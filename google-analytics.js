/**
 * Google Analytics 4 — cấu hình + đọc số liệu qua Analytics Data API v1beta.
 *
 * Vì sao dùng Service Account (không OAuth tương tác):
 *  - Server chỉ cần đọc báo cáo định kỳ, không có người dùng Google đăng nhập.
 *  - Đã có sẵn `jsonwebtoken` (ký RS256) + `axios` (HTTP) nên không cần thêm
 *    package `googleapis`.
 *
 * Cấu hình nằm trong bảng `settings` (key/value) do admin lưu qua /api/settings:
 *   ga_enabled, ga_measurement_id, ga_property_id, ga_service_account_json
 *
 * Module này KHÔNG tự đăng ký route; server.js chỉ gọi các hàm export.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const axios = require('axios');

// Nạp DB TRỄ: các hàm thuần (parse/validate/chuẩn hoá report) phải test được mà
// không mở database.sqlite thật. Chỉ các hàm đọc settings mới cần kết nối.
let db = null;
function getDb() {
  if (!db) db = require('./database');
  return db;
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API_BASE = 'https://analyticsdata.googleapis.com/v1beta';
const ANALYTICS_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const HTTP_TIMEOUT_MS = 12000;

const MEASUREMENT_ID_RE = /^G-[A-Z0-9]{6,20}$/;
const PROPERTY_ID_RE = /^\d{4,20}$/;

const SETTING_KEYS = ['ga_enabled', 'ga_measurement_id', 'ga_property_id', 'ga_service_account_json'];

const DEFAULTS = {
  ga_enabled: '0',
  ga_measurement_id: '',
  ga_property_id: '',
  ga_service_account_json: ''
};

/** Lỗi nghiệp vụ có mã để server/UI hiển thị thống nhất. */
class GaError extends Error {
  constructor(code, message, hint) {
    super(message);
    this.name = 'GaError';
    this.code = code;
    this.hint = hint || '';
  }
}

// ============================================================================
// Đọc settings (cache ngắn để /ga.js không query DB mỗi request)
// ============================================================================
function getSetting(key, dflt) {
  return new Promise((resolve) => {
    getDb().get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
      resolve(err || !row || row.value === null || row.value === undefined ? dflt : row.value);
    });
  });
}

let configCache = { at: 0, value: null };
const CONFIG_TTL_MS = 10000;

async function loadConfig(force) {
  const now = Date.now();
  if (!force && configCache.value && now - configCache.at < CONFIG_TTL_MS) return configCache.value;

  const values = {};
  await Promise.all(SETTING_KEYS.map(async (k) => { values[k] = await getSetting(k, DEFAULTS[k]); }));

  const measurementId = String(values.ga_measurement_id || '').trim();
  const propertyId = String(values.ga_property_id || '').trim();
  const account = parseServiceAccount(values.ga_service_account_json);

  const value = {
    enabled: String(values.ga_enabled) === '1',
    measurementId,
    propertyId,
    account,
    trackingValid: MEASUREMENT_ID_RE.test(measurementId),
    reportingValid: PROPERTY_ID_RE.test(propertyId) && account.ok
  };
  configCache = { at: now, value };
  return value;
}

function resetCache() {
  configCache = { at: 0, value: null };
  tokenCache.key = null;
  tokenCache.token = null;
  tokenCache.exp = 0;
  tokenCache.promise = null;
  dashboardCache.clear();
}

// ============================================================================
// Chuẩn hoá / validate cấu hình
// ============================================================================
function normalizeMeasurementId(v) {
  // GA4 Measurement ID luôn viết hoa; admin hay dán kèm khoảng trắng.
  return String(v == null ? '' : v).trim().toUpperCase();
}

function isValidMeasurementId(v) {
  return MEASUREMENT_ID_RE.test(normalizeMeasurementId(v));
}

