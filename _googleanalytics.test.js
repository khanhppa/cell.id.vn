/**
 * Test thuần cho google-analytics.js — KHÔNG cần DB, KHÔNG gọi mạng thật.
 * Chạy: node _googleanalytics.test.js
 *
 * Dùng HTTP giả + RSA key tạm để kiểm tra:
 *  - parse/validate Service Account JSON, Measurement ID, Property ID.
 *  - chuẩn hoá report GA4 (totals 2 kỳ, series zero-fill, dimension report).
 *  - map lỗi Google (401/403/400/429/network) sang mã nghiệp vụ.
 *  - getDashboard: batch + countries + realtime, cache token & dashboard, resetCache.
 *  - snippet /ga.js và describeServiceAccount không lộ private key.
 */
const crypto = require('crypto');
const assert = require('assert');
const ga = require('./google-analytics');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`); }
}

const { privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' }
});
const SERVICE_JSON = JSON.stringify({
  type: 'service_account',
  project_id: 'cell-test',
  client_email: 'svc@cell-test.iam.gserviceaccount.com',
  private_key: privateKey
});

console.log('\n== Parse Service Account ==');
const parsed = ga.parseServiceAccount(SERVICE_JSON);
ok('JSON hợp lệ -> ok', parsed.ok === true, parsed);
ok('đọc đúng client_email', parsed.ok && parsed.credentials.client_email === 'svc@cell-test.iam.gserviceaccount.com');
ok('private key giữ nguyên PEM', parsed.ok && /BEGIN PRIVATE KEY/.test(parsed.credentials.private_key));
ok('chuỗi rỗng -> missing', ga.parseServiceAccount('').reason === 'missing');
ok('JSON hỏng -> invalid_json', ga.parseServiceAccount('{oops').reason === 'invalid_json');
ok('thiếu client_email -> missing_client_email',
  ga.parseServiceAccount(JSON.stringify({ private_key: privateKey })).reason === 'missing_client_email');
ok('thiếu private_key -> invalid_private_key',
  ga.parseServiceAccount(JSON.stringify({ client_email: 'a@b.co' })).reason === 'invalid_private_key');
ok('BOM đầu file vẫn parse được',
  ga.parseServiceAccount('\uFEFF' + SERVICE_JSON).ok === true);
const desc = ga.describeServiceAccount(SERVICE_JSON);
ok('describe trả email + configured', desc.configured === true && desc.email.includes('@'), desc);
ok('describe KHÔNG chứa private key', JSON.stringify(desc).indexOf('PRIVATE KEY') === -1);

console.log('\n== Validate ID ==');
ok('G-ABC1234567 hợp lệ', ga.isValidMeasurementId('G-ABC1234567'));
ok('measurement id thường bị từ chối', !ga.isValidMeasurementId('UA-123-1'));
ok('measurement id rỗng bị từ chối', !ga.isValidMeasurementId(''));
ok('measurement id được trim + viết hoa',
  ga.normalizeMeasurementId(' g-abc1234567 ') === 'G-ABC1234567', ga.normalizeMeasurementId(' g-abc1234567 '));
ok('property 123456789 hợp lệ', ga.isValidPropertyId('123456789'));
ok('property có chữ bị từ chối', !ga.isValidPropertyId('12345abc'));
ok('property rỗng bị từ chối', !ga.isValidPropertyId(''));
ok('property bỏ tiền tố properties/',
  ga.normalizePropertyId('properties/123456789') === '123456789', ga.normalizePropertyId('properties/123456789'));
ok('property dạng properties/ vẫn hợp lệ', ga.isValidPropertyId('properties/123456789'));
ok('JSON encode 2 lần vẫn parse', ga.parseServiceAccount(JSON.stringify(SERVICE_JSON)).ok === true);
const literalNewlineKey = JSON.stringify({
  client_email: 'literal@test.local',
  private_key: '-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----'
});
ok('private_key còn escape \\\\n vẫn chuẩn hoá được', ga.parseServiceAccount(literalNewlineKey).ok === true);

console.log('\n== Report definitions ==');
const reqs = ga.buildReportRequests(28);
ok('totals có 2 date range (hiện tại + kỳ trước)', reqs.totals.dateRanges.length === 2, reqs.totals.dateRanges);
ok('kỳ hiện tại 28daysAgo -> yesterday',
  reqs.totals.dateRanges[0].startDate === '28daysAgo' && reqs.totals.dateRanges[0].endDate === 'yesterday');
ok('kỳ trước 56daysAgo -> 29daysAgo',
  reqs.totals.dateRanges[1].startDate === '56daysAgo' && reqs.totals.dateRanges[1].endDate === '29daysAgo');
ok('series có dimension date + 3 metric',
  reqs.series.dimensions[0].name === 'date' && reqs.series.metrics.length === 3,
  reqs.series);
ok('pages lấy top 10 theo pageviews', reqs.pages.limit === '10' && reqs.pages.dimensions[0].name === 'pagePath');

console.log('\n== Chuẩn hoá totals ==');
const totalsHeaders = [
  { name: 'dateRange' }, { name: 'activeUsers' }, { name: 'totalUsers' }, { name: 'newUsers' },
  { name: 'sessions' }, { name: 'screenPageViews' }, { name: 'eventCount' },
  { name: 'engagementRate' }, { name: 'bounceRate' }, { name: 'averageSessionDuration' },
  { name: 'sessionsPerUser' }, { name: 'engagedSessions' }
];
function metricRow(values) {
  return { dimensionValues: [{ value: 'date_range_x' }], metricValues: values.map(v => ({ value: String(v) })) };
}
const totalsReport = {
  columnHeaders: totalsHeaders,
  rows: [metricRow([120, 150, 30, 40, 200, 500, 0.62, 0.38, 95.4, 1.3, 25]),
    metricRow([100, 130, 20, 32, 160, 400, 0.55, 0.45, 80, 1.2, 18])]
};
const normTotals = ga.normalizeTotals(totalsReport);
ok('totals.active_users = 120', normTotals.totals.active_users === 120, normTotals.totals);
ok('totals.page_views = 200', normTotals.totals.page_views === 200);
ok('previous.sessions = 32', normTotals.previous.sessions === 32);
ok('metric thiếu -> 0', ga.normalizeTotals({ columnHeaders: totalsHeaders, rows: [metricRow([1])] }).totals.sessions === 0);
const deltas = ga.computeDeltas(normTotals.totals, normTotals.previous);
ok('delta sessions = +25%', deltas.sessions === 25, deltas.sessions);
ok('không có kỳ trước -> deltas null', ga.computeDeltas(normTotals.totals, null) === null);

// GA không cam kết thứ tự row: nhận diện kỳ theo dimensionValues date_range_0/1.
const reversedRows = [
  metricRow([100, 130, 20, 32, 160, 400, 0.55, 0.45, 80, 1.2, 18]),
  metricRow([120, 150, 30, 40, 200, 500, 0.62, 0.38, 95.4, 1.3, 25])
];
reversedRows[0].dimensionValues = [{ value: 'date_range_1' }];
reversedRows[1].dimensionValues = [{ value: 'date_range_0' }];
const normReversed = ga.normalizeTotals({ columnHeaders: totalsHeaders, rows: reversedRows });
ok('row đảo thứ tự vẫn map đúng kỳ hiện tại', normReversed.totals.active_users === 120, normReversed);
ok('row đảo thứ tự vẫn map đúng kỳ trước', normReversed.previous.active_users === 100, normReversed);

console.log('\n== Chuẩn hoá series (zero-fill) ==');
const last7 = ga.dateRangeKeys(7);
const d1 = last7[0].replace(/-/g, '');
const d2 = last7[1].replace(/-/g, '');
const seriesReport = {
  rows: [
    { dimensionValues: [{ value: d1 }], metricValues: [{ value: '10' }, { value: '4' }, { value: '20' }] },
    { dimensionValues: [{ value: d2 }], metricValues: [{ value: '12' }, { value: '5' }, { value: '25' }] }
  ]
};
const series = ga.normalizeSeries(seriesReport, 7);
ok('series có đủ 7 ngày', series.length === 7, series);
ok('ngày đầu kỳ map đúng', series.some(d => d.date === last7[0] && d.users === 10 && d.page_views === 20), series);
ok('ngày không có dữ liệu = 0', series[2].users === 0 && series[2].sessions === 0, series[2]);
ok('dateRangeKeys trả đúng số ngày', ga.dateRangeKeys(5).length === 5);

console.log('\n== Chuẩn hoá dimension report ==');
const pages = ga.normalizeDimensionReport({
  rows: [
    { dimensionValues: [{ value: '/index.html' }], metricValues: [{ value: '50' }, { value: '40' }, { value: '88.5' }] },
    { dimensionValues: [{ value: '/login.html' }], metricValues: [{ value: '10' }, { value: '8' }, { value: '20' }] }
  ]
}, { dimensions: { path: 0 }, metrics: { page_views: 0, users: 1, avg_session_seconds: 2 } });
ok('pages map path + số liệu', pages.length === 2 && pages[0].path === '/index.html' && pages[0].page_views === 50, pages);
ok('pages giữ thứ tự server trả về', pages[1].path === '/login.html');

console.log('\n== Map lỗi Google ==');
function httpErr(status, data) {
  const e = new Error('request failed');
  e.response = { status, data };
  return e;
}
ok('403 -> permission_denied', ga.mapGoogleError(httpErr(403, { error: { message: 'no access' } })).code === 'permission_denied');
ok('401 -> invalid_credentials', ga.mapGoogleError(httpErr(401, {})).code === 'invalid_credentials');
ok('404 -> invalid_property', ga.mapGoogleError(httpErr(404, {})).code === 'invalid_property');
ok('400 + property -> invalid_property',
  ga.mapGoogleError(httpErr(400, { error: { message: 'Invalid property id' } })).code === 'invalid_property');
ok('429 -> quota_exceeded', ga.mapGoogleError(httpErr(429, {})).code === 'quota_exceeded');
ok('network -> network_error', ga.mapGoogleError(new Error('ENOTFOUND')).code === 'network_error');
const denied = ga.mapGoogleError(httpErr(403, { error: { message: 'no access' } }));
ok('403 có hint về Viewer', /Viewer/.test(denied.message), denied.message);

console.log('\n== Snippet /ga.js ==');
const snippet = ga.buildGaJs('G-ABC1234567');
ok('snippet chứa measurement id', snippet.includes('G-ABC1234567'));
ok('snippet chứa gtag config', snippet.includes("gtag('config'"));
ok('snippet chứa thẻ script googletagmanager', snippet.includes('googletagmanager.com/gtag/js'));
ok('ID sai -> snippet rỗng (comment)', !ga.buildGaJs('UA-1-2').includes('googletagmanager'));

console.log('\n== getDashboard với HTTP giả ==');
const credentials = parsed.credentials;
const config = {
  enabled: true,
  measurementId: 'G-ABC1234567',
  propertyId: '123456789',
  account: { ok: true, credentials, reason: null },
  trackingValid: true,
  reportingValid: true
};
const calls = [];
let tokenCalls = 0;
const fakeReports = {
  reports: [
    totalsReport,
    seriesReport,
    { rows: [{ dimensionValues: [{ value: '/a' }], metricValues: [{ value: '9' }, { value: '7' }, { value: '30' }] }] },
    { rows: [{ dimensionValues: [{ value: 'Organic Search' }], metricValues: [{ value: '20' }, { value: '15' }] }] },
    { rows: [{ dimensionValues: [{ value: 'mobile' }], metricValues: [{ value: '18' }, { value: '12' }] }] }
  ]
};
const fakeHttp = {
  post: async (url, body, opts) => {
    calls.push({ url, opts });
    if (url === ga.TOKEN_URL) {
      tokenCalls++;
      return { data: { access_token: 'fake-token', expires_in: 3600 } };
    }
    if (url.includes(':batchRunReports')) return { data: fakeReports };
    if (url.includes(':runReport')) {
      return { data: { rows: [{ dimensionValues: [{ value: 'Vietnam' }], metricValues: [{ value: '30' }, { value: '22' }] }] } };
    }
    if (url.includes(':runRealtimeReport')) return { data: { rows: [{ metricValues: [{ value: '5' }] }] } };
    throw new Error('unexpected URL ' + url);
  }
};

(async () => {
  ga.resetCache();
  const dash = await ga.getDashboard({ days: 7, http: fakeHttp, config });
  ok('dashboard configured = true', dash.configured === true, dash);
  ok('realtime active_users = 5', dash.realtime.active_users === 5, dash.realtime);
  ok('totals active_users = 120', dash.totals.active_users === 120);
  ok('deltas sessions = 25', dash.deltas.sessions === 25);
  ok('series dài 7 ngày', dash.series.length === 7);
  ok('top_pages map path', dash.top_pages[0] && dash.top_pages[0].path === '/a', dash.top_pages);
  ok('channels map channel', dash.channels[0] && dash.channels[0].channel === 'Organic Search');
  ok('devices map device', dash.devices[0] && dash.devices[0].device === 'mobile');
  ok('countries map country', dash.countries[0] && dash.countries[0].country === 'Vietnam');
  ok('gọi đúng 1 lần token', tokenCalls === 1, tokenCalls);
  ok('batch gồm 5 report',
    calls.some(c => c.url.includes(':batchRunReports') && c.opts && c.opts.headers.Authorization === 'Bearer fake-token'));

  const cached = await ga.getDashboard({ days: 7, http: fakeHttp, config });
  ok('lần 2 dùng dashboard cache', cached.cached === true && tokenCalls === 1, { cached: cached.cached, tokenCalls });

  ga.resetCache();
  const fresh = await ga.getDashboard({ days: 7, http: fakeHttp, config });
  ok('resetCache -> gọi token lại', tokenCalls === 2 && fresh.cached === false, { tokenCalls, cached: fresh.cached });

  // Cache tách theo số ngày
  await ga.getDashboard({ days: 14, http: fakeHttp, config });
  ok('days khác -> gọi token nhưng vẫn cache token (không tăng)', tokenCalls === 2, tokenCalls);

  console.log('\n== Chưa cấu hình ==');
  ga.resetCache();
  const off = await ga.getDashboard({ days: 7, http: fakeHttp, config: { ...config, enabled: false } });
  ok('GA tắt -> configured false, reason disabled', off.configured === false && off.reason === 'disabled', off);
  const missing = await ga.getDashboard({
    days: 7, http: fakeHttp,
    config: { ...config, propertyId: '', reportingValid: false }
  });
  ok('thiếu property -> missing_credentials', missing.configured === false && missing.reason === 'missing_credentials');

  console.log('\n== testConnection ==');
  ga.resetCache();
  const testOk = await ga.testConnection({
    measurement_id: 'G-ABC1234567',
    property_id: '123456789',
    service_account_json: SERVICE_JSON
  }, { http: fakeHttp });
  ok('testConnection ok', testOk.ok === true, testOk);
  ok('testConnection trả email service account',
    testOk.reporting.account_email === 'svc@cell-test.iam.gserviceaccount.com', testOk.reporting);
  ok('testConnection có sample 7 ngày', !!testOk.reporting.sample, testOk.reporting);

  const badHttp = {
    post: async (url) => {
      if (url === ga.TOKEN_URL) return { data: { access_token: 'x', expires_in: 3600 } };
      throw httpErr(403, { error: { message: 'User does not have sufficient permissions' } });
    }
  };
  const testDenied = await ga.testConnection({
    measurement_id: 'bad', property_id: '123456789', service_account_json: SERVICE_JSON
  }, { http: badHttp });
  ok('testConnection lỗi quyền -> permission_denied',
    testDenied.ok === false && testDenied.error.code === 'permission_denied', testDenied);
  ok('testConnection vẫn báo tracking sai', testDenied.tracking.ok === false);

  const testNoJson = await ga.testConnection({
    measurement_id: 'G-ABC1234567', property_id: '123456789', service_account_json: ''
  }, { http: fakeHttp });
  ok('thiếu JSON -> invalid_credentials',
    testNoJson.ok === false && testNoJson.error.code === 'invalid_credentials', testNoJson);

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('LỖI TEST:', e);
  process.exit(1);
});
