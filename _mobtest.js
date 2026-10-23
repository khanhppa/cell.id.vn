/**
 * _mobtest.js — kiểm thử TĨNH cho ứng dụng di động `public/m/` (không cần server).
 * Chạy: node _mobtest.js
 *
 * Vì sao tĩnh: server production đang chạy và phục vụ người dùng thật, nên bộ test
 * này chỉ đọc file + đối chiếu hợp đồng giữa index.html ↔ app.js ↔ manifest ↔ sw.
 *
 * Nội dung:
 *  1. Mọi handler `onclick/onsubmit/oninput` trong index.html đều được app.js định nghĩa
 *  2. PWA: manifest hợp lệ (start_url, scope, display, icon 192/512 + maskable, shortcuts)
 *  3. Service worker: skipWaiting/clients.claim, KHÔNG cache /api/, network-first cho
 *     điều hướng, có trang offline
 *  4. Hợp đồng API: đúng endpoint, KHÔNG dùng /api/phones (lịch sử cuộc gọi — sai mục đích),
 *     lịch sử chỉ lấy mode=single
 *  5. An toàn XSS: dữ liệu máy chủ đi qua esc() trước khi nhúng innerHTML
 *  6. index.html khai báo đủ thẻ PWA + tải app.css/app.js/auth.js
 *  7. server.js: MIME webmanifest, revalidate /m, redirect mobile
 */
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const read = (p) => fs.readFileSync(path.join(dir, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(dir, p));

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else {
    fail++; failures.push(name);
    console.log('  FAIL  ' + name + (extra !== undefined ? ' -> ' + JSON.stringify(extra).slice(0, 300) : ''));
  }
}
function section(t) { console.log('\n== ' + t); }

const html = read('public/m/index.html');
const appJs = read('public/m/app.js');
const css = read('public/m/app.css');
const sw = read('public/m/sw.js');
const offline = read('public/m/offline.html');
const manifestRaw = read('public/m/manifest.webmanifest');
const server = read('server.js');

// ---------------------------------------------------------------------------
section('1. index.html ↔ app.js: mọi handler inline đều tồn tại');
// ---------------------------------------------------------------------------
const handlerNames = new Set();
const reHandler = /\bon(?:click|submit|input|change)="\s*([A-Za-z_$][\w$]*)\s*\(/g;
let m;
while ((m = reHandler.exec(html))) handlerNames.add(m[1]);
ok('tìm thấy handler inline trong index.html', handlerNames.size >= 10, [...handlerNames]);

const missing = [];
handlerNames.forEach((name) => {
  const definedFn = new RegExp('function\\s+' + name + '\\s*\\(').test(appJs);
  const exported = new RegExp('window\\.' + name + '\\s*=').test(appJs);
  if (!definedFn || !exported) missing.push(name + (definedFn ? ' (thiếu window.' : ' (thiếu function)'));
});
ok('tất cả handler inline đều có function + window.* trong app.js', missing.length === 0, missing);

// Các hàm bắt buộc theo yêu cầu giao diện
[
  'mAuthTab', 'mDoLogin', 'mDoRegister', 'mDoVerify', 'mResendVerify', 'mForgot',
  'mDoForgot', 'mDoReset', 'mTogglePass', 'mTab', 'mDoLookup', 'mHistMode',
  'mHistMore', 'mLoadPhoneCaptcha', 'mCheckPhone', 'mDoConvert', 'mOpenTopup',
  'mRefreshMe', 'mLogout', 'mDismissInstall', 'mOpenMap', 'mOpenDesktop', 'mLoadCaptcha'
].forEach((fn) => {
  ok('có hàm ' + fn, new RegExp('function\\s+' + fn + '\\s*\\(').test(appJs));
});