function normalizePropertyId(v) {
  // Chấp nhận cả dạng "properties/123456789" (admin copy từ URL/API).
  return String(v == null ? '' : v).trim().replace(/^properties\//i, '').trim();
}

function isValidPropertyId(v) {
  return PROPERTY_ID_RE.test(normalizePropertyId(v));
}

/**
 * Parse nội dung file JSON service account do admin dán vào.
 * Chấp nhận cả JSON có BOM; private key phải đúng định dạng PEM.
 * Chấp nhận thêm trường hợp JSON bị encode 2 lần (dán nguyên chuỗi có dấu ngoặc kép).
 */
function parseServiceAccount(raw) {
  const text = String(raw == null ? '' : raw).replace(/^\uFEFF/, '').trim();
  if (!text) return { ok: false, reason: 'missing' };

  let obj;
  try {
    obj = JSON.parse(text);
    if (typeof obj === 'string') obj = JSON.parse(obj); // double-encoded
  } catch (e) {
    return { ok: false, reason: 'invalid_json' };
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, reason: 'invalid_json' };

  const clientEmail = String(obj.client_email || '').trim();
  let privateKey = String(obj.private_key || '');
  // Một số admin copy private_key ở dạng còn escape "\\n" (không phải JSON) →
  // chuẩn hoá về newline thật để jwt.sign dùng được.
  if (!privateKey.includes('\n') && privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) return { ok: false, reason: 'missing_client_email' };
  if (!/BEGIN (?:RSA )?PRIVATE KEY/.test(privateKey)) return { ok: false, reason: 'invalid_private_key' };

  return {
    ok: true,
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
      project_id: obj.project_id ? String(obj.project_id) : null
    }
  };
}

/** Thông tin service-account an toàn để trả cho admin (không có private key). */
function describeServiceAccount(raw) {
  const parsed = parseServiceAccount(raw);
  if (!parsed.ok) return { configured: false, email: '', reason: parsed.reason };
  return { configured: true, email: parsed.credentials.client_email, reason: null };
}

// ============================================================================
// OAuth2 token (JWT bearer flow) — cache theo credential
// ============================================================================
const tokenCache = { key: null, token: null, exp: 0, promise: null };

function tokenCacheKey(credentials) {
  return crypto.createHash('sha256')
    .update(String(credentials.client_email) + '\n' + String(credentials.private_key))
    .digest('hex');
}

function mapTokenError(err) {
  const status = err && err.response && err.response.status;
  const data = err && err.response && err.response.data;
  const reason = data && (data.error || data.error_description);
  const detail = String((data && (data.error_description || data.error)) || err.message || '');
  if (!status) {
    return new GaError('network_error',
      'Không kết nối được tới Google OAuth. Kiểm tra mạng/máy chủ rồi thử lại.', detail);
  }
  if (status === 400 && reason === 'invalid_grant') {
    return new GaError('invalid_credentials',
      'Service Account không hợp lệ: Google từ chối private key (invalid_grant). Hãy tạo lại key và dán đúng file JSON.', detail);
  }
  return new GaError('invalid_credentials',
    'Google từ chối xác thực Service Account' + (status ? ` (HTTP ${status})` : ''), detail);
}

async function fetchAccessToken(credentials, http) {
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    { iss: credentials.client_email, scope: ANALYTICS_SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 },
    credentials.private_key,
    { algorithm: 'RS256' }
  );
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion
  }).toString();
  try {
    const res = await http.post(TOKEN_URL, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: HTTP_TIMEOUT_MS
    });
    const token = res && res.data && res.data.access_token;
    if (!token) throw new GaError('invalid_credentials', 'Google không trả access_token cho Service Account.');
    return { token, expiresIn: Number(res.data.expires_in) || 3600 };
  } catch (e) {
    if (e instanceof GaError) throw e;
    throw mapTokenError(e);
  }
}

async function getAccessToken(config, { force = false, http = axios } = {}) {
  if (!config || !config.account || !config.account.ok) {
    throw new GaError('missing_credentials', 'Chưa cấu hình Service Account JSON cho Google Analytics.');
  }
  const key = tokenCacheKey(config.account.credentials);
  const now = Date.now();

  if (!force && tokenCache.token && tokenCache.key === key && tokenCache.exp > now + 60000) {
    return tokenCache.token;
  }
  if (!force && tokenCache.promise && tokenCache.key === key) {
    return tokenCache.promise;
  }

  tokenCache.key = key;
  tokenCache.promise = fetchAccessToken(config.account.credentials, http)
    .then((r) => {
      tokenCache.token = r.token;
      tokenCache.exp = Date.now() + r.expiresIn * 1000;
      tokenCache.promise = null;
      return r.token;
    })
    .catch((e) => {
      tokenCache.promise = null;
      tokenCache.key = null;
      throw e;
    });
  return tokenCache.promise;
}

