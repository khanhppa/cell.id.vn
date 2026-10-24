#!/usr/bin/env node
/**
 * bin/verify-payments.js — kiểm thử luồng NẠP ĐIỂM / THANH TOÁN, chạy hoàn toàn
 * offline (không gọi payOS, không cần mạng).
 *
 * Vì sao có file này: trước khi lên production, các hành vi "tiền bạc" phải được
 * kiểm tra tự động thay vì bấm tay:
 *   - cổng tắt / thiếu credential → API phải trả LÝ DO rõ ràng (không chỉ "chưa khả dụng");
 *   - webhook payOS cộng điểm đúng 1 lần (retry không cộng thêm);
 *   - chuyển THIẾU tiền → KHÔNG cộng điểm, đơn chuyển UNDERPAID;
 *   - đơn đã hết hạn phía mình nhưng payOS xác nhận đã thu tiền → vẫn phải cộng;
 *   - chữ ký webhook sai / đơn lạ → không cộng, không 500;
 *   - giả lập thanh toán bị KHOÁ ở production.
 *
 * Cách làm: spawn `node server.js` với DB + uploads TẠM (không đụng dữ liệu thật),
 * rồi gọi HTTP như client thật. Chữ ký webhook tạo bằng chính SDK payOS
 * (`client.crypto.createSignatureFromObj`) nên đúng thuật toán payOS dùng.
 *
 * Chạy:  node bin/verify-payments.js     (hoặc: npm run verify:payments)
 * Exit:  0 = pass hết, 1 = có test fail
 */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const http = require('http');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3');
const { PayOS } = require('@payos/node');

const ROOT = path.join(__dirname, '..');
const JWT_SECRET = 'verify-payments-secret-0123456789abcdef0123456789';
const CHECKSUM_KEY = 'verify-payments-checksum-key';
const BASIC_HASH = '$2a$04$abcdefghijklmnopqrstuuJ8YQ0z5Q5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5'; // không dùng để đăng nhập

// Client SDK chỉ dùng để KÝ payload webhook (không gọi mạng khi tạo instance).
const payosSdk = new PayOS({
  clientId: 'verify-client-id',
  apiKey: 'verify-api-key',
  checksumKey: CHECKSUM_KEY,
  baseURL: 'https://api-merchant.payos.vn'
});

