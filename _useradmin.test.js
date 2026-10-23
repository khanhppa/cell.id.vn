/**
 * Test tích hợp quản lý user (admin): sửa TOÀN BỘ trường hồ sơ.
 * Chạy: node _useradmin.test.js
 *
 * Dùng DB tạm + cổng tạm (xem _test-server.js), không đụng dữ liệu thật.
 */
const { start } = require('./_test-server');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`); }
}

(async () => {
  const h = await start();

  const adminId = await h.createUser({
    username: 'ua_admin', role: 'admin', status: 'active', email: 'admin@test.local', verified: 1
  });
  const adminToken = await h.login('ua_admin');
  ok('đăng nhập admin', !!adminToken);

  const userId = await h.createUser({ username: 'ua_user', email: 'u@test.local', verified: 0 });
  const dupId = await h.createUser({ username: 'ua_dup', email: 'dup@test.local', verified: 1 });
  ok('tạo user nền', !!userId && !!dupId);

  console.log('\n== Danh sách + chi tiết ==');
  const list = await h.req('GET', '/api/admin/users', undefined, adminToken);
  ok('GET /api/admin/users -> 200', list.status === 200);
  const listed = (list.body || []).find(u => u.id === userId);
  ok('list có email + email_verified', listed && listed.email === 'u@test.local' && Number(listed.email_verified) === 0, listed);

  const detail = await h.req('GET', `/api/admin/users/${userId}`, undefined, adminToken);
  ok('GET chi tiết -> 200', detail.status === 200, detail.body);
  const d0 = detail.body || {};
  ok('chi tiết đủ trường hồ sơ',
    d0.username === 'ua_user' && d0.email === 'u@test.local' && d0.role === 'user'
    && d0.status === 'active' && d0.email_verified === 0
    && d0.balance === 0 && d0.used === 0 && 'terms_accepted_at' in d0 && !!d0.created_at, d0);
  ok('chi tiết user không tồn tại -> 404',
    (await h.req('GET', '/api/admin/users/999999', undefined, adminToken)).status === 404);

  console.log('\n== Sửa toàn bộ trường ==');
  const upd = await h.req('PUT', `/api/admin/users/${userId}`, {
    username: 'ua_user2',
    email: 'u2@test.local',
    email_verified: 1,
    password: 'newpass1',
    role: 'admin',
    status: 'active'
  }, adminToken);
  ok('PUT đầy đủ -> 200', upd.status === 200, upd.body);
  const u1 = upd.body && upd.body.user || {};
  ok('username đã đổi', u1.username === 'ua_user2', u1);
  ok('email đã đổi', u1.email === 'u2@test.local', u1);
  ok('email_verified = 1', u1.email_verified === 1, u1);
  ok('role = admin', u1.role === 'admin', u1);
  ok('status = active', u1.status === 'active', u1);

  const loginNewPass = await h.login('ua_user2', 'newpass1');
  ok('đăng nhập bằng mật khẩu mới', !!loginNewPass);

  console.log('\n== Đổi email & xác thực ==');
  const up2 = await h.req('PUT', `/api/admin/users/${userId}`, { email: 'u3@test.local' }, adminToken);
  ok('đổi email -> 200', up2.status === 200, up2.body);
  ok('đổi email tự reset xác thực', up2.body.user.email_verified === 0, up2.body.user);

  const up2b = await h.req('PUT', `/api/admin/users/${userId}`, { email: 'u3@test.local', email_verified: 1 }, adminToken);
  ok('tick xác thực giữ nguyên', up2b.body.user.email_verified === 1, up2b.body.user);

  const up3 = await h.req('PUT', `/api/admin/users/${userId}`, { email: '' }, adminToken);
  ok('xoá email -> 200', up3.status === 200, up3.body);
  ok('email = null sau khi xoá', up3.body.user.email === null, up3.body.user);
  ok('xoá email reset xác thực', up3.body.user.email_verified === 0, up3.body.user);

  console.log('\n== Validation ==');
  const dupName = await h.req('PUT', `/api/admin/users/${userId}`, { username: 'ua_admin' }, adminToken);
  ok('trùng username -> 409', dupName.status === 409, dupName.body);

  const dupMail = await h.req('PUT', `/api/admin/users/${userId}`, { email: 'dup@test.local' }, adminToken);
  ok('trùng email -> 409', dupMail.status === 409, dupMail.body);

  const badRole = await h.req('PUT', `/api/admin/users/${userId}`, { role: 'root' }, adminToken);
  ok('role sai -> 400', badRole.status === 400, badRole.body);
  const badStatus = await h.req('PUT', `/api/admin/users/${userId}`, { status: 'banned' }, adminToken);
  ok('status sai -> 400', badStatus.status === 400, badStatus.body);
  const shortPw = await h.req('PUT', `/api/admin/users/${userId}`, { password: '123' }, adminToken);
  ok('mật khẩu ngắn -> 400', shortPw.status === 400, shortPw.body);
  const badMail = await h.req('PUT', `/api/admin/users/${userId}`, { email: 'not-an-email' }, adminToken);
  ok('email sai -> 400', badMail.status === 400, badMail.body);
  const noChange = await h.req('PUT', `/api/admin/users/${userId}`, {}, adminToken);
  ok('không có thay đổi -> 400', noChange.status === 400, noChange.body);

  console.log('\n== Guard tài khoản ==');
  const selfDemote = await h.req('PUT', `/api/admin/users/${adminId}`, { role: 'user' }, adminToken);
  ok('tự hạ quyền -> 400', selfDemote.status === 400, selfDemote.body);
  const selfDisable = await h.req('PUT', `/api/admin/users/${adminId}`, { status: 'disabled' }, adminToken);
  ok('tự khoá -> 400', selfDisable.status === 400, selfDisable.body);
  const selfDelete = await h.req('DELETE', `/api/admin/users/${adminId}`, undefined, adminToken);
  ok('tự xoá -> 400', selfDelete.status === 400, selfDelete.body);

  const demoteOther = await h.req('PUT', `/api/admin/users/${userId}`, { role: 'user' }, adminToken);
  ok('hạ quyền admin khác khi còn admin -> 200', demoteOther.status === 200, demoteOther.body);

  console.log('\n== Legacy route + tạo user ==');
  const legacy = await h.req('PUT', `/api/users/${userId}`, { username: 'ua_user3' }, adminToken);
  ok('PUT /api/users/:id (legacy) vẫn chạy', legacy.status === 200 && legacy.body.success, legacy.body);

  const created = await h.req('POST', '/api/admin/users', {
    username: 'ua_created', password: 'pw12345', email: 'created@test.local'
  }, adminToken);
  ok('tạo user qua /api/admin/users -> 200', created.status === 200, created.body);
  ok('user admin tạo mặc định đã xác thực', created.body.user && created.body.user.email_verified === 1, created.body.user);
  ok('user admin tạo mặc định active', created.body.user && created.body.user.status === 'active', created.body.user);

  const createdDup = await h.req('POST', '/api/admin/users', {
    username: 'ua_created', password: 'pw12345'
  }, adminToken);
  ok('tạo trùng username -> 409', createdDup.status === 409, createdDup.body);

  const badCreate = await h.req('POST', '/api/admin/users', { username: 'ab', password: '123' }, adminToken);
  ok('tạo user username/mật khẩu ngắn -> 400', badCreate.status === 400, badCreate.body);

  console.log('\n== Phân quyền ==');
  const normalId = await h.createUser({ username: 'ua_normal', email: 'normal@test.local', verified: 1 });
  const normalToken = await h.login('ua_normal');
  ok('đăng nhập user thường', !!normalToken);
  const forbiddenGet = await h.req('GET', `/api/admin/users/${normalId}`, undefined, normalToken);
  ok('user thường GET chi tiết -> 403', forbiddenGet.status === 403, forbiddenGet.body);
  const forbiddenPut = await h.req('PUT', `/api/admin/users/${normalId}`, { username: 'hacked' }, normalToken);
  ok('user thường PUT -> 403', forbiddenPut.status === 403, forbiddenPut.body);

  console.log(`\n${pass} passed, ${fail} failed\n`);
  await h.cleanup();
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('LỖI TEST:', e);
  process.exit(1);
});
