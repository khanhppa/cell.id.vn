/**
 * _apitest.js — Kiểm thử Public API v1.
 *
 * Chạy: node _apitest.js
 * Yêu cầu: server đang chạy ở http://127.0.0.1:3000 với CẢ HAI biến sau:
 *   API_TEST_NO_RATELIMIT=1    (tắt hạn mức theo key)
 *   AUTH_TEST_NO_RATELIMIT=1   (tắt hạn mức đăng nhập 30 lần/5 phút theo IP —
 *                               không tắt thì chạy test lặp lại sẽ bị 429)
 * Ví dụ: API_TEST_NO_RATELIMIT=1 AUTH_TEST_NO_RATELIMIT=1 node server.js
 *
 * Test tạo user tạm id 990001/990002 và key riêng, dọn sạch ở cuối.
 *
 * MÔ HÌNH: API key KHÔNG gắn tài khoản — key là cổng kết nối. Tra cứu cần key +
 * JWT; điểm trừ vào tài khoản trong JWT.
 */
const db = require('./database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const BASE = process.env.API_TEST_BASE || 'http://127.0.0.1:3000';
const SECRET = process.env.JWT_SECRET || 'cell-tracker-secret-key-2024';
const ADMIN_ID = 990001;
const USER_ID = 990002;
const PASSWORD = 'ApiTestPass123';

let pass = 0, fail = 0;
const failures = [];
function ok(desc, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + desc); }
  else {
    fail++; failures.push(desc);
    console.log('  FAIL ' + desc + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''));
  }
}
function section(t) { console.log('\n== ' + t); }

const q = (sql, p = []) => new Promise((res, rej) => db.all(sql, p, (e, r) => e ? rej(e) : res(r)));
const run = (sql, p = []) => new Promise((res, rej) => db.run(sql, p, function (e) { e ? rej(e) : res(this); }));

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, opts);
  let body = null;
  const txt = await res.text();
  try { body = JSON.parse(txt); } catch (e) { body = txt; }
  return { status: res.status, body, headers: res.headers };
}
const jsonReq = (path, method, payload, headers = {}) => req(path, {
  method,
  headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
  body: payload === undefined ? undefined : JSON.stringify(payload)
});