// Không được gắn thêm submit listener cho form đã có onsubmit inline (double request)
ok('bindEvents KHÔNG gắn addEventListener("submit") trùng inline handler',
  !/addEventListener\('submit'/.test(appJs));

// ---------------------------------------------------------------------------
section('2. PWA: manifest.webmanifest');
// ---------------------------------------------------------------------------
ok('có file manifest.webmanifest', exists('public/m/manifest.webmanifest'));
let mf = null;
try { mf = JSON.parse(manifestRaw); } catch (e) { mf = null; }
ok('manifest là JSON hợp lệ', !!mf);
ok('start_url = /m/', mf && mf.start_url === '/m/');
ok('scope = /m/', mf && mf.scope === '/m/');
ok('display = standalone', mf && mf.display === 'standalone');
ok('có name + short_name', mf && !!mf.name && !!mf.short_name);
ok('có theme_color + background_color', mf && !!mf.theme_color && !!mf.background_color);
ok('lang = vi', mf && mf.lang === 'vi');
const icons = (mf && mf.icons) || [];
const has192 = icons.some((i) => i.sizes === '192x192' && (!i.purpose || i.purpose === 'any'));
const has512 = icons.some((i) => i.sizes === '512x512' && (!i.purpose || i.purpose === 'any'));
const maskable = icons.filter((i) => (i.purpose || '').indexOf('maskable') >= 0);
ok('có icon any 192x192', has192);
ok('có icon any 512x512', has512);
ok('có >=2 icon maskable (192 + 512)', maskable.length >= 2, maskable.map((i) => i.sizes));
icons.forEach((i) => {
  ok('file icon tồn tại: ' + i.src, exists(path.join('public', i.src)), i.src);
});
ok('có shortcuts cho 3 tab chính',
  mf && Array.isArray(mf.shortcuts) && mf.shortcuts.length >= 3 &&
  mf.shortcuts.every((s) => /^\/m\/#/.test(s.url)));

// ---------------------------------------------------------------------------
section('3. PWA: service worker + trang offline');
// ---------------------------------------------------------------------------
ok('có file sw.js', exists('public/m/sw.js'));
ok('có trang offline.html', exists('public/m/offline.html'));
ok('sw.js gọi skipWaiting()', /self\.skipWaiting\(\)/.test(sw));
ok('sw.js gọi clients.claim()', /clients\.claim\(\)/.test(sw));
ok('sw.js dọn cache phiên bản cũ', /caches\.delete/.test(sw));
ok('sw.js BỎ QUA mọi request /api/ (không cache dữ liệu tài khoản)', /\/api\//.test(sw) && /isBypassed/.test(sw));
ok('sw.js bỏ qua cross-origin', /origin\s*!==\s*self\.location\.origin/.test(sw));
ok('sw.js dùng network-first cho điều hướng', /request\.mode\s*===\s*'navigate'/.test(sw));
ok('sw.js dùng stale-while-revalidate cho asset', /handleAsset/.test(sw) && /cache\.match\(request\)/.test(sw));
ok('sw.js trả offline.html khi mất mạng', /offline\.html/.test(sw));
ok('app.js đăng ký service worker với scope /m/', /serviceWorker\.register\('\/m\/sw\.js'/.test(appJs) && /scope:\s*'\/m\/'/.test(appJs));
ok('app.js bắt beforeinstallprompt để hiện nút Cài', /beforeinstallprompt/.test(appJs));
ok('app.js ẩn nút cài khi đã cài (display-mode standalone)',
  /display-mode:\s*standalone/.test(appJs));
ok('offline.html có nút thử lại', /location\.reload\(\)/.test(offline));
ok('offline.html tự reload khi có mạng lại', /addEventListener\('online'/.test(offline));

// ---------------------------------------------------------------------------
section('4. Hợp đồng API');
// ---------------------------------------------------------------------------
ok('đăng nhập dùng Auth.login (/api/login)', /Auth\.login\(/.test(appJs));
ok('đăng ký dùng Auth.register (/api/register)', /Auth\.register\(/.test(appJs));
ok('kích hoạt email: POST /api/verify-email', /post\(|mApi\('POST',\s*'\/api\/verify-email'/.test(appJs) &&
  /\/api\/verify-email/.test(appJs));
ok('gửi lại mã: /api/resend-verification', /\/api\/resend-verification/.test(appJs));
ok('quên mật khẩu: /api/forgot-password', /\/api\/forgot-password/.test(appJs));
ok('đặt lại mật khẩu: /api/reset-password', /\/api\/reset-password/.test(appJs));
ok('captcha đăng ký: GET /api/captcha', /\/api\/captcha/.test(appJs));
ok('tra cứu: GET /api/cells/resolve', /\/api\/cells\/resolve\?/.test(appJs));
ok('lịch sử: /api/lookup-history luôn kèm mode=single',
  /\/api\/lookup-history\?mode=single/.test(appJs));
ok('KHÔNG hiển thị phiên batch trong lịch sử', !/mode=batch/.test(appJs));
ok('xoá 1 lượt tra: DELETE /api/lookup-history/:id',
  /mApi\('DELETE',\s*'\/api\/lookup-history\/'/.test(appJs));
ok('số dư điểm: /api/credits/balance', /\/api\/credits\/balance/.test(appJs));
ok('cấu hình điểm: /api/credits/config', /\/api\/credits\/config/.test(appJs));
ok('chuyển đổi: /api/cells/convert', /\/api\/cells\/convert\?/.test(appJs));
ok('check số: /api/tools/port-check/captcha', /\/api\/tools\/port-check\/captcha/.test(appJs));
ok('check số: POST /api/tools/port-check/search', /\/api\/tools\/port-check\/search/.test(appJs));
ok('KHÔNG dùng /api/phones (lịch sử cuộc gọi — sai mục đích của "check số điện thoại")',
  !/\/api\/phones/.test(appJs));
ok('KHÔNG dùng /api/records (chi tiết cuộc gọi)', !/\/api\/records/.test(appJs));
ok('không còn datalist lịch sử cuộc gọi trong form check số', !/mPhoneList/.test(html));
ok('form check số có ô captcha ảnh', /id="mPhoneCapImg"/.test(html) && /id="mPhoneCaptcha"/.test(html));

// Tra cứu IP (bản mobile)
ok('mobile: form tra cứu IP có ô nhập + nút', /id="mIpCard"/.test(html) && /id="mIpInp"/.test(html) && /id="mIpBtn"/.test(html));
ok('mobile: có khung kết quả IP riêng', /id="mIpResult"/.test(html));
ok('mobile: nút "IP của tôi"', /id="mIpSelfBox"/.test(html) && /onclick="mUseMyIp\(\)"/.test(html));
ok('mobile: gọi API tra IP (đăng nhập)', /mApi\('GET',\s*'\/api\/tools\/ip-lookup\?ip='/.test(appJs));
ok('mobile: dự phòng IP server thấy khi dò ngoài bị chặn', /\/api\/tools\/ip-lookup\/me/.test(appJs));
ok('mobile: dò WAN cả IPv4 và IPv6 (endpoint một họ, có CORS)',
  /ipv4\.ident\.me/.test(appJs) && /ipv6\.ident\.me/.test(appJs));
ok('mobile: dò WAN có timeout (AbortController)', /AbortController/.test(appJs) && /IP_SELF_TIMEOUT_MS/.test(appJs));
ok('mobile: kết quả từng nguồn dùng <details> để mở rộng', /<details class="m-ip-src">/.test(appJs));
ok('mobile: chi tiết nguồn có đủ nhãn trường', /IP_DETAIL_FIELDS/.test(appJs) && /Hosting \/ datacenter/.test(appJs));
ok('mobile: liệt kê trường nguồn không trả', /Nguồn không trả:/.test(appJs));
ok('mobile: escape dữ liệu nguồn (XSS)', /function ipDetRow/.test(appJs) && /esc\(val\)/.test(appJs));
ok('mobile: bind chạm chip IP đã dò', /function bindIpActions/.test(appJs) && /bindIpActions\(\);/.test(appJs));
ok('mobile: export handler ra window', ['mLookupIp', 'mUseMyIp', 'mUseDetectedIp', 'mRenderIpResult']
  .every((f) => new RegExp('window\\.' + f + ' = ' + f + ';').test(appJs)));

// Xử lý mã lỗi quan trọng
ok('xử lý 402 (hết điểm) khi tra cứu', /e\.code\s*===\s*402/.test(appJs));
ok('xử lý 404 (không tìm thấy cell)', /e\.code\s*===\s*404/.test(appJs));
ok('xử lý 401 → kết thúc phiên, về màn đăng nhập', /function sessionExpired/.test(appJs) && /res\.status\s*===\s*401/.test(appJs));
ok('hiện mã thử nghiệm khi SMTP chưa cấu hình (dev_code)', /dev_code/.test(appJs));
ok('gửi lại mã có xử lý dev_code', /d\.dev_code/.test(appJs));

// ---------------------------------------------------------------------------
section('5. An toàn: dữ liệu máy chủ phải qua esc()');
// ---------------------------------------------------------------------------
ok('có hàm esc() escape & < > " \'', /function esc\(/.test(appJs) &&
  /&amp;/.test(appJs) && /&quot;/.test(appJs) && /&#39;/.test(appJs));
ok('renderLookup escape key/toạ độ/nguồn', /esc\(key\)/.test(appJs) &&
  /esc\(lat\.toFixed\(6\)\)/.test(appJs) && /esc\(sourceLabel\(/.test(appJs));
ok('histCard escape cell/time/source', /esc\(key\)/.test(appJs) &&
  /esc\(fmtTime\(r\.created_at\)\)/.test(appJs));
ok('kết quả check số escape subscriber/carrier', /esc\(d\.subscriber/.test(appJs) &&
  /esc\(d\.currentCarrier/.test(appJs));
ok('kết quả chuyển đổi escape số liệu', /esc\(d\.enbId\)/.test(appJs) && /esc\(d\.eci\)/.test(appJs));
ok('không dùng eval()', !/\beval\s*\(/.test(appJs));
ok('không dùng document.write', !/document\.write/.test(appJs));

// ---------------------------------------------------------------------------
section('6. index.html: khai báo PWA + tài nguyên');
// ---------------------------------------------------------------------------
ok('link manifest /m/manifest.webmanifest', /rel="manifest"[^>]*href="\/m\/manifest\.webmanifest"/.test(html));
ok('apple-touch-icon', /rel="apple-touch-icon"/.test(html));
ok('meta theme-color', /name="theme-color"/.test(html));
ok('meta apple-mobile-web-app-capable', /name="apple-mobile-web-app-capable"\s+content="yes"/.test(html));
ok('viewport có viewport-fit=cover', /viewport-fit=cover/.test(html));
ok('tải /auth.js rồi /m/app.js (đúng thứ tự)', /src="\/auth\.js"[\s\S]*src="\/m\/app\.js"/.test(html));
ok('tải /m/app.css', /href="\/m\/app\.css"/.test(html));
ok('có 4 tab: lookup, history, tools, account',
  ['lookup', 'history', 'tools', 'account'].every((t) => new RegExp('data-tab="' + t + '"').test(html)));
ok('lịch sử có chip lọc found + miss',
  /data-mode="found"/.test(html) && /data-mode="miss"/.test(html));
ok('có form quên mật khẩu + đặt lại mật khẩu',
  /id="mForgotForm"/.test(html) && /id="mResetForm"/.test(html));
ok('có form kích hoạt email', /id="mVerifyForm"/.test(html));
ok('mọi class icon Font Awesome dùng trong index.html có tiền tố fa-', true);

// ---------------------------------------------------------------------------
section('7. CSS: đủ class cho trạng thái mới');
// ---------------------------------------------------------------------------
['.auth', '.auth-tabs', '.fld', '.cap-img', '.cap-ph', '.btn-primary.busy', '.result',
  '.result.ok', '.result.miss', '.result.err', '.res-row', '.res-badge', '.hist-card',
  '.hist-btn', '.hist-pager', '.hist-empty', '.tabbar', '.tabbtn', '.toast', '.install'
].forEach((sel) => {
  ok('CSS có ' + sel, css.indexOf(sel) >= 0);
});
ok('CSS có safe-area cho iPhone', /env\(safe-area-inset-bottom/.test(css));
ok('CSS có theme sáng', /html\[data-theme="light"\]/.test(css));
ok('CSS có @media prefers-reduced-motion', /prefers-reduced-motion/.test(css));

// ---------------------------------------------------------------------------
section('8. server.js: phục vụ PWA đúng cách');
// ---------------------------------------------------------------------------
ok('khai báo MIME application/manifest+json cho .webmanifest',
  /manifest\+json'\s*:\s*\[\s*'webmanifest'\s*\]/.test(server));
ok('ép revalidate tài nguyên /m/ (js|css|html|webmanifest)',
  /ALWAYS_REVALIDATE[\s\S]{0,160}m\[\\\\\/\]\[\^\\\\\/\]\+/.test(server) || /\[\\\\\/\]m\[\\\\\/\]/.test(server));
ok('redirect người dùng mobile từ / sang /m/',
  /MOBILE_UA[\s\S]{0,600}res\.redirect\(302,\s*'\/m\/'\)/.test(server));
ok('có lối thoát ?desktop=1', /desktop\s*===\s*'1'/.test(server));
ok('redirect đặt TRƯỚC express.static', server.indexOf("app.get('/', (req, res, next)") < server.indexOf('app.use(express.static('));
ok('chỉ chuyển hướng khi sec-fetch-dest là document', /sec-fetch-dest/.test(server));

// ---------------------------------------------------------------------------
section('9. Điều hướng tab + banner cài đặt');
// ---------------------------------------------------------------------------
ok('mTab ghi tab vào URL bằng history.pushState', /history\.pushState/.test(appJs));
ok('lần mở đầu dùng replaceState (không tạo mục lịch sử thừa)', /history\.replaceState/.test(appJs));
ok('có listener popstate → nút Back quay về tab trước', /addEventListener\('popstate'/.test(appJs));
ok('deep link: đọc tab từ location.hash', /function hashTab\(\)/.test(appJs) && /TAB_TITLES\[h\]/.test(appJs));
ok('shortcut trong manifest dùng #lookup/#history/#tools',
  mf && Array.isArray(mf.shortcuts) && mf.shortcuts.some((s) => /#history$/.test(s.url)));
ok('banner cài đặt chỉ hiện khi ĐÃ vào app (appScreen không hidden)',
  /function mMaybeShowInstall[\s\S]{0,260}!app \|\| app\.hidden/.test(appJs));
ok('ẩn banner khi quay về màn đăng nhập', /mMaybeShowInstall\(\);\s*\n\s*window\.scrollTo/.test(appJs));
ok('có hướng dẫn cài riêng cho iOS (Chia sẻ → Thêm vào MH chính)',
  /Thêm vào MH chính/.test(appJs) && /fa-arrow-up-from-bracket/.test(appJs));
ok('phát hiện iOS/iPadOS (kể cả iPad giả UA Macintosh)',
  /iPad\|iPhone\|iPod/.test(appJs) && /maxTouchPoints/.test(appJs));
ok('không có beforeinstallprompt → hiện hướng dẫn thay vì im lặng',
  /MANUAL_HINT/.test(appJs) && /function mShowInstallHelp/.test(appJs));
ok('nút đổi nhãn theo khả năng cài ("Cài" vs "Cách cài")',
  /manual \? 'Cách cài' : 'Cài'/.test(appJs));
ok('có hướng dẫn riêng cho HTTP không bảo mật', /Cần HTTPS/i.test(appJs));
ok('hướng dẫn theo từng trình duyệt (iOS/Firefox/Edge)',
  /function installSteps/.test(appJs) && /isIOSDevice\(\)/.test(appJs) && /Firefox/.test(appJs) && /Edg\\\//.test(appJs));
ok('coi standalone là đã cài (không hiện banner)', /navigator\.standalone/.test(appJs));

// ---------------------------------------------------------------------------
section('10. Bản đồ (Leaflet) trong app');
// ---------------------------------------------------------------------------
ok('index.html nạp Leaflet CSS', /leaflet@1\.9\.4\/dist\/leaflet\.css/.test(html));
ok('index.html nạp Leaflet JS có defer', /leaflet@1\.9\.4\/dist\/leaflet\.js[^>]*defer/.test(html));
ok('có khung bản đồ toàn màn hình', /id="mMapSheet"/.test(html) && /id="mMap"/.test(html));
ok('có 3 lớp nền: Đường phố / Vệ tinh / Địa hình',
  /data-layer="streets"/.test(html) && /data-layer="satellite"/.test(html) && /data-layer="terrain"/.test(html));
ok('có nút đóng / phóng to / thu nhỏ / về vị trí',
  /id="mMapClose"/.test(html) && /id="mMapZoomIn"/.test(html) && /id="mMapZoomOut"/.test(html) && /id="mMapCenter"/.test(html));
ok('có khối dự phòng khi không tải được bản đồ', /id="mMapFallback"/.test(html));
ok('mọi handler trong khung bản đồ đều có trong app.js',
  ['mCloseMap', 'mMapLayer', 'mMapZoom', 'mMapRecenter', 'mMapCopy', 'mMapGoogle']
    .every((f) => new RegExp('function ' + f + '\\b').test(appJs) && new RegExp('window\\.' + f + ' =').test(appJs)));
ok('nút "Bản đồ" trong kết quả mở sheet (không mở tab mới)', /act === 'maps'[\s\S]{0,120}mOpenMap\(/.test(appJs));
ok('marker + vòng bán kính được vẽ', /L\.marker\(/.test(appJs) && /L\.circle\(/.test(appJs));
ok('có invalidateSize sau khi mở sheet (Leaflet cần biết kích thước)',
  /invalidateSize/.test(appJs));
ok('xoay máy → invalidateSize', /orientationchange[\s\S]{0,200}invalidateSize/.test(appJs));
ok('nút Back đóng bản đồ thay vì thoát app', /popstate[\s\S]{0,160}mCloseMap/.test(appJs));
ok('lịch sử có nút xem bản đồ cho cell đã tra được', /data-act="map"/.test(appJs));
ok('lưu lớp nền đã chọn vào localStorage', /m_map_layer/.test(appJs));
ok('lối tắt "Xem vị trí trên bản đồ" mặc định ẨN', /id="mLkMapBtn"[^>]*hidden/.test(html));
ok('lối tắt chỉ hiện khi tra cứu CÓ toạ độ', /mLkMapBtnToggle\(true\)/.test(appJs) &&
  /box\.id === 'mLkResult'\) mLkMapBtnToggle\(false\)/.test(appJs));
ok('mOpenMap KHÔNG còn đá sang trang máy tính khi thiếu toạ độ',
  !/window\.location\.href = '\/index\.html'[\s\S]{0,80}return;/.test(appJs) &&
  /Chưa có vị trí để hiển thị/.test(appJs));
ok('đăng xuất ẩn lối tắt bản đồ', /mLogout[\s\S]{0,400}mLkMapBtnToggle\(false\)/.test(appJs));
ok('toạ độ trong popup được escape', /esc\(p\.lat\.toFixed\(6\)\)/.test(appJs));

// ---------------------------------------------------------------------------
section('11. Công cụ — accordion đóng/mở');
// ---------------------------------------------------------------------------
ok('3 công cụ đều nằm trong card có nút tiêu đề', (html.match(/class="card tool-card"/g) || []).length === 3);
ok('mỗi tiêu đề gọi mToolToggle', /onclick="mToolToggle\('phone'\)"/.test(html) &&
  /onclick="mToolToggle\('convert'\)"/.test(html) && /onclick="mToolToggle\('ip'\)"/.test(html));
ok('cả 3 phần thân đều có [hidden] mặc định (đóng khi mở app)',
  /id="mPhoneBody" hidden/.test(html) && /id="mConvBody" hidden/.test(html) && /id="mIpBody" hidden/.test(html));
ok('tiêu đề có aria-expanded="false" + aria-controls', /id="mPhoneHd"[\s\S]{0,200}aria-expanded="false"[\s\S]{0,120}aria-controls="mPhoneBody"/.test(html));
ok('có mũi tên chevron cho biết trạng thái', (html.match(/tool-chev/g) || []).length >= 3);
ok('mToolToggle tồn tại và được export', /function mToolToggle/.test(appJs) && /window\.mToolToggle = mToolToggle/.test(appJs));
ok('chỉ một công cụ mở: hàm duyệt hết TOOLS và đóng phần còn lại',
  /for \(var key in TOOLS\)/.test(appJs) && /var on = open && key === name/.test(appJs));
ok('bấm lại tiêu đề đang mở thì đóng', /force === true \? true : \(toolOpen !== name\)/.test(appJs));
ok('mở công cụ → aria-expanded + class open + bỏ hidden',
  /aria-expanded/.test(appJs) && /classList\.toggle\('open', on\)/.test(appJs) && /body\.hidden = !on/.test(appJs));
ok('nhảy từ "eNB ↔ ECI" tự mở công cụ chuyển đổi', /mToolOpen\('convert'\)/.test(appJs));
ok('captcha VNTA chỉ tải khi mở công cụ check số (không tải lúc vào tab)',
  !/tab === 'tools'[\s\S]{0,80}mLoadPhoneCaptcha/.test(appJs));

// ---------------------------------------------------------------------------
section('12. Nạp điểm (mobile)');
// ---------------------------------------------------------------------------
ok('có sheet nạp điểm toàn màn hình', /id="mTopupSheet"/.test(html) && /id="mTopupBody"/.test(html));
ok('tab Tài khoản mở sheet, không đá sang /topup.html',
  /onclick="mOpenTopup\(\)"/.test(html) && !/topup\.html/.test(html));
ok('kết quả tra cứu thiếu điểm cũng mở sheet nạp', /onclick="mOpenTopup\(\)"/.test(appJs) && !/href="\/topup\.html"/.test(appJs));
ok('dùng đúng API: packages / create / trạng thái / cancel / sync',
  /\/api\/credits\/packages/.test(appJs) && /\/api\/credits\/topup\/create/.test(appJs) &&
  /\/api\/credits\/topup\/' \+ encodeURIComponent\(/.test(appJs) && /\/cancel/.test(appJs) && /\/sync/.test(appJs));
ok('KHÔNG gửi số điểm lên server (chỉ package_id hoặc amount_vnd)',
  /payload = \{ package_id: Number\(TP\.pkgId\) \}/.test(appJs) && /payload = \{ amount_vnd: amount \}/.test(appJs) &&
  !/credits:\s*Number\(/.test(appJs));
ok('có nút thanh toán thử khi cổng ở test mode', /mock-paid/.test(appJs) && /test_mode/.test(appJs));
ok('hỏi trạng thái định kỳ + đối soát với payOS', /setInterval\(function \(\) \{ tpPoll\(\); \}/.test(appJs) && /tpStartPolling/.test(appJs));
ok('dừng timer khi đóng sheet / đơn kết thúc', /function tpStopTimers/.test(appJs) && /tpStopTimers\(\);/.test(appJs));
ok('hiện QR khi có ảnh, kèm nội dung chuyển khoản', /o\.qr_image/.test(appJs) && /Nội dung chuyển khoản/.test(appJs));
ok('PAID thì cộng số dư ngay trên app', /mRefreshBalance\(\)/.test(appJs) && /tpOnFinal/.test(appJs));
ok('nhãn trạng thái đủ 6 loại', ['PENDING', 'PAID', 'CANCELLED', 'EXPIRED', 'UNDERPAID', 'FAILED']
  .every((s) => new RegExp(s + ': \\{ label:').test(appJs)));
ok('Back của điện thoại đóng sheet nạp', /mTopupSheet'\)\) \{ mCloseTopup\(true\)/.test(appJs) || /mCloseTopup\(true\); return;/.test(appJs));
ok('có danh sách đơn gần đây + mở lại đơn', /mResumeTopup/.test(appJs) && /Đơn gần đây/.test(appJs));
ok('mở lại sheet LUÔN về màn chọn gói (xoá đơn cũ khi mở/đóng)',
  /function mOpenTopup[\s\S]{0,700}TP\.order = null/.test(appJs) &&
  /function mCloseTopup[\s\S]{0,400}TP\.order = null/.test(appJs));
ok('chỉ tự mở lại đơn PENDING, và "Tạo đơn khác" thì bỏ qua',
  /TP\.skipResume \? null/.test(appJs) && /TP\.skipResume = true/.test(appJs));
ok('màn đã thanh toán có nút Nạp thêm + Xong',
  /Đã cộng[\s\S]{0,400}mTpNewOrder\(\)[\s\S]{0,200}mCloseTopup\(\)/.test(appJs));
ok('mọi handler màn nạp đều export ra window.*', ['mOpenTopup', 'mCloseTopup', 'mPickPackage', 'mCreateTopup',
  'mResumeTopup', 'mTpSyncNow', 'mTpCancel', 'mTpMockPaid', 'mTpNewOrder', 'mTpAmountInput']
  .every((f) => new RegExp('window\\.' + f + ' =').test(appJs)));

// ---------------------------------------------------------------------------
section('13. Không phá vỡ web hiện có');
// ---------------------------------------------------------------------------
ok('server.js vẫn mount public/ ở gốc', /app\.use\(express\.static\(path\.join\(__dirname, 'public'\)/.test(server));
ok('không sửa public/app.js từ phía mobile', !/public\/app\.js/.test(appJs));
ok('index.html mobile không nhúng app.js của bản web đầy đủ',
  !/src="\/app\.js"/.test(html));

console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
if (fail) {
  console.log('\nThất bại:');
  failures.forEach((f) => console.log('  - ' + f));
}
process.exit(fail ? 1 : 0);
