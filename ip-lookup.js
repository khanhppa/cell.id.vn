/**
 * ip-lookup.js — Tra cứu địa chỉ IP qua NHIỀU nguồn, chuẩn hoá + tổng hợp.
 *
 * KIẾN TRÚC
 * ---------
 * 1. `SOURCE_DEFAULTS` là DANH MỤC TĨNH: mỗi loại nguồn có URL gốc mặc định,
 *    ưu tiên, timeout, thời gian cache và hàm `parse()` riêng. Thêm nguồn mới =
 *    thêm 1 entry ở đây (database.js tự seed row vào `ip_lookup_sources`).
 * 2. Cấu hình THAY ĐỔI ĐƯỢC (bật/tắt, key, plan, timeout, cache) nằm trong DB,
 *    bảng `ip_lookup_sources` — admin sửa ở trang quản trị, KHÔNG cần deploy.
 * 3. `runLookup()` chạy các nguồn SONG SONG, mỗi nguồn có timeout riêng và lỗi
 *    riêng: một nguồn chết/chậm không được làm hỏng kết quả của nguồn khác.
 * 4. Mọi phản hồi của nguồn được `parse()` đổi về CÙNG một hình dạng trường
 *    (xem `NORMALIZED_FIELDS`). Nhờ vậy UI chỉ cần một bảng và `aggregate()`
 *    đếm được mức đồng thuận giữa các nguồn.
 *
 * NGUYÊN TẮC
 * ----------
 * - KHÔNG bao giờ trả API key ra response (chỉ bản che `••••1234`).
 * - Cache ghi cả kết quả LỖI nhưng chỉ dùng lại tối đa 1 ngày: nguồn free đổi
 *   hạn mức/khôi phục dịch vụ thì hệ thống tự lành, không bị "dính" lỗi cũ.
 * - Hạn mức ngày tính theo mốc `ip_lookup_day_cutoff_hour` (giờ Việt Nam) để
 *   admin đặt giờ reset về đêm, tránh cắt ngang giờ cao điểm.
 */
const net = require('net');
const axios = require('axios');
const db = require('./database');

// ============================================================
// Trường chuẩn hoá — mọi nguồn phải quy về đây (thiếu thì bỏ trống)
// ============================================================
const NORMALIZED_FIELDS = [
  'ip', 'country', 'countryCode', 'continent', 'continentCode',
  'region', 'city', 'postal', 'lat', 'lon', 'timezone', 'gmtOffset',
  'asn', 'asnName', 'isp', 'org', 'domain', 'linkType', 'usageType',
  'isProxy', 'proxyType', 'isHosting', 'isMobile', 'threatLevel'
];

// Trường dùng để đếm "các nguồn đồng ý nhau" (so khớp dạng chuỗi, không phân
// biệt hoa/thường). `lat`/`lon` KHÔNG đưa vào đây vì mỗi nguồn lệch vài km —
// xem `aggregate()` (dùng trung vị thay vì bỏ phiếu).
const VOTED_FIELDS = [
  'country', 'countryCode', 'continent', 'region', 'city', 'postal',
  'timezone', 'asn', 'asnName', 'isp', 'org', 'domain'
];

const USER_AGENT = 'CellTracker-IPLookup/1.0 (+https://cell.id.vn)';
const DEFAULT_TIMEOUT_MS = 10000;
const MAX_TIMEOUT_MS = 60000;
const MIN_TIMEOUT_MS = 1000;

