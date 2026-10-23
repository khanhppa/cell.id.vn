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
  console.log('\n== 5. cùng uploadId + vòng khác → cell đã trả phí KHÔNG bị trừ lại ==');
  const r5 = await req('POST', '/api/cells/resolve-batch',
    { cells, uploadId: 'bc-test-3', fileName: 't.xlsx', roundIdx: 1 }, token);
  ok('vòng 1: cell đã trả phí → charged = 0', r5.body.credit && r5.body.credit.charged === 0, r5.body.credit);
  ok('vòng 1: reused = 3 (trả toạ độ miễn phí)', r5.body.credit && r5.body.credit.reused === 3, r5.body.credit);
  const bal5 = (await sqlGet('SELECT credit_balance AS b FROM users WHERE id = ?', [userId])).b;
  ok('số dư giữ nguyên 7 (không trừ lần 2)', bal5 === 7, bal5);
  ok('vẫn chỉ 1 bút toán cho batch (không ghi thêm)',
    (await sqlGet('SELECT COUNT(*) AS c FROM credit_transactions WHERE user_id = ? AND ref LIKE ?',
      [userId, 'bc-test-3:r%'])).c === 1);

  console.log('\n== 5b. cell đã có trong call_log_batches.resolved_cells (phiên) → không trừ lại ==');
  // Mô phỏng: client đã đẩy toạ độ lên phiên nhưng `lookup_history` của batch KHÔNG có
  // (đóng tab trước khi logLookups ghi xong / history bị xoá). Toạ độ đã trả phí vẫn
  // phải được trả lại MIỄN PHÍ — không thì user bị trừ điểm lần 2.
  await setBalance(6);
  await sqlRun('INSERT INTO call_log_batches (batch_id, user_id, file_name, resolved_cells)' +
    ' VALUES (?, ?, ?, ?)',
    ['bc-test-5b', userId, 'saved.xlsx',
      JSON.stringify([{ mcc: '452', mnc: '4', lac: '9101', cellid: '11100101', sector: '', lat: 21.0, lng: 105.8, range: 500, source: 'local', radio: 'LTE' }])]);
  const r5b = await req('POST', '/api/cells/resolve-batch',
    { cells: [{ mcc: 452, mnc: 4, lac: 9101, cellid: 11100101 }], uploadId: 'bc-test-5b', fileName: 'saved.xlsx' }, token);
  ok('HTTP 200', r5b.status === 200, r5b.status);
  ok('trả toạ độ cell đã lưu trong phiên', !!(r5b.body.results[0] && r5b.body.results[0].lat), r5b.body.results[0]);
  ok('credit.charged = 0 (đã trả phí ở phiên trước)', r5b.body.credit && r5b.body.credit.charged === 0, r5b.body.credit);
  const bal5b = (await sqlGet('SELECT credit_balance AS b FROM users WHERE id = ?', [userId])).b;
  ok('số dư giữ nguyên 6', bal5b === 6, bal5b);

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
  // Nạp thêm điểm rồi tra lại: cell đã trả phí trả toạ độ MIỄN PHÍ, chỉ cell còn thiếu
  // (unpaid) mới bị trừ điểm → không bao giờ trừ 2 lần cho cùng cell trong 1 lần nạp.
  await setBalance(5);
  const r7b = await req('POST', '/api/cells/resolve-batch',
    { cells: mixCells, uploadId: 'bc-test-7', fileName: 'mix.xlsx', roundIdx: 1 }, token);
  ok('tra lại: charged = 0 (không trừ thêm cho cell đã trả phí)',
    r7b.body.credit && r7b.body.credit.charged === 0, r7b.body.credit);
  ok('tra lại: reused = 3', r7b.body.credit && r7b.body.credit.reused === 3, r7b.body.credit);
  const bal7b = (await sqlGet('SELECT credit_balance AS b FROM users WHERE id = ?', [userId])).b;
  ok('số dư giữ nguyên 5', bal7b === 5, bal7b);
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
      const t0 = Date.now();
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
          resolve({ status: res.statusCode, body: p, ms: Date.now() - t0 });
        });
      });
      r.on('error', reject);
      r.write(payload);
      r.end();
    });

    ok('HTTP 200', r8.status === 200, r8.status);
    // Analyze không được "treo": 3 dòng nhưng phải trả về nhanh (< 3s kể cả khởi động
    // lạnh + upload). Trước đây tra CSDL nội bộ từng cell rất chậm với file lớn.
    ok('analyze trả về nhanh (< 3000 ms)', r8.ms < 3000, r8.ms + ' ms');
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

  console.log('\n== 9. /cells endpoints: ghép trạng thái found/miss/unpaid, không rò toạ độ ==');
  {
    const bcrypt2 = require('bcryptjs');
    const hash2 = await bcrypt2.hash('pw', 4);
    await sqlRun('INSERT INTO users (username, password, role, status) VALUES (?, ?, ?, ?)',
      ['bc_state', hash2, 'user', 'active']);
    const uid2 = (await sqlGet('SELECT id FROM users WHERE username = ?', ['bc_state'])).id;
    const stateToken = (await req('POST', '/api/login', { username: 'bc_state', password: 'pw' })).body.token;
    const settle = (ms) => new Promise(r => setTimeout(r, ms));
    const batchId = 'clstate9';
    const rows9 = [
      { cellid: '11100101', action_type: 'CALL_OUT' },
      { cellid: '11100102', action_type: 'CALL_IN' },
      { cellid: '11100303', action_type: 'SMS_IN' },
      { cellid: '11100404', action_type: 'CALL_OUT' },
    ];
    for (const r of rows9) {
      await sqlRun('INSERT INTO call_logs (user_id, network, action_type, mcc, mnc, lac, cellid, batch_id)' +
        ' VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [uid2, 'Viettel', r.action_type, '452', '04', '9101', r.cellid, batchId]);
    }
    await sqlRun('INSERT INTO call_log_batches (batch_id, user_id, file_name, network, row_count) VALUES (?, ?, ?, ?, ?)',
      [batchId, uid2, 'state.xlsx', 'Viettel', rows9.length]);
    const hist = (cellid, found, lat) => sqlRun(
      'INSERT INTO lookup_history (user_id, mode, mcc, mnc, lac, cellid, sector, lat, lng, range, source, found, batch_id, radio)' +
      ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [uid2, 'batch', '452', '04', '9101', cellid, '', lat ? lat : null, lat ? 105.8 : null, 500,
        lat ? 'local' : '', found ? 1 : 0, batchId, 'LTE']);
    await hist('11100101', true, 21.01);
    await hist('11100102', true, 21.02);
    await hist('11100303', false, null);
    await settle(150);

    const bySession = await req('GET', '/api/call-log-sessions/' + batchId + '/cells', undefined, stateToken);
    ok('GET /api/call-log-sessions/:id/cells → 200', bySession.status === 200, bySession.status);
    ok('trả đủ 4 cell của FILE (không co cồn theo số có toạ độ)',
      bySession.body && bySession.body.summary && bySession.body.summary.total === 4,
      bySession.body && bySession.body.summary);
    ok('summary 4 · 2 found · 1 miss · 1 unpaid',
      bySession.body.summary.found === 2 && bySession.body.summary.miss === 1 && bySession.body.summary.unpaid === 1,
      bySession.body.summary);
    const cellOf = (id) => (bySession.body.cells || []).find(c => String(c.cellid) === id) || {};
    ok('cell found có toạ độ', cellOf('11100101').state === 'found' && cellOf('11100101').lat === 21.01,
      cellOf('11100101'));
    ok('cell miss state=miss, KHÔNG có toạ độ', cellOf('11100303').state === 'miss' && !cellOf('11100303').lat,
      cellOf('11100303'));
    ok('cell chưa tra state=unpaid, KHÔNG có toạ độ (kể cả có trong CSDL nội bộ)',
      cellOf('11100404').state === 'unpaid' && !cellOf('11100404').lat, cellOf('11100404'));

    const byLookup = await req('GET', '/api/lookup-history/batch/' + batchId + '/cells', undefined, stateToken);
    ok('GET /api/lookup-history/batch/:id/cells cùng số liệu với phiên',
      byLookup.status === 200 && byLookup.body.summary.total === 4 &&
      byLookup.body.summary.found === 2, byLookup.body && byLookup.body.summary);
    ok('GET lookup-history/batch/:id/cells trả resolvedCells cho client ghép',
      Array.isArray(byLookup.body.resolvedCells), byLookup.body.resolvedCells);
    ok('fallback (lookup_history trống nhưng có resolved_cells) cũng trả resolvedCells',
      /resolvedCells:\s*data\.resolvedCells/.test(fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8')));

    ok('route /cells cần đăng nhập (401 khi không có token)',
      (await req('GET', '/api/call-log-sessions/' + batchId + '/cells')).status === 401);
    ok('user khác không thấy toạ độ của batch này',
      ((await req('GET', '/api/call-log-sessions/' + batchId + '/cells', undefined, token)).body.summary || {}).found === 0);

    console.log('\n== 10. POST /api/call-log-sessions/:batchId/cells (lưu cell đã trả phí) ==');
    // Cell 11100404 đang unpaid → đẩy toạ độ lên phiên (như client làm sau khi tra).
    const post1 = await req('POST', '/api/call-log-sessions/' + batchId + '/cells',
      { cells: [{ mcc: '452', mnc: '04', lac: '9101', cellid: '11100404', lat: 21.0404, lng: 105.804, range: 700, source: 'local', radio: 'LTE' }] },
      stateToken);
    ok('POST /cells → 200 + added 1', post1.status === 200 && post1.body.added === 1, post1.body);
    const savedRow = await sqlGet('SELECT resolved_cells FROM call_log_batches WHERE batch_id = ?', [batchId]);
    ok('cột resolved_cells có JSON 1 cell',
      !!savedRow && /11100404/.test(savedRow.resolved_cells || ''), savedRow && savedRow.resolved_cells);

    const afterPost = await req('GET', '/api/call-log-sessions/' + batchId + '/cells', undefined, stateToken);
    const c4 = (afterPost.body.cells || []).find(c => String(c.cellid) === '11100404') || {};
    ok('GET sau POST: cell 11100404 thành found + có toạ độ',
      c4.state === 'found' && c4.lat === 21.0404, c4);
    ok('GET trả resolvedCells cho client ghép', Array.isArray(afterPost.body.resolvedCells) &&
      afterPost.body.resolvedCells.length === 1, afterPost.body.resolvedCells);
    ok('summary cập nhật: 3 found · 0 unpaid',
      afterPost.body.summary.found === 3 && afterPost.body.summary.unpaid === 0, afterPost.body.summary);

    const post2 = await req('POST', '/api/call-log-sessions/' + batchId + '/cells',
      { cells: [{ mcc: '452', mnc: '04', lac: '9101', cellid: '11100404', lat: 21.0404, lng: 105.804 }] }, stateToken);
    ok('POST lại cùng cell → updated 1, không nhân bản',
      post2.status === 200 && post2.body.updated === 1 && post2.body.total === 1, post2.body);

    ok('POST /cells từ user khác → 403', (await req('POST', '/api/call-log-sessions/' + batchId + '/cells',
      { cells: [{ mcc: '452', mnc: '04', lac: '9101', cellid: '11100404', lat: 1, lng: 2 }] }, token)).status === 403);
    ok('POST /cells batch không tồn tại → 404', (await req('POST', '/api/call-log-sessions/nope-xyz/cells',
      { cells: [{ mcc: '452', mnc: '04', lac: '9101', cellid: '1', lat: 1, lng: 2 }] }, stateToken)).status === 404);
    ok('POST /cells thiếu mảng cells → 400', (await req('POST', '/api/call-log-sessions/' + batchId + '/cells',
      {}, stateToken)).status === 400);
    ok('POST /cells quá 2000 cell → 400', (await req('POST', '/api/call-log-sessions/' + batchId + '/cells',
      { cells: new Array(2001).fill({ mcc: '452', mnc: '04', lac: '9101', cellid: '1', lat: 1, lng: 2 }) },
      stateToken)).status === 400);
    ok('POST /cells bỏ qua toạ độ không hợp lệ', (await req('POST', '/api/call-log-sessions/' + batchId + '/cells',
      { cells: [{ mcc: '452', mnc: '04', lac: '9101', cellid: '999', lat: 999, lng: 999 }] }, stateToken))
      .body.total === 1);

    // Batch chỉ có resolved_cells (chưa từng ghi lookup_history) → nhánh fallback của
    // /api/lookup-history/batch/:id/cells vẫn phải trả toạ độ đã trả phí.
    await sqlRun('INSERT INTO call_log_batches (batch_id, user_id, file_name, resolved_cells) VALUES (?, ?, ?, ?)',
      ['clstate9b', uid2, 'saved-only.xlsx', JSON.stringify([{ mcc: '452', mnc: '04', lac: '9101', cellid: '22200505', lat: 21.5, lng: 105.9, range: 300, source: 'local', radio: 'LTE' }])]);
    const fb = await req('GET', '/api/lookup-history/batch/clstate9b/cells', undefined, stateToken);
    ok('fallback: 200 + resolvedCells có toạ độ đã trả phí',
      fb.status === 200 && Array.isArray(fb.body.resolvedCells) &&
      fb.body.resolvedCells.length === 1 && fb.body.resolvedCells[0].lat === 21.5,
      { status: fb.status, body: fb.body });
  }

  console.log('\n== 11. GET /api/call-log-sessions: tiến độ tra + lọc ngày (tab "Tra cứu theo list") ==');
  {
    // batchId + uid2 lấy lại theo batch 'clstate9' đã dựng ở mục 9/10.
    const uid2 = (await sqlGet(
      'SELECT user_id FROM call_log_batches WHERE batch_id = ?', ['clstate9'])).user_id;
    const stateToken = (await req('POST', '/api/login', { username: 'bc_state', password: 'pw' })).body.token;

    const list = await req('GET', '/api/call-log-sessions?page=1&limit=50', undefined, stateToken);
    ok('GET /api/call-log-sessions → 200 + mảng data', list.status === 200 && Array.isArray(list.body.data),
      list.status);
    const s = (list.body.data || []).find(x => x.batch_id === 'clstate9') || {};
    ok('dòng phiên có cell_total = số cell duy nhất của file (4)', s.cell_total === 4, s.cell_total);
    ok('looked_count = số cell đã tra (3: 2 found + 1 miss)', s.looked_count === 3, s.looked_count);
    ok('found_count = số cell history trả toạ độ + số cell lưu trong resolved_cells (2 + 1)',
      s.found_count === 3, s.found_count);
    ok('total/totalPages cho pager', list.body.total >= 1 && list.body.totalPages >= 1,
      { total: list.body.total, totalPages: list.body.totalPages });

    // created_at lưu UTC, route lọc theo ngày GIỜ VN (UTC+7). Lấy "hôm nay" theo đúng
    // múi giờ đó, nếu không test sẽ fail oan quanh nửa đêm (17h UTC = 0h ngày hôm sau).
    const vnToday = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
    const today = (await req('GET', '/api/call-log-sessions?date=' + vnToday,
      undefined, stateToken));
    ok('lọc ngày hôm nay vẫn thấy phiên vừa tạo',
      today.status === 200 && (today.body.data || []).some(x => x.batch_id === 'clstate9'));

    const old = await req('GET', '/api/call-log-sessions?date=2000-01-01', undefined, stateToken);
    ok('lọc ngày khác → không trả phiên này',
      old.status === 200 && !(old.body.data || []).some(x => x.batch_id === 'clstate9'));

    const bad = await req('GET', '/api/call-log-sessions?date=khong-phai-ngay', undefined, stateToken);
    ok('ngày sai định dạng bị bỏ qua (không lỗi 500)',
      bad.status === 200 && (bad.body.data || []).some(x => x.batch_id === 'clstate9'));

    ok('danh sách phiên cần đăng nhập (401)',
      (await req('GET', '/api/call-log-sessions')).status === 401);
    ok('user khác không thấy phiên của uid2',
      !(((await req('GET', '/api/call-log-sessions', undefined, token)).body.data) || [])
        .some(x => x.batch_id === 'clstate9'));
    ok('uid2 tồn tại (chốt dữ liệu test)', Number.isFinite(Number(uid2)));
  }

  // ==========================================================================
  // PUT /api/call-log-sessions/:batchId — đăng ký phiên khi bấm "Tra cứu" ở bảng
  // cell (file nạp Excel chưa có bản ghi call_logs nào vẫn phải hiện ở tab).
  // ==========================================================================
  console.log('\n== 12. PUT /api/call-log-sessions/:batchId (upsert metadata phiên) ==');
  {
    const uid2 = (await sqlGet(
      'SELECT user_id FROM call_log_batches WHERE batch_id = ?', ['clstate9'])).user_id;
    const stateToken = (await req('POST', '/api/login', { username: 'bc_state', password: 'pw' })).body.token;
    const newId = 'clput' + Date.now();

    const put = await req('PUT', '/api/call-log-sessions/' + newId, {
      fileName: 'reg.xlsx', network: 'Viettel', rowCount: 12, cellCount: 5
    }, stateToken);
    ok('PUT tạo phiên mới → 200', put.status === 200 && put.body.success === true, put.body);
    const row = await sqlGet('SELECT * FROM call_log_batches WHERE batch_id = ?', [newId]);
    ok('phiên mới ghi đúng metadata (file/network/row_count/cell_count)',
      row && row.file_name === 'reg.xlsx' && row.network === 'Viettel' &&
      Number(row.row_count) === 12 && Number(row.cell_count) === 5,
      row);
    ok('phiên mới thuộc đúng user (uid2)', Number(row.user_id) === Number(uid2));

    const again = await req('PUT', '/api/call-log-sessions/' + newId, {
      fileName: 'reg2.xlsx', network: '', rowCount: 12, cellCount: 7
    }, stateToken);
    const row2 = await sqlGet('SELECT * FROM call_log_batches WHERE batch_id = ?', [newId]);
    ok('PUT lần 2 là upsert (không nhân đôi dòng, không reset resolved_cells)',
      again.status === 200 && row2.file_name === 'reg2.xlsx' &&
      Number(row2.cell_count) === 7 && (await sqlGet(
        'SELECT COUNT(*) AS n FROM call_log_batches WHERE batch_id = ?', [newId])).n === 1,
      row2);
    ok('PUT giữ network cũ khi client gửi rỗng (COALESCE NULLIF)',
      (await sqlGet('SELECT network FROM call_log_batches WHERE batch_id = ?', [newId])).network === 'Viettel');

    // Phiên chỉ có metadata (chưa có call_logs) vẫn phải hiện trong danh sách.
    const list = await req('GET', '/api/call-log-sessions?page=1&limit=50', undefined, stateToken);
    const s = (list.body.data || []).find(x => x.batch_id === newId) || {};
    ok('phiên chỉ có metadata vẫn hiện trong GET /api/call-log-sessions',
      !!s.batch_id && s.file_name === 'reg2.xlsx');
    ok('GET trả cell_count để hiện đúng tổng số cell', Number(s.cell_count) === 7, s.cell_count);

    // Tra toạ độ vào phiên đó (không còn 404 batch not found).
    const post = await req('POST', '/api/call-log-sessions/' + newId + '/cells', {
      cells: [{ mcc: '452', mnc: '04', lac: '9101', cellid: '33330707', lat: 21.02, lng: 105.83, range: 500, source: 'local', radio: 'LTE' }]
    }, stateToken);
    ok('POST cells vào phiên vừa PUT → 200 (không 404 batch not found)', post.status === 200, post.body);

    ok('PUT cần đăng nhập (401)',
      (await req('PUT', '/api/call-log-sessions/' + newId, { fileName: 'x.xlsx' })).status === 401);
    ok('PUT không ghi đè phiên của user khác (403)',
      (await req('PUT', '/api/call-log-sessions/' + newId, { fileName: 'hack.xlsx' }, token)).status === 403);
    ok('PUT của user khác không đổi tên file',
      (await sqlGet('SELECT file_name FROM call_log_batches WHERE batch_id = ?', [newId])).file_name === 'reg2.xlsx');
  }

  console.log('\n== 13. resolve-batch lô lớn: tra CSDL nội bộ theo lô (nhanh) + trừ điểm đúng ==');
  {
    const bcrypt3 = require('bcryptjs');
    const hash3 = await bcrypt3.hash('pw', 4);
    await sqlRun('INSERT INTO users (username, password, role, status) VALUES (?, ?, ?, ?)',
      ['bc_bulk', hash3, 'user', 'active']);
    const uid3 = (await sqlGet('SELECT id FROM users WHERE username = ?', ['bc_bulk'])).id;
    const bulkToken = (await req('POST', '/api/login', { username: 'bc_bulk', password: 'pw' })).body.token;

    // 120 cell thuộc 12 LAC khác nhau, có cả cellid dạng NGẮN và dạng ECI (18 chữ số)
    // + vài cell KHÔNG có trong CSDL (phải ra miss, không trừ điểm).
    const bulk = [];
    for (let i = 0; i < 120; i++) {
      const lac = 9200 + (i % 12);
      const cellid = i % 2 === 0 ? String(22210000 + i) : String(169400000 + i * 7);
      bulk.push({ mcc: 452, mnc: '04', lac, cellid });
      await sqlRun('INSERT OR REPLACE INTO cells (mcc, mnc, lac, cellid, lat, lng, range, radio) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [452, '04', lac, cellid, 21.0 + i * 0.001, 105.8 + i * 0.001, 500, 'LTE']);
    }
    await sqlRun('UPDATE users SET credit_balance = ? WHERE id = ?', [500, uid3]);

    const t0 = Date.now();
    const rb = await req('POST', '/api/cells/resolve-batch',
      { cells: bulk, uploadId: 'bulkbatch' + Date.now(), fileName: 'bulk.xlsx', roundIdx: 0 }, bulkToken);
    const ms = Date.now() - t0;

    ok('resolve-batch 120 cell trả 200', rb.status === 200, rb.status);
    ok('lô 120 cell xong trong < 4000 ms', ms < 4000, ms + ' ms');
    const res = rb.body.results || [];
    ok('trả đủ 120 kết quả', res.length === 120, res.length);
    ok('mọi cell có trong CSDL nội bộ đều ra toạ độ (alias ngắn/ECI)',
      res.filter(r => r.lat != null).length === 120, res.filter(r => r.lat != null).length);
    ok('chỉ trừ điểm cho số cell tra ra kết quả (không trừ theo số query)',
      Number(rb.body.credit && rb.body.credit.charged) === 120, rb.body.credit);
    const bal3 = (await sqlGet('SELECT credit_balance AS b FROM users WHERE id = ?', [uid3])).b;
    ok('số dư giảm đúng 120', bal3 === 380, bal3);

    // Bấm lại CÙNG uploadId + CÙNG vòng (retry / mất mạng) → không trừ thêm.
    const rb2 = await req('POST', '/api/cells/resolve-batch',
      { cells: bulk, uploadId: rb.body.batchId, fileName: 'bulk.xlsx', roundIdx: 0 }, bulkToken);
    ok('retry cùng vòng không trừ thêm', Number(rb2.body.credit && rb2.body.credit.charged) === 0, rb2.body.credit);
    ok('retry vẫn trả toạ độ (đã trả phí)',
      (rb2.body.results || []).filter(r => r.lat != null).length === 120,
      (rb2.body.results || []).filter(r => r.lat != null).length);
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}