// ============================================================================
// Gọi Analytics Data API
// ============================================================================
function mapGoogleError(err) {
  if (err instanceof GaError) return err;
  const status = err && err.response && err.response.status;
  const body = (err && err.response && err.response.data) || {};
  const info = body.error || {};
  const message = String(info.message || err.message || '');
  const reason = String(
    ((info.details || []).find(d => d && d.reason) || {}).reason || info.status || ''
  );
  const detail = message.slice(0, 300);

  if (!status) {
    return new GaError('network_error',
      'Không kết nối được tới Google Analytics. Kiểm tra mạng/máy chủ rồi thử lại.', detail);
  }
  if (status === 401) {
    return new GaError('invalid_credentials',
      'Service Account không được Google chấp nhận (401). Kiểm tra lại file JSON.', detail);
  }
  if (status === 403) {
    return new GaError('permission_denied',
      'Service Account chưa có quyền đọc property này. Thêm email service account làm Viewer trong GA4 → Property Access Management.',
      detail);
  }
  if (status === 404) {
    return new GaError('invalid_property', 'Không tìm thấy GA4 Property với ID đã nhập.', detail);
  }
  if (status === 400) {
    if (/property/i.test(message) || /INVALID_ARGUMENT/i.test(reason)) {
      return new GaError('invalid_property',
        'GA4 Property ID hoặc tham số báo cáo không hợp lệ.', detail);
    }
    return new GaError('api_error', 'Google Analytics từ chối yêu cầu (400).', detail);
  }
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(reason)) {
    return new GaError('quota_exceeded',
      'Đã vượt hạn mức gọi Google Analytics. Thử lại sau ít phút.', detail);
  }
  return new GaError('api_error',
    'Google Analytics trả lỗi' + (status ? ` (HTTP ${status})` : ''), detail);
}

