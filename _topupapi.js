/**
 * Test LIVE biên HTTP của tính năng "chỉ nạp thêm điểm".
 * Chạy: node _topupapi.js
 *
 * Dùng DB tạm + PORT tạm, không đụng database.sqlite.
 * Kiểm tra:
 *  1. POST /api/admin/credits/adjust với -5  -> 400 (topup_only)
 *  2. POST /api/admin/credits/adjust với 0   -> 400
 *  3. POST /api/admin/credits/adjust với +5  -> 200
 *  4. POST /api/users tạo user mới -> chỉ có bonus đăng ký
 *  5. POST /api/users cố gửi credit trong body -> server bỏ qua
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

const tmpDb = path.join(os.tmpdir(), `topup-api-${process.pid}-${Date.now()}.sqlite`);
const realDbPath = path.join(path.dirname(__dirname), 'database.sqlite');

// Redirect mọi kết nối DB của tiến trình này sang DB tạm (giống _credittest.js).
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
// database.js gọi require('sqlite3').verbose() — verbose() trả về object MỚI, nên phải
// vá cả object đó, nếu không patch bị vô hiệu và test ghi thẳng vào DB thật.
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

// Chọn cổng trống thực sự để tránh đụng server cũ còn sống (gây nhầm DB tạm).
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
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-topup';

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
        resolve({ status: res.statusCode, body: parsed, setCookie: res.headers['set-cookie'] });
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

  const sqlRun = (sql, params = []) => new Promise((res, rej) =>
    db.run(sql, params, function (err) { err ? rej(err) : res(this); }));
  const sqlGet = (sql, params = []) => new Promise((res, rej) =>
    db.get(sql, params, (err, row) => err ? rej(err) : res(row)));

  await waitPort(Number(process.env.PORT));

  // Tạo admin + bật credit.
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('pw', 4);
  await sqlRun('INSERT INTO users (username, password, role, status) VALUES (?, ?, ?, ?)',
    ['topup_admin', hash, 'admin', 'active']);
  const admin = await sqlGet('SELECT id FROM users WHERE username = ?', ['topup_admin']);
  await sqlRun("INSERT INTO settings (key, value) VALUES ('credit_enabled','1') ON CONFLICT(key) DO UPDATE SET value='1'");
  await sqlRun("INSERT INTO settings (key, value) VALUES ('credit_signup_bonus','5') ON CONFLICT(key) DO UPDATE SET value='5'");

  const login = await req('POST', '/api/login', { username: 'topup_admin', password: 'pw' });
  const token = login.body && login.body.token ? login.body.token : null;
  ok('đăng nhập admin lấy được token', !!token, login.body);

  console.log('\n== Biên HTTP chỉ-được-nạp-thêm ==');
  const target = await sqlRun('INSERT INTO users (username, password, status) VALUES (?, ?, ?)',
    ['topup_target', 'x', 'active']);
  const uid = target.lastID;

  const neg = await req('POST', '/api/admin/credits/adjust', { user_id: uid, amount: -5, note: 'thử trừ' }, token);
  ok('adjust -5 -> 400', neg.status === 400, neg.body);
  ok('adjust -5 trả reason topup_only', neg.body && neg.body.reason === 'topup_only', neg.body);

  const zero = await req('POST', '/api/admin/credits/adjust', { user_id: uid, amount: 0, note: 'thử 0' }, token);
  ok('adjust 0 -> 400', zero.status === 400, zero.body);

  const afterFail = await credits.getBalance(uid);
  ok('số dư KHÔNG bị đổi sau 2 request bị chặn', afterFail === 0, afterFail);

  const pos = await req('POST', '/api/admin/credits/adjust', { user_id: uid, amount: 5, note: 'nạp hợp lệ' }, token);
  ok('adjust +5 -> 200', pos.status === 200, pos.body);
  ok('adjust +5 trả balance = 5', pos.body && Number(pos.body.balance) === 5, pos.body);

  console.log('\n== Tạo user chỉ nhận bonus đăng ký ==');
  const created = await req('POST', '/api/users',
    { username: 'topup_new1', password: 'pw', role: 'user', status: 'active' }, token);
  ok('tạo user -> 200', created.status === 200, created.body);
  ok('user mới chỉ có số dư = bonus (5)', created.body && Number(created.body.credit_balance) === 5, created.body);

  // Cố tình gửi credit trong body: server phải bỏ qua hoàn toàn.
  const sneaky = await req('POST', '/api/users',
    { username: 'topup_new2', password: 'pw', role: 'user', status: 'active', credit: 999 }, token);
  ok('tạo user kèm credit:999 -> 200', sneaky.status === 200, sneaky.body);
  ok('credit trong body bị bỏ qua, số dư vẫn = 5', sneaky.body && Number(sneaky.body.credit_balance) === 5, sneaky.body);

  const new2 = await sqlGet('SELECT id FROM users WHERE username = ?', ['topup_new2']);
  const new2Bal = await credits.getBalance(new2.id);
  ok('DB xác nhận số dư new2 = 5', new2Bal === 5, new2Bal);
  const new2Tx = await credits.listTransactions(new2.id);
  ok('new2 chỉ có 1 bút toán (signup_bonus)',
    new2Tx.length === 1 && new2Tx[0].type === 'signup_bonus', new2Tx.map(t => t.type));

  console.log(`\n${pass} passed, ${fail} failed\n`);
  try { if (app && app.close) app.close(); } catch (e) {}
  try { db.close(); } catch (e) {}
  for (const f of [tmpDb, tmpDb + '-journal', tmpDb + '-wal', tmpDb + '-shm']) {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) {}
  }
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('LỖI TEST:', e); process.exit(1); });
