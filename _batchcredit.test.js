/**
 * Test RUNTIME cho trừ điểm MỘT PHẦN ở `POST /api/cells/resolve-batch`.
 * Chạy: node _batchcredit.test.js
 *
 * Boot server thật trên DB tạm + PORT tạm (patch sqlite3 giống _payos.test.js).
 *  - Khi số điểm < số cell found → chỉ trừ tối đa số dư, báo insufficient.
 *  - Khi hết điểm (0) → chặn 402 trước khi tra (pre-check).
 *  - Response trả `credit.{charged,requested,insufficient}`.
 *  - Bút toán ledger khớp số dư (không trừ âm, không trừ quá khả năng).
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

const tmpDb = path.join(os.tmpdir(), `batchcredit-test-${process.pid}-${Date.now()}.sqlite`);
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
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-batchcredit';

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
  const sqlRun = (sql, params = []) => new Promise((res, rej) =>
    db.run(sql, params, function (err) { err ? rej(err) : res(this); }));
  const sqlGet = (sql, params = []) => new Promise((res, rej) =>
    db.get(sql, params, (err, row) => err ? rej(err) : res(row)));
  await waitPort(Number(process.env.PORT));

  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('pw', 4);
  await sqlRun('INSERT INTO users (username, password, role, status) VALUES (?, ?, ?, ?)',
    ['bc_user', hash, 'user', 'active']);
  const userId = (await sqlGet('SELECT id FROM users WHERE username = ?', ['bc_user'])).id;

  const setSetting = (k, v) => sqlRun(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [k, v]);
  await setSetting('credit_enabled', '1');
  await setSetting('credit_cost_per_lookup', '1');
  await setSetting('credit_allow_negative', '0');
  await setSetting('max_online_resolve', '50');
  // Tắt nguồn online để test thuần phần trừ điểm (cell tra bằng CSDL nội bộ).
  await setSetting('enable_opencellid', '0');
  await setSetting('enable_opencellid_web', '0');

  const login = await req('POST', '/api/login', { username: 'bc_user', password: 'pw' });
  const token = login.body && login.body.token;
  ok('đăng nhập lấy được token', !!token, login.body);

  const setBalance = (n) => sqlRun('UPDATE users SET credit_balance = ? WHERE id = ?', [n, userId]);

  // 3 cell đã có toạ độ trong CSDL nội bộ → mỗi cell "found" tính 1 điểm.
  const cells = [
    { mcc: 452, mnc: 4, lac: 9101, cellid: 11100101 },
    { mcc: 452, mnc: 4, lac: 9101, cellid: 11100102 },
    { mcc: 452, mnc: 4, lac: 9101, cellid: 11100103 },
  ];
  for (let i = 0; i < cells.length; i++) {
    await sqlRun('INSERT INTO cells (mcc, mnc, lac, cellid, lat, lng, range) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [cells[i].mcc, cells[i].mnc, cells[i].lac, cells[i].cellid, 21.0 + i * 0.01, 105.8 + i * 0.01, 500]);
  }

  console.log('\n== 1. số dư 2 < 3 cell found → tra lần lượt 2 cell đầu, báo insufficient ==');
  await setBalance(2);
  const r1 = await req('POST', '/api/cells/resolve-batch',
    { cells, uploadId: 'bc-test-1', fileName: 't.xlsx' }, token);
  ok('HTTP 200', r1.status === 200, r1.status);
  // LUẬT: tra lần lượt từ đầu → chỉ `affordable` cell ĐẦU trả toạ độ; phần vượt
  // số dư bị ẩn toạ độ (`unpaid:true`) để không rò kết quả chưa trả phí.
  const found1 = (r1.body.results || []).filter(x => x.lat && x.lon).length;
  ok('chỉ trả toạ độ 2 cell đầu (đúng số điểm)', found1 === 2, found1);
  ok('cell thứ 1 + 2 có toạ độ',
    !!(r1.body.results[0].lat && r1.body.results[1].lat), r1.body.results.map(x => !!x.lat));
  ok('cell thứ 3 (vượt điểm) bị ẩn toạ độ + unpaid:true',
    (!r1.body.results[2].lat && r1.body.results[2].unpaid === true), r1.body.results[2]);
  ok('credit.charged = 2 (chỉ trong khả năng)', r1.body.credit && r1.body.credit.charged === 2, r1.body.credit);
  ok('credit.requested = 3', r1.body.credit && r1.body.credit.requested === 3, r1.body.credit);
  ok('credit.found = 3 (tra ra 3, trả phí 2)', r1.body.credit && r1.body.credit.found === 3, r1.body.credit);
  ok('credit.missed = 0', r1.body.credit && r1.body.credit.missed === 0, r1.body.credit);
  ok('credit.unpaid = 1 (còn 1 cell chưa tra vì thiếu điểm)',
    r1.body.credit && r1.body.credit.unpaid === 1, r1.body.credit);
  ok('credit.insufficient = true', r1.body.credit && r1.body.credit.insufficient === true, r1.body.credit);
  const bal1 = (await sqlGet('SELECT credit_balance AS b FROM users WHERE id = ?', [userId])).b;
  ok('số dư về 0', bal1 === 0, bal1);
  const tx1 = await sqlGet(
    "SELECT COUNT(*) AS c, COALESCE(SUM(amount),0) AS s FROM credit_transactions WHERE user_id = ? AND ref = ?",
    [userId, 'bc-test-1:r0']);
  ok('ghi đúng 1 bút toán (ref có hậu tố vòng)', tx1.c === 1, tx1.c);
  ok('bút toán = -2', tx1.s === -2, tx1.s);
  // Cờ `charged` theo từng cell → client biết cell nào đã trả phí trong phiên.
  const chargedFlags = (r1.body.results || []).map(x => !!x.charged);
  ok('chỉ 2 cell đầu có results[].charged = true',
    chargedFlags.filter(Boolean).length === 2 && chargedFlags[0] && chargedFlags[1] && !chargedFlags[2],
    chargedFlags);
  ok('số cell charged khớp credit.charged', chargedFlags.filter(Boolean).length === r1.body.credit.charged, chargedFlags);

  console.log('\n== 2. hết điểm (0) → pre-check 402, không đốt quota ==');
  await setBalance(0);
  const r2 = await req('POST', '/api/cells/resolve-batch',
    { cells, uploadId: 'bc-test-2', fileName: 't.xlsx' }, token);
  ok('HTTP 402', r2.status === 402, { status: r2.status, body: r2.body });
  ok('reason insufficient', r2.body && r2.body.reason === 'insufficient', r2.body);
  ok('không ghi bút toán mới',
    (await sqlGet('SELECT COUNT(*) AS c FROM credit_transactions WHERE user_id = ? AND ref = ?',
      [userId, 'bc-test-2'])).c === 0);

  console.log('\n== 3. số dư 10 ≥ 3 → trừ đủ, không insufficient ==');
  await setBalance(10);
  const r3 = await req('POST', '/api/cells/resolve-batch',
    { cells, uploadId: 'bc-test-3', fileName: 't.xlsx' }, token);
  ok('credit.charged = 3', r3.body.credit && r3.body.credit.charged === 3, r3.body.credit);
  ok('credit.insufficient = false', r3.body.credit && r3.body.credit.insufficient === false, r3.body.credit);
  const bal3 = (await sqlGet('SELECT credit_balance AS b FROM users WHERE id = ?', [userId])).b;
  ok('số dư 10 → 7', bal3 === 7, bal3);

  console.log('\n== 4. retry cùng uploadId + cùng vòng → không trừ lần 2 ==');
  const r4 = await req('POST', '/api/cells/resolve-batch',
    { cells, uploadId: 'bc-test-3', fileName: 't.xlsx', roundIdx: 0 }, token);
  ok('duplicate: charged = 0', r4.body.credit && r4.body.credit.charged === 0, r4.body.credit);
  const bal4 = (await sqlGet('SELECT credit_balance AS b FROM users WHERE id = ?', [userId])).b;
  ok('số dư giữ nguyên 7', bal4 === 7, bal4);

  // Vòng kế của CÙNG uploadId phải được trừ riêng (ref khác) — đây là bug "tra nhiều
  // cell mà chỉ trừ ít điểm": cùng ref bị coi là retry nên vòng sau không bị trừ.
  console.log('\n== 5. cùng uploadId nhưng VÒNG khác → trừ riêng ==');
  const r5 = await req('POST', '/api/cells/resolve-batch',
    { cells, uploadId: 'bc-test-3', fileName: 't.xlsx', roundIdx: 1 }, token);
  ok('vòng 1 charged = 3 (không bị dedup)', r5.body.credit && r5.body.credit.charged === 3, r5.body.credit);
  const bal5 = (await sqlGet('SELECT credit_balance AS b FROM users WHERE id = ?', [userId])).b;
  ok('số dư 7 → 4', bal5 === 4, bal5);
  ok('2 bút toán riêng theo vòng',
    (await sqlGet('SELECT COUNT(*) AS c FROM credit_transactions WHERE user_id = ? AND ref LIKE ?',
      [userId, 'bc-test-3:r%'])).c === 2);

  console.log('\n== 6. cell tra không ra (miss) → không trừ, charged = false ==');
  await setBalance(5);
  // Cell hoàn toàn mới, không có trong CSDL nội bộ + mọi nguồn online đã tắt.
  const missCells = [{ mcc: 452, mnc: 4, lac: 9999, cellid: 88880001 }];
  const r6 = await req('POST', '/api/cells/resolve-batch',
    { cells: missCells, uploadId: 'bc-test-6', fileName: 'miss.xlsx' }, token);
  ok('HTTP 200', r6.status === 200, r6.status);
  ok('cell miss không có toạ độ', !(r6.body.results[0].lat && r6.body.results[0].lon), r6.body.results);
  ok('results[].charged = false cho cell miss', r6.body.results[0].charged === false, r6.body.results[0]);
  ok('credit.charged = 0', r6.body.credit && r6.body.credit.charged === 0, r6.body.credit);
  const bal6 = (await sqlGet('SELECT credit_balance AS b FROM users WHERE id = ?', [userId])).b;
  ok('số dư giữ nguyên 5', bal6 === 5, bal6);

  console.log('\n== 7. lô trộn 3 found + 1 miss, số dư 2 → đếm đủ 3 loại ==');
  await setBalance(2);
  const mixCells = [
    { mcc: 452, mnc: 4, lac: 9101, cellid: 11100101 },  // found
    { mcc: 452, mnc: 4, lac: 9999, cellid: 88880001 },  // miss (không có nguồn)
    { mcc: 452, mnc: 4, lac: 9101, cellid: 11100102 },  // found
    { mcc: 452, mnc: 4, lac: 9101, cellid: 11100103 },  // found
  ];
  const r7 = await req('POST', '/api/cells/resolve-batch',
    { cells: mixCells, uploadId: 'bc-test-7', fileName: 'mix.xlsx', roundIdx: 0 }, token);
  ok('HTTP 200', r7.status === 200, r7.status);
  const withCoords = (r7.body.results || []).filter(x => x.lat && x.lon);
  ok('trả toạ độ đúng 2 cell (2 điểm) — bỏ qua miss, tra lần lượt', withCoords.length === 2, withCoords.length);
  ok('2 cell trả toạ độ là cell#1 và cell#3 (theo thứ tự nạp)',
    !!(r7.body.results[0].lat && r7.body.results[2].lat && !r7.body.results[3].lat),
    r7.body.results.map(x => !!x.lat));
  ok('cell#2 (miss) không có toạ độ, không tính điểm',
    !r7.body.results[1].lat && r7.body.results[1].charged === false, r7.body.results[1]);
  ok('cell#4 (found vượt điểm) bị ẩn toạ độ + unpaid:true',
    !r7.body.results[3].lat && r7.body.results[3].unpaid === true, r7.body.results[3]);
  ok('credit.found = 3 (tra ra kết quả)', r7.body.credit && r7.body.credit.found === 3, r7.body.credit);
  ok('credit.missed = 1 (không ra kết quả)', r7.body.credit && r7.body.credit.missed === 1, r7.body.credit);
  ok('credit.unpaid = 1 (chưa tra vì thiếu điểm)', r7.body.credit && r7.body.credit.unpaid === 1, r7.body.credit);
  ok('credit.charged = 2', r7.body.credit && r7.body.credit.charged === 2, r7.body.credit);
  ok('credit.insufficient = true', r7.body.credit && r7.body.credit.insufficient === true, r7.body.credit);
  const bal7 = (await sqlGet('SELECT credit_balance AS b FROM users WHERE id = ?', [userId])).b;
  ok('số dư về 0', bal7 === 0, bal7);
  // Nạp thêm điểm rồi tra lại CÙNG vòng → cell unpaid phải được tra tiếp (tra lần lượt).
  await setBalance(5);
  const r7b = await req('POST', '/api/cells/resolve-batch',
    { cells: mixCells, uploadId: 'bc-test-7', fileName: 'mix.xlsx', roundIdx: 0 }, token);
  ok('tra lại cùng vòng = duplicate, không trừ thêm',
    r7b.body.credit && r7b.body.credit.duplicate === true, r7b.body.credit);
  ok('tra lại cùng vòng vẫn giữ toạ độ cell đã trả phí',
    !!(r7b.body.results[0].lat && r7b.body.results[2].lat), r7b.body.results.map(x => !!x.lat));

  console.log('\n== 8. POST /api/call-logs/analyze — CHỈ ĐỌC, không trừ điểm, không ghi DB ==');
  {
    const XLSX = require('xlsx');
    const HEADER = ['STT', 'Thời gian', 'Loại cuộc gọi', 'Số liên hệ', 'Thời lượng',
      'Mã địa danh', 'Tên địa danh', 'Cell ID', 'Sector', 'LAC', 'MCC', 'MNC'];
    const rows = [
      [1, '2024-01-01 08:00:00', 'CALL_OUT', '0912000001', 12, 'D', 'HN', 11100101, '', 9101, 452, '04'],
      [2, '2024-01-01 08:05:00', 'SMS_IN', '0912000001', 12, 'D', 'HN', 11100101, '', 9101, 452, '04'],
      [3, '2024-01-01 08:10:00', 'CALL_IN', '0912000002', 12, 'D', 'HN', 11100102, '', 9101, 452, '04'],
    ];
    const ws = XLSX.utils.aoa_to_sheet([HEADER, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'S1');
    const xbuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const balBefore = (await sqlGet('SELECT credit_balance AS b FROM users WHERE id = ?', [userId])).b;
    const logsBefore = (await sqlGet('SELECT COUNT(*) AS c FROM call_logs WHERE user_id = ?', [userId])).c;
    const txBefore = (await sqlGet('SELECT COUNT(*) AS c FROM credit_transactions WHERE user_id = ?', [userId])).c;

    const boundary = '----bcTestBoundary' + Date.now();
    const pre = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="an.xlsx"\r\n` +
      'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n');
    const post = Buffer.from(`\r\n--${boundary}--\r\n`);
    const payload = Buffer.concat([pre, xbuf, post]);

    const r8 = await new Promise((resolve, reject) => {
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

    ok('HTTP 200', r8.status === 200, r8.status);
    ok('cellCount = 2 (dedup theo cell)', r8.body.cellCount === 2, r8.body.cellCount);
    ok('totalRows = 3', r8.body.totalRows === 3, r8.body.totalRows);
    const c0 = (r8.body.cells || [])[0] || {};
    ok('cell có rowCount = 2', c0.rowCount === 2, c0.rowCount);
    ok('cell đã có trong CSDL nội bộ → gắn localLat/localLon',
      c0.localLat === 21.0 && c0.localLon === 105.8, { lat: c0.localLat, lon: c0.localLon });

    const balAfter = (await sqlGet('SELECT credit_balance AS b FROM users WHERE id = ?', [userId])).b;
    ok('analyze KHÔNG trừ điểm', balAfter === balBefore, { before: balBefore, after: balAfter });
    const logsAfter = (await sqlGet('SELECT COUNT(*) AS c FROM call_logs WHERE user_id = ?', [userId])).c;
    ok('analyze KHÔNG ghi call_logs', logsAfter === logsBefore, { before: logsBefore, after: logsAfter });
    const txAfter = (await sqlGet('SELECT COUNT(*) AS c FROM credit_transactions WHERE user_id = ?', [userId])).c;
    ok('analyze KHÔNG tạo bút toán', txAfter === txBefore, { before: txBefore, after: txAfter });
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}