// ============================================================
// Danh mục nguồn
// ============================================================
// `requiresKey`: thiếu key thì KHÔNG gọi (tránh đốt request vô ích và tránh gửi
//   request rỗng lên nguồn trả 401 hàng loạt).
// `plan`: chỉ IPinfo dùng — 'lite' (miễn phí, country + ASN) hoặc 'core' (có
//   city/toạ độ/flags).
// `enabledDefault`: nguồn free không cần key bật sẵn; nguồn cần key phải do
//   admin nhập key rồi bật (tránh log đầy lỗi MISSING_KEY ngay sau khi cài).
const SOURCE_DEFAULTS = {
  dbip: {
    name: 'DB-IP',
    baseUrl: 'http://api.db-ip.com/v2',
    plan: 'lite',
    requiresKey: false,
    enabledDefault: true,
    priority: 10,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    cacheDays: 7,
    docsUrl: 'https://db-ip.com/api/doc.php',
    notes: 'Free API chạy trên HTTP (không HTTPS). Nhập API key để có city/toạ độ/ASN đầy đủ; '
      + 'key free bị giới hạn lượt/ngày, nên bật cache.',
    buildUrl(cfg, ip) {
      const base = trimBase(cfg.base_url) || this.baseUrl;
      const key = String(cfg.api_key || '').trim() || 'free';
      return `${base}/${encodeURIComponent(key)}/${ip}`;
    },
    parse(raw) {
      if (raw && raw.errorCode) throw new Error(dbIpError(raw));
      return pick({
        ip: raw.ipAddress,
        continent: raw.continentName, continentCode: raw.continentCode,
        country: raw.countryName, countryCode: raw.countryCode,
        region: raw.stateProv || raw.stateProvCode, city: raw.city, postal: raw.zipCode,
        lat: num(raw.latitude), lon: num(raw.longitude),
        timezone: raw.timeZone, gmtOffset: num(raw.gmtOffset),
        asn: raw.asNumber ? 'AS' + raw.asNumber : null,
        asnName: raw.asName, isp: raw.isp, org: raw.organization,
        linkType: raw.linkType, usageType: raw.usageType,
        isProxy: bool(raw.isProxy), proxyType: raw.proxyType, threatLevel: raw.threatLevel
      });
    }
  },

  // Bản FREE của DB-IP, tách riêng để admin bật/tắt độc lập và vì lý do pháp lý
  // (điều khoản free API cấm dùng thương mại) khác bản có key.
  dbip_free: {
    name: 'DB-IP (free)',
    baseUrl: 'http://api.db-ip.com/v2',
    plan: 'lite',
    requiresKey: false,
    enabledDefault: false,
    priority: 90,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    cacheDays: 7,
    docsUrl: 'https://db-ip.com/api/doc.php',
    notes: 'Chỉ dùng khi CHƯA có key DB-IP: bản free không có toạ độ/ASN và bị giới hạn lượt.',
    buildUrl(cfg, ip) {
      const base = trimBase(cfg.base_url) || this.baseUrl;
      return `${base}/free/${ip}`;
    },
    parse: (raw) => SOURCE_DEFAULTS.dbip.parse(raw)
  },

  ipinfo: {
    name: 'IPinfo',
    baseUrl: 'https://api.ipinfo.io',
    plan: 'lite',
    requiresKey: true,
    enabledDefault: false,
    priority: 20,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    cacheDays: 7,
    docsUrl: 'https://ipinfo.io/developers/lite-api',
    notes: 'Plan "lite" (miễn phí): country + ASN. Plan "core" (trả phí): city, toạ độ, '
      + 'timezone và các cờ is_mobile/is_hosting/is_anonymous.',
    buildUrl(cfg, ip) {
      const base = trimBase(cfg.base_url) || this.baseUrl;
      const plan = cfg.plan === 'core' ? 'lookup' : 'lite';
      return `${base}/${plan}/${ip}?token=${encodeURIComponent(String(cfg.api_key || '').trim())}`;
    },
    parse(raw, cfg) {
      // Lỗi của IPinfo nằm ở HTTP status + body { error: { title, message } }.
      if (raw && raw.error) {
        const e = raw.error;
        throw new Error(e.message || e.title || 'IPinfo trả lỗi');
      }
      if (!raw || (!raw.ip && !raw.geo)) throw new Error('IPinfo trả dữ liệu rỗng');
      const geo = raw.geo || {};
      const as = raw.as || {};
      const core = String(cfg.plan || 'lite') === 'core';
      return pick({
        ip: raw.ip,
        country: core ? geo.country : raw.country,
        countryCode: core ? geo.country_code : raw.country_code,
        continent: core ? geo.continent : raw.continent,
        continentCode: core ? geo.continent_code : raw.continent_code,
        region: geo.region, city: geo.city, postal: geo.postal_code,
        lat: num(geo.latitude), lon: num(geo.longitude), timezone: geo.timezone,
        asn: core ? as.asn : raw.asn,
        asnName: core ? as.name : raw.as_name,
        domain: core ? as.domain : raw.as_domain,
        org: core ? as.name : raw.as_name,
        isProxy: bool(raw.is_anonymous),
        isHosting: bool(raw.is_hosting),
        isMobile: bool(raw.is_mobile),
        // `as.type` mô tả loại mạng — ánh xạ sang usageType cho đồng nhất.
        usageType: core && as.type ? as.type : (raw.is_hosting ? 'hosting' : null)
      });
    }
  },

  ipwho_is: {
    name: 'ipwho.is',
    baseUrl: 'https://ipwho.is',
    plan: 'lite',
    requiresKey: false,
    enabledDefault: true,
    priority: 30,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    cacheDays: 3,
    docsUrl: 'https://ipwhois.io/documentation',
    notes: 'Miễn phí, không cần key, có city/toạ độ/ASN. Nguồn này giới hạn theo IP gọi nên '
      + 'nên giữ cache để không bị chặn.',
    buildUrl(cfg, ip) {
      const base = trimBase(cfg.base_url) || this.baseUrl;
      return `${base}/${ip}`;
    },
    parse(raw) {
      if (!raw || raw.success === false) {
        throw new Error((raw && (raw.message || raw.reason)) || 'ipwho.is không tìm thấy IP');
      }
      const conn = raw.connection || {};
      const tz = raw.timezone || {};
      return pick({
        ip: raw.ip,
        continent: raw.continent, continentCode: raw.continent_code,
        country: raw.country, countryCode: raw.country_code,
        region: raw.region, city: raw.city, postal: raw.postal,
        lat: num(raw.latitude), lon: num(raw.longitude),
        timezone: tz.id, gmtOffset: tz.offset == null ? null : Math.round(Number(tz.offset) / 3600),
        asn: conn.asn ? 'AS' + conn.asn : null,
        asnName: conn.org, isp: conn.isp, org: conn.org, domain: conn.domain
      });
    }
  },

  ipapi_is: {
    name: 'ipapi.is',
    baseUrl: 'https://api.ipapi.is',
    plan: 'lite',
    requiresKey: false,
    enabledDefault: true,
    priority: 40,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    cacheDays: 3,
    docsUrl: 'https://ipapi.is/',
    notes: 'Miễn phí có giới hạn lượt/ngày (không cần key). Trả cờ bogon — IP nội bộ vẫn '
      + 'tra được nhưng toạ độ là của nhà mạng, không phải thiết bị.',
    buildUrl(cfg, ip) {
      const base = trimBase(cfg.base_url) || this.baseUrl;
      return `${base}/?q=${ip}`;
    },
    parse(raw) {
      if (!raw || (!raw.ip && !raw.country)) throw new Error('ipapi.is trả dữ liệu rỗng');
      // `asn` dạng "AS15169 Google LLC" → tách số và tên.
      const asnRaw = String(raw.asn || '').trim();
      const m = asnRaw.match(/^(AS\d+)\s*(.*)$/i);
      return pick({
        ip: raw.ip,
        country: raw.country, countryCode: raw.cc || raw.country_code,
        region: raw.region, city: raw.city,
        lat: num(raw.lat), lon: num(raw.lon), timezone: raw.timezone,
        asn: m ? m[1] : (asnRaw || null),
        asnName: m ? (m[2] || raw.company) : raw.company,
        isp: raw.company, org: raw.company,
        isHosting: bool(raw.is_datacenter),
        isProxy: bool(raw.is_proxy) || bool(raw.is_vpn) || bool(raw.is_tor),
        isMobile: bool(raw.is_mobile),
        usageType: raw.is_datacenter ? 'hosting' : null
      });
    }
  },

  ip_api_com: {
    name: 'ip-api.com',
    baseUrl: 'http://ip-api.com',
    plan: 'lite',
    requiresKey: false,
    enabledDefault: true,
    priority: 50,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    cacheDays: 3,
    docsUrl: 'https://ip-api.com/docs/api:json',
    notes: 'Miễn phí nhưng CHỈ HTTP và giới hạn 45 request/phút cho mỗi IP máy chủ — '
      + 'cache là bắt buộc nếu lượng tra cao. Bật key (bản trả phí) bằng cách đổi base_url sang HTTPS.',
    buildUrl(cfg, ip) {
      const base = trimBase(cfg.base_url) || this.baseUrl;
      const fields = 'status,message,country,countryCode,region,regionName,city,zip,lat,lon,'
        + 'timezone,isp,org,as,asname,mobile,proxy,hosting,query';
      return `${base}/json/${ip}?fields=${fields}`;
    },
    parse(raw) {
      if (!raw || raw.status !== 'success') {
        throw new Error((raw && raw.message) || 'ip-api.com không tra được IP');
      }
      const asRaw = String(raw.as || '').trim();
      const m = asRaw.match(/^(AS\d+)\s*(.*)$/i);
      return pick({
        ip: raw.query,
        country: raw.country, countryCode: raw.countryCode,
        region: raw.regionName, city: raw.city, postal: raw.zip,
        lat: num(raw.lat), lon: num(raw.lon), timezone: raw.timezone,
        asn: m ? m[1] : (asRaw || null),
        asnName: m ? m[2] : raw.asname,
        isp: raw.isp, org: raw.org,
        isProxy: bool(raw.proxy), isHosting: bool(raw.hosting), isMobile: bool(raw.mobile),
        usageType: raw.hosting ? 'hosting' : null
      });
    }
  },

  freeipapi: {
    name: 'freeipapi.com',
    baseUrl: 'https://freeipapi.com',
    plan: 'lite',
    requiresKey: false,
    enabledDefault: true,
    priority: 60,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    cacheDays: 3,
    docsUrl: 'https://freeipapi.com/',
    notes: 'Miễn phí, không cần key. IP không hợp lệ vẫn trả HTTP 200 với toàn field null — '
      + 'module coi đó là lỗi, không phải "không xác định".',
    buildUrl(cfg, ip) {
      const base = trimBase(cfg.base_url) || this.baseUrl;
      return `${base}/api/json/${ip}`;
    },
    parse(raw) {
      if (!raw || !raw.ipAddress) throw new Error('freeipapi không có dữ liệu cho IP này');
      return pick({
        ip: raw.ipAddress,
        country: raw.countryName, countryCode: raw.countryCode,
        continent: raw.continent, continentCode: raw.continentCode,
        region: raw.regionName, city: raw.cityName, postal: raw.zipCode,
        lat: num(raw.latitude), lon: num(raw.longitude),
        timezone: Array.isArray(raw.timeZones) ? raw.timeZones[0] : null,
        asn: raw.asn ? 'AS' + raw.asn : null,
        asnName: raw.asnOrganization,
        isp: raw.asnOrganization, org: raw.asnOrganization,
        isProxy: bool(raw.isProxy), isHosting: bool(raw.isDatacenter),
        isMobile: bool(raw.isMobile)
      });
    }
  },

  iplocation_net: {
    name: 'iplocation.net',
    baseUrl: 'https://api.iplocation.net',
    plan: 'lite',
    requiresKey: false,
    enabledDefault: false,
    priority: 70,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    cacheDays: 3,
    docsUrl: 'https://www.iplocation.net/api',
    notes: 'Miễn phí nhưng chỉ có country + ISP (không city/toạ độ) — giá trị thấp, mặc định TẮT. '
      + 'Lỗi nằm trong `response_code`, không phải HTTP status.',
    buildUrl(cfg, ip) {
      const base = trimBase(cfg.base_url) || this.baseUrl;
      return `${base}/?ip=${ip}`;
    },
    parse(raw) {
      if (!raw) throw new Error('iplocation.net trả dữ liệu rỗng');
      if (String(raw.response_code) !== '200') {
        throw new Error(raw.response_message || 'iplocation.net không tra được IP');
      }
      return pick({
        ip: raw.ip,
        country: raw.country_name, countryCode: raw.country_code2,
        isp: raw.isp, org: raw.isp
      });
    }
  }
};

