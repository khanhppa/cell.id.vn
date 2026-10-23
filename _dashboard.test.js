/**
 * Test tích hợp Dashboard tổng quan + cấu hình Google Analytics.
 * Chạy: node _dashboard.test.js
 *
 * Dùng DB tạm + cổng tạm (xem _test-server.js). KHÔNG gọi Google thật:
 * mọi assertion chỉ kiểm tra cấu hình/validation/endpoint nội bộ.
 */
const crypto = require('crypto');
const { start } = require('./_test-server');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`); }
}

(async () => {
  const h = await start();

  const adminId = await h.createUser({
    username: 'dash_admin', role: 'admin', status: 'active', email: 'dash@test.local', verified: 1
  });
  const token = await h.login('dash_admin');
  ok('đăng nhập admin', !!token);

  const normalId = await h.createUser({ username: 'dash_user', email: 'dashu@test.local', verified: 1 });
  const normalToken = await h.login('dash_user');
  ok('đăng nhập user thường', !!normalToken);

  // Seed dữ liệu để dashboard có số liệu thật.
  await h.sqlRun(`INSERT INTO cells (mcc, mnc, lac, cellid, lat, lng, source, user_id)
                  VALUES ('452', '01', '9000', '111', 21.0, 105.8, 'test', ?)`, [normalId]);
  await h.sqlRun(`INSERT INTO cells (mcc, mnc, lac, cellid, lat, lng, source, user_id)
                  VALUES ('452', '01', '9000', '222', 21.1, 105.9, 'test', ?)`, [normalId]);
  for (let i = 0; i < 4; i++) {
    await h.sqlRun(`INSERT INTO lookup_history (user_id, mode, mcc, mnc, lac, cellid, found)
                    VALUES (?, 'single', '452', '01', '9000', ?, ?)`, [normalId, 'c' + i, i < 3 ? 1 : 0]);
  }
  await h.sqlRun(`INSERT INTO lookup_batches (batch_id, user_id, file_name, mode, cell_count, found_count)
                  VALUES ('batch-test-1', ?, 'cells.csv', 'batch', 10, 6)`, [normalId]);
  await h.sqlRun(`INSERT INTO payment_orders (order_code, user_id, amount_vnd, credits, status, paid_at)
                  VALUES (9001, ?, 50000, 50, 'PAID', CURRENT_TIMESTAMP)`, [normalId]);
  await h.sqlRun(`INSERT INTO payment_orders (order_code, user_id, amount_vnd, credits, status)
                  VALUES (9002, ?, 20000, 20, 'PENDING')`, [normalId]);
  await h.sqlRun(`INSERT INTO ip_tracker (user_id, type, name, token) VALUES (?, 'url', 'test', 'tok-dash-1')`, [adminId]);
  const tracker = await h.sqlGet("SELECT id FROM ip_tracker WHERE token = 'tok-dash-1'");
  await h.sqlRun(`INSERT INTO ip_tracker_logs (tracker_id, ip) VALUES (?, '127.0.0.1')`, [tracker.id]);

  console.log('\n== Phân quyền ==');
  const forbidden = await h.req('GET', '/api/admin/dashboard', undefined, normalToken);
  ok('user thường -> 403', forbidden.status === 403, forbidden.body);
  const forbiddenGa = await h.req('GET', '/api/admin/analytics', undefined, normalToken);
  ok('user thường gọi analytics -> 403', forbiddenGa.status === 403, forbiddenGa.body);

  console.log('\n== Dashboard local ==');
  const dash = await h.req('GET', '/api/admin/dashboard?days=7', undefined, token);
  ok('GET dashboard -> 200', dash.status === 200, dash.body);
  const d = dash.body || {};
  ok('users.total đếm đủ', d.users && d.users.total >= 2, d.users);
  ok('users.new_in_window > 0', d.users && d.users.new_in_window > 0, d.users);
  ok('users có series 7 ngày', Array.isArray(d.users.series) && d.users.series.length === 7, d.users && d.users.series);
  ok('cells.total = 2', d.cells && d.cells.total === 2, d.cells);
  ok('lookups.in_window = 4', d.lookups && d.lookups.in_window === 4, d.lookups);
  ok('lookups.today = 4', d.lookups && d.lookups.today === 4, d.lookups);
  ok('lookups.found_rate = 75', d.lookups && d.lookups.found_rate === 75, d.lookups);
  ok('lookups có series 7 ngày', d.lookups && d.lookups.series.length === 7, d.lookups && d.lookups.series);
  ok('top_users có dash_user', (d.lookups.top_users || []).some(u => u.username === 'dash_user'), d.lookups.top_users);
  ok('revenue.paid_vnd = 50000', d.revenue && d.revenue.paid_vnd === 50000, d.revenue);
  ok('revenue.paid_orders = 1', d.revenue && d.revenue.paid_orders === 1, d.revenue);
  ok('revenue.pending_orders = 1', d.revenue && d.revenue.pending_orders === 1, d.revenue);
  ok('ip.trackers = 1 + visits_total = 1', d.ip && d.ip.trackers === 1 && d.ip.visits_total === 1, d.ip);
  ok('system có uptime/db/version',
    d.system && d.system.uptime_seconds >= 0 && d.system.db_size_bytes > 0 && !!d.system.node_version, d.system);
  ok('activity có user/payment/batch',
    d.activity && d.activity.users.length > 0 && d.activity.payments.length > 0
    && d.activity.lookup_batches.length > 0, d.activity);
  ok('dashboard cached lần 2', (await h.req('GET', '/api/admin/dashboard?days=7', undefined, token)).body.cached === true);
  ok('refresh=1 bỏ cache', (await h.req('GET', '/api/admin/dashboard?days=7&refresh=1', undefined, token)).body.cached === false);
  ok('days ngoài range vẫn trả series hợp lệ',
    (await h.req('GET', '/api/admin/dashboard?days=999', undefined, token)).body.window_days === 365);

  console.log('\n== GA chưa cấu hình ==');
  const ga0 = await h.req('GET', '/api/admin/analytics?days=7', undefined, token);
  ok('analytics chưa cấu hình -> 200 configured:false',
    ga0.status === 200 && ga0.body.configured === false, ga0.body);
  ok('reason = disabled khi mặc định tắt', ga0.body.reason === 'disabled', ga0.body.reason);

  const gaJs0 = await h.req('GET', '/ga.js');
  ok('/ga.js trả JS rỗng khi chưa bật',
    typeof gaJs0.body === 'string' && !gaJs0.body.includes('googletagmanager'), gaJs0.body);

  console.log('\n== Validate settings GA ==');
  const badM = await h.req('PUT', '/api/settings', { settings: { ga_enabled: '1', ga_measurement_id: 'UA-123' } }, token);
  ok('Measurement ID sai -> 400', badM.status === 400, badM.body);
  const badP = await h.req('PUT', '/api/settings', { settings: { ga_enabled: '1', ga_property_id: 'abc' } }, token);
  ok('Property ID sai -> 400', badP.status === 400, badP.body);
  const badJson = await h.req('PUT', '/api/settings', {
    settings: { ga_enabled: '1', ga_service_account_json: '{oops' }
  }, token);
  ok('Service Account JSON hỏng -> 400', badJson.status === 400, badJson.body);
  const missingCfg = await h.req('PUT', '/api/settings', { settings: { ga_enabled: '1' } }, token);
  ok('bật GA không có cấu hình -> 400', missingCfg.status === 400, missingCfg.body);

  console.log('\n== Bật tracking bằng Measurement ID ==');
  const okTrack = await h.req('PUT', '/api/settings', {
    // Cố tình gửi lẫn khoảng trắng + chữ thường: server phải chuẩn hoá.
    settings: { ga_enabled: '1', ga_measurement_id: ' g-test12345 ' }
  }, token);
  ok('lưu Measurement ID -> 200', okTrack.status === 200, okTrack.body);

  const settings1 = await h.req('GET', '/api/settings', undefined, token);
  ok('GET settings có ga_measurement_id', settings1.body.ga_measurement_id === 'G-TEST12345', settings1.body);
  ok('chưa có Service Account -> _set false', settings1.body.ga_service_account_json_set === false, settings1.body);
  ok('chưa có email service account', !settings1.body.ga_service_account_email, settings1.body);

  const gaJs1 = await h.req('GET', '/ga.js');
  ok('/ga.js chứa Measurement ID', typeof gaJs1.body === 'string' && gaJs1.body.includes('G-TEST12345'), gaJs1.body);
  ok('/ga.js chứa gtag config', /gtag\('config'/.test(gaJs1.body));
  ok('/ga.js chứa googletagmanager', gaJs1.body.includes('googletagmanager.com/gtag/js'));
  ok('/ga.js có Cache-Control', /max-age=300/.test(gaJs1.headers['cache-control'] || ''), gaJs1.headers['cache-control']);

  const ga1 = await h.req('GET', '/api/admin/analytics?days=7', undefined, token);
  ok('chỉ tracking -> configured:false (thiếu reporting)',
    ga1.status === 200 && ga1.body.configured === false && ga1.body.reason === 'missing_credentials', ga1.body);

  console.log('\n== Service Account JSON ==');
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' }
  });
  const serviceAccount = JSON.stringify({
    type: 'service_account',
    project_id: 'dash-test',
    client_email: 'svc@dash-test.iam.gserviceaccount.com',
    private_key: privateKey
  });

  const missingEmail = await h.req('PUT', '/api/settings', {
    settings: { ga_service_account_json: JSON.stringify({ private_key: privateKey }) }
  }, token);
  ok('JSON thiếu client_email -> 400', missingEmail.status === 400, missingEmail.body);

  const okFull = await h.req('PUT', '/api/settings', {
    settings: {
      ga_enabled: '1',
      ga_measurement_id: 'G-TEST12345',
      // Dán kiểu URL/API cũng phải được chuẩn hoá về dãy số.
      ga_property_id: 'properties/123456789',
      ga_service_account_json: serviceAccount
    }
  }, token);
  ok('lưu đủ cấu hình GA -> 200', okFull.status === 200, okFull.body);

  const settings2 = await h.req('GET', '/api/settings', undefined, token);
  ok('Property ID được chuẩn hoá bỏ properties/',
    settings2.body.ga_property_id === '123456789', settings2.body.ga_property_id);
  ok('Service Account bị che (••••)', /^••••/.test(settings2.body.ga_service_account_json || ''), settings2.body.ga_service_account_json);
  ok('có cờ ga_service_account_json_set', settings2.body.ga_service_account_json_set === true, settings2.body);
  ok('GET settings trả email service account',
    settings2.body.ga_service_account_email === 'svc@dash-test.iam.gserviceaccount.com', settings2.body);
  ok('GET settings KHÔNG lộ private key',
    JSON.stringify(settings2.body).indexOf('PRIVATE KEY') === -1);

  // Test cấu hình KHÔNG gọi Google thật: JSON thiếu private_key -> 400 ngay.
  const analyticsTest = await h.req('POST', '/api/admin/analytics/test', {
    measurement_id: 'G-TEST12345',
    property_id: '123456789',
    service_account_json: JSON.stringify({ client_email: 'svc@dash-test.iam.gserviceaccount.com' })
  }, token);
  ok('analytics/test JSON thiếu key -> 400', analyticsTest.status === 400, analyticsTest.body);
  ok('analytics/test báo tracking OK', analyticsTest.body && analyticsTest.body.tracking.ok === true, analyticsTest.body);
  ok('analytics/test báo lỗi credentials',
    analyticsTest.body && analyticsTest.body.error && analyticsTest.body.error.code === 'invalid_credentials', analyticsTest.body);

  console.log('\n== Tắt GA ==');
  const off = await h.req('PUT', '/api/settings', { settings: { ga_enabled: '0' } }, token);
  ok('tắt GA -> 200', off.status === 200, off.body);
  const gaJs2 = await h.req('GET', '/ga.js');
  ok('/ga.js rỗng sau khi tắt',
    typeof gaJs2.body === 'string' && !gaJs2.body.includes('googletagmanager'), gaJs2.body);
  const ga2 = await h.req('GET', '/api/admin/analytics?days=7', undefined, token);
  ok('analytics sau khi tắt -> configured:false, reason disabled',
    ga2.status === 200 && ga2.body.configured === false && ga2.body.reason === 'disabled', ga2.body);

  console.log(`\n${pass} passed, ${fail} failed\n`);
  await h.cleanup();
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('LỖI TEST:', e);
  process.exit(1);
});
