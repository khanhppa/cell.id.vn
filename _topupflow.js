/**
 * E2E HTTP cho luồng nạp điểm payOS (test mode) + hạn thanh toán + huỷ đơn.
 * Chạy: node _topupflow.js
 *
 * Dùng DB tạm + PORT tạm, KHÔNG đụng database.sqlite.
 * Kiểm tra:
 *  1. GET /api/credits/packages -> available=true, test_mode=true
 *  2. POST /api/credits/topup/create -> có expires_at ISO, test_mode, description
 *  2b. payload gửi payOS: returnUrl/cancelUrl trỏ /payment-result.html?order=
 *  3. GET  /api/credits/topup/:code -> PENDING, expires_at còn hạn
 *  4. POST /api/credits/topup/:code/mock-paid -> PAID + cộng điểm
 *  5. GET danh sách đơn -> chứa đơn vừa tạo, có expires_at
 *  6. Đơn thứ 2 rồi POST .../cancel -> CANCELLED, không cộng điểm
 *  7. Đơn quá hạn (expires_at trong quá khứ) -> GET tự chuyển EXPIRED
 *  8. User khác KHÔNG xem/huỷ/mock được đơn của người khác -> 403
 *  8b. POST /api/credits/topup/:code/sync -> 200 (PENDING), 403 user khác, 404 đơn lạ
 *  9. mode=production (test_mode=0) -> mock-paid trả 400
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

const tmpDb = path.join(os.tmpdir(), `topup-flow-${process.pid}-${Date.now()}.sqlite`);
const realDbPath = path.join(path.dirname(__dirname), 'database.sqlite');

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
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-topupflow';

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

async function main() {
  process.env.PORT = String(await pickFreePort());
  const app = require('./server');
  const db = require('./database');
  const credits = require('./credits');
  const payosMod = require('./payos');

  // Bọc createPaymentLink để bắt payload thật gửi cho payOS (response HTTP không
  // phơi returnUrl/cancelUrl, nên phải nhìn từ phía payos module).
  const linkCalls = [];
  const realCreatePaymentLink = payosMod.createPaymentLink;
  payosMod.createPaymentLink = async function (opts) {
    linkCalls.push(opts);
    return realCreatePaymentLink.call(this, opts);
  };

  const sqlRun = (sql, params = []) => new Promise((res, rej) =>
    db.run(sql, params, function (err) { err ? rej(err) : res(this); }));
  const sqlGet = (sql, params = []) => new Promise((res, rej) =>
    db.get(sql, params, (err, row) => err ? rej(err) : res(row)));

  await waitPort(Number(process.env.PORT));

  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('pw', 4);
  for (const u of ['flow_admin', 'flow_user', 'flow_other']) {
    await sqlRun('INSERT INTO users (username, password, role, status) VALUES (?, ?, ?, ?)',
      [u, hash, u === 'flow_admin' ? 'admin' : 'user', 'active']);
  }

  const setSetting = (k, v) => sqlRun(
    `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [k, v]);

  await setSetting('credit_enabled', '1');
  await setSetting('payos_enabled', '1');
  await setSetting('payos_test_mode', '1');
  await setSetting('payos_client_id', 'test_client');
  await setSetting('payos_api_key', 'test_api_key');
  await setSetting('payos_checksum_key', 'test_checksum_key');
  await setSetting('topup_vnd_per_credit', '1000');
  await setSetting('topup_min_vnd', '10000');
  await setSetting('topup_max_vnd', '5000000');

  // 1 gói nạp đang bật (DB tự seed 3 gói; tạo thêm gói nhận diện được).
  await sqlRun(`INSERT INTO topup_packages (label, amount_vnd, credits, sort_order, active)
                VALUES (?, ?, ?, ?, 1)`,
    ['Gói test 50k', 50000, 50, 1]);

  const login = async (u) => {
    const r = await req('POST', '/api/login', { username: u, password: 'pw' });
    return r.body && r.body.token ? r.body.token : null;
  };
  const userToken = await login('flow_user');
  const otherToken = await login('flow_other');
  const adminToken = await login('flow_admin');
  ok('đăng nhập 3 tài khoản lấy token', !!userToken && !!otherToken && !!adminToken);

  const uid = (await sqlGet('SELECT id FROM users WHERE username = ?', ['flow_user'])).id;

  console.log('\n== 1. /api/credits/packages ==');
  const pk = await req('GET', '/api/credits/packages', undefined, userToken);
  ok('packages -> 200', pk.status === 200, pk.body);
  ok('available = true', pk.body && pk.body.available === true, pk.body);
  ok('test_mode = true', pk.body && pk.body.test_mode === true, pk.body);
  ok('min/max đúng', pk.body && pk.body.min_vnd === 10000 && pk.body.max_vnd === 5000000, pk.body);
  const pkgId = pk.body && pk.body.packages && pk.body.packages[0] && pk.body.packages[0].id;
  ok('có ít nhất 1 gói nạp', !!pkgId, pk.body);
  const pkg = (await sqlGet(`SELECT id, credits FROM topup_packages WHERE label = ?`, ['Gói test 50k']));
  ok('gói test tồn tại', !!pkg);
  const pkgAmount = 50000, pkgCredits = 50;

  console.log('\n== 2. tạo đơn theo gói ==');
  const c1 = await req('POST', '/api/credits/topup/create', { package_id: pkg.id }, userToken);
  ok('create -> 200', c1.status === 200, c1.body);
  ok('trả order_code số', c1.body && Number.isFinite(Number(c1.body.order_code)), c1.body);
  ok('trả test_mode = true', c1.body && c1.body.test_mode === true, c1.body);
  ok('trả expires_at ISO', c1.body && /^\d{4}-\d{2}-\d{2}T/.test(c1.body.expires_at || ''), c1.body);
  ok('expires_at ~ +15 phút',
    c1.body && Math.abs(new Date(c1.body.expires_at).getTime() - Date.now() - 15 * 60000) < 60000,
    c1.body && c1.body.expires_at);
  ok('trả description (nội dung CK)', !!(c1.body && c1.body.description), c1.body);
  ok('trả account_number', !!(c1.body && c1.body.account_number), c1.body);
  // Test mode: `qrCode` là URL nội bộ (/topup.html?mock=1) chứ không phải chuỗi
  // VietQR → server KHÔNG dựng ảnh QR (client hiện nút mở trang payOS thay thế).
  ok('test mode: qr_image rỗng (không phải chuỗi VietQR)', c1.body && !c1.body.qr_image, c1.body && c1.body.qr_image);
  ok('test mode: qr_code vẫn là link nội bộ', c1.body && /\/topup\.html\?order=\d+&mock=1$/.test(c1.body.qr_code || ''), c1.body && c1.body.qr_code);
  const code1 = Number(c1.body.order_code);

  console.log('\n== 2b. returnUrl / cancelUrl gửi cho payOS ==');
  const call1 = linkCalls[linkCalls.length - 1];
  ok('createPaymentLink được gọi 1 lần', linkCalls.length === 1, linkCalls.length);
  const rUrl = (call1 && call1.returnUrl) || '';
  const xUrl = (call1 && call1.cancelUrl) || '';
  ok('returnUrl trỏ /payment-result.html?order=<code>',
    /\/payment-result\.html\?order=\d+$/.test(rUrl), rUrl);
  ok('returnUrl đúng mã đơn', rUrl.endsWith('/payment-result.html?order=' + code1), rUrl);
  ok('cancelUrl trỏ /payment-result.html?order=<code>&status=cancel',
    xUrl.endsWith('/payment-result.html?order=' + code1 + '&status=cancel'), xUrl);
  ok('returnUrl KHÔNG còn trỏ credits.html', !/credits\.html/.test(rUrl + xUrl), rUrl);
  ok('returnUrl là URL tuyệt đối', /^https?:\/\//.test(rUrl), rUrl);
  ok('amount gửi payOS khớp gói', call1 && Number(call1.amount) === pkgAmount, call1 && call1.amount);
  ok('orderCode gửi payOS khớp đơn', call1 && Number(call1.orderCode) === code1, call1 && call1.orderCode);

  console.log('\n== 3. xem đơn ==');
  const g1 = await req('GET', `/api/credits/topup/${code1}`, undefined, userToken);
  ok('get -> 200', g1.status === 200, g1.body);
  ok('status PENDING', g1.body && g1.body.status === 'PENDING', g1.body);
  ok('có expires_at', !!(g1.body && g1.body.expires_at), g1.body);
  ok('có package_label', g1.body && g1.body.package_label === 'Gói test 50k', g1.body);
  ok('amount_vnd khớp gói', g1.body && Number(g1.body.amount_vnd) === pkgAmount, g1.body);
  ok('GET đơn PENDING: qr_image rỗng ở test mode', g1.body && !g1.body.qr_image, g1.body && g1.body.qr_image);

  console.log('\n== 8. cách ly đơn giữa các user ==');
  const gOther = await req('GET', `/api/credits/topup/${code1}`, undefined, otherToken);
  ok('user khác xem đơn -> 403', gOther.status === 403, gOther.body);
  const cOther = await req('POST', `/api/credits/topup/${code1}/cancel`, {}, otherToken);
  ok('user khác huỷ đơn -> 403', cOther.status === 403, cOther.body);
  const mOther = await req('POST', `/api/credits/topup/${code1}/mock-paid`, undefined, otherToken);
  ok('user khác mock-paid -> 403', mOther.status === 403, mOther.body);

  console.log('\n== 8b. đối soát /sync (fallback khi webhook không tới) ==');
  const balBeforeSync = await credits.getBalance(uid);
  // payOS test mode: không có link thật → lấy trạng thái thất bại. Route PHẢI
  // trả 200 + synced=false (không được 400/500 làm đỏ nhịp poll của client).
  const sync1 = await req('POST', `/api/credits/topup/${code1}/sync`, undefined, userToken);
  ok('sync đơn PENDING -> 200 (không chặn luồng poll)', sync1.status === 200, sync1.body);
  ok('sync đơn PENDING: trả về đúng order_code/status hiện tại',
    sync1.body && (sync1.body.status === 'PENDING' || sync1.body.status === 'PAID'), sync1.body);
  ok('sync KHÔNG cộng điểm khi payOS không xác nhận PAID',
    (await credits.getBalance(uid)) === balBeforeSync, await credits.getBalance(uid));

  const syncOther = await req('POST', `/api/credits/topup/${code1}/sync`, undefined, otherToken);
  ok('user khác đối soát đơn -> 403', syncOther.status === 403, syncOther.body);
  const syncMissing = await req('POST', '/api/credits/topup/99999999/sync', undefined, userToken);
  ok('đối soát đơn không tồn tại -> 404', syncMissing.status === 404, syncMissing.body);
  const syncNoAuth = await req('POST', `/api/credits/topup/${code1}/sync`, undefined, null);
  ok('đối soát không token -> 401', syncNoAuth.status === 401, syncNoAuth.body);

  console.log('\n== 4. giả lập đã trả tiền ==');
  const balBefore = await credits.getBalance(uid);
  const m1 = await req('POST', `/api/credits/topup/${code1}/mock-paid`, undefined, userToken);
  ok('mock-paid -> 200', m1.status === 200, m1.body);
  ok('cộng đúng điểm của gói', (await credits.getBalance(uid)) - balBefore === pkgCredits,
    { before: balBefore, after: await credits.getBalance(uid) });
  const gPaid = await req('GET', `/api/credits/topup/${code1}`, undefined, userToken);
  ok('đơn chuyển PAID', gPaid.body && gPaid.body.status === 'PAID', gPaid.body);
  await req('POST', `/api/credits/topup/${code1}/mock-paid`, undefined, userToken);
  ok('mock lần 2 không cộng thêm điểm', (await credits.getBalance(uid)) - balBefore === pkgCredits);

  console.log('\n== 5. danh sách đơn ==');
  const list = await req('GET', '/api/credits/topup?limit=20', undefined, userToken);
  ok('list -> 200', list.status === 200, list.body);
  ok('list là mảng và chứa đơn vừa tạo',
    Array.isArray(list.body) && list.body.some(o => Number(o.order_code) === code1), list.body);
  ok('mọi đơn có expires_at',
    Array.isArray(list.body) && list.body.every(o => o.expires_at), list.body);

  console.log('\n== 6. huỷ đơn ==');
  const c2 = await req('POST', '/api/credits/topup/create', { package_id: pkg.id }, userToken);
  const code2 = Number(c2.body.order_code);
  const balBeforeCancel = await credits.getBalance(uid);
  const cx = await req('POST', `/api/credits/topup/${code2}/cancel`, { reason: 'thử huỷ' }, userToken);
  ok('cancel -> 200', cx.status === 200, cx.body);
  ok('cancel trả status CANCELLED', cx.body && cx.body.status === 'CANCELLED', cx.body);
  ok('huỷ KHÔNG cộng điểm', (await credits.getBalance(uid)) === balBeforeCancel, balBeforeCancel);
  const cancelPaid = await req('POST', `/api/credits/topup/${code1}/cancel`, {}, userToken);
  ok('huỷ đơn đã PAID -> 400', cancelPaid.status === 400, cancelPaid.body);
  await req('POST', `/api/credits/topup/${code2}/mock-paid`, undefined, userToken);
  ok('mock đơn đã huỷ không cộng điểm', (await credits.getBalance(uid)) === balBeforeCancel);

  console.log('\n== 7. đơn quá hạn tự chuyển EXPIRED ==');
  const c3 = await req('POST', '/api/credits/topup/create', { package_id: pkg.id }, userToken);
  const code3 = Number(c3.body.order_code);
  await sqlRun(`UPDATE payment_orders SET expires_at = datetime('now', '-5 minutes') WHERE order_code = ?`, [code3]);
  const gExpired = await req('GET', `/api/credits/topup/${code3}`, undefined, userToken);
  ok('đơn quá hạn -> EXPIRED khi xem', gExpired.body && gExpired.body.status === 'EXPIRED', gExpired.body);

  console.log('\n== 9. tắt test mode -> chặn mock ==');
  await setSetting('payos_test_mode', '0');
  const c4 = await req('POST', '/api/credits/topup/create', { package_id: pkg.id }, userToken);
  const code4 = c4.body && c4.body.order_code ? Number(c4.body.order_code) : null;
  if (code4) {
    const mDenied = await req('POST', `/api/credits/topup/${code4}/mock-paid`, undefined, userToken);
    ok('test_mode=0 -> mock-paid 400', mDenied.status === 400, mDenied.body);
  } else {
    ok('test_mode=0 -> tạo đơn thất bại (không gọi được payOS thật)', c4.status >= 400, c4.body);
  }

  console.log('\n== 10. nạp điểm xong tra cứu được (bug user báo) ==');
  await setSetting('payos_test_mode', '1');
  await setSetting('credit_enabled', '1');
  await setSetting('credit_cost_per_lookup', '1');
  await setSetting('credit_allow_negative', '0');
  await setSetting('enable_opencellid', '0');
  await setSetting('enable_opencellid_web', '0');
  // User 0 điểm + 2 cell CÓ toạ độ trong CSDL nội bộ (case lỗi hay gặp).
  await sqlRun('UPDATE users SET credit_balance = 0 WHERE id = ?', [uid]);
  const bCells = [
    { mcc: 452, mnc: 4, lac: 9301, cellid: 33300101 },
    { mcc: 452, mnc: 4, lac: 9301, cellid: 33300102 },
  ];
  for (let i = 0; i < bCells.length; i++) {
    await sqlRun('INSERT INTO cells (mcc, mnc, lac, cellid, lat, lng, range) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [bCells[i].mcc, bCells[i].mnc, bCells[i].lac, bCells[i].cellid, 10.0 + i * 0.01, 106.0 + i * 0.01, 500]);
  }
  const bUpload = 'up-topupflow-1';
  const d1 = await req('POST', '/api/cells/resolve-batch',
    { cells: bCells, uploadId: bUpload, fileName: 't.xlsx', roundIdx: 0 }, userToken);
  ok('0 điểm -> 402 (chặn từ đầu, chưa đốt quota)', d1.status === 402, { s: d1.status, b: d1.body });
  ok('0 điểm -> reason insufficient', d1.body && d1.body.reason === 'insufficient', d1.body);
  ok('0 điểm -> số dư không bị trừ âm', Number((await sqlGet('SELECT credit_balance b FROM users WHERE id = ?', [uid])).b) === 0);

  // Nạp điểm (client cũng setCreditBalance từ /api/credits/balance khi quay lại tab).
  await sqlRun('UPDATE users SET credit_balance = 5 WHERE id = ?', [uid]);
  const balAfterTopup = await req('GET', '/api/credits/balance', undefined, userToken);
  ok('/api/credits/balance trả số dư MỚI = 5', Number(balAfterTopup.body && balAfterTopup.body.balance) === 5, balAfterTopup.body);

  const d2 = await req('POST', '/api/cells/resolve-batch',
    { cells: bCells, uploadId: bUpload, fileName: 't.xlsx', roundIdx: 0 }, userToken);
  ok('nạp xong -> 200', d2.status === 200, d2.status);
  ok('nạp xong -> trả toạ độ cả 2 cell',
    (d2.body.results || []).filter(x => x.lat && x.lon).length === 2, d2.body.results);
  ok('nạp xong -> results[].charged = true',
    (d2.body.results || []).every(x => x.charged === true), d2.body.results);
  ok('nạp xong -> credit.charged = 2', d2.body.credit && d2.body.credit.charged === 2, d2.body.credit);
  ok('nạp xong -> số dư 5 - 2 = 3',
    Number((await sqlGet('SELECT credit_balance b FROM users WHERE id = ?', [uid])).b) === 3);

  const d3 = await req('POST', '/api/cells/resolve-batch',
    { cells: bCells, uploadId: bUpload, fileName: 't.xlsx', roundIdx: 0 }, userToken);
  ok('retry cùng vòng -> credit.duplicate = true', d3.body.credit && d3.body.credit.duplicate === true, d3.body.credit);
  ok('retry cùng vòng -> không trừ lại (vẫn 3)',
    Number((await sqlGet('SELECT credit_balance b FROM users WHERE id = ?', [uid])).b) === 3);

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exitCode = fail ? 1 : 0;
  try { if (app && app.close) await new Promise(r => app.close(r)); } catch (e) {}
  try { db.close(); } catch (e) {}
  for (const f of [tmpDb, tmpDb + '-journal', tmpDb + '-wal', tmpDb + '-shm']) {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) {}
  }
}

main().catch(e => { console.error('LỖI TEST:', e); process.exit(1); });
