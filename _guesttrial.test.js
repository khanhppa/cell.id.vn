/**
 * Test guest trial: guest-trial.js (hành vi thật trên DB tạm) + wiring.
 * Chạy: node _guesttrial.test.js
 *
 * DB tạm — KHÔNG đụng database.sqlite (xem patchDbRedirect).
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`); }
}

const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

/** Patch fs + sqlite3 để mọi thao tác DB trỏ về DB tạm. Gọi TRƯỚC require('./database'). */
function patchDbRedirect(realDbPath, tmpDb) {
  const realExistsSync = fs.existsSync;
  fs.existsSync = function (p) {
    if (typeof p === 'string' && path.resolve(p) === path.resolve(realDbPath)) return false;
    return realExistsSync.apply(this, arguments);
  };
  const Sqlite3 = require('sqlite3');
  const RealDatabase = Sqlite3.Database;
  function PatchedDatabase(file, ...rest) {
    if (typeof file === 'string' && path.resolve(file) === path.resolve(realDbPath)) file = tmpDb;
    return new RealDatabase(file, ...rest);
  }
  PatchedDatabase.prototype = RealDatabase.prototype;
  Sqlite3.Database = PatchedDatabase;
  const RealVerbose = Sqlite3.verbose;
  Sqlite3.verbose = function () {
    const v = RealVerbose.apply(this, arguments);
    const orig = v.Database;
    function VDatabase(file, ...rest) {
      if (typeof file === 'string' && path.resolve(file) === path.resolve(realDbPath)) file = tmpDb;
      return new orig(file, ...rest);
    }
    VDatabase.prototype = orig.prototype;
    v.Database = VDatabase;
    return v;
  };
}