function apiUrl(propertyId, method) {
  return `${API_BASE}/properties/${encodeURIComponent(propertyId)}:${method}`;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function callApi(url, body, token, http, label) {
  try {
    const res = await http.post(url, body, { headers: authHeaders(token), timeout: HTTP_TIMEOUT_MS });
    return (res && res.data) || {};
  } catch (e) {
    const mapped = mapGoogleError(e);
    mapped.message = `${label}: ${mapped.message}`;
    throw mapped;
  }
}

async function runReport(propertyId, body, token, http = axios) {
  return callApi(apiUrl(propertyId, 'runReport'), body, token, http, 'Báo cáo');
}

async function batchRunReports(propertyId, requests, token, http = axios) {
  return callApi(apiUrl(propertyId, 'batchRunReports'), { requests }, token, http, 'Báo cáo');
}

async function runRealtimeReport(propertyId, body, token, http = axios) {
  return callApi(apiUrl(propertyId, 'runRealtimeReport'), body, token, http, 'Realtime');
}

// ============================================================================
// Chuẩn hoá kết quả trả UI
// ============================================================================
const METRIC_KEYS = [
  'active_users', 'total_users', 'new_users', 'sessions', 'page_views', 'event_count',
  'engagement_rate', 'bounce_rate', 'avg_session_seconds', 'sessions_per_user', 'engaged_sessions'
];

const GA_METRIC_NAMES = {
  active_users: 'activeUsers',
  total_users: 'totalUsers',
  new_users: 'newUsers',
  sessions: 'sessions',
  page_views: 'screenPageViews',
  event_count: 'eventCount',
  engagement_rate: 'engagementRate',
  bounce_rate: 'bounceRate',
  avg_session_seconds: 'averageSessionDuration',
  sessions_per_user: 'sessionsPerUser',
  engaged_sessions: 'engagedSessions'
};

function emptyTotals() {
  const out = {};
  for (const k of METRIC_KEYS) out[k] = 0;
  return out;
}

function readNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeTotals(report) {
  const rows = (report && report.rows) || [];
  const allHeaders = (report && report.columnHeaders) || [];
  // `columnHeaders` gồm cả dimension (vd dateRange) đứng trước, còn
  // `row.metricValues` CHỈ chứa metric → phải lấy đúng danh sách header metric.
  const rowMetricCount = rows[0] && rows[0].metricValues ? rows[0].metricValues.length : 0;
  const metricHeaders = allHeaders.some(h => h && h.columnType)
    ? allHeaders.filter(h => h && h.columnType === 'METRIC')
    : (rowMetricCount ? allHeaders.slice(Math.max(0, allHeaders.length - rowMetricCount)) : allHeaders);
  const headers = metricHeaders.map(h => h.name);
  const pick = (row) => {
    const out = emptyTotals();
    if (!row) return out;
    for (const [key, gaName] of Object.entries(GA_METRIC_NAMES)) {
      const idx = headers.indexOf(gaName);
      if (idx >= 0) out[key] = readNum(row.metricValues && row.metricValues[idx] && row.metricValues[idx].value);
    }
    return out;
  };
  // GA trả 1 row/date range kèm dimensionValues `date_range_0|1`. Không dựa vào
  // thứ tự row (API không cam kết) — nhận diện theo giá trị dimension.
  let currentRow = null;
  let previousRow = null;
  let sawRangeDim = false;
  for (const row of rows) {
    const dim = String((row.dimensionValues && row.dimensionValues[0] && row.dimensionValues[0].value) || '');
    if (dim === 'date_range_0' || dim === 'date_range_1') {
      sawRangeDim = true;
      if (dim === 'date_range_0') currentRow = row;
      else previousRow = row;
    }
  }
  if (!sawRangeDim) {
    currentRow = rows[0] || null;
    previousRow = rows[1] || null;
  } else if (!currentRow) {
    currentRow = rows[0] || null;
  }
  return { totals: pick(currentRow), previous: previousRow ? pick(previousRow) : null };
}

function pctDelta(current, previous) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function computeDeltas(totals, previous) {
  if (!previous) return null;
  const out = {};
  for (const k of METRIC_KEYS) out[k] = pctDelta(readNum(totals[k]), readNum(previous[k]));
  return out;
}

/** Danh sách ngày (UTC) từ `days` ngày trước tới hôm qua — khớp mốc tương đối của GA. */
function dateRangeKeys(days) {
  const out = [];
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  for (let i = days; i >= 1; i--) {
    out.push(new Date(todayUtc - i * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

function gaDateToKey(v) {
  const s = String(v || '');
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return s;
}

function normalizeSeries(report, days) {
  const rows = (report && report.rows) || [];
  const map = new Map();
  for (const row of rows) {
    const raw = row.dimensionValues && row.dimensionValues[0] && row.dimensionValues[0].value;
    const key = gaDateToKey(raw);
    if (!key) continue;
    map.set(key, {
      users: readNum(row.metricValues && row.metricValues[0] && row.metricValues[0].value),
      sessions: readNum(row.metricValues && row.metricValues[1] && row.metricValues[1].value),
      page_views: readNum(row.metricValues && row.metricValues[2] && row.metricValues[2].value)
    });
  }
  return dateRangeKeys(days).map((date) => ({
    date,
    users: (map.get(date) || {}).users || 0,
    sessions: (map.get(date) || {}).sessions || 0,
    page_views: (map.get(date) || {}).page_views || 0
  }));
}

function readDim(row, idx) {
  return String((row.dimensionValues && row.dimensionValues[idx] && row.dimensionValues[idx].value) || '');
}

function readMetricAt(row, idx) {
  return readNum(row.metricValues && row.metricValues[idx] && row.metricValues[idx].value);
}

function normalizeDimensionReport(report, spec) {
  const rows = (report && report.rows) || [];
  return rows.map((row) => {
    const out = {};
    for (const [field, idx] of Object.entries(spec.dimensions)) out[field] = readDim(row, idx);
    for (const [field, idx] of Object.entries(spec.metrics)) out[field] = readMetricAt(row, idx);
    return out;
  });
}

function normalizeRealtime(report) {
  const row = ((report && report.rows) || [])[0];
  return { active_users: row ? readMetricAt(row, 0) : 0 };
}

// ============================================================================
// Report definitions + tải dashboard
// ============================================================================
const CORE_METRICS = [
  'activeUsers', 'totalUsers', 'newUsers', 'sessions', 'screenPageViews', 'eventCount',
  'engagementRate', 'bounceRate', 'averageSessionDuration', 'sessionsPerUser', 'engagedSessions'
];

function buildReportRequests(days) {
  const current = { startDate: `${days}daysAgo`, endDate: 'yesterday', name: 'current' };
  const previous = { startDate: `${days * 2}daysAgo`, endDate: `${days + 1}daysAgo`, name: 'previous' };
  const range = { startDate: current.startDate, endDate: current.endDate };
  const metrics = (names) => names.map(name => ({ name }));

  return {
    totals: {
      dateRanges: [current, previous],
      metrics: metrics(CORE_METRICS)
    },
    series: {
      dateRanges: [range],
      dimensions: [{ name: 'date' }],
      metrics: metrics(['activeUsers', 'sessions', 'screenPageViews']),
      orderBys: [{ dimension: { dimensionName: 'date' } }],
      limit: '400'
    },
    pages: {
      dateRanges: [range],
      dimensions: [{ name: 'pagePath' }],
      metrics: metrics(['screenPageViews', 'activeUsers', 'averageSessionDuration']),
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: '10'
    },
    channels: {
      dateRanges: [range],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: metrics(['sessions', 'totalUsers']),
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: '10'
    },
    devices: {
      dateRanges: [range],
      dimensions: [{ name: 'deviceCategory' }],
      metrics: metrics(['sessions', 'activeUsers']),
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: '6'
    },
    countries: {
      dateRanges: [range],
      dimensions: [{ name: 'country' }],
      metrics: metrics(['activeUsers', 'sessions']),
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: '10'
    }
  };
}

const dashboardCache = new Map();
const DASHBOARD_TTL_MS = 60000;

function clampDays(value) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return 28;
  return Math.min(Math.max(n, 1), 365);
}

function buildNotConfigured(config) {
  return {
    ok: true,
    configured: false,
    reason: !config.enabled ? 'disabled' : 'missing_credentials',
    tracking: {
      enabled: config.enabled,
      measurement_id_set: !!config.measurementId,
      measurement_id_valid: config.trackingValid
    },
    message: !config.enabled
      ? 'Google Analytics đang tắt. Bật trong Cấu hình → Google Analytics.'
      : 'Chưa đủ cấu hình để đọc số liệu GA4 (cần Property ID + Service Account JSON).'
  };
}

/**
 * Tải toàn bộ số liệu dashboard GA.
 * @param {{days?:number, refresh?:boolean, http?:object}} opts
 */
async function getDashboard(opts = {}) {
  const days = clampDays(opts.days);
  const http = opts.http || axios;
  // `config` cho phép test bơm cấu hình dựng sẵn (không đụng DB thật).
  const config = opts.config || await loadConfig(opts.refresh);
  const cacheKey = String(days);

  if (!config.enabled || !config.reportingValid) return buildNotConfigured(config);

  if (!opts.refresh && dashboardCache.has(cacheKey)) {
    const cached = dashboardCache.get(cacheKey);
    if (Date.now() - cached.at < DASHBOARD_TTL_MS) return { ...cached.value, cached: true };
  }

  const token = await getAccessToken(config, { http });
  const requests = buildReportRequests(days);

  const [batch, countriesReport, realtimeReport] = await Promise.all([
    batchRunReports(config.propertyId, [
      requests.totals, requests.series, requests.pages, requests.channels, requests.devices
    ], token, http),
    runReport(config.propertyId, requests.countries, token, http),
    runRealtimeReport(config.propertyId, { metrics: [{ name: 'activeUsers' }] }, token, http)
  ]);

  const reports = (batch && batch.reports) || [];
  const totalsNorm = normalizeTotals(reports[0]);
  const result = {
    ok: true,
    configured: true,
    range: {
      days,
      start: requests.totals.dateRanges[0].startDate,
      end: requests.totals.dateRanges[0].endDate
    },
    realtime: normalizeRealtime(realtimeReport),
    totals: totalsNorm.totals,
    previous: totalsNorm.previous,
    deltas: computeDeltas(totalsNorm.totals, totalsNorm.previous),
    series: normalizeSeries(reports[1], days),
    top_pages: normalizeDimensionReport(reports[2], {
      dimensions: { path: 0 },
      metrics: { page_views: 0, users: 1, avg_session_seconds: 2 }
    }),
    channels: normalizeDimensionReport(reports[3], {
      dimensions: { channel: 0 },
      metrics: { sessions: 0, users: 1 }
    }),
    devices: normalizeDimensionReport(reports[4], {
      dimensions: { device: 0 },
      metrics: { sessions: 0, users: 1 }
    }),
    countries: normalizeDimensionReport(countriesReport, {
      dimensions: { country: 0 },
      metrics: { users: 0, sessions: 1 }
    }),
    tracking: {
      enabled: config.enabled,
      measurement_id_set: !!config.measurementId,
      measurement_id_valid: config.trackingValid
    },
    fetched_at: new Date().toISOString(),
    cached: false
  };

  dashboardCache.set(cacheKey, { at: Date.now(), value: result });
  return result;
}

/**
 * Kiểm tra cấu hình (kể cả giá trị chưa lưu do admin nhập trong form).
 * Không ném lỗi — luôn trả {ok, tracking, reporting, error}.
 */
async function testConnection(override = {}, opts = {}) {
  const http = opts.http || axios;
  const stored = opts.config || await loadConfig(true);
  const measurementId = override.measurement_id !== undefined
    ? normalizeMeasurementId(override.measurement_id) : stored.measurementId;
  const propertyId = override.property_id !== undefined
    ? normalizePropertyId(override.property_id) : stored.propertyId;
  const rawJson = override.service_account_json !== undefined
    ? String(override.service_account_json) : (await getSetting('ga_service_account_json', ''));

  const tracking = {
    ok: isValidMeasurementId(measurementId),
    measurement_id: measurementId,
    error: isValidMeasurementId(measurementId) ? null : 'Measurement ID phải có dạng G-XXXXXXXXXX'
  };

  const parsedAccount = parseServiceAccount(rawJson);
  const reporting = {
    ok: false,
    property_id: propertyId,
    account_email: parsedAccount.ok ? parsedAccount.credentials.client_email : '',
    error: null
  };

  if (!isValidPropertyId(propertyId)) {
    reporting.error = 'Property ID phải là dãy số (vd 123456789)';
    return { ok: false, tracking, reporting, error: { code: 'invalid_property', message: reporting.error } };
  }
  if (!parsedAccount.ok) {
    const messages = {
      missing: 'Chưa có Service Account JSON',
      invalid_json: 'Service Account JSON không parse được',
      missing_client_email: 'Service Account JSON thiếu client_email',
      invalid_private_key: 'Service Account JSON thiếu private_key hợp lệ'
    };
    reporting.error = messages[parsedAccount.reason] || 'Service Account JSON không hợp lệ';
    return { ok: false, tracking, reporting, error: { code: 'invalid_credentials', message: reporting.error } };
  }

  const config = {
    enabled: true,
    propertyId,
    account: parsedAccount,
    trackingValid: tracking.ok,
    reportingValid: true
  };

  try {
    const token = await getAccessToken(config, { http, force: true });
    const sample = await runReport(propertyId, {
      dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }],
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }]
    }, token, http);
    const row = (sample.rows || [])[0];
    reporting.ok = true;
    reporting.sample = {
      active_users_7d: row ? readMetricAt(row, 0) : 0,
      sessions_7d: row ? readMetricAt(row, 1) : 0
    };
    return { ok: true, tracking, reporting, error: null };
  } catch (e) {
    const mapped = mapGoogleError(e);
    reporting.error = mapped.message;
    return {
      ok: false,
      tracking,
      reporting,
      error: { code: mapped.code, message: mapped.message, hint: mapped.hint || '' }
    };
  }
}