// Thứ tự gọi mặc định khi chưa có row trong DB (dùng cho test và làm fallback).
const SOURCE_ORDER = Object.keys(SOURCE_DEFAULTS).sort(
  (a, b) => SOURCE_DEFAULTS[a].priority - SOURCE_DEFAULTS[b].priority
);

// ============================================================
// Tiện ích nhỏ
// ============================================================
function trimBase(v) {
  return String(v == null ? '' : v).trim().replace(/\/+$/, '');
}

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function bool(v) {
  return v === true || v === 'true' || v === 1 || v === '1';
}

function clampInt(v, dflt, min, max) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, n));
}

/**
 * Gom các trường chuẩn hoá từ object thô của nguồn; BỎ trường null/undefined/''.
 *
 * `pick` cố tình không đưa `ip` rỗng vào kết quả: UI hiển thị dòng IP dựa trên
 * IP người dùng nhập, còn trường `ip` chỉ là "nguồn này nghĩ IP là gì" — khác
 * nhau (vd bản rút gọn IPv6) thì vẫn phải hiện.
 */
function pick(obj) {
  const out = {};
  for (const k of NORMALIZED_FIELDS) {
    const v = obj[k];
    if (v === null || v === undefined) continue;
    if (typeof v === 'string') {
      const s = v.trim();
      if (!s || s.toLowerCase() === 'null') continue;
      out[k] = s;
      continue;
    }
    out[k] = v;
  }
  return out;
}

/** Lỗi DB-IP → câu tiếng Việt đọc được + giữ mã gốc để admin đối chiếu tài liệu. */
function dbIpError(raw) {
  const code = String(raw.errorCode || 'ERROR');
  const map = {
    INVALID_KEY: 'API key DB-IP không hợp lệ',
    INVALID_ADDRESS: 'Địa chỉ IP không hợp lệ',
    HTTPS_NOT_ALLOWED: 'DB-IP free API không hỗ trợ HTTPS — đổi base_url về http://',
    TEMPORARY_BLOCKED: 'DB-IP tạm chặn do phát hiện truy cập bất thường — thử lại sau',
    TOO_MANY_ADDRESSES: 'Gửi quá nhiều địa chỉ trong một request DB-IP',
    OVER_QUERY_LIMIT: 'Đã hết hạn mức lượt tra của key DB-IP trong ngày',
    RESTRICTED: 'API key DB-IP không có quyền dùng endpoint này',
    EXPIRED: 'API key DB-IP đã hết hạn',
    UNAVAILABLE: 'DB-IP đang bảo trì/quá tải — thử lại sau'
  };
  return `${map[code] || (raw.error || 'DB-IP trả lỗi')} (${code})`;
}

// ============================================================
// Chuẩn hoá IP
// ============================================================
/**
 * Chuẩn hoá chuỗi người dùng nhập thành địa chỉ IP hợp lệ.
 *
 * Chấp nhận: IPv4, IPv6, IPv6 bọc ngoặc vuông `[::1]`. Từ chối: hostname, CIDR,
 * kèm port, chuỗi rỗng. Việc từ chối ở đây quan trọng vì URL nguồn được ghép
 * trực tiếp từ IP — chỉ nhận `net.isIP() === 4|6` mới chắc chắn không chèn được
 * path/query lạ.
 *
 * IPv6 được rút gọn bằng cách lowercase: cùng một địa chỉ gõ nhiều kiểu
 * (`2001:DB8::1`, `2001:db8:0:0::1`) sẽ trùng khoá cache.
 */
function normalizeIp(input) {
  let s = String(input == null ? '' : input).trim();
  if (!s) return { ok: false, error: 'Chưa nhập địa chỉ IP' };
  if (s.length > 64) return { ok: false, error: 'Địa chỉ IP quá dài' };
  if (/^\[.*\]$/.test(s)) s = s.slice(1, -1);
  // IPv4-mapped IPv6 (::ffff:1.2.3.4) — giữ nguyên, net.isIP nhận dạng 6.
  const version = net.isIP(s);
  if (!version) {
    return { ok: false, error: 'Địa chỉ IP không hợp lệ (chỉ nhận IPv4 hoặc IPv6, không nhận tên miền)' };
  }
  // IPv4-mapped IPv6 (::ffff:1.2.3.4) — net.isIP nhận dạng 6 nhưng NGƯỜI DÙNG
  // và nhật ký cần thấy địa chỉ IPv4 quen thuộc; đồng thời đổi về IPv4 để khoá
  // cache/hạn mức khớp với chính địa chỉ đó khi tra bằng IPv4 thuần.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(s);
  if (mapped && net.isIP(mapped[1]) === 4) {
    return { ok: true, ip: mapped[1], version: 4 };
  }
  if (version === 6) return { ok: true, ip: s.toLowerCase(), version: 6 };
  return { ok: true, ip: s, version: 4 };
}

// ============================================================
// Hạn mức ngày (mốc reset theo giờ Việt Nam)
// ============================================================
// Asia/Ho_Chi_Minh không có DST → dùng offset cố định +07 thay vì phụ thuộc ICU
// của Node (máy chủ có thể build small-icu, thiếu timezone database).
const VN_OFFSET_MS = 7 * 3600 * 1000;

/**
 * Mốc bắt đầu "ngày hạn mức" gần nhất, dạng chuỗi UTC để so với
 * `created_at`/`last_at` của SQLite (`CURRENT_TIMESTAMP` cũng là UTC).
 *
 * Ví dụ cutoff = 2 (02:00 giờ VN): lúc 01:30 ngày 23 → ngày hạn mức bắt đầu từ
 * 02:00 ngày 22 (chưa reset); lúc 02:01 → bắt đầu từ 02:00 ngày 23 (đã reset).
 */
