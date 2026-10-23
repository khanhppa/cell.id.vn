/**
 * Test RUNTIME cho nguồn `google` (Google Geolocation API).
 * Chạy: node _googlesource.test.js
 *
 * Boot server thật trên DB tạm + PORT tạm (patch sqlite3 giống _batchcredit.test.js),
 * MOCK `axios.post` để không tốn tiền/không cần mạng. Phủ:
 *  - Shape request: considerIp=false, radioType chữ thường, cellTowers[] số nguyên.
 *  - LTE gửi ECI (long) thay vì raw short.
 *  - NR gửi newRadioCellId và KHÔNG gửi cellId.
 *  - Cell vi phạm range bị loại khỏi mảng; gsm thiếu LAC bị loại.
 *  - 400/403/429 và response thiếu location → coi như miss, KHÔNG ghi toạ độ.
 *  - Geo gate: toạ độ ngoài khung MCC → miss, không ghi DB.
 *  - Option B: chỉ cell miss hết nguồn khác mới gọi Google; gom nhóm theo
 *    `max_google_per_batch`; toạ độ của nhóm gán chung cho mọi cell trong nhóm.
 *  - Không cấu hình key → không gọi mạng.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

const tmpDb = path.join(os.tmpdir(), `googlesource-test-${process.pid}-${Date.now()}.sqlite`);
const realDbPath = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.join(path.dirname(__dirname), 'database.sqlite');
// database.js ưu tiên DB_PATH — đặt biến này khi chạy test để cả hai phía trỏ cùng một file tạm.

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

// ---- MOCK axios.post: mọi request ra Google đều đi qua đây ----
const axios = require('axios');
const gCalls = [];          // { url, body, opts }
let gResponder = null;      // (url, body) => { status, data } | data — test tự đặt
const realPost = axios.post;
axios.post = async function (url, body, opts) {
  if (typeof url === 'string' && url.indexOf('geolocation/v1/geolocate') !== -1) {
    gCalls.push({ url, body, opts });
    if (!gResponder) return { status: 500, data: { error: { message: 'no responder' } } };
    const r = gResponder(url, body);
    if (r instanceof Error) throw r;
    return r.data === undefined ? { status: 200, data: r } : r;
  }
  return realPost.apply(this, arguments);
};

function pickFreePort() {
  const net = require('net');
  const srv = net.createServer();
  return new Promise((resolve, reject) => {
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-google';
process.env.GOOGLE_MAPS_API_KEY = '';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`); }
}

const BASE = () => `http://127.0.0.1:${process.env.PORT}`;
function req(method, urlPath, body, token) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const r = http.request(BASE() + urlPath, {
      method,
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        data ? { 'Content-Length': data.length } : {},
        token ? { Authorization: 'Bearer ' + token } : {}
      )
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(buf); } catch (e) { parsed = buf; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function waitPort(port) {
  const net = require('net');
  await new Promise(resolve => {
    const t0 = Date.now();
    (function poll() {
      const s = net.connect(port, '127.0.0.1');
      s.on('connect', () => { s.destroy(); resolve(); });
      s.on('error', () => {
        s.destroy();
        if (Date.now() - t0 > 8000) return resolve();
        setTimeout(poll, 120);
      });
    })();
  });
}

main().catch(e => { console.error('LỖI TEST:', e); process.exit(1); });

async function main() {
  process.env.PORT = String(await pickFreePort());
  require('./server');
  const db = require('./database');
  const srvSrc = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  const admSrc = fs.readFileSync(path.join(__dirname, 'public', 'admin.js'), 'utf8');
  const admHtml = fs.readFileSync(path.join(__dirname, 'public', 'admin.html'), 'utf8');
  const sqlRun = (sql, params = []) => new Promise((res, rej) =>
    db.run(sql, params, function (err) { err ? rej(err) : res(this); }));
  const sqlGet = (sql, params = []) => new Promise((res, rej) =>
    db.get(sql, params, (err, row) => err ? rej(err) : res(row)));
  await waitPort(Number(process.env.PORT));

  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('pw', 4);
  await sqlRun('INSERT INTO users (username, password, role, status) VALUES (?, ?, ?, ?)',
    ['gg_user', hash, 'user', 'active']);
  const userId = (await sqlGet('SELECT id FROM users WHERE username = ?', ['gg_user'])).id;

  const setSetting = (k, v) => sqlRun(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [k, v]);
  await setSetting('credit_enabled', '0');
  await setSetting('max_online_resolve', '500');
  await setSetting('max_google_per_batch', '10');
  // Tắt hết nguồn per-cell; chỉ bật google + nhập key trong DB (DB-first).
  for (const t of ['opencellid', 'opencellid_web', 't0stbrot', 'combain']) {
    await sqlRun('UPDATE data_sources SET enabled = 0 WHERE type = ?', [t]);
  }
  await sqlRun("UPDATE data_sources SET enabled = 1, api_key = 'TEST_GOOGLE_KEY' WHERE type = 'google'");

  const login = await req('POST', '/api/login', { username: 'gg_user', password: 'pw' });
  const token = login.body && login.body.token;
  ok('đăng nhập lấy được token', !!token, login.body);

  // Toạ độ hợp lệ VN cho MCC 452 (dùng để Google trả về).
  const VN = { lat: 21.0278, lng: 105.8342 };
  const FOUND = { location: VN, accuracy: 750 };

  console.log('\n== 0. static: registry + flag an toàn ==');
  ok("ONLINE_SOURCE_TYPES có 'google'", /ONLINE_SOURCE_TYPES = \[[^\]]*'google'/.test(srvSrc));
  ok('google có priority 25 trong defaults', /google: \{ name: 'Google Geolocation', priority: 25 \}/.test(srvSrc));
  ok('google nằm trong ONLINE_SOURCE_DEFAULT_DISABLED (mặc định tắt)',
    /ONLINE_SOURCE_DEFAULT_DISABLED = \['opencellid_web', 'google'\]/.test(srvSrc));
  // Khoá chống rò toạ độ theo IP server: thiếu considerIp:false là lỗi nghiêm trọng.
  ok('resolver gửi considerIp: false (chống rò toạ độ IP server)',
    /considerIp: false/.test(srvSrc));
  ok('getGoogleKey fallback process.env.GOOGLE_MAPS_API_KEY',
    /process\.env\.GOOGLE_MAPS_API_KEY/.test(srvSrc));
  ok("getGoogleKeyFromDB đọc data_sources type='google'",
    /WHERE type = 'google' AND enabled = 1 AND api_key IS NOT NULL/.test(srvSrc));
  ok('setting max_google_per_batch có trong SETTING_KEYS',
    /SETTING_KEYS = \[[^\]]*'max_google_per_batch'/.test(srvSrc));
  ok('setting max_google_per_batch có default 10', /max_google_per_batch: '10'/.test(srvSrc));
  ok('database.js seed max_google_per_batch', /max_google_per_batch', '10'/.test(
    fs.readFileSync(path.join(__dirname, 'database.js'), 'utf8')));
  ok('admin.html có option google', /<option value="google">/.test(admHtml));
  ok('admin.html có input setGoogleMax', /id="setGoogleMax"/.test(admHtml));
  ok('admin.js có nhánh google trong onSourceTypeChange', /type === 'google'/.test(admSrc));
  ok('admin.js lưu max_google_per_batch', /settings\.max_google_per_batch = googleMax/.test(admSrc));
  ok('admin.js có badge cho google', /s === 'google'/.test(admSrc));

  console.log('\n== 1. shape request: considerIp false + số nguyên + radioType chữ thường ==');
  gCalls.length = 0;
  gResponder = () => ({ status: 200, data: FOUND });
  const single = await req('GET',
    '/api/cells/resolve?mcc=452&mnc=4&lac=9101&cellid=169495310', undefined, token);
  ok('HTTP 200 (resolve 1 cell)', single.status === 200, single.body);
  ok('source = google', single.body.source === 'google', single.body.source);
  ok('gọi đúng endpoint geolocation/v1/geolocate',
    gCalls.length === 1 && gCalls[0].url.indexOf('geolocation/v1/geolocate') !== -1 && /key=TEST_GOOGLE_KEY/.test(gCalls[0].url),
    gCalls.map(c => c.url));
  const b1 = gCalls[0].body;
  ok('considerIp = false', b1.considerIp === false, b1.considerIp);
  ok('radioType = lte (chữ thường)', b1.radioType === 'lte', b1.radioType);
  ok('homeMobileCountryCode = 452 (number)', b1.homeMobileCountryCode === 452, b1.homeMobileCountryCode);
  ok('cellTowers có 1 phần tử', Array.isArray(b1.cellTowers) && b1.cellTowers.length === 1, b1.cellTowers);
  const t1 = b1.cellTowers[0];
  ok('cellId là number', typeof t1.cellId === 'number', typeof t1.cellId);
  ok('mobileCountryCode/mobileNetworkCode là number',
    typeof t1.mobileCountryCode === 'number' && typeof t1.mobileNetworkCode === 'number', t1);
  ok('KHÔNG gửi newRadioCellId cho lte', t1.newRadioCellId === undefined, t1);
  ok('toạ độ trả về dùng accuracy làm range', single.body.data.range === 750, single.body.data.range);
  ok('range/lat/lon khớp response Google',
    single.body.data.lat === VN.lat && single.body.data.lon === VN.lng, single.body.data);
  const stored = await sqlGet('SELECT lat, lng, source FROM cells WHERE cellid = ? AND source = ?', ['169495310', 'google']);
  ok('đã ghi DB với source google', !!stored && !!stored.lat, stored);

  console.log('\n== 2. NR dùng newRadioCellId, KHÔNG có cellId ==');
  gCalls.length = 0;
  const nrRes = await req('GET',
    '/api/cells/resolve?mcc=452&mnc=4&lac=100&cellid=123456789&radio=NR', undefined, token);
  ok('HTTP 200 (nr)', nrRes.status === 200, nrRes.body);
  const b2 = gCalls[0].body;
  ok('radioType = nr', b2.radioType === 'nr', b2.radioType);
  ok('có newRadioCellId = 123456789', b2.cellTowers[0].newRadioCellId === 123456789, b2.cellTowers[0]);
  ok('KHÔNG có cellId khi nr', b2.cellTowers[0].cellId === undefined, b2.cellTowers[0]);

  console.log('\n== 3. cell vượt range bị loại; gsm thiếu LAC bị loại ==');
  gCalls.length = 0;
  gResponder = () => ({ status: 200, data: FOUND });
  // "12345678901234567890" > uint32 và không parse được int nguyên → loại.
  const badCells = [
    { mcc: 452, mnc: 4, lac: 9101, cellid: '12345678901234567890' },
    { mcc: 452, mnc: 4, lac: 9101, cellid: 169495311 }
  ];
  await req('POST', '/api/cells/resolve-batch',
    { cells: badCells, uploadId: 'gg-bad-1', fileName: 'b.xlsx' }, token);
  const b3 = gCalls[0].body;
  ok('chỉ gửi 1 cell hợp lệ (loại cell vượt uint32)',
    b3.cellTowers.length === 1, b3.cellTowers);
  // GSM: locationAreaCode bắt buộc → LAC ngoài 0..65535 ⇒ luôn bị loại (không gọi Google).
  gCalls.length = 0;
  const gsmNoLac = await req('GET',
    '/api/cells/resolve?mcc=452&mnc=4&lac=99999&cellid=12345&radio=GSM', undefined, token);
  ok('gsm LAC vượt range → không gọi Google', gCalls.length === 0, gCalls.length);
  ok('gsm LAC vượt range → 404 miss', gsmNoLac.status === 404, gsmNoLac.status);

  console.log('\n== 4. lỗi API: 400 / 403 / 429 / thiếu location → miss, không ghi DB ==');
  for (const [st, label] of [[400, '400'], [403, '403'], [429, '429']]) {
    gCalls.length = 0;
    gResponder = () => ({ status: st, data: { error: { code: st, message: 'boom ' + st } } });
    const rr = await req('GET',
      `/api/cells/resolve?mcc=452&mnc=4&lac=9202&cellid=169495399&radio=LTE`, undefined, token);
    ok(`lỗi ${label} → 404 (miss, không sập)`, rr.status === 404, rr.status);
    const row = await sqlGet('SELECT id FROM cells WHERE cellid = ? AND source = ?', ['169495399', 'google']);
    ok(`lỗi ${label} → không ghi DB`, !row, row);
  }
  gResponder = () => ({ status: 200, data: { accuracy: 100 } }); // thiếu location
  const rNoLoc = await req('GET',
    '/api/cells/resolve?mcc=452&mnc=4&lac=9203&cellid=169495400&radio=LTE', undefined, token);
  ok('response thiếu location → 404 miss', rNoLoc.status === 404, rNoLoc.status);

  console.log('\n== 5. geo gate: toạ độ ngoài khung MCC → miss, không ghi DB ==');
  gCalls.length = 0;
  gResponder = () => ({ status: 200, data: { location: { lat: 55.75, lng: 37.61 }, accuracy: 500 } }); // Moscow
  const rGeo = await req('GET',
    '/api/cells/resolve?mcc=452&mnc=4&lac=9204&cellid=169495401&radio=LTE', undefined, token);

  console.log('\n== 6. Option B: chỉ cell miss hết nguồn mới gọi Google; gom nhóm ==');
  // 2 cell đã có toạ độ nội bộ + 2 cell miss; chỉ 2 cell miss được gửi Google.
  const localCells = [
    { mcc: 452, mnc: 4, lac: 9301, cellid: 170000001 },
    { mcc: 452, mnc: 4, lac: 9301, cellid: 170000002 }
  ];
  for (const c of localCells) {
    await sqlRun('INSERT OR REPLACE INTO cells (mcc, mnc, lac, cellid, lat, lng, range, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [c.mcc, c.mnc, c.lac, c.cellid, 21.01, 105.81, 400, 'csv']);
  }
  const missCells = [
    { mcc: 452, mnc: 4, lac: 9302, cellid: 170000101 },
    { mcc: 452, mnc: 4, lac: 9302, cellid: 170000102 }
  ];
  gCalls.length = 0;
  gResponder = () => ({ status: 200, data: { location: { lat: 20.99, lng: 105.85 }, accuracy: 1200 } });
  const rMix = await req('POST', '/api/cells/resolve-batch',
    { cells: [...localCells, ...missCells], uploadId: 'gg-mix-1', fileName: 'm.xlsx' }, token);
  ok('HTTP 200', rMix.status === 200, rMix.status);
  ok('chỉ 1 request Google cho cả nhóm miss', gCalls.length === 1, gCalls.length);
  ok('chỉ gửi 2 cell miss (không gửi 2 cell đã có toạ độ nội bộ)',
    gCalls[0].body.cellTowers.length === 2, gCalls[0].body.cellTowers.length);
  ok('cell local giữ source local', rMix.body.results[0].source === 'local', rMix.body.results[0]);
  ok('cell miss 1 nhận source google', rMix.body.results[2].source === 'google', rMix.body.results[2]);
  ok('cell miss 2 nhận source google', rMix.body.results[3].source === 'google', rMix.body.results[3]);
  ok('2 cell miss dùng CHUNG 1 toạ độ (multilateration)',
    rMix.body.results[2].lat === rMix.body.results[3].lat && rMix.body.results[2].lon === rMix.body.results[3].lon,
    rMix.body.results.slice(2).map(x => [x.lat, x.lon]));
  ok('range = accuracy của Google (1200)', rMix.body.results[2].range === 1200, rMix.body.results[2].range);

  console.log('\n== 7. chia nhóm theo max_google_per_batch (đổi live qua API admin) ==');
  await sqlRun("UPDATE users SET role = 'admin' WHERE id = ?", [userId]);
  const adminLogin = await req('POST', '/api/login', { username: 'gg_user', password: 'pw' });
  const admToken = adminLogin.body && adminLogin.body.token;
  const put = await req('PUT', '/api/settings', { settings: { max_google_per_batch: '2' } }, admToken);
  ok('PUT /api/settings max_google_per_batch → 200', put.status === 200, put.body);
  const getS = await req('GET', '/api/settings', undefined, admToken);
  ok('GET /api/settings trả max_google_per_batch = 2', getS.body.max_google_per_batch === '2', getS.body.max_google_per_batch);

  const five = [1, 2, 3, 4, 5].map(n => ({ mcc: 452, mnc: 4, lac: 9401, cellid: 171000000 + n }));
  gCalls.length = 0;
  gResponder = () => ({ status: 200, data: { location: { lat: 21.02, lng: 105.83 }, accuracy: 900 } });
  const rGroups = await req('POST', '/api/cells/resolve-batch',
    { cells: five, uploadId: 'gg-groups-1', fileName: 'g.xlsx' }, token);
  ok('5 cell miss với max=2 → 3 request (2+2+1)', gCalls.length === 3, gCalls.length);
  ok('kích thước nhóm lần lượt 2,2,1',
    gCalls.map(c => c.body.cellTowers.length).join(',') === '2,2,1',
    gCalls.map(c => c.body.cellTowers.length));
  ok('cả 5 cell đều có toạ độ', rGroups.body.results.filter(x => x.lat && x.lon).length === 5,
    rGroups.body.results.map(x => !!x.lat));
  const putBad = await req('PUT', '/api/settings', { settings: { max_google_per_batch: '0' } }, admToken);
  ok('max_google_per_batch = 0 vẫn hợp lệ nhưng resolver tự fallback về 10',
    putBad.status === 200, putBad.body);

  console.log('\n== 8. không có key → không gọi mạng ==');
  await sqlRun("UPDATE data_sources SET api_key = '' WHERE type = 'google'");
  gCalls.length = 0;
  gResponder = () => ({ status: 200, data: FOUND });
  const rNoKey = await req('GET',
    '/api/cells/resolve?mcc=452&mnc=4&lac=9501&cellid=179000001&radio=LTE', undefined, token);
  ok('không key → 404 miss', rNoKey.status === 404, rNoKey.status);
  ok('không key → KHÔNG gọi Google (không đốt quota)', gCalls.length === 0, gCalls.length);
  const rNoKeyBatch = await req('POST', '/api/cells/resolve-batch',
    { cells: [{ mcc: 452, mnc: 4, lac: 9501, cellid: 179000002 }], uploadId: 'gg-nokey-1', fileName: 'n.xlsx' }, token);
  ok('batch không key → không gọi Google', gCalls.length === 0, gCalls.length);
  ok('batch không key → cell vẫn miss', rNoKeyBatch.body.results[0].lat === null, rNoKeyBatch.body.results[0]);

  console.log('\n== 9. last_error: lỗi nguồn hiện cho admin (chẩn đoán "bật mà không ra") ==');
  await sqlRun("UPDATE data_sources SET enabled = 1, api_key = 'TEST_GOOGLE_KEY' WHERE type = 'google'");
  // 403 (billing/key) — đúng ca người dùng gặp: nguồn bật, key có, mà miss.
  gCalls.length = 0;
  gResponder = () => ({ status: 403, data: { error: { code: 403, message: 'PERMISSION_DENIED: You must enable Billing on the Google Cloud Project' } } });
  const rDiag = await req('GET',
    '/api/cells/resolve?mcc=452&mnc=4&lac=9601&cellid=179000101&radio=LTE', undefined, token);
  ok('403 → 404 miss', rDiag.status === 404, rDiag.status);
  const srcList = await req('GET', '/api/sources', undefined, admToken);
  ok('GET /api/sources → 200', srcList.status === 200, srcList.status);
  const gRow = (srcList.body || []).find(x => x.type === 'google');
  ok('nguồn google có trường last_error', !!gRow && 'last_error' in gRow, gRow && Object.keys(gRow));
  ok('last_error nói rõ lý do Google từ chối (billing)',
    !!(gRow && gRow.last_error && /Billing/.test(gRow.last_error) && /từ chối/.test(gRow.last_error)),
    gRow && gRow.last_error);
  ok('last_error_at là ISO timestamp',
    !!(gRow && /^\d{4}-\d{2}-\d{2}T/.test(String(gRow.last_error_at))), gRow && gRow.last_error_at);
  // Nguồn chưa từng lỗi → last_error null (không hiện badge đỏ oan).
  const ocidRow = (srcList.body || []).find(x => x.type === 'opencellid');
  ok('nguồn chưa lỗi → last_error = null', !!ocidRow && ocidRow.last_error === null, ocidRow && ocidRow.last_error);

  // Thành công về sau phải XOÁ lỗi cũ, nếu không admin thấy cảnh báo sai.
  gResponder = () => ({ status: 200, data: FOUND });
  const rOk = await req('GET',
    '/api/cells/resolve?mcc=452&mnc=4&lac=9602&cellid=179000102&radio=LTE', undefined, token);
  ok('sau đó tra thành công → 200 source google', rOk.status === 200 && rOk.body.source === 'google', rOk.body && rOk.body.source);
  const srcList2 = await req('GET', '/api/sources', undefined, admToken);
  const gRow2 = (srcList2.body || []).find(x => x.type === 'google');
  ok('tra thành công → last_error được xoá về null', !!gRow2 && gRow2.last_error === null, gRow2 && gRow2.last_error);

  console.log('\n== 10. debug hint cho admin khi miss ==');
  gCalls.length = 0;
  gResponder = () => ({ status: 403, data: { error: { code: 403, message: 'PERMISSION_DENIED: billing off' } } });
  const rDbgAdm = await req('GET',
    '/api/cells/resolve?debug=1&mcc=452&mnc=4&lac=9603&cellid=179000103&radio=LTE', undefined, admToken);
  ok('admin + debug=1 → 404 kèm payload.debug', rDbgAdm.status === 404 && !!rDbgAdm.body.debug, rDbgAdm.body);
  ok('debug nêu google key=set (key có trong DB)',
    !!(rDbgAdm.body.debug && rDbgAdm.body.debug.sources.google.key === 'set'),
    rDbgAdm.body.debug && rDbgAdm.body.debug.sources.google);
  ok('debug kèm lastError của google',
    !!(rDbgAdm.body.debug && /billing off/.test(String(rDbgAdm.body.debug.sources.google.lastError))),
    rDbgAdm.body.debug && rDbgAdm.body.debug.sources.google);
  // Không phải admin → không lộ debug (tránh rò chi tiết hạ tầng cho user thường).
  const rDbgUser = await req('GET',
    '/api/cells/resolve?debug=1&mcc=452&mnc=4&lac=9603&cellid=179000103&radio=LTE', undefined, token);
  ok('user thường + debug=1 → KHÔNG có payload.debug', rDbgUser.status === 404 && rDbgUser.body.debug === undefined, rDbgUser.body);

  console.log('\n== 11. cell ID short (eNB) không có sector → KHÔNG gửi Google (tránh ECI bịa) ==');
  gCalls.length = 0;
  gResponder = () => ({ status: 200, data: FOUND });
  // 662091 ≤ 2^20 ⇒ short; không sector ⇒ ECI dựng = 662091*256 = 169495296 (bịa sector 0).
  const rShort = await req('POST', '/api/cells/resolve-batch',
    { cells: [{ mcc: 452, mnc: 4, lac: 9401, cellid: 662091 }], uploadId: 'gg-short-1', fileName: 's.xlsx' }, token);
  ok('cell short không sector → KHÔNG gọi Google', gCalls.length === 0, gCalls.length);
  ok('cell short không sector → vẫn miss', rShort.body.results[0].lat === null, rShort.body.results[0]);
  const srcList3 = await req('GET', '/api/sources', undefined, admToken);
  const gRow3 = (srcList3.body || []).find(x => x.type === 'google');
  ok('last_error giải thích lý do loại (eNB short / không cell hợp lệ)',
    !!(gRow3 && gRow3.last_error && /(short|hợp lệ)/.test(gRow3.last_error)), gRow3 && gRow3.last_error);
  // Có sector ⇒ dựng được ECI hợp lệ ⇒ vẫn gửi bình thường.
  gCalls.length = 0;
  const rShortSector = await req('GET',
    '/api/cells/resolve?mcc=452&mnc=4&lac=9402&cellid=662091&sector=1&radio=LTE', undefined, token);
  ok('cell short CÓ sector → gửi Google (ECI = 169495297)',
    gCalls.length === 1 && gCalls[0].body.cellTowers[0].cellId === 169495297,
    gCalls.map(c => c.body.cellTowers));

  console.log('\n== 12. POST /api/call-logs/analyze — KHÔNG gọi nguồn online, không đốt quota ==');
  {
    const XLSX = require('xlsx');
    const HEADER = ['STT', 'Thời gian', 'Loại cuộc gọi', 'Số liên hệ', 'Thời lượng',
      'Mã địa danh', 'Tên địa danh', 'Cell ID', 'Sector', 'LAC', 'MCC', 'MNC'];
    // Cell KHÔNG có trong CSDL nội bộ → nếu analyze gọi nguồn online sẽ tốn quota.
    const rows = [
      [1, '2024-01-01 08:00:00', 'CALL_OUT', '0912000001', 12, 'D', 'HN', 179000201, '', 9701, 452, '04'],
      [2, '2024-01-01 08:05:00', 'CALL_IN', '0912000002', 12, 'D', 'HN', 179000202, '', 9701, 452, '04'],
    ];
    const ws = XLSX.utils.aoa_to_sheet([HEADER, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'S1');
    const xbuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    gCalls.length = 0;
    gResponder = () => ({ status: 200, data: FOUND });

    const boundary = '----ggAnalyzeBoundary' + Date.now();
    const pre = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="an.xlsx"\r\n` +
      'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n');
    const postBuf = Buffer.from(`\r\n--${boundary}--\r\n`);
    const payload = Buffer.concat([pre, xbuf, postBuf]);

    const rAn = await new Promise((resolve, reject) => {
      const r = http.request(BASE() + '/api/call-logs/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data; boundary=' + boundary,
          'Content-Length': payload.length,
          Authorization: 'Bearer ' + token
        }
      }, res => {
        let buf = '';
        res.on('data', c => buf += c);
        res.on('end', () => {
          let p = null; try { p = JSON.parse(buf); } catch (e) { p = buf; }
          resolve({ status: res.statusCode, body: p });
        });
      });
      r.on('error', reject);
      r.write(payload);
      r.end();
    });

    ok('HTTP 200', rAn.status === 200, rAn.status);
    ok('cellCount = 2', rAn.body.cellCount === 2, rAn.body.cellCount);
    ok('analyze KHÔNG gọi Google (không đốt quota)', gCalls.length === 0, gCalls.length);
    ok('cell chưa có trong CSDL → localLat = null (không tự đi tra)',
      rAn.body.cells.every(c => c.localLat === null), rAn.body.cells.map(c => c.localLat));
    ok('analyze KHÔNG ghi toạ độ vào DB',
      (await sqlGet('SELECT COUNT(*) AS c FROM cells WHERE lac = 9701')).c === 0);
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