// ============================================================================
// Snippet tracking phía client
// ============================================================================
function buildGaJs(measurementId) {
  const id = normalizeMeasurementId(measurementId);
  if (!isValidMeasurementId(id)) return '/* Cell.id.vn — Google Analytics chưa cấu hình */\n';
  return `/* Cell.id.vn — Google Analytics 4 */\n`
    + `(function(){var id=${JSON.stringify(id)};if(!/^G-[A-Z0-9]{6,20}$/.test(id))return;`
    + `window.dataLayer=window.dataLayer||[];function gtag(){window.dataLayer.push(arguments);}`
    + `window.gtag=window.gtag||gtag;gtag('js',new Date());gtag('config',id);`
    + `var s=document.createElement('script');s.async=true;`
    + `s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(id);`
    + `document.head.appendChild(s);})();\n`;
}

async function getTrackingConfig() {
  const config = await loadConfig();
  return {
    enabled: config.enabled && config.trackingValid,
    measurement_id: config.measurementId,
    measurement_id_valid: config.trackingValid
  };
}

module.exports = {
  GaError,
  TOKEN_URL,
  API_BASE,
  MEASUREMENT_ID_RE,
  PROPERTY_ID_RE,
  SETTING_KEYS,
  DEFAULTS,
  loadConfig,
  resetCache,
  parseServiceAccount,
  describeServiceAccount,
  isValidMeasurementId,
  isValidPropertyId,
  normalizeMeasurementId,
  normalizePropertyId,
  getAccessToken,
  mapGoogleError,
  mapTokenError,
  runReport,
  batchRunReports,
  runRealtimeReport,
  buildReportRequests,
  normalizeTotals,
  normalizeSeries,
  normalizeDimensionReport,
  normalizeRealtime,
  computeDeltas,
  dateRangeKeys,
  getDashboard,
  testConnection,
  buildGaJs,
  getTrackingConfig,
  clampDays,
  _tokenCacheKey: tokenCacheKey
};