let pass = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else {
    failures.push(name);
    console.log(`  FAIL  ${name}${extra === undefined ? '' : ' -> ' + JSON.stringify(extra)}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function pickFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function httpReq(port, method, urlPath, { body, token } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const req = http.request({
      host: '127.0.0.1', port, path: urlPath, method,
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        data ? { 'Content-Length': data.length } : {},
        token ? { Authorization: 'Bearer ' + token } : {}
      )
    }, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { buf += c; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(buf); } catch (_) { parsed = buf; }
        resolve({ status: res.statusCode, body: parsed, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

/** Chờ /healthz trả 200 (server khởi động + mở DB xong). */
async function waitUp(port, deadlineMs = 30000) {
  const end = Date.now() + deadlineMs;
  while (Date.now() < end) {
    try {
      const r = await httpReq(port, 'GET', '/healthz');
      if (r.status === 200) return true;
    } catch (_) { /* chưa lên */ }
    await sleep(200);
  }
  return false;
}

function startServer({ port, dbPath, uploadDir, nodeEnv }) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      NODE_ENV: nodeEnv,
      PORT: String(port),
      HOST: '127.0.0.1',
      HTTPS_PORT: '0',
      JWT_SECRET,
      GUEST_SECRET: 'verify-guest-secret-0123456789abcdef0123456789',
      TRUST_PROXY: '1',
      DB_PATH: dbPath,
      UPLOAD_DIR: uploadDir
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const logs = [];
  child.stdout.on('data', (d) => logs.push(String(d)));
  child.stderr.on('data', (d) => logs.push(String(d)));
  return { child, logs };
}

function stopServer(srv) {
  return new Promise((resolve) => {
    if (!srv || !srv.child || srv.child.exitCode !== null) return resolve();
    srv.child.once('exit', () => resolve());
    try { srv.child.kill('SIGKILL'); } catch (_) { resolve(); }
    setTimeout(resolve, 4000);
  });
}

function openDb(dbPath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => (err ? reject(err) : resolve(db)));
    db.configure('busyTimeout', 5000);
  });
}
const dbRun = (db, sql, params = []) => new Promise((res, rej) =>
  db.run(sql, params, function (err) { return err ? rej(err) : res(this); }));
const dbGet = (db, sql, params = []) => new Promise((res, rej) =>
  db.get(sql, params, (err, row) => (err ? rej(err) : res(row))));
const setSetting = (db, key, value) => dbRun(db,
  `INSERT INTO settings (key, value) VALUES (?, ?)
   ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [key, String(value)]);

/** Ký body webhook đúng thuật toán payOS (sort key → query string → HMAC-SHA256). */
async function signWebhook(data) {
  const signature = await payosSdk.crypto.createSignatureFromObj(data, CHECKSUM_KEY);
  return { code: '00', desc: 'success', success: true, data, signature };
}

const webhookData = (order, amount, overrides = {}) => Object.assign({
  orderCode: order.order_code,
  amount: amount === undefined ? order.amount_vnd : amount,
  description: order.description || ('Nap diem ' + order.order_code),
  accountNumber: '0000000000',
  reference: 'FT_VERIFY_' + order.order_code,
  transactionDateTime: '2026-01-01 10:00:00',
  currency: 'VND',
  paymentLinkId: order.payment_link_id || ('test_' + order.order_code),
  code: '00',
  desc: 'success'
}, overrides);

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-verify-payments-'));
  const dbPath = path.join(tmp, 'database.sqlite');
  const uploadDir = path.join(tmp, 'uploads');
  const port = await pickFreePort();

  let server = startServer({ port, dbPath, uploadDir, nodeEnv: 'test' });
  let db = null;

  const cleanup = async () => {
    await stopServer(server);
    try { if (db) db.close(); } catch (_) { /* ignore */ }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* Windows giữ lock DB vài giây */ }
  };

  try {
    const up = await waitUp(port);
    if (!up) {
      console.error('Server không khởi động được. Log:\n' + server.logs.join('').slice(-3000));
      await cleanup();
      return 1;
    }

    // ---------------------------------------------------------------- seed
    db = await openDb(dbPath);
    await dbRun(db, `INSERT INTO users (id, username, password, role, status, credit_balance)
                     VALUES (1, 'verify_admin', ?, 'admin', 'active', 0)`, [BASIC_HASH]);
    await dbRun(db, `INSERT INTO users (id, username, password, role, status, credit_balance)
                     VALUES (2, 'verify_buyer', ?, 'user', 'active', 0)`, [BASIC_HASH]);

    const base = {
      payos_enabled: '1',
      payos_test_mode: '1',
      payos_client_id: 'verify-client-id',
      payos_api_key: 'verify-api-key',
      payos_checksum_key: CHECKSUM_KEY,
      payos_base_url: 'https://api-merchant.payos.vn',
      payos_webhook_url: 'https://verify.test/api/payos/webhook',
      public_base_url: 'https://verify.test',
      topup_vnd_per_credit: '1000',
      topup_min_vnd: '10000',
      topup_max_vnd: '5000000'
    };
    for (const [k, v] of Object.entries(base)) await setSetting(db, k, v);

    const adminToken = jwt.sign({ id: 1, username: 'verify_admin', role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
    const buyerToken = jwt.sign({ id: 2, username: 'verify_buyer', role: 'user' }, JWT_SECRET, { expiresIn: '1h' });

    const api = (method, p, body, token) => httpReq(port, method, p, { body, token });
    const balance = async () => {
      const r = await api('GET', '/api/credits/balance', undefined, buyerToken);
      return Number(r.body && r.body.balance) || 0;
    };
    const createOrder = async (packageId) => {
      const r = await api('POST', '/api/credits/topup/create', { package_id: packageId }, buyerToken);
      ok(`tạo đơn gói #${packageId} -> 200`, r.status === 200, r.body);
      return r.body || {};
    };

    console.log('\n== 1. Trạng thái cổng + gói nạp ==');
    const pkgs = await api('GET', '/api/credits/packages', undefined, buyerToken);
    ok('GET /api/credits/packages -> 200', pkgs.status === 200, pkgs.body);
    ok('available = true khi đã bật + đủ credential', pkgs.body.available === true, pkgs.body);
    ok('trả test_mode = true', pkgs.body.test_mode === true, pkgs.body.test_mode);
    ok('Cache-Control: no-store (không cache trạng thái cũ)',
      /no-store/.test(String(pkgs.headers['cache-control'] || '')), pkgs.headers['cache-control']);
    ok('có ít nhất 1 gói nạp đang bật', Array.isArray(pkgs.body.packages) && pkgs.body.packages.length >= 1,
      pkgs.body.packages && pkgs.body.packages.length);

    console.log('\n== 2. Tạo đơn (test mode, không gọi mạng) ==');
    const order1 = await createOrder(1);
    ok('đơn có order_code', Number.isFinite(Number(order1.order_code)), order1.order_code);
    ok('số tiền khớp gói 10.000đ', Number(order1.amount_vnd) === 10000, order1.amount_vnd);
    ok('điểm khớp gói (10)', Number(order1.credits) === 10, order1.credits);
    ok('checkout_url là link nội bộ test mode', /mock=1/.test(String(order1.checkout_url || '')), order1.checkout_url);
    ok('có ảnh QR? (test mode trả link nên qr_image null cũng hợp lệ)',
      order1.qr_image === null || /^data:image\//.test(String(order1.qr_image || '')), typeof order1.qr_image);

    const st1 = await api('GET', '/api/credits/topup/' + order1.order_code, undefined, buyerToken);
    ok('đơn mới ở trạng thái PENDING', st1.body && st1.body.status === 'PENDING', st1.body && st1.body.status);

    console.log('\n== 3. Webhook sai chữ ký / đơn lạ không cộng điểm ==');
    const badSig = await api('POST', '/api/payos/webhook', {
      code: '00', success: true, data: webhookData(order1), signature: 'deadbeef'
    });
    ok('chữ ký sai -> HTTP 200 + success=false', badSig.status === 200 && badSig.body.success === false, badSig.body);
    ok('chữ ký sai -> số dư vẫn 0', (await balance()) === 0);

    const ghost = await signWebhook(webhookData(order1, undefined, { orderCode: 999999999 }));
    const ghostRes = await api('POST', '/api/payos/webhook', ghost);
    ok('đơn lạ -> ignored=true', ghostRes.body && ghostRes.body.ignored === true, ghostRes.body);
    ok('đơn lạ -> số dư vẫn 0', (await balance()) === 0);

    console.log('\n== 4. Webhook hợp lệ cộng điểm đúng 1 lần ==');
    const wh1 = await signWebhook(webhookData(order1));
    const r1 = await api('POST', '/api/payos/webhook', wh1);
    ok('webhook lần 1 -> 200', r1.status === 200, r1.body);
    ok('số dư = 10 điểm', (await balance()) === 10, await balance());

    const paid1 = await dbGet(db, 'SELECT * FROM payment_orders WHERE order_code = ?', [order1.order_code]);
    ok('đơn chuyển PAID', paid1.status === 'PAID', paid1.status);
    ok('ghi paid_at', !!paid1.paid_at, paid1.paid_at);
    ok('ghi amount_paid = 10000', Number(paid1.amount_paid) === 10000, paid1.amount_paid);
    ok('ghi transaction_ref', paid1.transaction_ref === 'FT_VERIFY_' + order1.order_code, paid1.transaction_ref);

    const r2 = await api('POST', '/api/payos/webhook', wh1);
    const r3 = await api('POST', '/api/payos/webhook', wh1);
    ok('webhook lặp -> vẫn 200', r2.status === 200 && r3.status === 200, [r2.status, r3.status]);
    ok('webhook lặp KHÔNG cộng thêm điểm', (await balance()) === 10, await balance());
    const tx1 = await dbGet(db,
      "SELECT COUNT(*) AS c FROM credit_transactions WHERE user_id = 2 AND type = 'payment' AND ref = ?",
      ['payos:' + order1.order_code]);
    ok('đúng 1 bút toán payment cho đơn', tx1.c === 1, tx1.c);

    console.log('\n== 5. Chuyển THIẾU tiền -> không cộng điểm ==');
    const order2 = await createOrder(2);           // gói 20.000đ
    const wh2 = await signWebhook(webhookData(order2, 5000));   // chỉ chuyển 5.000đ
    const rUnder = await api('POST', '/api/payos/webhook', wh2);
    ok('webhook trả thiếu -> 200', rUnder.status === 200, rUnder.body);
    const under = await dbGet(db, 'SELECT * FROM payment_orders WHERE order_code = ?', [order2.order_code]);
    ok('đơn chuyển UNDERPAID', under.status === 'UNDERPAID', under.status);
    ok('ghi amount_paid = 5000', Number(under.amount_paid) === 5000, under.amount_paid);
    const txUnder = await dbGet(db,
      "SELECT COUNT(*) AS c FROM credit_transactions WHERE type = 'payment' AND ref = ?",
      ['payos:' + order2.order_code]);
    ok('KHÔNG có bút toán nào cho đơn trả thiếu', txUnder.c === 0, txUnder.c);
    ok('số dư vẫn 10 điểm', (await balance()) === 10, await balance());

    // payOS sau đó báo đã thu ĐỦ (khách chuyển bù / ngân hàng cập nhật) → cộng bình thường.
    const wh2b = await signWebhook(webhookData(order2));   // đủ 20.000đ
    await api('POST', '/api/payos/webhook', wh2b);
    const recovered = await dbGet(db, 'SELECT * FROM payment_orders WHERE order_code = ?', [order2.order_code]);
    ok('UNDERPAID -> PAID khi payOS báo đã thu đủ', recovered.status === 'PAID', recovered.status);
    ok('số dư = 30 điểm sau khi thu đủ đơn 20.000đ', (await balance()) === 30, await balance());

    console.log('\n== 6. Đơn đã hết hạn nhưng payOS xác nhận đã thu -> vẫn cộng ==');
    const order3 = await createOrder(1);           // 10.000đ / 10 điểm
    await dbRun(db, "UPDATE payment_orders SET status = 'EXPIRED' WHERE order_code = ?", [order3.order_code]);
    const wh3 = await signWebhook(webhookData(order3));
    await api('POST', '/api/payos/webhook', wh3);
    const late = await dbGet(db, 'SELECT * FROM payment_orders WHERE order_code = ?', [order3.order_code]);
    ok('đơn EXPIRED -> PAID sau khi payOS báo đã thu', late.status === 'PAID', late.status);
    ok('số dư = 40 điểm (cộng đơn trễ hạn)', (await balance()) === 40, await balance());

    console.log('\n== 7. Chẩn đoán admin ==');
    const gw = await api('GET', '/api/admin/payos/status', undefined, adminToken);
    ok('GET /api/admin/payos/status -> 200', gw.status === 200, gw.body);
    ok('available = true', gw.body.available === true, gw.body.available);
    ok('trả effective_webhook_url', !!gw.body.effective_webhook_url, gw.body.effective_webhook_url);
    ok('trả số đơn theo trạng thái', !!(gw.body.orders && gw.body.orders.counts), gw.body.orders);
    ok('cảnh báo test mode khi NODE_ENV=test KHÔNG bị coi là production',
      !(gw.body.warnings || []).some(w => w.code === 'test_mode_in_production'), gw.body.warnings);

    console.log('\n== 8. Giả lập thanh toán (test mode) ==');
    const order4 = await createOrder(1);
    const mock = await api('POST', '/api/admin/payments/' + order4.order_code + '/mock-paid', {}, adminToken);
    ok('mock-paid -> 200 (môi trường test)', mock.status === 200, mock.body);
    ok('số dư = 50 điểm', (await balance()) === 50, await balance());

    console.log('\n== 8b. Cập nhật TỨC THÌ qua long-poll /wait ==');
    const order5 = await createOrder(1);           // 10.000đ / 10 điểm

    // Mở kết nối chờ TRƯỚC, rồi mới bắn webhook: response phải về ngay khi có sự kiện.
    const waitStart = Date.now();
    const waitPromise = api('GET', '/api/credits/topup/' + order5.order_code + '/wait', undefined, buyerToken);
    await sleep(600);                              // đảm bảo server đã đăng ký listener
    const whWait = await signWebhook(webhookData(order5));
    await api('POST', '/api/payos/webhook', whWait);
    const waited = await waitPromise;
    const elapsed = Date.now() - waitStart;
    ok('/wait trả 200 khi webhook tới', waited.status === 200, waited.body);
    ok('/wait trả status PAID', waited.body && waited.body.status === 'PAID', waited.body);
    ok('/wait phản hồi gần như tức thì (< 3s, không chờ nhịp poll)',
      elapsed < 3000, elapsed + 'ms');
    ok('số dư = 60 điểm sau webhook trong lúc chờ', (await balance()) === 60, await balance());

    // Đơn đã có kết quả cuối → trả ngay, không giữ kết nối 25s.
    const t2 = Date.now();
    const waited2 = await api('GET', '/api/credits/topup/' + order5.order_code + '/wait', undefined, buyerToken);
    ok('/wait trả ngay khi đơn đã PAID', waited2.status === 200 && waited2.body.status === 'PAID',
      waited2.body);
    ok('/wait không giữ kết nối với đơn đã kết thúc (< 1.5s)', Date.now() - t2 < 1500, Date.now() - t2);

    // Bảo mật: user khác / mã đơn sai.
    const strangerToken = jwt.sign({ id: 3, username: 'verify_stranger', role: 'user' }, JWT_SECRET, { expiresIn: '1h' });
    const forbiddenWait = await api('GET', '/api/credits/topup/' + order5.order_code + '/wait', undefined, strangerToken);
    ok('/wait đơn của người khác -> 403', forbiddenWait.status === 403, forbiddenWait.body);
    const missingWait = await api('GET', '/api/credits/topup/999999999/wait', undefined, buyerToken);
    ok('/wait đơn không tồn tại -> 404', missingWait.status === 404, missingWait.body);

    console.log('\n== 9. Cổng tắt / thiếu credential -> API trả LÝ DO ==');
    await setSetting(db, 'payos_enabled', '0');
    const offPkgs = await api('GET', '/api/credits/packages', undefined, buyerToken);
    ok('cổng tắt -> available=false', offPkgs.body.available === false, offPkgs.body.available);
    ok('cổng tắt -> reason=gateway_disabled', offPkgs.body.reason === 'gateway_disabled', offPkgs.body.reason);
    ok('cổng tắt -> reasons[0].message có nội dung', !!(offPkgs.body.reasons && offPkgs.body.reasons[0].message),
      offPkgs.body.reasons);
    const offCreate = await api('POST', '/api/credits/topup/create', { package_id: 1 }, buyerToken);
    ok('cổng tắt -> tạo đơn 400 + reason gateway_disabled',
      offCreate.status === 400 && offCreate.body.reason === 'gateway_disabled', offCreate.body);

    await setSetting(db, 'payos_enabled', '1');
    await setSetting(db, 'payos_api_key', '');
    const missPkgs = await api('GET', '/api/credits/packages', undefined, buyerToken);
    ok('thiếu credential -> available=false', missPkgs.body.available === false, missPkgs.body.available);
    ok('thiếu credential -> reason=missing_credentials',
      missPkgs.body.reason === 'missing_credentials', missPkgs.body.reason);
    ok('thiếu credential -> nêu đúng field thiếu',
      Array.isArray(missPkgs.body.gateway.missing) && missPkgs.body.gateway.missing.includes('payos_api_key'),
      missPkgs.body.gateway && missPkgs.body.gateway.missing);

    // Khôi phục cấu hình đủ để máy chủ production bên dưới dùng lại.
    await setSetting(db, 'payos_api_key', 'verify-api-key');
    await setSetting(db, 'payos_test_mode', '1');

    console.log('\n== 10. Production: giả lập thanh toán bị khoá ==');
    await stopServer(server);
    if (db) { try { db.close(); } catch (_) { /* ignore */ } db = null; }

    const prodPort = await pickFreePort();
    const prodServer = startServer({ port: prodPort, dbPath, uploadDir, nodeEnv: 'production' });
    const prodUp = await waitUp(prodPort);
    ok('server production khởi động được', prodUp);
    if (prodUp) {
      const mockCode = order4.order_code;
      const prodMock = await httpReq(prodPort, 'POST',
        '/api/admin/payments/' + mockCode + '/mock-paid', { body: {}, token: adminToken });
      ok('mock-paid ở production -> 403', prodMock.status === 403, prodMock.body);
      ok('mock-paid ở production -> reason production_forbidden',
        prodMock.body && prodMock.body.reason === 'production_forbidden', prodMock.body);
      const prodUserMock = await httpReq(prodPort, 'POST',
        '/api/credits/topup/' + mockCode + '/mock-paid', { body: {}, token: buyerToken });
      ok('mock-paid (user) ở production -> 403', prodUserMock.status === 403, prodUserMock.body);
    }
    await stopServer(prodServer);

    console.log('\n== 11. Ảnh QR: chỉ dựng từ chuỗi VietQR gốc của payOS ==');
    process.env.DB_PATH = dbPath;          // payos -> database mở đúng DB tạm
    const payosMod = require('../payos');
    const realVqr = '00020101021238570010A000000727012700069704220113VQRQANAYE63520208QRIBFTTA'
      + '53037045405100005802VN62250821Nap diem 7928330376386304647D';
    const qrImg = await payosMod.buildQrImage(realVqr);
    ok('chuỗi VietQR gốc -> ảnh PNG data-URL', /^data:image\/png;base64,/.test(qrImg || ''),
      (qrImg || '').slice(0, 40));
    ok('URL checkout (test mode) -> null, không vẽ QR sai',
      (await payosMod.buildQrImage('https://pay.payos.vn/web/abc')) === null);
    ok('chuỗi không phải EMVCo/VietQR -> null',
      (await payosMod.buildQrImage('hello world')) === null);
    ok('chuỗi rỗng -> null', (await payosMod.buildQrImage('')) === null);
  } catch (e) {
    console.error('\nLỖI KHÔNG MONG ĐỢI:', e && e.stack || e);
    failures.push('unexpected_error');
  } finally {
    await cleanup();
  }

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log('Fail: ' + failures.join(' | '));
    return 1;
  }
  return 0;
}

main().then((code) => process.exit(code)).catch((e) => {
  console.error('LỖI:', e && e.stack || e);
  process.exit(1);
});