async function main() {
  let guestTrial;
  try {
    require('./database');
    guestTrial = require('./guest-trial');
  } catch (e) { console.error('Không nạp được database/guest-trial:', e.message); process.exit(1); }

  await sleep(500); // chờ database.js tạo schema

  const db = require('./database');
  const sqlAll = (sql, p = []) => new Promise((res, rej) => db.all(sql, p, (e, r) => e ? rej(e) : res(r || [])));
  const sqlRun = (sql, p = []) => new Promise((res, rej) => db.run(sql, p, function (e) { e ? rej(e) : res(this); }));
  const setSetting = (k, v) => sqlRun(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [k, String(v)]);

  console.log('\n== Schema (Phương án A) ==');
  const cols = await sqlAll('PRAGMA table_info(guest_trials)');
  const names = cols.map(c => c.name);
  ok('bảng guest_trials tồn tại', cols.length > 0, names);
  for (const c of ['id', 'guest_key', 'ip', 'user_agent', 'used_at', 'mcc', 'mnc', 'lac', 'cellid', 'sector', 'found',
                   'guest_net_key', 'client_id', 'ua_family', 'expires_at']) {
    ok(`có cột ${c}`, names.includes(c));
  }
  const idx = await sqlAll("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='guest_trials'");
  const idxNames = idx.map(i => i.name);
  ok('có index idx_guest_trials_key', idxNames.includes('idx_guest_trials_key'), idxNames);
  ok('có index idx_guest_trials_net (khoá kép)', idxNames.includes('idx_guest_trials_net'), idxNames);
  ok('có index idx_guest_trials_client', idxNames.includes('idx_guest_trials_client'), idxNames);
  const uniqueOnKey = await sqlAll('PRAGMA index_list(guest_trials)');
  ok('guest_key UNIQUE (chống ghi trùng)', uniqueOnKey.some(i => i.unique === 1), uniqueOnKey);

  console.log('\n== Fingerprint ==');
  const fpA = guestTrial.fingerprint(req('1.2.3.4', 'UA-A'));
  const fpA2 = guestTrial.fingerprint(req('1.2.3.4', 'UA-A'));
  const fpB = guestTrial.fingerprint(req('1.2.3.4', 'UA-B'));
  const fpC = guestTrial.fingerprint(req('5.6.7.8', 'UA-A'));
  ok('cùng ip+ua → cùng khoá', fpA === fpA2);
  ok('đổi user-agent → đổi khoá', fpA !== fpB);
  ok('đổi ip → đổi khoá', fpA !== fpC);
  ok('khoá là sha256 hex 64 ký tự', /^[a-f0-9]{64}$/.test(fpA), fpA);
  ok('khoá KHÔNG chứa ip thô', !fpA.includes('1.2.3.4'));
  ok('clientIp bỏ tiền tố ::ffff:',
    guestTrial.clientIp({ headers: {}, socket: { remoteAddress: '::ffff:7.7.7.7' } }) === '7.7.7.7',
    guestTrial.clientIp({ headers: {}, socket: { remoteAddress: '::ffff:7.7.7.7' } }));
  ok('clientIp lấy ip đầu trong x-forwarded-for',
    guestTrial.clientIp({ headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' } }) === '9.9.9.9',
    guestTrial.clientIp({ headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' } }));

  console.log('\n== Phương án A: ipPrefix / uaFamily / netKey ==');
  ok('ipPrefix IPv4 che /24', guestTrial.ipPrefix('1.2.3.4') === '1.2.3', guestTrial.ipPrefix('1.2.3.4'));
  ok('ipPrefix IPv6 che /64', guestTrial.ipPrefix('2001:db8:85a3:1:2:3:4:5') === '2001:db8:85a3:1',
    guestTrial.ipPrefix('2001:db8:85a3:1:2:3:4:5'));
  ok('ipPrefix rỗng → rỗng', guestTrial.ipPrefix('') === '');

  const uaChromeWin = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const uaChromeWin2 = uaChromeWin.replace('120.0.0.0', '121.0.0.0');
  const uaSafariIos = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  ok('uaFamily nhận chrome-win', guestTrial.uaFamily(uaChromeWin) === 'chrome-win', guestTrial.uaFamily(uaChromeWin));
  ok('uaFamily BỎ số version (120 vs 121 cùng họ)',
    guestTrial.uaFamily(uaChromeWin) === guestTrial.uaFamily(uaChromeWin2), guestTrial.uaFamily(uaChromeWin2));
  ok('uaFamily nhận safari-ios', guestTrial.uaFamily(uaSafariIos) === 'safari-ios', guestTrial.uaFamily(uaSafariIos));
  ok('uaFamily rỗng → unknown', guestTrial.uaFamily('') === 'unknown');

  const netA = guestTrial.netKey(req('1.2.3.4', uaChromeWin));
  const netA2 = guestTrial.netKey(req('1.2.3.99', uaChromeWin2)); // khác IP cuối + khác version UA
  const netB = guestTrial.netKey(req('1.2.3.4', uaSafariIos));    // khác họ trình duyệt
  const netC = guestTrial.netKey(req('9.9.9.9', uaChromeWin));    // khác đường mạng
  ok('netKey: khác số IP cuối + khác UA version → CÙNG khoá (chống lách)', netA === netA2,
    { netA, netA2 });
  ok('netKey: khác họ trình duyệt → khác khoá', netA !== netB);
  ok('netKey: khác đường mạng → khác khoá', netA !== netC);
  ok('netKey là sha256 hex 64 ký tự', /^[a-f0-9]{64}$/.test(netA), netA);

  console.log('\n== Phương án A: cookie ký HMAC ==');
  const cid = guestTrial.newClientId();
  const signed = guestTrial.signClientId(cid);
  ok('clientId 32 byte hex', /^[a-f0-9]{64}$/.test(cid), cid);
  ok('verify(sign(clientId)) → clientId gốc', guestTrial.verifyClientId(signed) === cid);
  ok('cookie bị sửa chữ ký → null', guestTrial.verifyClientId(cid + '.deadbeef') === null);
  ok('cookie không có dấu chấm → null', guestTrial.verifyClientId(cid) === null);
  ok('cookie rỗng → null', guestTrial.verifyClientId('') === null);
  ok('sign hai lần ra cùng giá trị', guestTrial.signClientId(cid) === signed);

  const cookieHeader = guestTrial.buildCookie({ headers: {} }, signed);
  ok('cookie có HttpOnly', cookieHeader.includes('HttpOnly'), cookieHeader);
  ok('cookie có SameSite=Lax', cookieHeader.includes('SameSite=Lax'), cookieHeader);
  ok('cookie có Path=/', cookieHeader.includes('Path=/'), cookieHeader);
  ok('cookie có Max-Age', /Max-Age=\d+/.test(cookieHeader), cookieHeader);
  ok('http thường KHÔNG có Secure', !cookieHeader.includes('Secure'), cookieHeader);
  ok('x-forwarded-proto=https → có Secure',
    guestTrial.buildCookie({ headers: { 'x-forwarded-proto': 'https' } }, signed).includes('Secure'));
  ok('fingerprint có clientId → khác khi không có',
    guestTrial.fingerprint(req('1.2.3.4', uaChromeWin), cid) !== guestTrial.fingerprint(req('1.2.3.4', uaChromeWin)));

  console.log('\n== getMax ==');
  await guestTrial.reset();
  await sqlRun('DELETE FROM settings WHERE key = ?', ['guest_trial_max']);
  ok('mặc định = TRIAL_MAX_DEFAULT (1)', await guestTrial.getMax() === guestTrial.TRIAL_MAX_DEFAULT);
  await setSetting('guest_trial_max', '3');
  ok('đọc được từ settings', await guestTrial.getMax() === 3);
  await setSetting('guest_trial_max', '999999');
  ok('bị chặn trên bởi TRIAL_MAX_CAP', await guestTrial.getMax() === guestTrial.TRIAL_MAX_CAP);
  await setSetting('guest_trial_max', 'abc');
  ok('giá trị rác → default', await guestTrial.getMax() === guestTrial.TRIAL_MAX_DEFAULT);
  await setSetting('guest_trial_max', '-5');
  ok('giá trị âm → default', await guestTrial.getMax() === guestTrial.TRIAL_MAX_DEFAULT);
  await setSetting('guest_trial_max', '0');
  ok('admin set 0 = tắt hoàn toàn', await guestTrial.getMax() === 0);
  await runLifecycle(guestTrial, sqlAll, sqlRun, setSetting, req);
  await runWiring(guestTrial);
}

async function runLifecycle(guestTrial, sqlAll, sqlRun, setSetting, req) {
  console.log('\n== Vòng đời 1 lượt (max = 1) ==');
  await setSetting('guest_trial_max', '1');
  await guestTrial.reset();
  const uaA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const r1 = req('1.2.3.4', uaA);
  const key = guestTrial.fingerprint(r1);
  const net = guestTrial.netKey(r1);

  let st = await guestTrial.getStatus(key, net);
  ok('guest mới: used = 0', st.used === 0, st);
  ok('guest mới: remaining = 1', st.remaining === 1, st);
  ok('guest mới: allowed = true', st.allowed === true, st);
  ok('guest mới: usedAt = null', st.usedAt === null, st);

  await guestTrial.recordTrial(key, net, r1, { mcc: '452', mnc: '01', lac: '100', cellid: '200', sector: '1' }, true);
  st = await guestTrial.getStatus(key, net);
  ok('sau khi dùng: used = 1', st.used === 1, st);
  ok('sau khi dùng: remaining = 0', st.remaining === 0, st);
  ok('sau khi dùng: allowed = false', st.allowed === false, st);
  ok('sau khi dùng: usedAt có giá trị', !!st.usedAt, st);

  const rows = await sqlAll('SELECT * FROM guest_trials');
  ok('chỉ 1 bản ghi cho 1 guest', rows.length === 1, rows.length);
  ok('lưu đúng cell đã tra', rows[0] && rows[0].cellid === '200' && rows[0].mcc === '452', rows[0]);
  ok('lưu found = 1', rows[0] && rows[0].found === 1, rows[0]);
  ok('lưu user-agent', rows[0] && rows[0].user_agent === uaA, rows[0]);
  ok('lưu guest_net_key', rows[0] && rows[0].guest_net_key === net, rows[0]);
  ok('lưu ua_family', rows[0] && rows[0].ua_family === 'chrome-win', rows[0]);
  ok('có expires_at (cửa sổ 30 ngày)', rows[0] && !!rows[0].expires_at, rows[0]);

  // Ghi lần 2 (client retry) không tạo bản ghi mới, không đổi used_at.
  const usedAt1 = rows[0].used_at;
  await guestTrial.recordTrial(key, net, r1, { mcc: '999', mnc: '99', lac: '9', cellid: '9999' }, false);
  const rows2 = await sqlAll('SELECT * FROM guest_trials');
  ok('recordTrial lần 2 KHÔNG tạo bản ghi mới', rows2.length === 1, rows2.length);
  ok('KHÔNG ghi đè cell của lần đầu', rows2[0].cellid === '200', rows2[0]);
  ok('KHÔNG đổi used_at', rows2[0].used_at === usedAt1, { usedAt1, now: rows2[0].used_at });

  console.log('\n== Phương án A: chống lách incognito / đổi UA ==');
  // Sang tab ẩn danh: cookie mất → guest_key mới, nhưng khoá mạng trùng.
  const uaA121 = uaA.replace('120.0.0.0', '121.0.0.0');
  const rIncog = req('1.2.3.4', uaA121, { clientIdCookie: null });
  const keyIncog = guestTrial.fingerprint(rIncog);
  const netIncog = guestTrial.netKey(rIncog);
  ok('incognito: guest_key KHÁC phiên thường', keyIncog !== key);
  ok('incognito: netKey TRÙNG phiên thường (chống lách)', netIncog === net, { net, netIncog });
  const stIncog = await guestTrial.getStatus(keyIncog, netIncog);
  ok('incognito: vẫn bị tính là đã dùng hết lượt', stIncog.used === 1 && stIncog.allowed === false, stIncog);

  // Đổi User-Agent cùng máy: họ trình duyệt + đường mạng vẫn trùng.
  const rOtherUa = req('1.2.3.4', uaA.replace('Chrome/120.0.0.0', 'Chrome/999.0.0.0').replace('Safari/537.36', 'Safari/605.1'));
  const stUa = await guestTrial.getStatus(guestTrial.fingerprint(rOtherUa), guestTrial.netKey(rOtherUa));
  ok('đổi User-Agent (cùng họ): vẫn hết lượt', stUa.allowed === false, stUa);

  // Hết hạn cửa sổ: bản ghi cũ → cho thử lại.
  await sqlRun('UPDATE guest_trials SET expires_at = datetime(\'now\', \'-1 day\')');
  const stExpired = await guestTrial.getStatus(key, net);
  ok('bản ghi quá hạn → coi như chưa dùng (cho thử lại)', stExpired.used === 0 && stExpired.allowed === true, stExpired);
  await sqlRun('UPDATE guest_trials SET expires_at = datetime(\'now\', \'+30 days\')');

  console.log('\n== Guest khác độc lập ==');
  const r2 = req('5.6.7.8', uaA);
  const key2 = guestTrial.fingerprint(r2);
  ok('guest khác vẫn còn lượt', (await guestTrial.getStatus(key2, guestTrial.netKey(r2))).allowed === true);
  await guestTrial.reset();
  ok('reset() xoá hết trial', (await sqlAll('SELECT * FROM guest_trials')).length === 0);
  ok('sau reset, guest được dùng lại', (await guestTrial.getStatus(key, net)).allowed === true);
}

const tmpDb = path.join(os.tmpdir(), `guest-test-${process.pid}-${Date.now()}.sqlite`);
const realDbPath = path.join(__dirname, 'database.sqlite');
patchDbRedirect(realDbPath, tmpDb);

const sleep = ms => new Promise(r => setTimeout(r, ms));
/**
 * Request giả. `opts.clientIdCookie === null` mô phỏng khách xoá cookie
 * (tab ẩn danh) → không có clientId trong fingerprint.
 */
function req(ip, ua, opts = {}) {
  return {
    ip,
    headers: { 'user-agent': ua, 'x-forwarded-for': ip },
    __clientIdCookie: Object.prototype.hasOwnProperty.call(opts, 'clientIdCookie') ? opts.clientIdCookie : undefined
  };
}



async function runWiring() {
  console.log('\n== Wiring server.js ==');
  const server = read('server.js');
  ok('require ./guest-trial', /require\(['"]\.\/guest-trial['"]\)/.test(server));
  ok('route GET /api/guest/status', /app\.get\(['"]\/api\/guest\/status['"]/.test(server));
  ok('route GET /api/guest/lookup', /app\.get\(['"]\/api\/guest\/lookup['"]/.test(server));
  ok('/api/guest/status KHÔNG requireAuth', /app\.get\(['"]\/api\/guest\/status['"],\s*async/.test(server));
  ok('/api/guest/lookup KHÔNG requireAuth', /app\.get\(['"]\/api\/guest\/lookup['"],\s*async/.test(server));
  ok('guest lookup dùng probeCellRow (local, không gọi online)', /api\/guest\/lookup[\s\S]{0,1500}probeCellRow/.test(server));
  ok('guest lookup KHÔNG gọi nguồn online', !/api\/guest\/lookup[\s\S]{0,1500}resolveOpenCellID/.test(server));
  ok('có mã GUEST_TRIAL_EXHAUSTED', server.includes('GUEST_TRIAL_EXHAUSTED'));
  ok('có upsell registerUrl #register', server.includes('/login.html#register'));

  console.log('\n== Wiring server.js: gate API dữ liệu ==');
  for (const route of ['/api/cells/stats', '/api/cells/search', '/api/cells/all', '/api/cells/convert', '/api/phones']) {
    const re = new RegExp(`app\\.get\\(['"]${route.replace(/\//g, '\\/')}['"],\\s*requireAuth`);
    ok(`${route} yêu cầu đăng nhập`, re.test(server));
  }
  ok('/api/records/:phone yêu cầu đăng nhập', /app\.get\(['"]\/api\/records\/:phone['"],\s*requireAuth/.test(server));

  console.log('\n== Wiring frontend ==');
  const app = read(path.join('public', 'app.js'));
  ok('app.js KHÔNG còn Auth.requireAuth() trong initAuth', !/async function initAuth\(\)\s*\{\s*const ok = await Auth\.requireAuth/.test(app));
  ok('app.js có enterGuestMode', app.includes('enterGuestMode'));
  ok('app.js bật window.__guestMode', app.includes('window.__guestMode = true'));
  ok('app.js có guestLookup', app.includes('guestLookup'));
  ok('guestLookup gọi /api/guest/lookup', app.includes('/api/guest/lookup'));
  ok('app.js KHÔNG còn hàm renderGuestTrialBanner', !app.includes('renderGuestTrialBanner'));
  ok('app.js KHÔNG còn refreshGuestTrialUI', !app.includes('refreshGuestTrialUI'));
  ok('app.js vẽ lại panel foot khi đổi tab', /switchTab[\s\S]{0,1000}renderPanelVersion/.test(app));
  ok('apiRequest có guard guest (chặn vòng lặp 401)', /__guestMode\s*&&\s*!Auth\.getToken\(\)/.test(app));
  ok('lookupCell có nhánh guest', /__guestMode\)\s*return guestLookup/.test(app));

  const authjs = read(path.join('public', 'auth.js'));
  ok('auth.js: chỉ hiện badge điểm khi đã đăng nhập', /if \(loggedIn\) \{[\s\S]{0,200}updateCreditBadge/.test(authjs));
  ok('auth.js: có nhãn Đăng nhập/Đăng ký cho guest', authjs.includes('loginTxt') && authjs.includes('registerTxt'));
  ok('auth.js: guest KHÔNG thấy menu user', /!loggedIn \? `[\s\S]{0,400}loginTxt/.test(authjs));
  // `const Auth = {...}` top-level KHÔNG tự thành window.Auth; finishLogin() và
  // index.html kiểm tra `window.Auth` nên thiếu gán tường minh → token không được
  // lưu sau login (user vẫn ở guest mode sau reload).
  ok('auth.js gán window.Auth = Auth (để finishLogin lưu được token)',
    /window\.Auth\s*=\s*Auth\s*;/.test(authjs));
  ok('auth-popup.js finishLogin chỉ lưu token qua window.Auth',
    /if \(window\.Auth\) \{[\s\S]{0,160}Auth\.setToken/.test(read(path.join('public', 'auth-popup.js'))));
  // Ở trang chủ, đổi hash không nạp lại app.js → phải reload mới thấy UI đăng nhập.
  const authPopupSrc = read(path.join('public', 'auth-popup.js'));
  ok('finishLogin nạp lại trang khi đang ở trang chủ',
    /finishLogin[\s\S]{0,700}window\.location\.reload\(\)/.test(authPopupSrc));
  ok('auth.js có Auth.goLogin (dùng chung cho logout/requireAuth)',
    /Auth\.goLogin\s*=\s*function/.test(authjs));
  ok('auth.js goLogin nạp lại trang khi đang ở trang chủ',
    /goLogin\s*=\s*function[\s\S]{0,420}window\.location\.reload\(\)/.test(authjs));
  ok('logout dùng goLogin (không chỉ đổi hash)',
    /logout\(\)\s*\{[\s\S]{0,300}this\.goLogin\(\)/.test(authjs));
  // Đăng xuất phải về TRANG CHỦ, không còn dùng /login.html (trang đó bỏ).
  ok('auth.js goLogin KHÔNG trỏ về /login.html',
    !/Auth\.goLogin\s*=\s*function[\s\S]{0,400}login\.html/.test(authjs));
  ok('auth.js tách clearSession (xoá, không điều hướng) khỏi logout (xoá + về trang chủ)',
    /clearSession\(\)\s*\{\s*this\.clearToken\(\);\s*this\.clearUser\(\);\s*\}/.test(authjs));
  ok('nhánh 401 dùng clearSession, KHÔNG tự logout/điều hướng',
    !/checkSession[\s\S]{0,900}this\.logout\(\)/.test(authjs) &&
    /status === 401[\s\S]{0,220}clearSession\(\)/.test(authjs));
  ok('auth.js gọi hook __onSessionExpired khi hết phiên',
    authjs.includes('__onSessionExpired'));
  ok('app.js định nghĩa window.__onSessionExpired → enterGuestMode',
    /window\.__onSessionExpired\s*=\s*function[\s\S]{0,300}enterGuestMode\(\)/.test(app));
  for (const rel of ['credits.html', 'topup.html', 'version.html', 'tools/ip-tracker.html', 'tools/ip-tracker.js']) {
    const src = read(path.join('public', rel));
    ok(`${rel}: không redirect cứng /login.html`, !/location\.(href|replace)\s*=\s*['"][^'"]*login\.html/.test(src));
  }
  ok('app.js: nút Đăng ký trỏ /index.html#register', app.includes('/index.html#register'));
  // Token hết hạn nằm lại localStorage làm isLoggedIn()=true giả → UI tưởng đã
  // đăng nhập nhưng mọi API trả 401 → logout → vòng lặp về popup đăng nhập.
  ok('auth.js có decodeToken + isTokenExpired', authjs.includes('decodeToken') && authjs.includes('isTokenExpired'));
  ok('auth.js isLoggedIn dựa trên hạn token, không chỉ tồn tại',
    /isLoggedIn\(\)\s*\{\s*return !this\.isTokenExpired\(\);/.test(authjs));
  ok('auth.js checkSession dọn token hết hạn', /if \(this\.isTokenExpired\(\)\) \{ this\.clearToken\(\); this\.clearUser\(\); return null; \}/.test(authjs));
  ok('app.js enterGuestMode xoá token hết hạn (chặn vòng lặp 401)',
    /enterGuestMode[\s\S]{0,400}Auth\.isTokenExpired\(\)[\s\S]{0,120}Auth\.clearToken\(\)/.test(app));

  // Navbar chung (auth.js) tô màu bằng var(--header-bg), var(--bg-surface),
  // var(--bg-surface2), var(--bg-btn-primary), var(--border-focus) với fallback
  // hardcode màu SÁNG. Trang nào không tự khai báo các biến này trong
  // :root/[data-theme] thì navbar đứng im ở tông sáng dù trang đã sang dark.
  const NAVBAR_VARS = ['--header-bg', '--bg-surface', '--bg-surface2', '--bg-btn-primary', '--border-focus'];
  const THEMED_PAGES = ['index.html', 'admin.html', 'credits.html', 'topup.html', 'version.html',
    'tools/port-check.html', 'tools/ebn-eci.html', 'tools/ip-tracker.html'];
  for (const rel of THEMED_PAGES) {
    const html = read(path.join('public', rel));
    const missing = NAVBAR_VARS.filter(v => !new RegExp(v.replace(/-/g, '\\-') + '\\s*:').test(html));
    ok(`${rel}: khai báo đủ biến màu navbar (${NAVBAR_VARS.join(', ')})`, missing.length === 0);
    // Mỗi biến phải có mặt ở CẢ light lẫn dark (>= 2 lần khai báo) để đổi theo theme.
    const lightOnly = NAVBAR_VARS.filter(v =>
      (html.match(new RegExp(v.replace(/-/g, '\\-') + '\\s*:', 'g')) || []).length < 2);
    ok(`${rel}: biến navbar có giá trị cho cả light + dark`, lightOnly.length === 0);
  }

  const indexHtml = read(path.join('public', 'index.html'));
  ok('index.html có #guestGate', indexHtml.includes('id="guestGate"'));
  ok('index.html KHÔNG còn banner #guestTrialBanner', !indexHtml.includes('id="guestTrialBanner"'));
  ok('index.html KHÔNG còn CSS .guest-trial-banner', !indexHtml.includes('.guest-trial-banner'));
  ok('index.html: chân version #guestPanelFoot nằm ngoài mọi .tab-content',
    indexHtml.includes('id="guestPanelFoot"') &&
    !/tab-content[\s\S]*id="guestPanelFoot"[\s\S]*<\/div><!-- \/member-only -->/.test(indexHtml));
  ok('index.html: #cellPanelVer không nằm trong khối .guest-only (hiện cả 2 chế độ)',
    /id="guestPanelFoot"[\s\S]{0,400}id="cellPanelVer"/.test(indexHtml) &&
    !/<div class="guest-only"[\s\S]{0,600}id="cellPanelVer"/.test(indexHtml));
  ok('index.html: #cellPanelVer là nhãn tĩnh (không <a href>/can-link)',
    !/<a[^>]*id="cellPanelVer"/.test(indexHtml) && !indexHtml.includes('can-link'));
  ok('index.html: #cellPanelTrial (số lượt thử)', indexHtml.includes('id="cellPanelTrial"'));
  // Chân version phải là con của .sidebar (để nằm đáy left bar) nhưng KHÔNG
  // nằm trong .sidebar-body (vùng cuộn) — nếu không sẽ trôi theo nội dung.
  ok('index.html: #guestPanelFoot là con .sidebar, ngoài .sidebar-body', (function () {
    const iFoot = indexHtml.indexOf('id="guestPanelFoot"');
    const iBody = indexHtml.indexOf('class="sidebar-body"');
    const iBodyEnd = indexHtml.indexOf('</div>', indexHtml.indexOf('id="tab-lookuphistory"'));
    const iSidebar = indexHtml.indexOf('id="sidebar"');
    return iSidebar >= 0 && iFoot > iSidebar && iFoot > iBody && iFoot > iBodyEnd;
  })());
  ok('index.html KHÔNG còn offset header cho guest', !indexHtml.includes('body.guest-mode .header'));
  ok('index.html có CSS panel-foot', indexHtml.includes('.panel-foot'));
  ok('index.html có CSS guest mode', indexHtml.includes('body.guest-mode'));
  ok('index.html mở popup đăng ký (AuthPopup) thay link /login.html#register',
    indexHtml.includes("AuthPopup.open('register')"));

  console.log('\n== Wiring version (chỉ admin) ==');
  const versionHtml = read(path.join('public', 'version.html'));
  ok('version.html gate admin (isAdmin → goLogin khi không đủ quyền)', /!Auth\.isAdmin\(\)[\s\S]{0,160}Auth\.goLogin\(\)/.test(versionHtml));
  ok('version.html: non-admin dùng Auth.goLogin (về trang chủ, không /login.html)', /Auth\.goLogin\(\)/.test(versionHtml));
  const versionJs = read(path.join('public', 'version.js'));
  ok('version.js có renderPanelVersion', versionJs.includes('renderPanelVersion'));
  ok('version.js KHÔNG còn renderBadge', !versionJs.includes('renderBadge'));
  ok('auth.js KHÔNG còn badge navbar', !authjs.includes('verBadgeCommon'));
  ok('auth.js gọi renderPanelVersion', authjs.includes('renderPanelVersion'));
  ok('auth.js ẩn mục version trong Tools với non-admin', /\$\{isAdmin \? `[^`]*\/version\.html/.test(authjs));
  const adminHtml = read(path.join('public', 'admin.html'));
  ok('admin.html có sidebar item version', adminHtml.includes('data-section="version"'));
  ok('admin.html có #section-version', adminHtml.includes('id="section-version"'));
  ok('admin.html có #verAdminList', adminHtml.includes('id="verAdminList"'));
  ok('admin.html có CSS .ver-', adminHtml.includes('.ver-entry'));
  const adminJs = read(path.join('public', 'admin.js'));
  ok('admin.js render changelog ở section version', /version[\s\S]{0,120}renderChangelog\('verAdminList'/.test(adminJs));
  ok('server.js /api/version/changelog yêu cầu admin',
    /app\.get\(['"]\/api\/version\/changelog['"],\s*requireAuth,\s*requireAdmin/.test(server));
  ok('server.js /api/version vẫn công khai',
    /app\.get\(['"]\/api\/version['"],\s*\(req, res\)/.test(server));
  ok('server.js có ensureGuestCookie (phát cookie ký HMAC)', server.includes('ensureGuestCookie'));
  ok('server.js dùng getStatus(guestKey, guestNetKey) khoá kép', /getStatus\(\s*guestKey,\s*guestNetKey\s*\)/.test(server));

  const loginHtml = read(path.join('public', 'login.html'));
  ok('login.html mở tab Đăng ký theo #register', loginHtml.includes("'#register'"));
  ok('login.html có link về trang chủ', loginHtml.includes('/index.html'));

  console.log('\n== Wiring tools ==');
  const ebn = read(path.join('public', 'tools', 'ebn-eci.html'));
  ok('ebn-eci.html bỏ redirect login', !ebn.includes("window.location.href = '/login.html'"));
  ok('ebn-eci.html vẫn initNavbar', ebn.includes('Auth.initNavbar()'));
  const port = read(path.join('public', 'tools', 'port-check.html'));
  ok('port-check.html bỏ redirect login', !/window\.location\.href = '\/login\.html'/.test(port));
  const ip = read(path.join('public', 'tools', 'ip-tracker.html'));
  ok('ip-tracker.html YÊU CẦU đăng nhập (dùng Auth.goLogin)', /if \(!Auth\.isLoggedIn\(\)\) \{ Auth\.goLogin\(\); return; \}/.test(ip));

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('Lỗi test:', e); process.exit(1); });
