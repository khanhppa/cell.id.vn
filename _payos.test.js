/**
 * Test tích hợp payOS top-up. Chạy: node _payos.test.js
 *
 * Dùng DB tạm + PORT tạm (patch sqlite3 giống _topupapi.js) — không đụng DB thật.
 * Chạy ở TEST MODE (payos_test_mode='1') nên KHÔNG gọi mạng ra payOS.
 *
 * Nhóm test:
 *  1. vndToCredits — quy đổi + tỉ lệ đọc từ settings
 *  2. Ký webhook chéo: signWebhookPayload → verifyWebhook khớp
 *  3. verifyWebhook: sai chữ ký / sửa nội dung / body rỗng → {ok:false}
 *  4. Webhook E2E qua HTTP: cộng điểm 1 lần, gọi lặp KHÔNG cộng thêm
 *  5. Tạo đơn khi cổng tắt → 400; khi bật → 200 + order_code + cộng đúng điểm
 *  6. Stats tổng hợp đúng (doanh thu, điểm cấp, điểm dùng, chuyển đổi)
 *  7. Bảo mật: GET /api/settings không lộ secret
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

const tmpDb = path.join(os.tmpdir(), `payos-test-${process.pid}-${Date.now()}.sqlite`);
// database.js đặt DB ở path.dirname(__dirname) (tức thư mục CHA của repo) — xem database.js.
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
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-payos';

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
  const app = require('./server');
  const db = require('./database');
  const payos = require('./payos');
  const topup = require('./topup');

  const sqlRun = (sql, params = []) => new Promise((res, rej) =>
    db.run(sql, params, function (err) { err ? rej(err) : res(this); }));
  const sqlGet = (sql, params = []) => new Promise((res, rej) =>
    db.get(sql, params, (err, row) => err ? rej(err) : res(row)));

  await waitPort(Number(process.env.PORT));

  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('pw', 4);
  await sqlRun('INSERT INTO users (username, password, role, status) VALUES (?, ?, ?, ?)',
    ['payos_admin', hash, 'admin', 'active']);
  const buyer = await sqlRun('INSERT INTO users (username, password, role, status) VALUES (?, ?, ?, ?)',
    ['payos_buyer', hash, 'user', 'active']);
  const buyerId = buyer.lastID;

  const setSetting = (k, v) => sqlRun(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [k, v]);
  await setSetting('credit_enabled', '1');
  await setSetting('credit_cost_per_lookup', '1');
  await setSetting('credit_signup_bonus', '0');
  await setSetting('topup_vnd_per_credit', '1000');
  await setSetting('topup_min_vnd', '10000');
  await setSetting('topup_max_vnd', '5000000');
  await setSetting('payos_client_id', 'test-client');
  await setSetting('payos_api_key', 'test-api-key-secret');
  await setSetting('payos_checksum_key', 'test-checksum-key');
  await setSetting('payos_enabled', '1');
  await setSetting('payos_test_mode', '1');

  const login = await req('POST', '/api/login', { username: 'payos_admin', password: 'pw' });
  const token = login.body && login.body.token ? login.body.token : null;
  ok('đăng nhập admin lấy được token', !!token, login.body);
  const buyerLogin = await req('POST', '/api/login', { username: 'payos_buyer', password: 'pw' });
  const buyerToken = buyerLogin.body && buyerLogin.body.token;
  ok('đăng nhập buyer lấy được token', !!buyerToken, buyerLogin.body);

  // ------------------------------------------------------------------
  console.log('\n== 1. vndToCredits ==');
  ok('1000đ -> 1 điểm', (await payos.vndToCredits(1000)) === 1);
  ok('50000đ -> 50 điểm', (await payos.vndToCredits(50000)) === 50);
  await setSetting('topup_vnd_per_credit', '250');
  ok('tỉ lệ 250: 1000đ -> 4 điểm', (await payos.vndToCredits(1000)) === 4);
  ok('tỉ lệ 250: 333đ -> 1.332 điểm', Math.abs((await payos.vndToCredits(333)) - 1.332) < 1e-9,
    await payos.vndToCredits(333));
  await setSetting('topup_vnd_per_credit', '1000');

  // ------------------------------------------------------------------
  console.log('\n== 2. Ký webhook chéo (sign -> verify) ==');
  const payload = {
    orderCode: 123456789, amount: 50000, description: 'Nap diem 123456789',
    accountNumber: '12345678', reference: 'FT12345', transactionDateTime: '2026-01-01 10:00:00',
    currency: 'VND', paymentLinkId: 'pl_test_1', code: '00', desc: 'success'
  };
  const signed = await payos.signWebhookPayload(payload);
  ok('sign tạo được chữ ký', typeof signed.signature === 'string' && signed.signature.length > 0, signed.signature);
  const verified = await payos.verifyWebhook({ code: '00', success: true, data: signed.data, signature: signed.signature });
  ok('verify chấp nhận payload vừa ký', verified.ok === true, verified);
  ok('verify trả đúng orderCode', verified.ok && Number(verified.data.orderCode) === 123456789,
    verified.ok ? verified.data.orderCode : null);

  // ------------------------------------------------------------------
  console.log('\n== 3. verifyWebhook từ chối dữ liệu sai ==');
  const badSig = await payos.verifyWebhook({ code: '00', success: true, data: signed.data, signature: 'deadbeef' });
  ok('chữ ký sai -> ok=false', badSig.ok === false, badSig);
  ok('chữ ký sai -> reason invalid_signature', badSig.reason === 'invalid_signature', badSig.reason);
  const tampered = await payos.verifyWebhook({
    code: '00', success: true, signature: signed.signature,
    data: Object.assign({}, signed.data, { amount: 999999999 })
  });
  ok('sửa amount sau khi ký -> ok=false', tampered.ok === false, tampered);
  const emptyBody = await payos.verifyWebhook(null);
  ok('body rỗng -> ok=false', emptyBody.ok === false, emptyBody);

  // ------------------------------------------------------------------
  console.log('\n== 4. Tạo đơn nạp (user) ==');
  await setSetting('payos_enabled', '0');
  const offRes = await req('POST', '/api/credits/topup/create', { amount_vnd: 50000 }, buyerToken);
  ok('cổng tắt -> 400', offRes.status === 400, offRes.body);
  ok('cổng tắt -> reason gateway_disabled', offRes.body && offRes.body.reason === 'gateway_disabled', offRes.body);

  await setSetting('payos_enabled', '1');
  const tooSmall = await req('POST', '/api/credits/topup/create', { amount_vnd: 5000 }, buyerToken);
  ok('dưới mức tối thiểu -> 400', tooSmall.status === 400, tooSmall.body);
  const tooBig = await req('POST', '/api/credits/topup/create', { amount_vnd: 99999999 }, buyerToken);
  ok('trên mức tối đa -> 400', tooBig.status === 400, tooBig.body);

  const pkgs = await topup.listActivePackages();
  ok('có gói nạp seed sẵn', pkgs.length >= 1, pkgs.length);
  const pkg = pkgs[0];

  const created = await req('POST', '/api/credits/topup/create', { package_id: pkg.id }, buyerToken);
  ok('tạo đơn theo gói -> 200', created.status === 200, created.body);
  const orderCode = created.body && created.body.order_code;
  ok('trả về order_code số', Number.isFinite(Number(orderCode)), created.body);
  ok('số tiền khớp gói', created.body && Number(created.body.amount_vnd) === Number(pkg.amount_vnd), created.body);
  ok('điểm khớp gói', created.body && Number(created.body.credits) === Number(pkg.credits), created.body);
  ok('test mode trả cờ test_mode', created.body && created.body.test_mode === true, created.body);

  // Client không thể tự áp điểm: gửi credits trong body phải bị bỏ qua.
  const spoof = await req('POST', '/api/credits/topup/create',
    { amount_vnd: 50000, credits: 99999 }, buyerToken);
  ok('gửi credits giả -> vẫn tính theo tỉ lệ', spoof.body && Number(spoof.body.credits) === 50, spoof.body);
  const spoofCode = spoof.body.order_code;

  console.log('\n== 5. Trạng thái đơn + phân quyền ==');
  const st = await req('GET', '/api/credits/topup/' + orderCode, undefined, buyerToken);
  ok('chủ đơn xem được trạng thái -> 200', st.status === 200, st.body);
  ok('đơn mới có status PENDING', st.body && st.body.status === 'PENDING', st.body);

  await sqlRun('INSERT INTO users (username, password, role, status) VALUES (?, ?, ?, ?)',
    ['payos_other', hash, 'user', 'active']);
  const otherLogin = await req('POST', '/api/login', { username: 'payos_other', password: 'pw' });
  const otherToken = otherLogin.body && otherLogin.body.token;
  const forbidden = await req('GET', '/api/credits/topup/' + orderCode, undefined, otherToken);
  ok('user khác xem đơn -> 403', forbidden.status === 403, forbidden.body);
  const notFound = await req('GET', '/api/credits/topup/1', undefined, buyerToken);
  ok('đơn không tồn tại -> 404', notFound.status === 404, notFound.body);

  const balanceBefore = await sqlGet('SELECT credit_balance FROM users WHERE id = ?', [buyerId]);
  ok('số dư trước khi trả tiền = 0', Number(balanceBefore.credit_balance) === 0, balanceBefore);

  // ------------------------------------------------------------------
  console.log('\n== 6. Webhook cộng điểm + chống cộng trùng ==');
  const order = await topup.getOrderByCode(orderCode);
  const webhookData = {
    orderCode: order.order_code, amount: order.amount_vnd,
    description: order.description || payos.buildDescription(order.order_code),
    accountNumber: '0000000000', reference: 'FT_PAYOS_1',
    transactionDateTime: '2026-01-01 10:00:00', currency: 'VND',
    paymentLinkId: order.payment_link_id || ('test_' + order.order_code), code: '00', desc: 'success'
  };
  const sig = await payos.signWebhookPayload(webhookData);
  const whBody = { code: '00', desc: 'success', success: true, data: sig.data, signature: sig.signature };

  const wh1 = await req('POST', '/api/payos/webhook', whBody);
  ok('webhook lần 1 -> 200', wh1.status === 200, wh1.body);
  const after1 = await sqlGet('SELECT credit_balance FROM users WHERE id = ?', [buyerId]);
  ok('điểm cộng đúng bằng credits của đơn',
    Number(after1.credit_balance) === Number(order.credits), { got: after1.credit_balance, want: order.credits });
  const paidOrder = await topup.getOrderByCode(orderCode);
  ok('đơn chuyển sang PAID', paidOrder.status === 'PAID', paidOrder.status);
  ok('đơn ghi paid_at', !!paidOrder.paid_at, paidOrder.paid_at);
  ok('đơn ghi transaction_ref', paidOrder.transaction_ref === 'FT_PAYOS_1', paidOrder.transaction_ref);

  const wh2 = await req('POST', '/api/payos/webhook', whBody);
  const wh3 = await req('POST', '/api/payos/webhook', whBody);
  ok('webhook lần 2 -> 200', wh2.status === 200, wh2.body);
  ok('webhook lần 3 -> 200', wh3.status === 200, wh3.body);
  const after3 = await sqlGet('SELECT credit_balance FROM users WHERE id = ?', [buyerId]);
  ok('retry KHÔNG cộng thêm điểm',
    Number(after3.credit_balance) === Number(order.credits), { got: after3.credit_balance, want: order.credits });

  const txCount = await sqlGet(
    "SELECT COUNT(*) AS c FROM credit_transactions WHERE user_id = ? AND type = 'payment' AND ref = ?",
    [buyerId, topup.ledgerRef(orderCode)]);
  ok('chỉ có ĐÚNG 1 bút toán payment cho đơn', txCount.c === 1, txCount.c);

  const sumRow = await sqlGet('SELECT COALESCE(SUM(amount),0) AS s FROM credit_transactions WHERE user_id = ?', [buyerId]);
  ok('SUM(ledger) == credit_balance', Math.abs(Number(sumRow.s) - Number(after3.credit_balance)) < 1e-9,
    { ledger: sumRow.s, balance: after3.credit_balance });

  const badWh = await req('POST', '/api/payos/webhook',
    { code: '00', success: true, data: whBody.data, signature: 'badbadbad' });
  ok('webhook chữ ký sai -> 200 nhưng success=false',
    badWh.status === 200 && badWh.body && badWh.body.success === false, badWh.body);

  const ghost = await payos.signWebhookPayload(Object.assign({}, whBody.data, { orderCode: 999999999 }));
  const ghostRes = await req('POST', '/api/payos/webhook',
    { code: '00', success: true, data: ghost.data, signature: ghost.signature });
  ok('webhook đơn lạ -> 200 ignored',
    ghostRes.status === 200 && ghostRes.body && ghostRes.body.ignored === true, ghostRes.body);

  // ------------------------------------------------------------------
  console.log('\n== 7. Route admin: mock-paid + huỷ đơn ==');
  const mock = await req('POST', `/api/admin/payments/${spoofCode}/mock-paid`, {}, token);
  ok('mock-paid (admin) -> 200', mock.status === 200, mock.body);
  const mockOrder = await topup.getOrderByCode(spoofCode);
  ok('mock-paid chuyển đơn sang PAID', mockOrder.status === 'PAID', mockOrder.status);
  const balMock = await sqlGet('SELECT credit_balance FROM users WHERE id = ?', [buyerId]);
  ok('mock-paid cộng đúng 50 điểm', Number(balMock.credit_balance) === Number(order.credits) + 50, balMock);

  await req('POST', `/api/admin/payments/${spoofCode}/mock-paid`, {}, token);
  const balAfterAgain = await sqlGet('SELECT credit_balance FROM users WHERE id = ?', [buyerId]);
  ok('mock-paid lặp -> không cộng thêm',
    Number(balAfterAgain.credit_balance) === Number(order.credits) + 50, balAfterAgain);

  const toCancel = await req('POST', '/api/credits/topup/create', { amount_vnd: 20000 }, buyerToken);
  const cancelCode = toCancel.body.order_code;
  const cancelRes = await req('POST', `/api/admin/payments/${cancelCode}/cancel`, { reason: 'test' }, token);
  ok('huỷ đơn PENDING -> 200', cancelRes.status === 200, cancelRes.body);
  const cancelled = await topup.getOrderByCode(cancelCode);
  ok('đơn chuyển sang CANCELLED', cancelled.status === 'CANCELLED', cancelled.status);
  const cancelAgain = await req('POST', `/api/admin/payments/${cancelCode}/cancel`, {}, token);
  ok('huỷ đơn đã huỷ -> 400', cancelAgain.status === 400, cancelAgain.body);

  const mockForbidden = await req('POST', `/api/admin/payments/${spoofCode}/mock-paid`, {}, buyerToken);
  ok('user thường gọi mock-paid -> 403', mockForbidden.status === 403, mockForbidden.body);

  // ------------------------------------------------------------------
  console.log('\n== 8. Thống kê nạp/dùng ==');
  const statsRes = await req('GET', '/api/admin/payments/stats?days=30', undefined, token);
  ok('stats -> 200', statsRes.status === 200, statsRes.body && statsRes.body.error);
  const s = statsRes.body || {};
  const expectedRevenue = Number(order.amount_vnd) + 50000;
  ok('doanh thu = tổng đơn PAID', Number(s.topup && s.topup.revenue_vnd) === expectedRevenue,
    { got: s.topup && s.topup.revenue_vnd, want: expectedRevenue });
  ok('điểm đã cấp = order.credits + 50', Number(s.topup && s.topup.credits_granted) === Number(order.credits) + 50,
    s.topup && s.topup.credits_granted);
  ok('paid_orders = 2', Number(s.topup && s.topup.paid_orders) === 2, s.topup && s.topup.paid_orders);
  ok('cancelled_orders = 1', Number(s.topup && s.topup.cancelled_orders) === 1, s.topup && s.topup.cancelled_orders);
  ok('tổng đơn = 3', Number(s.topup && s.topup.total_orders) === 3, s.topup && s.topup.total_orders);
  ok('tỉ lệ chuyển đổi ~66.67%', Math.abs(Number(s.topup && s.topup.conversion_rate) - 66.67) < 0.02,
    s.topup && s.topup.conversion_rate);
  ok('by_status có phần tử', Array.isArray(s.by_status) && s.by_status.length >= 2, s.by_status);
  ok('có top_topup_users', Array.isArray(s.top_topup_users) && s.top_topup_users.length === 1, s.top_topup_users);
  ok('top nạp đúng user buyer', s.top_topup_users[0].user_id === buyerId, s.top_topup_users[0]);
  ok('điểm còn lại hệ thống = tổng số dư',
    Number(s.system && s.system.credits_remaining) === Number(balAfterAgain.credit_balance),
    { got: s.system && s.system.credits_remaining, want: balAfterAgain.credit_balance });

  const creditsMod = require('./credits');
  await creditsMod.chargeLookup(buyerId, 1, 'test-lookup-1', 'test lookup');
  const stats2 = await req('GET', '/api/admin/payments/stats', undefined, token);
  ok('usage.credits_used tăng sau 1 lượt tra', Number(stats2.body.usage.credits_used) === 1, stats2.body.usage);
  ok('usage.lookups = 1', Number(stats2.body.usage.lookups) === 1, stats2.body.usage);
  ok('usage.users_used = 1', Number(stats2.body.usage.users_used) === 1, stats2.body.usage);
  ok('có usage_daily cho hôm nay', (stats2.body.usage_daily || []).length === 1, stats2.body.usage_daily);
  ok('có top_usage_users', (stats2.body.top_usage_users || []).length === 1, stats2.body.top_usage_users);

  // ------------------------------------------------------------------
  console.log('\n== 9. Bảo mật: settings không lộ secret ==');
  const settingsRes = await req('GET', '/api/settings', undefined, token);
  ok('settings -> 200', settingsRes.status === 200, settingsRes.body);
  ok('payos_api_key bị che (••••)', /^••••/.test(settingsRes.body.payos_api_key), settingsRes.body.payos_api_key);
  ok('payos_checksum_key bị che', /^••••/.test(settingsRes.body.payos_checksum_key), settingsRes.body.payos_checksum_key);
  ok('có cờ payos_api_key_set = true', settingsRes.body.payos_api_key_set === true, settingsRes.body.payos_api_key_set);
  ok('secret KHÔNG xuất hiện nguyên văn',
    JSON.stringify(settingsRes.body).indexOf('test-api-key-secret') === -1);
  ok('client_id (không bí mật) vẫn xem được',
    settingsRes.body.payos_client_id === 'test-client', settingsRes.body.payos_client_id);

  const keep = await req('PUT', '/api/settings',
    { settings: { payos_api_key: settingsRes.body.payos_api_key } }, token);
  ok('PUT với bản che -> 200', keep.status === 200, keep.body);
  const stillGood = await payos.verifyWebhook({ code: '00', success: true, data: signed.data, signature: signed.signature });
  ok('checksum key vẫn nguyên vẹn sau khi gửi bản che', stillGood.ok === true, stillGood.reason);
  const apiKeyRow = await sqlGet("SELECT value FROM settings WHERE key = 'payos_api_key'");
  ok('payos_api_key trong DB không bị ghi bản che', apiKeyRow.value === 'test-api-key-secret', apiKeyRow.value);

  // ------------------------------------------------------------------
  console.log('\n== 10. Gói nạp CRUD (admin) ==');
  const newPkg = await req('POST', '/api/admin/topup/packages',
    { label: 'Gói test', amount_vnd: 30000, credits: 30, sort_order: 99, active: 1 }, token);
  ok('thêm gói -> 200', newPkg.status === 200, newPkg.body);
  const newPkgId = newPkg.body.package.id;
  const badPkg = await req('POST', '/api/admin/topup/packages', { amount_vnd: -1, credits: 1 }, token);
  ok('số tiền âm -> 400', badPkg.status === 400, badPkg.body);
  const badPkg2 = await req('POST', '/api/admin/topup/packages', { amount_vnd: 10000, credits: 0 }, token);
  ok('điểm 0 -> 400', badPkg2.status === 400, badPkg2.body);

  const updPkg = await req('PUT', '/api/admin/topup/packages/' + newPkgId,
    { label: 'Gói test 2', amount_vnd: 40000, credits: 40, sort_order: 98, active: 1 }, token);
  ok('sửa gói -> 200', updPkg.status === 200, updPkg.body);
  ok('sửa gói đổi số tiền', Number(updPkg.body.package.amount_vnd) === 40000, updPkg.body.package);

  const delPkg = await req('DELETE', '/api/admin/topup/packages/' + newPkgId, undefined, token);
  ok('xoá gói chưa có đơn -> hard delete', delPkg.status === 200 && delPkg.body.soft === false, delPkg.body);

  const delUsed = await req('DELETE', '/api/admin/topup/packages/' + pkg.id, undefined, token);
  ok('xoá gói đã có đơn -> soft delete', delUsed.status === 200 && delUsed.body.soft === true, delUsed.body);
  const pkgAfter = await topup.getPackage(pkg.id);
  ok('gói soft-delete chuyển active = 0', Number(pkgAfter.active) === 0, pkgAfter.active);

  // ------------------------------------------------------------------
  console.log('\n== 11. Danh sách đơn + filter (admin) ==');
  const listAll = await req('GET', '/api/admin/payments?limit=100', undefined, token);
  ok('list đơn -> 200', listAll.status === 200, listAll.body);
  ok('trả envelope có total', typeof listAll.body.total === 'number', listAll.body.total);
  ok('total = 3 đơn', listAll.body.total === 3, listAll.body.total);
  ok('mỗi dòng có username join', listAll.body.data.every(o => 'username' in o), listAll.body.data[0]);

  const listPaid = await req('GET', '/api/admin/payments?status=PAID', undefined, token);
  ok('filter PAID -> 2 đơn', listPaid.body.total === 2, listPaid.body.total);
  const listQ = await req('GET', '/api/admin/payments?q=payos_buyer', undefined, token);
  ok('filter theo username -> 3 đơn', listQ.body.total === 3, listQ.body.total);

  const listUser = await req('GET', '/api/credits/topup?limit=10', undefined, buyerToken);
  ok('user xem đơn của mình -> 200', listUser.status === 200, listUser.body);
  ok('user thấy 3 đơn của mình', listUser.body.length === 3, listUser.body.length);

  const bal = await req('GET', '/api/credits/balance', undefined, buyerToken);
  ok('số dư cuối = credits order + 50 - 1 (lookup)',
    Number(bal.body.balance) === Number(order.credits) + 50 - 1, bal.body.balance);

  // ------------------------------------------------------------------
  console.log('\n== 12. Gói nạp public + đơn nạp hiển thị cho user ==');
  const pubPkgs = await req('GET', '/api/credits/packages', undefined, buyerToken);
  ok('GET /api/credits/packages -> 200', pubPkgs.status === 200, pubPkgs.body);
  ok('trả available=true', pubPkgs.body.available === true, pubPkgs.body.available);
  ok('trả tỉ lệ vnd_per_credit = 1000', Number(pubPkgs.body.vnd_per_credit) === 1000, pubPkgs.body.vnd_per_credit);
  ok('gói đã tắt không còn trong danh sách public',
    pubPkgs.body.packages.every(p => p.id !== pkg.id), pubPkgs.body.packages.map(p => p.id));

  const pubNoAuth = await req('GET', '/api/credits/packages', undefined, null);
  ok('chưa đăng nhập -> 401', pubNoAuth.status === 401, pubNoAuth.body);

  // Webhook là route PUBLIC — không được đòi token.
  const whNoAuth = await req('POST', '/api/payos/webhook', { code: '00', success: true, data: {}, signature: 'x' });
  ok('webhook gọi không token vẫn vào được (không 401)', whNoAuth.status === 200, whNoAuth.status);

  console.log(`\n${pass} passed, ${fail} failed\n`);
  try { if (app && app.close) app.close(); } catch (e) {}
  try { db.close(); } catch (e) {}
  for (const f of [tmpDb, tmpDb + '-journal', tmpDb + '-wal', tmpDb + '-shm']) {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) {}
  }
  process.exit(fail ? 1 : 0);
}