function quotaWindowStart(cutoffHour) {
  const cutoff = clampInt(cutoffHour, 2, 0, 23);
  const nowMs = Date.now();
  const localMs = nowMs + VN_OFFSET_MS;
  const localHour = Math.floor((localMs % 86400000) / 3600000);
  let midnightLocal = Math.floor(localMs / 86400000) * 86400000;
  if (localHour < cutoff) midnightLocal -= 86400000;
  const startMs = midnightLocal + cutoff * 3600000 - VN_OFFSET_MS;
  return { ms: startMs, sql: toSqlUtc(startMs) };
}

/** ms → 'YYYY-MM-DD HH:MM:SS' (UTC), đúng định dạng SQLite CURRENT_TIMESTAMP. */
function toSqlUtc(ms) {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

/** SQLite trả 'YYYY-MM-DD HH:MM:SS' (UTC, không hậu tố) → ms. */
function parseSqlUtc(v) {
  if (!v) return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

// ============================================================
// Wrapper DB (Promise)
// ============================================================
const all = (sql, params = []) => new Promise((resolve, reject) =>
  db.all(sql, params, (e, rows) => (e ? reject(e) : resolve(rows || []))));
const get = (sql, params = []) => new Promise((resolve, reject) =>
  db.get(sql, params, (e, row) => (e ? reject(e) : resolve(row || null))));
const run = (sql, params = []) => new Promise((resolve, reject) =>
  db.run(sql, params, function (e) { return e ? reject(e) : resolve(this); }));

async function getSetting(key, dflt) {
  const row = await get('SELECT value FROM settings WHERE key = ?', [key]).catch(() => null);
  return row && row.value !== null && row.value !== undefined ? row.value : dflt;
}
async function setSetting(key, value) {
  await run(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    [key, value == null ? '' : String(value)]);
}

// ============================================================
// Cấu hình công khai (cho trang /tools/ip-lookup.html)
// ============================================================
async function getConfig() {
  const [publicEnabled, guestDaily, userDaily, consoleEnabled, consolePerDay, cutoff] = await Promise.all([
    getSetting('ip_lookup_public_enabled', '1'),
    getSetting('ip_lookup_public_guest_daily', '1'),
    getSetting('ip_lookup_user_daily', '50'),
    getSetting('ip_lookup_console_enabled', '0'),
    getSetting('ip_lookup_console_per_day', '1000'),
    getSetting('ip_lookup_day_cutoff_hour', '2')
  ]);
  return {
    public_enabled: String(publicEnabled) === '1',
    guest_daily: clampInt(guestDaily, 1, 0, 1000),
    user_daily: clampInt(userDaily, 50, 0, 100000),
    console_enabled: String(consoleEnabled) === '1',
    console_per_day: clampInt(consolePerDay, 1000, 0, 1000000),
    day_cutoff_hour: clampInt(cutoff, 2, 0, 23)
  };
}

// ============================================================
// Đọc danh mục nguồn
// ============================================================
/** Chuẩn hoá row DB thành cấu hình nguồn dùng được (giữ nguyên id để admin sửa). */
function toSourceConfig(row) {
  const def = SOURCE_DEFAULTS[row.type];
  if (!def) return null;
  return {
    id: row.id,
    type: row.type,
    name: String(row.name || def.name).trim() || def.name,
    label: def.name,
    base_url: row.base_url || '',
    api_key: row.api_key || '',
    plan: row.plan === 'core' ? 'core' : 'lite',
    enabled: !!Number(row.enabled),
    priority: Number(row.priority) || def.priority,
    timeout_ms: clampInt(row.timeout_ms, def.timeoutMs, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS),
    cache_days: clampInt(row.cache_days, def.cacheDays, 0, 365),
    notes: row.notes || '',
    requiresKey: def.requiresKey,
    docsUrl: def.docsUrl,
    buildUrl: def.buildUrl,
    parse: def.parse
  };
}

/** Mọi nguồn trong DB, sắp theo ưu tiên (nhỏ trước). */
async function listSources() {
  const rows = await all('SELECT * FROM ip_lookup_sources ORDER BY priority ASC, id ASC');
  const out = [];
  for (const r of rows) {
    const cfg = toSourceConfig(r);
    if (cfg) out.push(cfg); // row của type lạ (đã xoá khỏi danh mục) → bỏ qua
  }
  return out;
}

/** Chỉ nguồn đang bật. */
async function listEnabledSources() {
  return (await listSources()).filter(s => s.enabled);
}

/**
 * Nguồn có được coi là "sẵn sàng" không. Nguồn cần key mà chưa nhập key thì
 * KHÔNG gọi mạng (tránh 401 hàng loạt) — runLookup trả lỗi rõ ràng thay vào đó.
 */
function isReady(src) {
  if (!src) return { ready: false, error: 'Nguồn không tồn tại' };
  if (src.requiresKey && !String(src.api_key || '').trim()) {
    return { ready: false, error: `Chưa cấu hình API key cho ${src.name}` };
  }
  return { ready: true };
}

// ============================================================
// Cache
// ============================================================
/**
 * Đọc cache còn hạn. Trả `null` nếu không có / đã hết hạn.
 *
 * Kết quả LỖI (ok = 0) chỉ được dùng lại tối đa 1 ngày (hoặc `cache_days` nếu
 * nhỏ hơn): nguồn free hết quota hôm nay có thể đã hoạt động lại ngày mai, cache
 * lỗi quá lâu sẽ khiến hệ thống "tưởng" nguồn chết.
 */
async function readCache(normalized, sourceType, cacheDays) {
  if (cacheDays <= 0) return null;
  const row = await get(
    'SELECT * FROM ip_lookup_cache WHERE normalized = ? AND source_type = ?',
    [normalized, sourceType]).catch(() => null);
  if (!row) return null;
  const fetched = parseSqlUtc(row.fetched_at);
  if (fetched === null) return null;
  const days = Number(row.ok) ? cacheDays : Math.min(cacheDays, 1);
  const ageMs = Date.now() - fetched;
  if (ageMs > days * 86400000) return null;
  let data = null;
  if (row.data_json) {
    try { data = JSON.parse(row.data_json); } catch (e) { return null; }
  }
  return {
    ok: !!Number(row.ok),
    data,
    error: row.error || null,
    fetchedAt: row.fetched_at,
    ageMs
  };
}

/** Ghi/đè cache cho 1 cặp (IP, nguồn). Lỗi DB không được làm hỏng kết quả trả về. */
async function writeCache(normalized, sourceType, rawIp, result) {
  try {
    await run(`INSERT INTO ip_lookup_cache (ip, normalized, source_type, data_json, ok, error, fetched_at)
               VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
               ON CONFLICT(normalized, source_type) DO UPDATE SET
                 ip = excluded.ip, data_json = excluded.data_json, ok = excluded.ok,
                 error = excluded.error, fetched_at = CURRENT_TIMESTAMP`,
      [rawIp, normalized, sourceType,
        result.ok ? JSON.stringify(result.data || {}) : null,
        result.ok ? 1 : 0,
        result.ok ? null : String(result.error || '').slice(0, 300)]);
  } catch (e) { /* cache là tối ưu, không phải điều kiện đúng */ }
}

// ============================================================
// Nhận diện IP nội bộ / không định tuyến ra Internet
// ============================================================
/**
 * IP có thuộc dải RIÊNG TƯ/không dùng trên Internet không.
 *
 * Cần cho nút "IP của tôi": khi chạy local, request đến từ `127.0.0.1`/`::1`
 * (hoặc LAN 192.168.x) — dán địa chỉ đó vào ô tra cứu là vô nghĩa, các nguồn
 * sẽ trả "không có dữ liệu" hoặc thông tin của nhà mạng. Vì vậy route `/me`
 * đánh dấu `private` để client bỏ qua và tự dò IP WAN bằng dịch vụ ngoài.
 *
 * Không phải IP hợp lệ → trả false (không kết luận thay cho người gọi).
 */
function isPrivateIp(ip) {
  const norm = normalizeIp(ip);
  if (!norm.ok) return false;
  const s = norm.ip;
  if (norm.version === 4) {
    const p = s.split('.').map(Number);
    if (p[0] === 10) return true;                       // 10/8
    if (p[0] === 127) return true;                      // loopback
    if (p[0] === 0) return true;                        // 0/8
    if (p[0] === 169 && p[1] === 254) return true;      // link-local
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true; // 172.16/12
    if (p[0] === 192 && p[1] === 168) return true;      // 192.168/16
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true; // CGNAT 100.64/10
    if (p[0] === 192 && p[1] === 0 && p[2] === 2) return true;  // TEST-NET-1
    if (p[0] >= 224) return true;                       // multicast + reserved
    return false;
  }
  const v = s.toLowerCase();
  if (v === '::1' || v === '::') return true;
  if (/^fe[89ab]/.test(v)) return true;                 // fe80::/10 link-local
  if (/^f[cd]/.test(v)) return true;                    // fc00::/7 ULA
  if (/^ff/.test(v)) return true;                       // multicast
  if (/^2001:0?db8:/.test(v)) return true;              // documentation 2001:db8::/32
  return false;
}

// ============================================================
// Gọi 1 nguồn
// ============================================================
const http = axios.create({
  timeout: DEFAULT_TIMEOUT_MS,
  // Nguồn trả 4xx/5xx vẫn cần đọc body để lấy thông báo lỗi thật.
  validateStatus: () => true,
  headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  // Nguồn free hay trả 301/302 sang HTTPS; theo 2 bước là đủ, tránh vòng lặp.
  maxRedirects: 2,
  // Không ném lỗi theo status — tự quyết định theo body.
  responseType: 'json',
  transitional: { silentJSONParsing: true }
});

/**
 * Tra 1 nguồn cho 1 IP (có cache).
 * @returns {Promise<{source,label,ok,data,error,cached,ms,url?}>}
 *   KHÔNG ném lỗi — mọi lỗi được gói vào `ok:false` để `Promise.all` không gãy.
 */
async function lookupOne(src, normalizedIp, { skipCache = false, cacheDays } = {}) {
  const started = Date.now();
  const days = cacheDays == null ? src.cache_days : cacheDays;

  if (!skipCache) {
    const hit = await readCache(normalizedIp, src.type, days);
    if (hit) {
      return {
        source: src.type, label: src.name, ok: hit.ok, cached: true,
        data: hit.data, error: hit.error, ms: Date.now() - started,
        fetchedAt: hit.fetchedAt
      };
    }
  }

  const ready = isReady(src);
  if (!ready.ready) {
    await writeCache(normalizedIp, src.type, normalizedIp, { ok: false, error: ready.error });
    return {
      source: src.type, label: src.name, ok: false, cached: false,
      data: null, error: ready.error, ms: Date.now() - started
    };
  }

  const url = src.buildUrl(src, normalizedIp);
  // Không log URL đầy đủ: IPinfo nhận token trong query string.
  let res;
  try {
    res = await http.get(url, { timeout: src.timeout_ms });
  } catch (e) {
    const msg = e.code === 'ECONNABORTED' || /timeout/i.test(e.message)
      ? `${src.name} không phản hồi trong ${src.timeout_ms}ms`
      : `Không kết nối được ${src.name}: ${e.message}`;
    noteSourceError(src.type, msg);
    await writeCache(normalizedIp, src.type, normalizedIp, { ok: false, error: msg });
    return { source: src.type, label: src.name, ok: false, cached: false, data: null, error: msg, ms: Date.now() - started };
  }

  const status = res.status;
  if (status >= 400) {
    const msg = `${src.name} trả HTTP ${status}`;
    noteSourceError(src.type, msg);
    await writeCache(normalizedIp, src.type, normalizedIp, { ok: false, error: msg });
    return { source: src.type, label: src.name, ok: false, cached: false, data: null, error: msg, ms: Date.now() - started };
  }

  let data;
  try {
    data = src.parse(res.data, src);
  } catch (e) {
    const msg = e.message || 'Dữ liệu nguồn không đọc được';
    noteSourceError(src.type, msg);
    await writeCache(normalizedIp, src.type, normalizedIp, { ok: false, error: msg });
    return { source: src.type, label: src.name, ok: false, cached: false, data: null, error: msg, ms: Date.now() - started };
  }

  clearSourceError(src.type);
  await writeCache(normalizedIp, src.type, normalizedIp, { ok: true, data });
  return {
    source: src.type, label: src.name, ok: true, cached: false,
    data, error: null, ms: Date.now() - started
  };
}

// ============================================================
// Lỗi gần nhất theo nguồn (in-memory) — admin thấy vì sao bật mà không ra data
// ============================================================
const lastErrors = new Map();
const ERROR_MAX_LEN = 300;

function noteSourceError(type, message) {
  lastErrors.set(type, {
    message: String(message == null ? '' : message).replace(/[\r\n]+/g, ' ').slice(0, ERROR_MAX_LEN),
    at: new Date().toISOString()
  });
}
function clearSourceError(type) {
  lastErrors.delete(type);
}
function getSourceError(type) {
  const e = lastErrors.get(type);
  return e ? { message: e.message, at: e.at } : null;
}

// ============================================================
// Tổng hợp kết quả nhiều nguồn
// ============================================================
/**
 * Bỏ phiếu cho từng trường trong `VOTED_FIELDS`.
 *
 * Cách chọn: giá trị xuất hiện nhiều nguồn nhất (so khớp không phân biệt hoa/
 * thường và khoảng trắng thừa); hoà phiếu thì lấy giá trị của nguồn có ưu tiên
 * cao hơn (`results` đã sắp theo ưu tiên). Kết quả kèm `votes` để UI hiển thị
 * "3/5 nguồn đồng ý" — người đọc tự đánh giá độ tin cậy, không bị ép tin một
 * con số duy nhất.
 */
function voteField(results, field) {
  const tally = new Map(); // key chuẩn hoá -> { value, count, sources[] }
  let firstIdx = 0;
  for (const r of results) {
    if (!r.ok || !r.data) continue;
    const raw = r.data[field];
    if (raw === null || raw === undefined || raw === '') continue;
    const value = String(raw).trim();
    if (!value) continue;
    const key = value.toLowerCase();
    let entry = tally.get(key);
    if (!entry) {
      entry = { value, count: 0, sources: [], bestIdx: firstIdx };
      tally.set(key, entry);
    }
    entry.count++;
    entry.sources.push(r.source);
    firstIdx++;
  }
  if (!tally.size) return null;
  const entries = Array.from(tally.values()).sort((a, b) =>
    (b.count - a.count) || (a.bestIdx - b.bestIdx));
  return {
    value: entries[0].value,
    count: entries[0].count,
    sources: entries[0].sources,
    alternatives: entries.slice(1, 4).map(e => ({ value: e.value, count: e.count }))
  };
}

/** Trung vị (mảng đã lọc số hợp lệ). Toạ độ dùng trung vị vì 1 nguồn sai lệch lớn không kéo lệch cả nhóm. */
function median(values) {
  if (!values.length) return null;
  const s = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Tổng hợp: chọn giá trị đa số cho các trường dạng chuỗi, trung vị cho toạ độ,
 * cộng cờ hợp nhất (isProxy/isHosting/isMobile: TRUE nếu BẤT KỲ nguồn nào nói
 * true — bỏ sót proxy rủi ro hơn báo nhầm).
 */
function aggregate(results) {
  const ok = results.filter(r => r.ok && r.data);
  const fields = {};
  for (const f of VOTED_FIELDS) {
    const v = voteField(results, f);
    if (v) fields[f] = v;
  }

  const lats = ok.map(r => r.data.lat).filter(v => typeof v === 'number' && Number.isFinite(v));
  const lons = ok.map(r => r.data.lon).filter(v => typeof v === 'number' && Number.isFinite(v));
  const lat = median(lats);
  const lon = median(lons);

  const unifiedFlags = {};
  for (const f of ['isProxy', 'isHosting', 'isMobile']) {
    const yes = ok.filter(r => r.data[f] === true).map(r => r.source);
    if (yes.length) unifiedFlags[f] = { value: true, sources: yes };
  }
  const proxyTypes = ok.map(r => r.data.proxyType).filter(Boolean);

  // Độ đồng ý = trung bình tỉ lệ phiếu của trường "country" và "asn" (2 trường
  // quan trọng nhất khi đối chiếu). Không có phiếu nào → 0.
  const ratio = (f) => {
    const v = fields[f];
    if (!v) return null;
    return v.count / ok.length;
  };
  const ratios = [ratio('country'), ratio('asn')].filter(v => v !== null);
  const agreement = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0;

  return {
    sources_total: results.length,
    sources_ok: ok.length,
    agreement: Math.round(agreement * 100) / 100,
    fields,
    lat, lon,
    coordinates: ok.filter(r => typeof r.data.lat === 'number' && typeof r.data.lon === 'number')
      .map(r => ({ source: r.source, lat: r.data.lat, lon: r.data.lon })),
    flags: unifiedFlags,
    proxyTypes: Array.from(new Set(proxyTypes)),
    ipVersions: Array.from(new Set(ok.map(r => (r.data.ip && r.data.ip.includes(':') ? 6 : 4))))
  };
}

// ============================================================
// Chạy tra cứu
// ============================================================
/**
 * Tra 1 IP qua các nguồn đã chọn.
 *
 * @param {object} opts
 * @param {string} opts.ip           IP người dùng nhập (đã/chuẩn bị chuẩn hoá)
 * @param {string[]} [opts.types]    giới hạn loại nguồn (giao với nguồn đang bật)
 * @param {boolean} [opts.includeDisabled] admin chạy thử cả nguồn đang tắt
 * @param {boolean} [opts.skipCache] admin cần dữ liệu tươi
 * @param {boolean} [opts.publicOnly] chỉ nguồn KHÔNG cần key (route cho khách)
 * @returns {Promise<{ok:boolean, error?:string, ip?:string, results?:Array, aggregate?:object}>}
 */
async function runLookup({ ip, types, includeDisabled = false, skipCache = false, publicOnly = false } = {}) {
  const norm = normalizeIp(ip);
  if (!norm.ok) return { ok: false, error: norm.error };

  let sources = await listSources();
  if (!includeDisabled) sources = sources.filter(s => s.enabled);
  if (publicOnly) sources = sources.filter(s => !s.requiresKey);
  if (Array.isArray(types) && types.length) {
    const want = new Set(types.map(t => String(t).trim()).filter(Boolean));
    sources = sources.filter(s => want.has(s.type));
  }
  if (!sources.length) {
    return {
      ok: false,
      error: 'Không có nguồn tra cứu IP nào đang bật (hoặc chưa cấu hình API key cho nguồn cần key)',
      ip: norm.ip
    };
  }

  // dbip_free chỉ có nghĩa khi CHƯA có key DB-IP. Nếu admin đã nhập key thì bỏ
  // qua bản free để không tốn thêm một lượt gọi vào cùng nhà cung cấp.
  const dbipWithKey = sources.some(s => s.type === 'dbip' && String(s.api_key || '').trim());
  if (dbipWithKey) sources = sources.filter(s => s.type !== 'dbip_free');

  const started = Date.now();
  const results = await Promise.all(sources.map(src =>
    lookupOne(src, norm.ip, { skipCache })
      .catch(e => ({
        source: src.type, label: src.name, ok: false, cached: false,
        data: null, error: e.message || 'Lỗi không xác định', ms: 0
      }))));

  // Giữ thứ tự ưu tiên khi trả về (Promise.all giữ nguyên thứ tự mảng đầu vào).
  return {
    ok: true,
    ip: norm.ip,
    ipVersion: norm.version,
    durationMs: Date.now() - started,
    results,
    aggregate: aggregate(results),
    cacheHits: results.filter(r => r.cached).length
  };
}

/** Kiểm tra 1 nguồn bằng IP mẫu (mặc định 8.8.8.8) — dùng cho nút "Test" của admin. */
async function testSource(type, { ip = '8.8.8.8', skipCache = true } = {}) {
  const sources = await listSources();
  const src = sources.find(s => s.type === type);
  if (!src) return { ok: false, error: 'Không tìm thấy nguồn ' + type };
  const norm = normalizeIp(ip);
  if (!norm.ok) return { ok: false, error: norm.error };
  const r = await lookupOne(src, norm.ip, { skipCache });
  return { ok: r.ok, type, label: src.name, ip: norm.ip, data: r.data, error: r.error, ms: r.ms };
}

/**
 * IP công khai của CHÍNH MÁY CHỦ (nguồn ngoài nhìn thấy).
 *
 * Dùng ipwho.is với path rỗng: nguồn tự nhận diện IP người gọi. Không qua cache —
 * IP của máy chủ có thể đổi khi VPS restart/đổi NAT, cache sẽ trả số cũ sai.
 */
async function lookupSelf({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const def = SOURCE_DEFAULTS.ipwho_is;
  try {
    const res = await http.get(`${trimBase(def.baseUrl)}/`, { timeout: timeoutMs });
    if (res.status >= 400) throw new Error(`ipwho.is trả HTTP ${res.status}`);
    const data = def.parse(res.data);
    if (!data.ip) throw new Error('ipwho.is không trả IP máy chủ');
    return { ok: true, ip: data.ip, data, source: 'ipwho_is' };
  } catch (e) {
    return { ok: false, error: e.message || 'Không lấy được IP máy chủ' };
  }
}

/**
 * Bản công khai của 1 nguồn — KHÔNG chứa `api_key`, `buildUrl`, `parse`.
 * Dùng cho response admin (form sửa chỉ cần metadata), tránh vô tình trả key thô.
 */
function publicSource(src) {
  if (!src) return null;
  return {
    id: src.id, type: src.type, name: src.name, label: src.label,
    base_url: src.base_url, plan: src.plan, enabled: src.enabled,
    priority: src.priority, timeout_ms: src.timeout_ms, cache_days: src.cache_days,
    notes: src.notes, requires_key: src.requiresKey, docs_url: src.docsUrl || null
  };
}

// ============================================================
// Nhật ký + hạn mức
// ============================================================
/**
 * Ghi 1 lượt tra. Fire-and-forget nhưng trả Promise để test chờ được.
 * `ip_address` = IP của NGƯỜI GỌI (để truy vết lạm dụng), `ip` = IP bị tra.
 */
function logLookup({ userId, ip, normalized, sourceTypes, status, durationMs, cacheHits, error, ipAddress, userAgent }) {
  return run(`INSERT INTO ip_lookup_logs
      (user_id, ip, normalized, source_types, status, duration_ms, cache_hits, error, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId == null ? null : Number(userId), ip || null, normalized || null,
      Array.isArray(sourceTypes) ? sourceTypes.join(',') : (sourceTypes || null),
      status == null ? null : Number(status),
      durationMs == null ? null : Math.round(Number(durationMs)),
      cacheHits == null ? 0 : Number(cacheHits),
      error ? String(error).slice(0, 500) : null,
      ipAddress || null, userAgent ? String(userAgent).slice(0, 300) : null])
    .catch(() => { /* log hỏng không được làm hỏng API */ });
}

/** Số lượt tra của 1 user trong "ngày hạn mức" hiện tại. */
async function countUserLookups(userId, cutoffHour) {
  if (userId == null) return 0;
  const win = quotaWindowStart(cutoffHour);
  const row = await get(
    `SELECT COUNT(*) AS c FROM ip_lookup_logs
     WHERE user_id = ? AND created_at >= ?`, [Number(userId), win.sql]).catch(() => null);
  return row ? Number(row.c) || 0 : 0;
}

/**
 * Hạn mức khách theo IP người gọi: trả về trạng thái + (tuỳ chọn) tiêu 1 lượt.
 * Bộ đếm reset theo `cutoffHour`, không theo lịch sử log (khách không có log
 * user_id nên đếm riêng ở `ip_guest_trials`).
 */
async function guestQuota(ipAddress, { limit, cutoffHour, consume = false } = {}) {
  const key = String(ipAddress || '').trim();
  const max = clampInt(limit, 1, 0, 1000);
  // limit = 0 → KHÔNG giới hạn: không đếm, không chặn (admin tắt hạn mức).
  if (max === 0) return { allowed: true, used: 0, limit: 0, remaining: 0 };
  if (!key) return { allowed: true, used: 0, limit: max, remaining: max };
  const win = quotaWindowStart(cutoffHour);
  const row = await get('SELECT * FROM ip_guest_trials WHERE normalized_ip = ?', [key]).catch(() => null);
  const lastAt = row ? parseSqlUtc(row.last_at) : null;
  let used = row && lastAt !== null && lastAt >= win.ms ? Number(row.count) || 0 : 0;
  const allowed = used < max;

  if (consume && allowed) {
    used += 1;
    await run(`INSERT INTO ip_guest_trials (normalized_ip, ip, count, first_at, last_at)
               VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
               ON CONFLICT(normalized_ip) DO UPDATE SET
                 count = CASE WHEN last_at < ? THEN 1 ELSE count + 1 END,
                 ip = excluded.ip,
                 first_at = CASE WHEN last_at < ? THEN CURRENT_TIMESTAMP ELSE first_at END,
                 last_at = CURRENT_TIMESTAMP`,
      [key, key, win.sql, win.sql]).catch(() => {});
  }
  return { allowed, used, limit: max, remaining: Math.max(0, max - used) };
}

// ============================================================
// Dọn dẹp
// ============================================================
async function pruneCache(days = 30) {
  const d = clampInt(days, 30, 1, 3650);
  const r = await run(`DELETE FROM ip_lookup_cache WHERE fetched_at < datetime('now', ?)`,
    [`-${d} days`]).catch(() => null);
  return r ? r.changes || 0 : 0;
}

async function pruneLogs(days = 30) {
  const d = clampInt(days, 30, 1, 3650);
  const r = await run(`DELETE FROM ip_lookup_logs WHERE created_at < datetime('now', ?)`,
    [`-${d} days`]).catch(() => null);
  return r ? r.changes || 0 : 0;
}

/** Xoá cache của 1 IP (admin cần dữ liệu tươi ngay). */
async function clearCacheFor(normalized) {
  if (!normalized) return 0;
  const r = await run('DELETE FROM ip_lookup_cache WHERE normalized = ?', [normalized]).catch(() => null);
  return r ? r.changes || 0 : 0;
}

// ============================================================
// Thống kê cho admin
// ============================================================
async function stats() {
  const one = (sql, params = []) => get(sql, params).catch(() => null);
  const [totals, day, bySource, topIps] = await Promise.all([
    one(`SELECT COUNT(*) AS requests,
                SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) AS errors,
                SUM(COALESCE(cache_hits, 0)) AS cache_hits,
                COUNT(DISTINCT normalized) AS distinct_ips
         FROM ip_lookup_logs`),
    one(`SELECT COUNT(*) AS requests,
                SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) AS errors,
                SUM(COALESCE(cache_hits, 0)) AS cache_hits
         FROM ip_lookup_logs WHERE created_at >= datetime('now','-1 day')`),
    all(`SELECT source_types, COUNT(*) AS c FROM ip_lookup_logs
         WHERE source_types IS NOT NULL AND source_types <> ''
         GROUP BY source_types ORDER BY c DESC LIMIT 10`).catch(() => []),
    all(`SELECT normalized, COUNT(*) AS c FROM ip_lookup_logs
         WHERE normalized IS NOT NULL GROUP BY normalized ORDER BY c DESC LIMIT 10`).catch(() => [])
  ]);

  // `source_types` là chuỗi "a,b,c" → tách ra đếm theo từng nguồn.
  const sourceCounts = new Map();
  for (const row of bySource) {
    for (const t of String(row.source_types || '').split(',')) {
      const k = t.trim();
      if (k) sourceCounts.set(k, (sourceCounts.get(k) || 0) + Number(row.c || 0));
    }
  }
  const perSource = Array.from(sourceCounts.entries())
    .map(([type, count]) => ({
      type,
      label: (SOURCE_DEFAULTS[type] && SOURCE_DEFAULTS[type].name) || type,
      count,
      last_error: getSourceError(type)
    }))
    .sort((a, b) => b.count - a.count);

  return {
    total: {
      requests: Number(totals && totals.requests) || 0,
      errors: Number(totals && totals.errors) || 0,
      cache_hits: Number(totals && totals.cache_hits) || 0,
      distinct_ips: Number(totals && totals.distinct_ips) || 0
    },
    last24h: {
      requests: Number(day && day.requests) || 0,
      errors: Number(day && day.errors) || 0,
      cache_hits: Number(day && day.cache_hits) || 0
    },
    sources: perSource,
    topIps: topIps.map(r => ({ ip: r.normalized, count: Number(r.c) || 0 })),
    cached_rows: Number((await get('SELECT COUNT(*) AS c FROM ip_lookup_cache').catch(() => null) || {}).c) || 0
  };
}

/** Nhật ký gần đây (join username). */
async function listLogs({ ip, source, limit = 200 } = {}) {
  const lim = clampInt(limit, 200, 1, 2000);
  const where = [];
  const params = [];
  if (ip) { where.push('l.normalized = ?'); params.push(String(ip).trim()); }
  if (source) { where.push("(',' || l.source_types || ',') LIKE ?"); params.push(`%,${source},%`); }
  params.push(lim);
  return all(`SELECT l.*, u.username
              FROM ip_lookup_logs l LEFT JOIN users u ON u.id = l.user_id
              ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
              ORDER BY l.id DESC LIMIT ?`, params).catch(() => []);
}

// ============================================================
// Quản trị nguồn (CREATE / UPDATE / DELETE / REORDER)
// ============================================================
function maskSecret(v) {
  const s = String(v || '');
  if (!s) return '';
  return s.length <= 4 ? '••••' : '••••' + s.slice(-4);
}
function isMaskedValue(v) {
  const s = String(v == null ? '' : v).trim();
  return s === '' || s.startsWith('••••');
}

/** Danh sách cho admin: kèm bản che key, cờ đã cấu hình, lỗi gần nhất. */
async function listSourcesForAdmin() {
  const sources = await listSources();
  const rows = await all('SELECT id, api_key FROM ip_lookup_sources').catch(() => []);
  const keys = new Map(rows.map(r => [Number(r.id), r.api_key || '']));
  return sources.map(s => {
    const key = keys.get(Number(s.id)) || '';
    const err = getSourceError(s.type);
    return {
      id: s.id, type: s.type, name: s.name, label: s.label,
      base_url: s.base_url, plan: s.plan, enabled: s.enabled, priority: s.priority,
      timeout_ms: s.timeout_ms, cache_days: s.cache_days, notes: s.notes,
      requires_key: s.requiresKey, docs_url: s.docsUrl || null,
      api_key_masked: key ? maskSecret(key) : '',
      api_key_set: !!key.trim(),
      last_error: err ? err.message : null,
      last_error_at: err ? err.at : null
    };
  });
}

/** Thêm 1 nguồn theo type có trong danh mục (mỗi type 1 row). */
async function addSource(type) {
  const key = String(type || '').trim();
  const def = SOURCE_DEFAULTS[key];
  if (!def) return { ok: false, error: 'Loại nguồn không hỗ trợ: ' + key };
  const exists = await get('SELECT id FROM ip_lookup_sources WHERE type = ?', [key]);
  if (exists) return { ok: false, error: 'Nguồn này đã có trong danh sách' };
  const r = await run(`INSERT INTO ip_lookup_sources
      (type, name, base_url, api_key, plan, enabled, priority, timeout_ms, cache_days, notes)
      VALUES (?, ?, ?, '', ?, 0, ?, ?, ?, ?)`,
    [key, def.name, def.baseUrl, def.plan || 'lite', def.priority, def.timeoutMs, def.cacheDays, def.notes || '']);
  const row = await get('SELECT * FROM ip_lookup_sources WHERE id = ?', [r.lastID]);
  return { ok: true, source: toSourceConfig(row) };
}

/**
 * Cập nhật cấu hình nguồn. Chỉ nhận trường cho phép — KHÔNG cho đổi `type`
 * (đổi type = đổi nguồn, phải xoá rồi thêm).
 *
 * `api_key` rỗng hoặc bản che `••••` nghĩa là GIỮ NGUYÊN key cũ: form admin luôn
 * gửi lại placeholder đã che, không được coi đó là ý định xoá key.
 */
async function updateSource(id, patch = {}) {
  const row = await get('SELECT * FROM ip_lookup_sources WHERE id = ?', [Number(id)]);
  if (!row) return { ok: false, error: 'Không tìm thấy nguồn' };
  const def = SOURCE_DEFAULTS[row.type];
  if (!def) return { ok: false, error: 'Nguồn không còn trong danh mục hỗ trợ' };

  const sets = [];
  const params = [];
  if (patch.name !== undefined) {
    const n = String(patch.name).trim();
    if (!n) return { ok: false, error: 'Tên nguồn không được để trống' };
    if (n.length > 100) return { ok: false, error: 'Tên nguồn tối đa 100 ký tự' };
    sets.push('name = ?'); params.push(n);
  }
  if (patch.base_url !== undefined) {
    const b = String(patch.base_url || '').trim();
    if (b && !/^https?:\/\/[^\s]+$/i.test(b)) return { ok: false, error: 'base_url phải là URL http(s)' };
    // Cảnh báo bảo mật: DB-IP free và ip-api.com free chỉ chạy HTTP.
    sets.push('base_url = ?'); params.push(b);
  }
  if (patch.api_key !== undefined && !isMaskedValue(patch.api_key)) {
    sets.push('api_key = ?'); params.push(String(patch.api_key).trim());
  }
  if (patch.plan !== undefined) {
    const p = String(patch.plan || '').toLowerCase();
    if (!['lite', 'core'].includes(p)) return { ok: false, error: 'plan phải là lite hoặc core' };
    sets.push('plan = ?'); params.push(p);
  }
  if (patch.enabled !== undefined) { sets.push('enabled = ?'); params.push(patch.enabled ? 1 : 0); }
  if (patch.priority !== undefined) {
    sets.push('priority = ?'); params.push(clampInt(patch.priority, def.priority, 1, 10000));
  }
  if (patch.timeout_ms !== undefined) {
    sets.push('timeout_ms = ?'); params.push(clampInt(patch.timeout_ms, def.timeoutMs, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS));
  }
  if (patch.cache_days !== undefined) {
    sets.push('cache_days = ?'); params.push(clampInt(patch.cache_days, def.cacheDays, 0, 365));
  }
  if (patch.notes !== undefined) { sets.push('notes = ?'); params.push(String(patch.notes || '').slice(0, 1000)); }
  if (!sets.length) return { ok: true, source: toSourceConfig(row) };

  params.push(Number(id));
  await run(`UPDATE ip_lookup_sources SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params);
  // Đổi cấu hình → lỗi cũ không còn ý nghĩa; admin Test lại sẽ thấy lỗi mới.
  clearSourceError(row.type);
  const fresh = await get('SELECT * FROM ip_lookup_sources WHERE id = ?', [Number(id)]);
  return { ok: true, source: toSourceConfig(fresh) };
}

async function deleteSource(id) {
  const row = await get('SELECT type FROM ip_lookup_sources WHERE id = ?', [Number(id)]);
  if (!row) return { ok: false, error: 'Không tìm thấy nguồn' };
  await run('DELETE FROM ip_lookup_sources WHERE id = ?', [Number(id)]);
  await run('DELETE FROM ip_lookup_cache WHERE source_type = ?', [row.type]).catch(() => {});
  clearSourceError(row.type);
  return { ok: true };
}

/** Sắp lại ưu tiên: order = [id, id, ...] → priority (i+1)*10. */
async function reorderSources(order) {
  if (!Array.isArray(order) || !order.length) return { ok: false, error: 'order phải là mảng id' };
  for (let i = 0; i < order.length; i++) {
    await run('UPDATE ip_lookup_sources SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [(i + 1) * 10, Number(order[i])]).catch(() => {});
  }
  return { ok: true };
}

module.exports = {
  NORMALIZED_FIELDS, VOTED_FIELDS, SOURCE_DEFAULTS, SOURCE_ORDER,
  normalizeIp, quotaWindowStart,
  isPrivateIp,
  aggregate,
  getConfig, getSetting, setSetting,
  listSources, listEnabledSources, listSourcesForAdmin, isReady,
  runLookup, testSource,
  lookupSelf, publicSource,
  logLookup, countUserLookups, guestQuota,
  stats, listLogs,
  addSource, updateSource, deleteSource, reorderSources,
  clearCacheFor, pruneCache, pruneLogs,
  getSourceError, clearSourceError, maskSecret, isMaskedValue
};