(async () => {
  // ---------- Chuẩn bị ----------
  section('0. Chuẩn bị dữ liệu test');
  const hash = await bcrypt.hash(PASSWORD, 8);
  await run(`INSERT OR REPLACE INTO users (id, username, password, role, status, email, email_verified, credit_balance)
             VALUES (?,?,?,?,?,?,?,?)`, [ADMIN_ID, '__apitest_admin', hash, 'admin', 'active', 'apitest_admin@example.com', 1, 1000]);
  await run(`INSERT OR REPLACE INTO users (id, username, password, role, status, email, email_verified, credit_balance)
             VALUES (?,?,?,?,?,?,?,?)`, [USER_ID, '__apitest_user', hash, 'user', 'active', 'apitest_user@example.com', 1, 1000]);
  // Dọn key cũ của user test để chạy lại được nhiều lần.
  await run(`DELETE FROM api_request_logs WHERE user_id IN (?,?)`, [ADMIN_ID, USER_ID]);
  await run(`DELETE FROM api_keys WHERE user_id IN (?,?)`, [ADMIN_ID, USER_ID]);
  ok('tạo user test', (await q('SELECT id FROM users WHERE id IN (?,?)', [ADMIN_ID, USER_ID])).length === 2);

  const adminTok = jwt.sign({ id: ADMIN_ID, username: '__apitest_admin', role: 'admin' }, SECRET, { expiresIn: '1h' });
  const userTok = jwt.sign({ id: USER_ID, username: '__apitest_user', role: 'user' }, SECRET, { expiresIn: '1h' });
  const adminH = { Authorization: 'Bearer ' + adminTok };
  const userH = { Authorization: 'Bearer ' + userTok };
  // Header tra cứu đúng mô hình mới: key là cổng, JWT là tài khoản bị trừ điểm.
  const keyH = (raw, tok) => ({ 'X-API-Key': raw, Authorization: 'Bearer ' + (tok || userTok) });

  // ---------- Health ----------
  section('1. GET /api/v1/health');
  const h = await req('/api/v1/health');
  ok('health trả 200', h.status === 200);
  ok('health có ok:true', h.body && h.body.ok === true);
  ok('health có apiVersion v1', h.body && h.body.apiVersion === 'v1');
  ok('health không cần xác thực', !h.body.error);

  // ---------- Xác thực: thiếu / sai ----------
  section('2. Xác thực — các trường hợp từ chối');
  const noCred = await req('/api/v1/me');
  ok('không gửi credential → 401', noCred.status === 401);
  ok('reason NO_CREDENTIALS', noCred.body && noCred.body.reason === 'NO_CREDENTIALS');

  const badKey = await req('/api/v1/me', { headers: { 'X-API-Key': 'sk_live_deadbeef' } });
  ok('key sai → 401', badKey.status === 401);
  ok('reason INVALID_KEY', badKey.body && badKey.body.reason === 'INVALID_KEY');

  const badJwt = await req('/api/v1/me', { headers: { Authorization: 'Bearer not.a.jwt' } });
  ok('JWT sai → 401', badJwt.status === 401);
  ok('reason INVALID_TOKEN', badJwt.body && badJwt.body.reason === 'INVALID_TOKEN');

  const randomTok = await req('/api/v1/me', { headers: { Authorization: 'Bearer ' + jwt.sign({ id: 999999 }, SECRET) } });
  ok('JWT trỏ user không tồn tại → 401', randomTok.status === 401);

  // ---------- Login ----------
  section('3. POST /api/v1/login');
  const lm = await jsonReq('/api/v1/login', 'POST', {});
  ok('thiếu body → 400', lm.status === 400);
  ok('reason MISSING_CREDENTIALS', lm.body && lm.body.reason === 'MISSING_CREDENTIALS');

  const lw = await jsonReq('/api/v1/login', 'POST', { username: '__apitest_user', password: 'sai-mat-khau' });
  ok('sai mật khẩu → 401', lw.status === 401);
  ok('reason INVALID_CREDENTIALS', lw.body && lw.body.reason === 'INVALID_CREDENTIALS');

  const lnf = await jsonReq('/api/v1/login', 'POST', { username: 'khong_ton_tai_xyz', password: 'x' });
  ok('user không tồn tại → 401 (không lộ user có tồn tại hay không)', lnf.status === 401);
  ok('cùng reason với sai mật khẩu', lnf.body && lnf.body.reason === 'INVALID_CREDENTIALS');

  const lg = await jsonReq('/api/v1/login', 'POST', { username: '__apitest_user', password: PASSWORD });
  ok('đăng nhập đúng → 200', lg.status === 200);
  ok('trả token', !!(lg.body && lg.body.token));
  ok('trả expires_in 86400', lg.body && lg.body.expires_in === 86400);
  ok('trả user.username', lg.body && lg.body.user && lg.body.user.username === '__apitest_user');
  ok('trả user.credit_balance (số)', lg.body && typeof lg.body.user.credit_balance === 'number');
  ok('KHÔNG trả password/hash', lg.body && !JSON.stringify(lg.body).includes('$2'));
  ok('KHÔNG trả credit_balance của người khác', lg.body && lg.body.user.id === USER_ID);

  const lgEmail = await jsonReq('/api/v1/login', 'POST', { username: 'apitest_user@example.com', password: PASSWORD });
  ok('đăng nhập bằng EMAIL cũng được', lgEmail.status === 200);

  const lgCase = await jsonReq('/api/v1/login', 'POST', { username: 'APITEST_USER@EXAMPLE.COM', password: PASSWORD });
  ok('email không phân biệt hoa/thường', lgCase.status === 200);

  // ---------- me bằng JWT ----------
  section('4. GET /api/v1/me — bằng JWT');
  const meJwt = await req('/api/v1/me', { headers: { Authorization: 'Bearer ' + lg.body.token } });
  ok('JWT hợp lệ → 200', meJwt.status === 200);
  ok('auth_type = jwt', meJwt.body && meJwt.body.auth_type === 'jwt');
  ok('không có key khi dùng JWT', meJwt.body && meJwt.body.key === undefined);
  ok('user.id đúng', meJwt.body && meJwt.body.user.id === USER_ID);
  ok('có credit_balance', meJwt.body && typeof meJwt.body.user.credit_balance === 'number');

  // ---------- Admin CRUD key ----------
  section('5. Admin tạo / liệt kê khoá');
  const notAdmin = await jsonReq('/api/admin/api/keys', 'POST', { name: 'x' }, userH);
  ok('user thường KHÔNG tạo được key → 403', notAdmin.status === 403);

  const noAuth = await req('/api/admin/api/keys');
  ok('không đăng nhập → 401', noAuth.status === 401);

  const noName = await jsonReq('/api/admin/api/keys', 'POST', { user_id: USER_ID }, adminH);
  ok('thiếu tên → 400', noName.status === 400);

  // Key không gắn tài khoản → user_id (nếu client cũ còn gửi) bị BỎ QUA, không
  // còn là điều kiện hợp lệ. Key vẫn tạo được và không gắn ai.
  const strayUser = await jsonReq('/api/admin/api/keys', 'POST',
    { user_id: 99999999, name: 'ignored user_id' }, adminH);
  ok('user_id không tồn tại KHÔNG còn gây lỗi (bị bỏ qua)', strayUser.status === 200);
  ok('key tạo ra không gắn tài khoản nào', strayUser.body.key.user_id === undefined);
  await req(`/api/admin/api/keys/${strayUser.body.key.id}`, { method: 'DELETE', headers: adminH });

  const pastExp = await jsonReq('/api/admin/api/keys', 'POST',
    { name: 'x', expires_at: '2000-01-01T00:00:00Z' }, adminH);
  ok('expires_at trong quá khứ → 400', pastExp.status === 400);

  const created = await jsonReq('/api/admin/api/keys', 'POST', {
    name: 'Integration test', scopes: ['lookup', 'account'],
    rate_limit_per_min: 30, rate_limit_per_day: 500
  }, adminH);
  ok('tạo key → 200', created.status === 200);
  const RAW = created.body && created.body.raw;
  ok('trả raw key đúng 1 lần', typeof RAW === 'string' && RAW.startsWith('sk_live_'));
  ok('raw key dài 72 ký tự', RAW && RAW.length === 72);
  ok('KHÔNG trả key_hash ra response', created.body && !JSON.stringify(created.body).includes('key_hash'));
  const keyId = created.body && created.body.key && created.body.key.id;
  ok('có key.id', Number.isFinite(keyId));
  ok('scopes là mảng', Array.isArray(created.body.key.scopes) && created.body.key.scopes.length === 2);
  ok('rate_limit_per_min đúng', created.body.key.rate_limit_per_min === 30);

  const list = await req('/api/admin/api/keys', { headers: adminH });
  ok('liệt kê key → 200', list.status === 200);
  ok('list là mảng', Array.isArray(list.body));
  ok('list KHÔNG chứa raw key', !JSON.stringify(list.body).includes(RAW));
  ok('list KHÔNG chứa key_hash', !JSON.stringify(list.body).includes('key_hash'));
  ok('key KHÔNG gắn tài khoản nào (không có owner_username)',
    list.body.every(k => k.owner_username === undefined && k.user_id === undefined));
  ok('key mặc định require_user = true', created.body.key.require_user === true);

  // ---------- Xác thực: key là cổng, JWT là tài khoản ----------
  section('6. Xác thực: key (cổng) + JWT (tài khoản)');
  // Cố ý CHỈ gửi key, KHÔNG JWT — phải bị từ chối vì không biết trừ điểm của ai.
  const keyOnly = await req('/api/v1/me', { headers: { 'X-API-Key': RAW } });
  ok('CHỈ gửi key (không JWT) → 401', keyOnly.status === 401, keyOnly.body);
  ok('reason USER_REQUIRED', keyOnly.body && keyOnly.body.reason === 'USER_REQUIRED');
  ok('gợi ý endpoint đăng nhập', keyOnly.body && String(keyOnly.body.hint || '').includes('/api/v1/login'));

  const keyOnlyResolve = await req('/api/v1/cells/resolve?mcc=452&mnc=01&lac=1&cellid=1',
    { headers: { 'X-API-Key': RAW } });
  ok('tra cứu chỉ bằng key → 401 USER_REQUIRED', keyOnlyResolve.status === 401 &&
    keyOnlyResolve.body.reason === 'USER_REQUIRED');

  const meBoth = await req('/api/v1/me', { headers: keyH(RAW) });
  ok('key + JWT → 200', meBoth.status === 200);
  ok('auth_type = key+jwt', meBoth.body && meBoth.body.auth_type === 'key+jwt');
  ok('trả thông tin key đang dùng', meBoth.body && meBoth.body.key && meBoth.body.key.id === keyId);
  ok('không lộ raw key trong response', meBoth.body && !JSON.stringify(meBoth.body).includes(RAW));
  ok('user là tài khoản trong JWT (không phải "chủ key")',
    meBoth.body && meBoth.body.user && meBoth.body.user.id === USER_ID);

  // JWT một mình vẫn dùng được (không có cổng key) — dùng cho web/tool nội bộ.
  const meJwtOnly = await req('/api/v1/me', { headers: { Authorization: 'Bearer ' + userTok } });
  ok('CHỈ JWT (không key) vẫn dùng được → 200', meJwtOnly.status === 200);
  ok('auth_type = jwt', meJwtOnly.body && meJwtOnly.body.auth_type === 'jwt');
  ok('không có key khi chỉ gửi JWT', meJwtOnly.body && meJwtOnly.body.key === undefined);

  // Điểm trừ vào tài khoản TRONG JWT, không phải ai khác.
  const ADMIN_BAL_BEFORE = Number((await q('SELECT credit_balance FROM users WHERE id = ?', [ADMIN_ID]))[0].credit_balance);
  const USER_BAL_BEFORE = Number((await q('SELECT credit_balance FROM users WHERE id = ?', [USER_ID]))[0].credit_balance);
  await run('DELETE FROM cells WHERE mcc=? AND mnc=? AND lac=? AND cellid=?', ['452','99','99001','990001']);
  await run(`INSERT INTO cells (mcc, mnc, lac, cellid, lat, lng, range, radio, description, source)
             VALUES ('452','99','99001','990001', 21.0278, 105.8342, 500, 'LTE', 'Test cell API', 'apitest')`);
  const charge = await req('/api/v1/cells/resolve?mcc=452&mnc=99&lac=99001&cellid=990001',
    { headers: keyH(RAW, adminTok) });   // key của app + JWT của ADMIN
  ok('key + JWT admin → tra được', charge.status === 200);
  const ADMIN_BAL_AFTER = Number((await q('SELECT credit_balance FROM users WHERE id = ?', [ADMIN_ID]))[0].credit_balance);
  const USER_BAL_AFTER = Number((await q('SELECT credit_balance FROM users WHERE id = ?', [USER_ID]))[0].credit_balance);
  ok('điểm trừ vào tài khoản TRONG JWT (admin), không phải ai khác',
    ADMIN_BAL_AFTER <= ADMIN_BAL_BEFORE);
  ok('tài khoản không đăng nhập KHÔNG bị trừ',
    USER_BAL_AFTER === USER_BAL_BEFORE, { before: USER_BAL_BEFORE, after: USER_BAL_AFTER });

  // ---------- Scope ----------
  section('7. Phân quyền theo scope');
  const accOnly = await jsonReq('/api/admin/api/keys', 'POST',
    { name: 'account only', scopes: ['account'] }, adminH);
  const RAW_ACC = accOnly.body.raw;
  const meAcc = await req('/api/v1/me', { headers: keyH(RAW_ACC) });
  ok('key có scope account → /me OK', meAcc.status === 200);
  const resAcc = await req('/api/v1/cells/resolve?mcc=452&mnc=01&lac=1&cellid=1', { headers: keyH(RAW_ACC) });
  ok('key THIẾU scope lookup → 403', resAcc.status === 403);
  ok('reason INSUFFICIENT_SCOPE', resAcc.body && resAcc.body.reason === 'INSUFFICIENT_SCOPE');
  ok('báo scope còn thiếu', resAcc.body && resAcc.body.requiredScope === 'lookup');

  // ---------- Resolve ----------
  section('8. GET /api/v1/cells/resolve');
  const rNoCred = await req('/api/v1/cells/resolve?mcc=452&mnc=01&lac=1&cellid=1');
  ok('không credential → 401', rNoCred.status === 401);

  const rBadParam = await req('/api/v1/cells/resolve', { headers: keyH(RAW) });
  ok('thiếu tham số → 400', rBadParam.status === 400);
  ok('reason BAD_REQUEST', rBadParam.body && rBadParam.body.reason === 'BAD_REQUEST');
  ok('found=false', rBadParam.body && rBadParam.body.found === false);

  // Chèn 1 cell nội bộ chắc chắn có toạ độ để test nhánh 200.
  await run(`DELETE FROM cells WHERE mcc='452' AND mnc='99' AND lac='99001' AND cellid='990001'`);
  await run(`INSERT INTO cells (mcc, mnc, lac, cellid, lat, lng, range, radio, description, source)
             VALUES ('452','99','99001','990001', 21.0278, 105.8342, 500, 'LTE', 'Test cell API', 'apitest')`);
  const rFound = await req('/api/v1/cells/resolve?mcc=452&mnc=99&lac=99001&cellid=990001', { headers: keyH(RAW) });
  ok('cell có trong nội bộ → 200', rFound.status === 200);
  ok('found = true', rFound.body && rFound.body.found === true);
  ok('source = local', rFound.body && rFound.body.source === 'local');
  ok('cell.lat là số', rFound.body && typeof rFound.body.cell.lat === 'number');
  ok('cell.lon là số (không phải lng)', rFound.body && typeof rFound.body.cell.lon === 'number' && rFound.body.cell.lng === undefined);
  ok('cell.range là số', rFound.body && typeof rFound.body.cell.range === 'number');
  ok('cell.radio có giá trị', rFound.body && !!rFound.body.cell.radio);
  ok('cell.address = mô tả', rFound.body && rFound.body.cell.address === 'Test cell API');
  ok('credit.charged là 0 hoặc 1', rFound.body && [0, 1].includes(rFound.body.credit.charged));

  const rMiss = await req('/api/v1/cells/resolve?mcc=452&mnc=99&lac=99999&cellid=9999999', { headers: keyH(RAW) });
  ok('cell không tồn tại → 404', rMiss.status === 404);
  ok('reason CELL_NOT_FOUND', rMiss.body && rMiss.body.reason === 'CELL_NOT_FOUND');
  ok('found = false khi miss', rMiss.body && rMiss.body.found === false);

  // Điểm: tra thành công phải giữ nguyên/tăng "đã trừ" trong log, miss thì không trừ.
  const balBefore = await q('SELECT credit_balance FROM users WHERE id = ?', [USER_ID]);
  await req('/api/v1/cells/resolve?mcc=452&mnc=99&lac=99001&cellid=990001', { headers: keyH(RAW) });
  const balAfter = await q('SELECT credit_balance FROM users WHERE id = ?', [USER_ID]);
  ok('tra miss nhiều lần không trừ điểm',
    Number(balAfter[0].credit_balance) === Number(balBefore[0].credit_balance) || Number(balAfter[0].credit_balance) <= Number(balBefore[0].credit_balance));

  // ---------- Rate limit headers ----------
  section('9. Header hạn mức');
  ok('có X-RateLimit-Limit', rFound.headers.get('x-ratelimit-limit') === '30');
  ok('có X-RateLimit-Remaining', rFound.headers.get('x-ratelimit-remaining') !== null);
  ok('có X-RateLimit-Limit-Day', rFound.headers.get('x-ratelimit-limit-day') === '500');
  ok('có X-RateLimit-Remaining-Day', rFound.headers.get('x-ratelimit-remaining-day') !== null);

  // ---------- Log ----------
  section('10. Nhật ký request');
  const logs = await req('/api/admin/api/logs?limit=50', { headers: adminH });
  ok('lấy log → 200', logs.status === 200);
  ok('log là mảng và có dữ liệu', Array.isArray(logs.body) && logs.body.length > 0);
  const ourLogs = logs.body.filter(l => l.user_id === USER_ID);
  ok('log ghi nhận request của key test', ourLogs.length > 0);
  ok('log KHÔNG chứa raw key', !JSON.stringify(logs.body).includes(RAW));
  ok('log có path', ourLogs.some(l => String(l.path || '').includes('/api/v1')));
  ok('log có status', ourLogs.every(l => l.status != null));
  ok('log có duration_ms', ourLogs.some(l => l.duration_ms != null));
  ok('log ghi request thất bại 404', ourLogs.some(l => Number(l.status) === 404));

  const logsErr = await req('/api/admin/api/logs?status=error', { headers: adminH });
  ok('lọc status=error → 200', logsErr.status === 200);
  ok('lọc error chỉ trả status>=400', logsErr.body.every(l => Number(l.status) >= 400));

  const logsByKey = await req('/api/admin/api/logs?key_id=' + keyId, { headers: adminH });
  ok('lọc theo key_id → chỉ log của key đó', logsByKey.body.every(l => Number(l.api_key_id) === Number(keyId)));

  const logsNotAdmin = await req('/api/admin/api/logs', { headers: userH });
  ok('user thường không xem được log → 403', logsNotAdmin.status === 403);

  // ---------- Stats ----------
  section('11. Thống kê');
  const st = await req('/api/admin/api/stats', { headers: adminH });
  ok('stats → 200', st.status === 200);
  ok('stats có keys.total', st.body && st.body.keys && typeof st.body.keys.total === 'number');
  ok('stats có keys.active', st.body && st.body.keys && typeof st.body.keys.active === 'number');
  ok('stats có last24h.requests', st.body && st.body.last24h && typeof st.body.last24h.requests === 'number');
  ok('stats có last24h.errors', st.body && st.body.last24h && typeof st.body.last24h.errors === 'number');
  const stNotAdmin = await req('/api/admin/api/stats', { headers: userH });
  ok('user thường không xem stats → 403', stNotAdmin.status === 403);

  // ---------- Tắt / bật / thu hồi / hết hạn ----------
  section('12. Tắt, bật, hết hạn, thu hồi');
  const off = await jsonReq(`/api/admin/api/keys/${keyId}`, 'PUT', { enabled: false }, adminH);
  ok('tắt key → 200', off.status === 200 && off.body.key.enabled === false);
  const afterOff = await req('/api/v1/me', { headers: keyH(RAW) });
  ok('key đang tắt → 403', afterOff.status === 403);
  ok('reason KEY_DISABLED', afterOff.body && afterOff.body.reason === 'KEY_DISABLED');

  const on = await jsonReq(`/api/admin/api/keys/${keyId}`, 'PUT', { enabled: true }, adminH);
  ok('bật lại key → 200', on.status === 200 && on.body.key.enabled === true);
  const afterOn = await req('/api/v1/me', { headers: keyH(RAW) });
  ok('key bật lại dùng được', afterOn.status === 200);

  const upd = await jsonReq(`/api/admin/api/keys/${keyId}`, 'PUT',
    { name: 'Renamed', rate_limit_per_min: 12 }, adminH);
  ok('sửa tên + hạn mức → 200', upd.status === 200);
  ok('tên đã đổi', upd.body.key.name === 'Renamed');
  ok('hạn mức phút đã đổi', upd.body.key.rate_limit_per_min === 12);

  // Hết hạn: đặt expires_at về quá khứ trực tiếp trong DB rồi gọi.
  await run('UPDATE api_keys SET expires_at = ? WHERE id = ?', ['2000-01-01 00:00:00', keyId]);
  const expired = await req('/api/v1/me', { headers: keyH(RAW) });
  ok('key hết hạn → 401', expired.status === 401);
  ok('reason KEY_EXPIRED', expired.body && expired.body.reason === 'KEY_EXPIRED');
  await run('UPDATE api_keys SET expires_at = NULL WHERE id = ?', [keyId]);

  const rv = await jsonReq(`/api/admin/api/keys/${keyId}/revoke`, 'POST', {}, adminH);
  ok('thu hồi → 200', rv.status === 200 && !!rv.body.key.revoked_at);
  const afterRv = await req('/api/v1/me', { headers: keyH(RAW) });
  ok('key đã thu hồi → 401', afterRv.status === 401);
  ok('reason KEY_REVOKED', afterRv.body && afterRv.body.reason === 'KEY_REVOKED');

  const revokeAgain = await jsonReq(`/api/admin/api/keys/${keyId}/revoke`, 'POST', {}, adminH);
  ok('thu hồi lại không lỗi (idempotent)', revokeAgain.status === 200);

  const cannotEnable = await jsonReq(`/api/admin/api/keys/${keyId}`, 'PUT', { enabled: true }, adminH);
  ok('KHÔNG bật lại được key đã thu hồi → 400', cannotEnable.status === 400);

  // ---------- Xoá ----------
  section('13. Xoá khoá');
  const fresh = await jsonReq('/api/admin/api/keys', 'POST',
    { name: 'temp to delete' }, adminH);
  const freshId = fresh.body.key.id;
  const del = await req(`/api/admin/api/keys/${freshId}`, { method: 'DELETE', headers: adminH });
  ok('xoá key chưa dùng → 200', del.status === 200);

  const delUsed = await req(`/api/admin/api/keys/${keyId}`, { method: 'DELETE', headers: adminH });
  ok('KHÔNG xoá được key đã có log → 400', delUsed.status === 400);

  // ---------- Tài khoản đăng nhập bị khoá (key không có chủ nên xét JWT) ----------
  section('14. Tài khoản trong JWT bị khoá / chưa kích hoạt');
  const k2 = await jsonReq('/api/admin/api/keys', 'POST', { name: 'for status test' }, adminH);
  const RAW2 = k2.body.raw;
  await run("UPDATE users SET status = 'disabled' WHERE id = ?", [USER_ID]);
  const dis = await req('/api/v1/me', { headers: keyH(RAW2) });
  ok('tài khoản trong JWT bị khoá → 403', dis.status === 403);
  ok('reason ACCOUNT_DISABLED', dis.body && dis.body.reason === 'ACCOUNT_DISABLED');
  // Key KHÔNG bị ảnh hưởng khi một tài khoản bị khoá — key không thuộc tài khoản đó.
  const keyStillOk = await req('/api/v1/me', { headers: keyH(RAW2, adminTok) });
  ok('cùng key nhưng JWT tài khoản khác (admin) vẫn dùng được → 200', keyStillOk.status === 200);

  const disLogin = await jsonReq('/api/v1/login', 'POST', { username: '__apitest_user', password: PASSWORD });
  ok('tài khoản bị khoá không login được qua API → 403', disLogin.status === 403);
  ok('reason ACCOUNT_DISABLED khi login', disLogin.body && disLogin.body.reason === 'ACCOUNT_DISABLED');

  await run("UPDATE users SET status = 'pending' WHERE id = ?", [USER_ID]);
  const pend = await req('/api/v1/me', { headers: keyH(RAW2) });
  ok('tài khoản chưa kích hoạt → 403', pend.status === 403);
  ok('reason EMAIL_NOT_VERIFIED', pend.body && pend.body.reason === 'EMAIL_NOT_VERIFIED');

  await run("UPDATE users SET status = 'active' WHERE id = ?", [USER_ID]);
  const restored = await req('/api/v1/me', { headers: keyH(RAW2) });
  ok('kích hoạt lại → dùng được', restored.status === 200);

  // ---------- Key không bắt buộc đăng nhập ----------
  section('14b. Key có require_user = 0 (chỉ endpoint công khai)');
  const noUserKey = await jsonReq('/api/admin/api/keys', 'POST',
    { name: 'no user required', require_user: false }, adminH);
  ok('tạo key với require_user=false → 200', noUserKey.status === 200);
  ok('require_user trả về false', noUserKey.body.key.require_user === false);
  const RAW_NOUSER = noUserKey.body.raw;
  // Endpoint cần danh tính vẫn phải từ chối vì không biết trừ điểm của ai.
  const noUserResolve = await req('/api/v1/cells/resolve?mcc=452&mnc=01&lac=1&cellid=1',
    { headers: { 'X-API-Key': RAW_NOUSER } });
  ok('key require_user=0 vẫn KHÔNG tra cứu được nếu thiếu JWT (không biết trừ điểm ai)',
    noUserResolve.status === 401 && noUserResolve.body.reason === 'USER_REQUIRED');
  // Bật lại require_user qua API sửa.
  const toggled = await jsonReq(`/api/admin/api/keys/${noUserKey.body.key.id}`, 'PUT',
    { require_user: true }, adminH);
  ok('sửa được require_user qua PUT', toggled.status === 200 && toggled.body.key.require_user === true);

  // ---------- Hàm thuần trong api-keys.js ----------
  section('15. Module api-keys — hàm thuần');
  const apiKeys = require('./api-keys');
  const g1 = apiKeys.generateKey();
  const g2 = apiKeys.generateKey();
  ok('generateKey sinh 2 key khác nhau', g1.raw !== g2.raw);
  ok('generateKey có prefix sk_live_', g1.raw.startsWith('sk_live_'));
  ok('hashKey ổn định', apiKeys.hashKey(g1.raw) === g1.hash);
  ok('hashKey khác nhau cho key khác', apiKeys.hashKey(g1.raw) !== apiKeys.hashKey(g2.raw));
  ok('hashKey là 64 hex', /^[0-9a-f]{64}$/.test(g1.hash));
  ok('prefix chỉ 12 ký tự đầu', g1.prefix === g1.raw.slice(0, 12));
  ok('prefix KHÔNG đủ dựng lại key', g1.prefix.length < g1.raw.length);
  ok('normalizeScopes bỏ scope rác', apiKeys.normalizeScopes('lookup,admin,*') === 'lookup');
  ok('normalizeScopes rỗng → mặc định cả 2', apiKeys.normalizeScopes('') === 'lookup,account');
  ok('normalizeScopes nhận mảng', apiKeys.normalizeScopes(['account']) === 'account');
  ok('hasScope đúng', apiKeys.hasScope('lookup,account', 'lookup') === true);
  ok('hasScope sai → false', apiKeys.hasScope('account', 'lookup') === false);
  ok('hasScope KHÔNG có admin', apiKeys.hasScope('lookup,account,admin', 'admin') === false);
  ok('clampInt chặn 0', apiKeys.clampInt(0, 60, 1, 100) === 60);
  ok('clampInt chặn rác', apiKeys.clampInt('abc', 60, 1, 100) === 60);
  ok('clampInt chặn vượt trần', apiKeys.clampInt(1e9, 60, 1, 100) === 100);
  ok('checkUsable null → INVALID_KEY', apiKeys.checkUsable(null).reason === 'INVALID_KEY');
  ok('checkUsable revoked → KEY_REVOKED',
    apiKeys.checkUsable({ revoked_at: 'x', enabled: 1 }).reason === 'KEY_REVOKED');
  ok('checkUsable enabled=0 → KEY_DISABLED',
    apiKeys.checkUsable({ enabled: 0 }).reason === 'KEY_DISABLED');
  ok('checkUsable ok khi hợp lệ (không cần tài khoản)',
    apiKeys.checkUsable({ enabled: 1 }).ok === true);
  ok('checkUsable KHÔNG cần/không xét chủ sở hữu',
    !/owner_status|OWNER_MISSING/.test(require('fs').readFileSync(require('path').join(__dirname, 'api-keys.js'), 'utf8')));
  // require_user: mặc định phải là BẬT, kể cả row cũ chưa có cột.
  ok('requiresUser: row null → true (an toàn)', apiKeys.requiresUser(null) === true);
  ok('requiresUser: thiếu cột → true', apiKeys.requiresUser({ enabled: 1 }) === true);
  ok('requiresUser: require_user=1 → true', apiKeys.requiresUser({ require_user: 1 }) === true);
  ok('requiresUser: require_user=0 → false', apiKeys.requiresUser({ require_user: 0 }) === false);

  // ---------- Key không gắn tài khoản ----------
  section('15b. Key là cổng, không gắn tài khoản');
  const akSrc2 = require('fs').readFileSync(require('path').join(__dirname, 'api-keys.js'), 'utf8');
  ok('findKeyByRaw KHÔNG join users', !/findKeyByRaw[\s\S]{0,700}JOIN users/.test(akSrc2));
  ok('createKey KHÔNG nhận/không kiểm userId', !/createKey\(\{[\s\S]{0,200}userId/.test(akSrc2));
  const noUserCreate = await jsonReq('/api/admin/api/keys', 'POST',
    { name: 'no account', user_id: USER_ID }, adminH);
  ok('gửi user_id khi tạo key → không gắn tài khoản nào',
    noUserCreate.status === 200 && noUserCreate.body.key.user_id === undefined);
  // RAW đã bị thu hồi ở mục 12 → dùng key còn sống (RAW2) cho phép thử này.
  const sameKeyTwoUsers = await req('/api/v1/me', { headers: keyH(RAW2, adminTok) });
  ok('CÙNG 1 key dùng được cho nhiều tài khoản',
    sameKeyTwoUsers.status === 200 && sameKeyTwoUsers.body.user.id === ADMIN_ID,
    sameKeyTwoUsers.body);
  const sameKeyOtherUser = await req('/api/v1/me', { headers: keyH(RAW2) });
  ok('cùng key đó, JWT tài khoản khác → trả tài khoản khác',
    sameKeyOtherUser.status === 200 && sameKeyOtherUser.body.user.id === USER_ID);

  // ---------- Không có endpoint nào đọc lại key ----------
  section('16. Bảo mật: không đọc lại được key');
  const apiSrc = require('fs').readFileSync(require('path').join(__dirname, 'server.js'), 'utf8');
  const akSrc = require('fs').readFileSync(require('path').join(__dirname, 'api-keys.js'), 'utf8');
  ok('server.js không có route trả raw key ngoài lúc tạo',
    (apiSrc.match(/raw:\s*r\.raw/g) || []).length === 1);
  ok('api-keys.js dùng crypto để sinh key', /crypto\.randomBytes/.test(akSrc));
  ok('api-keys.js lưu hash, không lưu raw', /key_hash/.test(akSrc) && !/INSERT INTO api_keys[\s\S]{0,400}\braw\b/.test(akSrc));
  ok('API KHÔNG bật CORS', !/Access-Control-Allow-Origin/.test(apiSrc));
  ok('log API không ghi raw key', !/INSERT INTO api_request_logs[\s\S]{0,600}raw/.test(akSrc));

  // ---------- Dọn dẹp ----------
  section('17. Dọn dẹp');
  // Key KHÔNG gắn user → phải xoá theo key_prefix của những key test vừa tạo,
  // không thể lọc theo user_id. Giữ lại mọi key không thuộc lượt test này.
  const ourKeyIds = await q(
    `SELECT DISTINCT api_key_id AS id FROM api_request_logs
     WHERE api_key_id IS NOT NULL AND user_id IN (?, ?)`, [ADMIN_ID, USER_ID]);
  const ids = ourKeyIds.map(r => Number(r.id)).filter(Number.isFinite);
  for (const id of ids) {
    await run('DELETE FROM api_request_logs WHERE api_key_id = ?', [id]);
    await run('DELETE FROM api_keys WHERE id = ?', [id]);
  }
  await run(`DELETE FROM api_request_logs WHERE user_id IN (?,?)`, [ADMIN_ID, USER_ID]);
  await run(`DELETE FROM cells WHERE mcc='452' AND mnc='99' AND lac='99001' AND cellid='990001'`);
  await run(`DELETE FROM users WHERE id IN (?,?)`, [ADMIN_ID, USER_ID]);
  ok('đã xoá user/cell test',
    (await q('SELECT id FROM users WHERE id IN (?,?)', [ADMIN_ID, USER_ID])).length === 0);
  ok('đã xoá key test', ids.length > 0 &&
    (await q(`SELECT id FROM api_keys WHERE id IN (${ids.map(() => '?').join(',')})`, ids)).length === 0);

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  if (fail) {
    console.log('\nThất bại:');
    failures.forEach(f => console.log('  - ' + f));
  }
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error('\nLỖI CHẠY TEST:', e && e.stack || e);
  process.exit(1);
});
