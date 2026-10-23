/**
 * Test tra cứu IP đa nguồn — ip-lookup.js (parse/aggregate/cache/hạn mức) + wiring.
 * Chạy: node _iplookup.test.js
 *
 * DB tạm — KHÔNG đụng database.sqlite (patchDbRedirect).
 * Mạng: axios bị stub hoàn toàn, test không gọi nguồn thật.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`); }
}
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

/** Patch fs + sqlite3 để mọi thao tác DB trỏ về DB tạm. Gọi TRƯỚC require('./database'). */
function patchDbRedirect(realDbPath, tmpDb) {
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
}

// ============================================================
// Stub axios TRƯỚC khi nạp ip-lookup.js (nó gọi axios.create() lúc load).
// `handler(url, opts)` được test đổi giữa chừng; `calls` đếm số request thật.
// ============================================================
const net = { calls: [], handler: async () => ({ status: 200, data: {} }) };
function installAxiosStub() {
  const axios = require('axios');
  const fakeClient = {
    get(url, opts) { net.calls.push({ url, opts }); return net.handler(url, opts); }
  };
  axios.create = () => fakeClient;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// JSON mẫu — chép từ phản hồi THẬT của từng nguồn (đã rút gọn field không dùng).
const SAMPLES = {
  dbipFree: {
    ipAddress: '8.8.8.8', continentCode: 'NA', continentName: 'North America',
    countryCode: 'US', countryName: 'United States', stateProvCode: 'CA',
    stateProv: 'California', city: 'Mountain View'
  },
  dbipPaid: {
    ipAddress: '123.45.67.89', continentCode: 'NA', continentName: 'North America',
    countryCode: 'US', countryName: 'United States', isEuMember: false,
    currencyCode: 'USD', phonePrefix: '1', stateProv: 'California',
    district: 'Santa Clara County', city: 'Mountain View', geonameId: 5375480,
    zipCode: '94043', latitude: 37.3861, longitude: -122.084, gmtOffset: -7,
    timeZone: 'America/Los_Angeles', asNumber: 16591, asName: 'GOOGLE-FIBER',
    isp: 'Google Fiber Inc.', linkType: 'fttx', usageType: 'consumer',
    organization: 'Google Fiber Inc.', isCrawler: false, isProxy: true,
    proxyType: 'vpn', threatLevel: 'high'
  },
  ipinfoLite: {
    ip: '8.8.8.8', asn: 'AS15169', as_name: 'Google LLC', as_domain: 'google.com',
    country_code: 'US', country: 'United States', continent_code: 'NA', continent: 'North America'
  },
  ipinfoCore: {
    ip: '8.8.8.8', hostname: 'dns.google',
    geo: {
      city: 'Mountain View', region: 'California', region_code: 'CA', country: 'United States',
      country_code: 'US', continent: 'North America', continent_code: 'NA',
      latitude: 37.4056, longitude: -122.0775, timezone: 'America/Los_Angeles', postal_code: '94043'
    },
    as: { asn: 'AS15169', name: 'Google LLC', domain: 'google.com', type: 'hosting' },
    is_place: false, is_anonymous: false, is_anycast: true,
    is_hosting: true, is_mobile: false, is_satellite: false
  },
  ipwho: {
    ip: '8.8.8.8', success: true, type: 'IPv4',
    continent: 'North America', continent_code: 'NA',
    country: 'United States', country_code: 'US', region: 'California', region_code: 'CA',
    city: 'San Jose', latitude: 37.3393939, longitude: -121.8949553, is_eu: false,
    postal: '95025', calling_code: '1',
    connection: { asn: 15169, org: 'Google LLC', isp: 'Google LLC', domain: 'google.com' },
    timezone: { id: 'America/Los_Angeles', abbr: 'PDT', is_dst: true, offset: -25200, utc: '-07:00' }
  },
  ipapiIs: {
    ip: '8.8.8.8', is_bogon: false, company: 'Google LLC',
    asn: 'AS15169 Google LLC', city: 'Mountain View', region: 'California',
    country: 'United States', lat: 37.38605, lon: -122.08385,
    timezone: 'America/Los_Angeles', docs: 'https://ipapi.is/free-tier.html'
  },
  ipApiCom: {
    status: 'success', country: 'United States', countryCode: 'US', regionName: 'Virginia',
    city: 'Ashburn', zip: '20149', lat: 39.03, lon: -77.5, timezone: 'America/New_York',
    isp: 'Google LLC', org: 'Google Public DNS', as: 'AS15169 Google LLC',
    mobile: false, proxy: true, hosting: true, query: '8.8.8.8'
  },
  freeipapi: {
    ipVersion: 4, ipAddress: '8.8.8.8', latitude: 37.422, longitude: -122.085,
    countryName: 'United States', countryCode: 'US', capital: 'Washington D.C.',
    phoneCodes: [1], timeZones: ['America/Los_Angeles'], zipCode: '94043',
    cityName: 'Mountain View', regionName: 'California', regionCode: 'CA',
    continent: 'North America', continentCode: 'NA', currencies: ['USD'], languages: ['en'],
    asn: '15169', asnOrganization: 'Google LLC', isProxy: false
  },
  iplocation: {
    ip: '8.8.8.8', ip_number: '134744072', ip_version: 4,
    country_name: 'United States of America', country_code2: 'US',
    isp: 'Google LLC', response_code: '200', response_message: 'OK'
  }
};

async function main() {
  const ROOT = __dirname;
  const realDb = path.join(path.dirname(ROOT), 'database.sqlite');
  const tmpDb = path.join(os.tmpdir(), 'iplookup-test-' + process.pid + '-' + Date.now() + '.sqlite');
  patchDbRedirect(realDb, tmpDb);
  installAxiosStub();

  let il;
  try {
    require('./database');
    il = require('./ip-lookup');
  } catch (e) { console.error('Không nạp được database/ip-lookup:', e.stack || e.message); process.exit(1); }
  await sleep(700); // chờ database.js tạo schema + seed

  const db = require('./database');
  const sqlAll = (sql, p = []) => new Promise((res, rej) => db.all(sql, p, (e, r) => e ? rej(e) : res(r || [])));
  const sqlRun = (sql, p = []) => new Promise((res, rej) => db.run(sql, p, function (e) { e ? rej(e) : res(this); }));
  const sqlGet = (sql, p = []) => new Promise((res, rej) => db.get(sql, p, (e, r) => e ? rej(e) : res(r || null)));
  const setSetting = (k, v) => sqlRun(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [k, String(v)]);

  // ============================================================
  console.log('\n== Schema + seed ==');
  // ============================================================
  for (const t of ['ip_lookup_sources', 'ip_lookup_cache', 'ip_lookup_logs', 'ip_guest_trials']) {
    const cols = await sqlAll(`PRAGMA table_info(${t})`);
    ok(`bảng ${t} tồn tại`, cols.length > 0);
  }
  const srcCols = (await sqlAll('PRAGMA table_info(ip_lookup_sources)')).map(c => c.name);
  for (const c of ['type', 'name', 'base_url', 'api_key', 'plan', 'enabled', 'priority', 'timeout_ms', 'cache_days', 'notes']) {
    ok(`ip_lookup_sources có cột ${c}`, srcCols.includes(c));
  }
  const seeded = await sqlAll('SELECT type, priority, enabled FROM ip_lookup_sources ORDER BY priority');
  ok('seed đủ 8 loại nguồn', seeded.length === 8, seeded.map(s => s.type));
  ok('seed đúng thứ tự ưu tiên', seeded[0] && seeded[0].type === 'dbip', seeded.slice(0, 3).map(s => s.type));
  ok('ipinfo mặc định TẮT (cần key)', Number(seeded.find(s => s.type === 'ipinfo').enabled) === 0);
  ok('dbip mặc định BẬT (free)', Number(seeded.find(s => s.type === 'dbip').enabled) === 1);
  ok('dbip_free mặc định TẮT', Number(seeded.find(s => s.type === 'dbip_free').enabled) === 0);
  const idx = (await sqlAll("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='ip_lookup_cache'")).map(i => i.name);
  ok('cache có index theo IP', idx.includes('idx_ip_lookup_cache_norm'), idx);
  const uniqueCache = await sqlAll('PRAGMA index_list(ip_lookup_cache)');
  ok('cache UNIQUE (normalized, source_type)', uniqueCache.some(i => i.unique === 1), uniqueCache);
  const settings = await sqlAll("SELECT key FROM settings WHERE key LIKE 'ip_lookup%'");
  ok('seed settings ip_lookup_*', settings.length >= 7, settings.map(s => s.key));

  // ============================================================
  console.log('\n== normalizeIp ==');
  // ============================================================
  const n1 = il.normalizeIp('8.8.8.8');
  ok('IPv4 hợp lệ', n1.ok && n1.ip === '8.8.8.8' && n1.version === 4, n1);
  ok('trim khoảng trắng', il.normalizeIp('  1.1.1.1 ').ip === '1.1.1.1');
  const n6 = il.normalizeIp('2001:DB8::1');
  ok('IPv6 lowercase', n6.ok && n6.ip === '2001:db8::1' && n6.version === 6, n6);
  ok('IPv6 bọc [] được bỏ ngoặc', il.normalizeIp('[::1]').ip === '::1');
  const mapped = il.normalizeIp('::ffff:127.0.0.1');
  ok('IPv4-mapped → IPv4 thuần', mapped.ok && mapped.ip === '127.0.0.1' && mapped.version === 4, mapped);
  ok('từ chối tên miền', il.normalizeIp('example.com').ok === false);
  ok('từ chối CIDR', il.normalizeIp('8.8.8.0/24').ok === false);
  ok('từ chối IP sai', il.normalizeIp('999.1.1.1').ok === false);
  ok('từ chối rỗng', il.normalizeIp('').ok === false);
  ok('từ chối kèm port', il.normalizeIp('8.8.8.8:53').ok === false);

  // ============================================================
  console.log('\n== parse() từng nguồn ==');
  // ============================================================
  const D = il.SOURCE_DEFAULTS;

  const dbipFree = D.dbip.parse(SAMPLES.dbipFree);
  ok('DB-IP free: quốc gia + thành phố', dbipFree.country === 'United States' && dbipFree.city === 'Mountain View', dbipFree);
  const dbipPaid = D.dbip.parse(SAMPLES.dbipPaid);
  ok('DB-IP paid: toạ độ + ASN + proxy', dbipPaid.lat === 37.3861 && dbipPaid.asn === 'AS16591' && dbipPaid.isProxy === true, dbipPaid);
  ok('DB-IP paid: usageType/linkType', dbipPaid.usageType === 'consumer' && dbipPaid.linkType === 'fttx');
  let dbipErr = null;
  try { D.dbip.parse({ errorCode: 'OVER_QUERY_LIMIT', error: 'exceeded' }); } catch (e) { dbipErr = e.message; }
  ok('DB-IP lỗi OVER_QUERY_LIMIT → message tiếng Việt + mã', /hết hạn mức/.test(dbipErr || '') && /OVER_QUERY_LIMIT/.test(dbipErr || ''), dbipErr);
  let dbipHttps = null;
  try { D.dbip.parse({ errorCode: 'HTTPS_NOT_ALLOWED' }); } catch (e) { dbipHttps = e.message; }
  ok('DB-IP HTTPS_NOT_ALLOWED → gợi ý đổi http', /http:\/\//.test(dbipHttps || ''), dbipHttps);

  const infoLite = D.ipinfo.parse(SAMPLES.ipinfoLite, { plan: 'lite' });
  ok('IPinfo lite: country + ASN + domain', infoLite.country === 'United States' && infoLite.asn === 'AS15169' && infoLite.domain === 'google.com', infoLite);
  const infoCore = D.ipinfo.parse(SAMPLES.ipinfoCore, { plan: 'core' });
  ok('IPinfo core: city + toạ độ + flags', infoCore.city === 'Mountain View' && infoCore.lat === 37.4056 && infoCore.isHosting === true, infoCore);
  ok('IPinfo core: usageType từ as.type', infoCore.usageType === 'hosting');
  let infoErr = null;
  try { D.ipinfo.parse({ error: { title: 'Forbidden', message: 'wrong token' } }, { plan: 'lite' }); } catch (e) { infoErr = e.message; }
  ok('IPinfo lỗi → ném message của nguồn', infoErr === 'wrong token', infoErr);

  const who = D.ipwho_is.parse(SAMPLES.ipwho);
  ok('ipwho.is: city/toạ độ/ASN', who.city === 'San Jose' && who.asn === 'AS15169' && who.lat === 37.3393939, who);
  ok('ipwho.is: gmtOffset quy từ giây', who.gmtOffset === -7, who.gmtOffset);
  let whoFalse = null;
  try { D.ipwho_is.parse({ success: false, message: 'invalid IP' }); } catch (e) { whoFalse = e.message; }
  ok('ipwho.is success:false → lỗi', whoFalse === 'invalid IP', whoFalse);

  const ipapi = D.ipapi_is.parse(SAMPLES.ipapiIs);
  ok('ipapi.is: tách ASN + tên', ipapi.asn === 'AS15169' && ipapi.asnName === 'Google LLC', ipapi);

  const ipcom = D.ip_api_com.parse(SAMPLES.ipApiCom);
  ok('ip-api.com: ASN/flags', ipcom.asn === 'AS15169' && ipcom.isProxy === true && ipcom.isHosting === true, ipcom);
  let ipcomErr = null;
  try { D.ip_api_com.parse({ status: 'fail', message: 'private range' }); } catch (e) { ipcomErr = e.message; }
  ok('ip-api.com status:fail → lỗi', ipcomErr === 'private range');

  const fip = D.freeipapi.parse(SAMPLES.freeipapi);
  ok('freeipapi: city + ASN + timezone đầu', fip.city === 'Mountain View' && fip.asn === 'AS15169' && fip.timezone === 'America/Los_Angeles', fip);
  let fipErr = null;
  try { D.freeipapi.parse({ ipVersion: null, ipAddress: null }); } catch (e) { fipErr = e.message; }
  ok('freeipapi null → coi là lỗi', !!fipErr, fipErr);

  const ipl = D.iplocation_net.parse(SAMPLES.iplocation);
  ok('iplocation.net: country + ISP', ipl.country === 'United States of America' && ipl.isp === 'Google LLC', ipl);
  let iplErr = null;
  try { D.iplocation_net.parse({ response_code: '400', response_message: 'Error: Invalid IP Address' }); } catch (e) { iplErr = e.message; }
  ok('iplocation.net response_code 400 → lỗi', /Invalid IP/.test(iplErr || ''), iplErr);

  // buildUrl — kiểm tra ghép URL và vị trí key/token.
  ok('DB-IP không key → /free/<ip>', D.dbip.buildUrl({ base_url: '' }, '8.8.8.8') === 'http://api.db-ip.com/v2/free/8.8.8.8');
  ok('DB-IP có key → /<key>/<ip>', D.dbip.buildUrl({ base_url: '', api_key: 'abc' }, '1.1.1.1') === 'http://api.db-ip.com/v2/abc/1.1.1.1');
  ok('IPinfo lite → /lite/<ip>?token=', D.ipinfo.buildUrl({ base_url: '', api_key: 'tok', plan: 'lite' }, '8.8.8.8').includes('/lite/8.8.8.8?token=tok'));
  ok('IPinfo core → /lookup/<ip>?token=', D.ipinfo.buildUrl({ base_url: '', api_key: 'tok', plan: 'core' }, '8.8.8.8').includes('/lookup/8.8.8.8?token=tok'));
  ok('ip-api.com gửi danh sách fields', D.ip_api_com.buildUrl({ base_url: '' }, '8.8.8.8').includes('fields='));
  ok('base_url có "/" cuối không tạo "//"', D.ipwho_is.buildUrl({ base_url: 'https://ipwho.is/' }, '8.8.8.8') === 'https://ipwho.is/8.8.8.8');

  // ============================================================
  console.log('\n== IP nội bộ (cho nút "IP của tôi") ==');
  // ============================================================
  for (const [ip, want, label] of [
    ['10.1.2.3', true, 'RFC1918 10/8'],
    ['172.16.0.1', true, 'RFC1918 172.16/12'],
    ['172.31.255.255', true, 'RFC1918 biên trên'],
    ['172.32.0.1', false, 'ngoài 172.16/12'],
    ['192.168.1.10', true, '192.168/16'],
    ['127.0.0.1', true, 'loopback'],
    ['100.64.0.1', true, 'CGNAT 100.64/10'],
    ['169.254.5.5', true, 'link-local IPv4'],
    ['0.0.0.0', true, '0/8'],
    ['8.8.8.8', false, 'IP công khai IPv4'],
    ['113.163.26.78', false, 'IP công khai VN'],
    ['::1', true, 'loopback IPv6'],
    ['fd00::1', true, 'ULA IPv6'],
    ['fe80::1', true, 'link-local IPv6'],
    ['2001:db8::1', true, 'tài liệu 2001:db8::/32'],
    ['2001:4860:4860::8888', false, 'IP công khai IPv6'],
    ['::ffff:192.168.0.1', true, 'IPv4-mapped LAN'],
    ['khong-phai-ip', false, 'chuỗi không hợp lệ → không kết luận']
  ]) {
    ok(`isPrivateIp(${ip}) = ${want} (${label})`, il.isPrivateIp(ip) === want, il.isPrivateIp(ip));
  }

  // ============================================================
  console.log('\n== aggregate() bỏ phiếu ==');
  // ============================================================
  const agg = il.aggregate([
    { source: 'a', ok: true, data: { country: 'United States', countryCode: 'US', asn: 'AS15169', lat: 10, lon: 20 } },
    { source: 'b', ok: true, data: { country: 'United States', asn: 'AS15169', lat: 12, lon: 22 } },
    { source: 'c', ok: true, data: { country: 'Canada', asn: 'AS15169', lat: 11, lon: 21, isProxy: true } },
    { source: 'd', ok: false, error: 'boom', data: null }
  ]);
  ok('đếm số nguồn trả lời', agg.sources_total === 4 && agg.sources_ok === 3, [agg.sources_total, agg.sources_ok]);
  ok('chọn country đa số', agg.fields.country.value === 'United States' && agg.fields.country.count === 2, agg.fields.country);
  ok('giữ phương án khác trong alternatives', agg.fields.country.alternatives.some(a => a.value === 'Canada'), agg.fields.country.alternatives);
  ok('ASN đồng thuận 3/3', agg.fields.asn.count === 3, agg.fields.asn);
  ok('toạ độ lấy trung vị', agg.lat === 11 && agg.lon === 21, [agg.lat, agg.lon]);
  ok('cờ proxy hợp nhất (bất kỳ nguồn nào true)', agg.flags.isProxy && agg.flags.isProxy.value === true, agg.flags);
  ok('agreement tính theo country+asn', agg.agreement > 0 && agg.agreement <= 1, agg.agreement);
  const aggEmpty = il.aggregate([{ source: 'x', ok: false, error: 'no', data: null }]);
  ok('không nguồn nào OK → agreement 0, không có fields', aggEmpty.sources_ok === 0 && aggEmpty.agreement === 0 && !aggEmpty.fields.country, aggEmpty);

  // ============================================================
  console.log('\n== quotaWindowStart ==');
  // ============================================================
  const win = il.quotaWindowStart(2);
  ok('mốc hạn mức ≤ hiện tại', win.ms <= Date.now());
  ok('mốc hạn mức trong 24h gần nhất (cộng cutoff)', Date.now() - win.ms < 26 * 3600000, Math.round((Date.now() - win.ms) / 3600000));
  ok('định dạng SQL UTC', /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(win.sql), win.sql);
  const win0 = il.quotaWindowStart(0);
  ok('cutoff 0 vẫn trả mốc hợp lệ', win0.ms <= Date.now());

  // ============================================================
  console.log('\n== runLookup + cache (axios stub) ==');
  // ============================================================
  // Chỉ bật ipwho.is để kết quả tất định.
  await sqlRun('UPDATE ip_lookup_sources SET enabled = 0');
  await sqlRun("UPDATE ip_lookup_sources SET enabled = 1, cache_days = 7 WHERE type = 'ipwho_is'");

  net.calls = [];
  net.handler = async (url) => {
    if (url.includes('ipwho.is')) return { status: 200, data: SAMPLES.ipwho };
    return { status: 404, data: { error: 'unexpected ' + url } };
  };

  const r1 = await il.runLookup({ ip: '8.8.8.8' });
  ok('runLookup OK', r1.ok && r1.results.length === 1, r1.error);
  ok('nguồn trả dữ liệu', r1.results[0].ok && r1.results[0].data.city === 'San Jose');
  ok('lần 1 KHÔNG dùng cache', r1.results[0].cached === false && r1.cacheHits === 0, r1.cacheHits);
  ok('lần 1 có gọi mạng', net.calls.length === 1, net.calls.length);
  ok('aggregate dùng dữ liệu nguồn', r1.aggregate.fields.country.value === 'United States', r1.aggregate.fields.country);

  const r2 = await il.runLookup({ ip: '8.8.8.8' });
  ok('lần 2 lấy từ cache', r2.results[0].cached === true && r2.cacheHits === 1, r2.cacheHits);
  ok('lần 2 KHÔNG gọi mạng lại', net.calls.length === 1, net.calls.length);
  const r3 = await il.runLookup({ ip: '8.8.8.8', skipCache: true });
  ok('skipCache buộc gọi mạng', net.calls.length === 2 && r3.results[0].cached === false, net.calls.length);

  // Cache tách theo IP
  await il.runLookup({ ip: '1.1.1.1' });
  ok('IP khác là khoá cache khác', net.calls.length === 3, net.calls.length);

  // Nguồn thiếu key → lỗi rõ ràng, không gọi mạng
  await sqlRun("UPDATE ip_lookup_sources SET enabled = 1, api_key = '' WHERE type = 'ipinfo'");
  net.calls = [];
  const rKey = await il.runLookup({ ip: '8.8.8.8', skipCache: true });
  const ipinfoRes = rKey.results.find(x => x.source === 'ipinfo');
  ok('nguồn thiếu key → ok:false', ipinfoRes && ipinfoRes.ok === false, ipinfoRes);
  ok('nguồn thiếu key báo đúng lý do', /API key/.test((ipinfoRes && ipinfoRes.error) || ''), ipinfoRes && ipinfoRes.error);
  ok('nguồn thiếu key KHÔNG gọi mạng', !net.calls.some(c => /ipinfo/.test(c.url)), net.calls.map(c => c.url));
  ok('nguồn khác vẫn OK dù 1 nguồn lỗi', rKey.results.some(x => x.ok), rKey.results.map(x => x.source + ':' + x.ok));

  // 1 nguồn ném lỗi mạng không làm gãy cả lô
  await sqlRun("UPDATE ip_lookup_sources SET enabled = 1 WHERE type = 'ip_api_com'");
  net.handler = async (url) => {
    if (url.includes('ip-api.com')) throw new Error('ECONNREFUSED');
    if (url.includes('ipwho.is')) return { status: 200, data: SAMPLES.ipwho };
    return { status: 404, data: {} };
  };
  const rThrow = await il.runLookup({ ip: '8.8.8.8', skipCache: true, types: ['ipwho_is', 'ip_api_com'] });
  ok('nguồn lỗi mạng được gói vào ok:false', rThrow.ok === true && rThrow.results.find(x => x.source === 'ip_api_com').ok === false);
  ok('lỗi mạng có message đọc được', /ECONNREFUSED/.test(rThrow.results.find(x => x.source === 'ip_api_com').error || ''));
  ok('nguồn còn lại vẫn trả dữ liệu', rThrow.results.find(x => x.source === 'ipwho_is').ok === true);

  // publicOnly: chỉ nguồn không cần key
  await sqlRun("UPDATE ip_lookup_sources SET enabled = 1, api_key = 'k' WHERE type = 'ipinfo'");
  const rPub = await il.runLookup({ ip: '8.8.8.8', publicOnly: true, skipCache: true });
  ok('publicOnly loại nguồn cần key', !rPub.results.some(x => x.source === 'ipinfo'), rPub.results.map(x => x.source));
  ok('publicOnly vẫn có nguồn free', rPub.results.length > 0);

  // dbip_free bị bỏ khi dbip đã có key
  await sqlRun("UPDATE ip_lookup_sources SET enabled = 1, api_key = 'k' WHERE type = 'dbip'");
  await sqlRun("UPDATE ip_lookup_sources SET enabled = 1 WHERE type = 'dbip_free'");
  const rDup = await il.runLookup({ ip: '8.8.8.8', skipCache: true, types: ['dbip', 'dbip_free'] });
  ok('có key DB-IP → bỏ dbip_free', rDup.results.length === 1 && rDup.results[0].source === 'dbip', rDup.results.map(x => x.source));

  // IP sai
  const rBad = await il.runLookup({ ip: 'not-an-ip' });
  ok('runLookup IP sai → ok:false', rBad.ok === false && /không hợp lệ/.test(rBad.error || ''), rBad);

  // Không bật nguồn nào
  await sqlRun('UPDATE ip_lookup_sources SET enabled = 0');
  const rNone = await il.runLookup({ ip: '8.8.8.8' });
  ok('không nguồn nào bật → lỗi rõ ràng', rNone.ok === false && /Không có nguồn/.test(rNone.error || ''), rNone.error);

  // ============================================================
  console.log('\n== Hạn mức + nhật ký ==');
  // ============================================================
  const g1 = await il.guestQuota('203.0.113.9', { limit: 1, cutoffHour: 2, consume: true });
  const g2 = await il.guestQuota('203.0.113.9', { limit: 1, cutoffHour: 2, consume: true });
  ok('khách: lượt đầu được phép', g1.allowed === true && g1.remaining === 0, g1);
  ok('khách: lượt thứ hai bị chặn', g2.allowed === false, g2);
  const gOther = await il.guestQuota('203.0.113.10', { limit: 1, cutoffHour: 2 });
  ok('khách: IP khác vẫn còn lượt', gOther.allowed === true, gOther);
  const gUnlimited = await il.guestQuota('203.0.113.11', { limit: 0, cutoffHour: 2, consume: true });
  ok('limit 0 = không giới hạn', gUnlimited.allowed === true && gUnlimited.remaining === 0);

  await sqlRun("INSERT INTO users (username, password, role, status, email_verified) VALUES ('ipxuser','x','user','active',1)");
  const u = await sqlGet('SELECT id FROM users WHERE username = ?', ['ipxuser']);
  await il.logLookup({ userId: u.id, ip: '8.8.8.8', normalized: '8.8.8.8', sourceTypes: ['dbip', 'ipwho_is'], status: 200, durationMs: 42, cacheHits: 1, ipAddress: '127.0.0.1' });
  await il.logLookup({ userId: u.id, ip: '1.1.1.1', normalized: '1.1.1.1', sourceTypes: ['dbip'], status: 500, durationMs: 5, cacheHits: 0, error: 'boom' });
  ok('countUserLookups đếm đúng user', (await il.countUserLookups(u.id, 2)) === 2);
  ok('countUserLookups user khác = 0', (await il.countUserLookups(u.id + 999, 2)) === 0);

  const st = await il.stats();
  ok('stats: tổng lượt', st.total.requests >= 2, st.total);
  ok('stats: đếm lỗi', st.total.errors >= 1, st.total.errors);
  ok('stats: đếm cache hit', st.total.cache_hits >= 1);
  ok('stats: top IP có 8.8.8.8', st.topIps.some(x => x.ip === '8.8.8.8'), st.topIps);
  ok('stats: thống kê theo nguồn', st.sources.some(s => s.type === 'dbip'), st.sources);

  const logs = await il.listLogs({ ip: '8.8.8.8', limit: 10 });
  ok('listLogs lọc theo IP', logs.length === 1 && logs[0].username === 'ipxuser', logs.map(l => l.normalized));
  const logsSrc = await il.listLogs({ source: 'ipwho_is', limit: 10 });
  ok('listLogs lọc theo nguồn', logsSrc.length === 1 && /ipwho_is/.test(logsSrc[0].source_types), logsSrc.length);

  // ============================================================
  console.log('\n== Quản trị nguồn ==');
  // ============================================================
  const adminList = await il.listSourcesForAdmin();
  ok('listSourcesForAdmin không trả key thô', adminList.every(s => !('api_key' in s)), Object.keys(adminList[0] || {}));
  const dbipRow = adminList.find(s => s.type === 'dbip');
  await il.updateSource(dbipRow.id, { api_key: 'super-secret-key' });
  const afterKey = (await il.listSourcesForAdmin()).find(s => s.type === 'dbip');
  ok('cập nhật key → chỉ trả bản che', afterKey.api_key_set === true && afterKey.api_key_masked === '••••-key', afterKey.api_key_masked);
  await il.updateSource(dbipRow.id, { api_key: afterKey.api_key_masked });
  const kept = await sqlGet('SELECT api_key FROM ip_lookup_sources WHERE id = ?', [dbipRow.id]);
  ok('gửi lại bản che = giữ nguyên key', kept.api_key === 'super-secret-key', kept.api_key);
  const badUrl = await il.updateSource(dbipRow.id, { base_url: 'ftp://x' });
  ok('từ chối base_url không http(s)', badUrl.ok === false, badUrl);
  const badPlan = await il.updateSource(dbipRow.id, { plan: 'weird' });
  ok('từ chối plan lạ', badPlan.ok === false, badPlan);
  const clamped = await il.updateSource(dbipRow.id, { timeout_ms: 999999 });
  ok('timeout bị chặn trần', clamped.ok && clamped.source.timeout_ms === 60000, clamped.source && clamped.source.timeout_ms);
  const addDup = await il.addSource('dbip');
  ok('không thêm trùng loại', addDup.ok === false && /đã có/.test(addDup.error), addDup);
  const addBad = await il.addSource('nope');
  ok('không thêm loại lạ', addBad.ok === false, addBad);
  const addOk = await il.addSource('iplocation_net');
  ok('thêm nguồn có trong danh mục', addOk.ok === true || /đã có/.test(addOk.error || ''), addOk.error);
  if (addOk.ok) {
    const del = await il.deleteSource(addOk.source.id);
    ok('xoá nguồn', del.ok === true);
  }
  const reorder = await il.reorderSources([dbipRow.id]);
  ok('reorder trả ok', reorder.ok === true);
  ok('reorder đặt priority 10', (await sqlGet('SELECT priority FROM ip_lookup_sources WHERE id = ?', [dbipRow.id])).priority === 10);
  const badReorder = await il.reorderSources('nope');
  ok('reorder từ chối input sai', badReorder.ok === false);

  // testSource dùng đúng nguồn + bỏ cache
  net.handler = async (url) => {
    if (url.includes('ipwho.is')) return { status: 200, data: SAMPLES.ipwho };
    return { status: 500, data: {} };
  };
  const t = await il.testSource('ipwho_is', { ip: '8.8.8.8' });
  ok('testSource trả dữ liệu', t.ok === true && t.data.country === 'United States', t);
  const tBad = await il.testSource('khong_co');
  ok('testSource loại lạ → lỗi', tBad.ok === false);
  const tIp = await il.testSource('ipwho_is', { ip: 'sai' });
  ok('testSource IP sai → lỗi', tIp.ok === false);

  // lookupSelf (IP máy chủ)
  net.handler = async (url) => {
    if (url === 'https://ipwho.is/') return { status: 200, data: SAMPLES.ipwho };
    return { status: 404, data: {} };
  };
  const selfRes = await il.lookupSelf();
  ok('lookupSelf trả IP máy chủ', selfRes.ok === true && selfRes.ip === '8.8.8.8', selfRes);

  // ============================================================
  console.log('\n== Cấu hình + retention ==');
  // ============================================================
  await setSetting('ip_lookup_public_enabled', '0');
  await setSetting('ip_lookup_guest_daily_placeholder_check', '1'); // không ảnh hưởng
  const cfg = await il.getConfig();
  ok('getConfig đọc được setting', cfg.public_enabled === false, cfg);
  ok('getConfig trả console_per_day', typeof cfg.console_per_day === 'number', cfg.console_per_day);
  await setSetting('ip_lookup_public_enabled', '1');
  ok('config public bật lại', (await il.getConfig()).public_enabled === true);

  // prune: chèn cache/log cũ rồi dọn
  await sqlRun("INSERT INTO ip_lookup_cache (ip, normalized, source_type, data_json, ok, fetched_at) VALUES ('9.9.9.9','9.9.9.9','dbip','{}',1, datetime('now','-90 days'))");
  const prunedCache = await il.pruneCache(30);
  ok('pruneCache xoá dòng cũ', prunedCache >= 1, prunedCache);
  await sqlRun("INSERT INTO ip_lookup_logs (user_id, ip, normalized, status, created_at) VALUES (NULL,'9.9.9.9','9.9.9.9',200, datetime('now','-90 days'))");
  const prunedLogs = await il.pruneLogs(30);
  ok('pruneLogs xoá dòng cũ', prunedLogs >= 1, prunedLogs);

  // ============================================================
  console.log('\n== Wiring ==');
  // ============================================================
  const server = read('server.js');
  ok('server nạp ip-lookup', /const ipLookup = require\('\.\/ip-lookup'\)/.test(server));
  ok('route config công khai', /app\.get\('\/api\/tools\/ip-lookup\/config',/.test(server));
  ok('route guest công khai (không requireAuth)', /app\.get\('\/api\/tools\/ip-lookup\/guest',\s*ipLookupRateLimit/.test(server));
  ok('route user yêu cầu đăng nhập', /app\.get\('\/api\/tools\/ip-lookup',\s*requireAuth/.test(server));
  ok('route IP của tôi yêu cầu đăng nhập', /app\.get\('\/api\/tools\/ip-lookup\/me',\s*requireAuth/.test(server));
  const iSources = server.indexOf("'/api/admin/ip-lookup/sources'");
  const iReorder = server.indexOf("'/api/admin/ip-lookup/sources/reorder'");
  const iById = server.indexOf("'/api/admin/ip-lookup/sources/:id'");
  ok('admin: reorder khai báo TRƯỚC /:id', iSources > 0 && iReorder > iSources && iById > iReorder, [iSources, iReorder, iById]);
  ok('admin: route test nguồn', /app\.post\('\/api\/admin\/ip-lookup\/sources\/:id\/test',\s*requireAuth,\s*requireAdmin/.test(server));
  ok('admin: route stats + logs + run', /\/api\/admin\/ip-lookup\/stats/.test(server) && /\/api\/admin\/ip-lookup\/logs/.test(server) && /\/api\/admin\/ip-lookup\/run/.test(server));
  ok('admin routes đều qua requireAdmin', (server.match(/app\.(get|post|put|delete)\('\/api\/admin\/ip-lookup[^']*',\s*requireAuth,\s*requireAdmin/g) || []).length >= 8);
  ok('settings ip_lookup_* được khai báo', /'ip_lookup_public_enabled'/.test(server) && /ip_lookup_log_retention_days/.test(server));
  ok('ip_lookup_public_enabled là BOOL setting', /BOOL_SETTING_KEYS = new Set\(\[[^\]]*ip_lookup_public_enabled/s.test(server));
  ok('cron retention được đăng ký', /initIpLookupRetention\(\)/.test(server) && /40 3 \* \* \*/.test(server));

  // JSON 404 cho /api: Express mặc định trả HTML "<!DOCTYPE html>" → client gọi
  // res.json() chết với "Unexpected token '<'". Middleware phải nằm SAU route /api.
  ok('server có middleware JSON 404 cho /api', /app\.use\('\/api',\s*\(req, res\)/.test(server));
  ok('JSON 404 đặt SAU route ip-lookup (không che route thật)', (() => {
    const iRoute = server.indexOf("'/api/tools/ip-lookup'");
    const iFallback = server.indexOf("app.use('/api'");
    return iRoute > 0 && iFallback > iRoute;
  })());
  ok('JSON 404 trả code API_NOT_FOUND + hint restart', /API_NOT_FOUND/.test(server) && /khởi động lại máy chủ/.test(server));

  const adminJsRaw = read('public/admin.js');
  ok('admin.js có readJsonHttp (chống parse HTML)', /async function readJsonHttp\(res, url\)/.test(adminJsRaw));
  ok('admin.js báo lỗi HTML 404 kèm gợi ý restart', /chưa được khởi động lại/.test(adminJsRaw));
  ok('admin.js không còn res.json() trực tiếp trong phần Tra cứu IP', (() => {
    const seg = adminJsRaw.slice(adminJsRaw.indexOf('// TRA CỨU IP'));
    // Đúng 2 lần: 1 trong chú thích giải thích lỗi, 1 trong thân readJsonHttp.
    // Mọi lời gọi API thật đều phải đi qua helper.
    const hits = (seg.match(/res\.json\(\)/g) || []).length;
    return hits === 2;
  })());

  const toolRaw = read(path.join('public', 'tools', 'ip-lookup.html'));
  ok('trang công cụ có readJson (chống parse HTML)', /async function readJson\(res, url\)/.test(toolRaw));
  ok('trang công cụ báo lỗi HTML kèm gợi ý restart', /chưa được khởi động lại/.test(toolRaw));
  ok('trang công cụ dùng readJson cho mọi lời gọi API', (() => {
    const body = toolRaw.slice(toolRaw.indexOf('(function () {'), toolRaw.indexOf('// ---------------- Khởi động'));
    const rawJson = (body.match(/await res\.json\(\)/g) || []).length;
    return rawJson === 0 && /readJson\(res,/.test(body);
  })());

  // Nút "IP của tôi" phải lấy IP WAN cho CẢ IPv4 và IPv6.
  ok('server /me trả cờ private + wan_ip', /private:\s*priv/.test(server) && /wan_ip:/.test(server));
  ok('server /me dùng isPrivateIp', /ipLookup\.isPrivateIp\(/.test(server));
  ok('trang công cụ có detectWan cho 2 họ', /async function detectWan\(family\)/.test(toolRaw));
  ok('có endpoint IPv4 chuyên biệt', /https:\/\/ipv4\.(ident\.me|icanhazip\.com)/.test(toolRaw) || /api-ipv4\.ip\.sb/.test(toolRaw));
  ok('có endpoint IPv6 chuyên biệt', /https:\/\/ipv6\.(ident\.me|icanhazip\.com)/.test(toolRaw) || /api-ipv6\.ip\.sb/.test(toolRaw));
  ok('endpoint dò IP đều hỗ trợ CORS (không dùng ipify thiếu ACAO)', !/fetchWithTimeout\('https:\/\/api\.ipify\.org/.test(toolRaw));
  ok('dò IP có timeout (AbortController)', /AbortController/.test(toolRaw) && /SELF_TIMEOUT_MS/.test(toolRaw));
  ok('hiển thị riêng từng họ IPv4/IPv6', /familyText\(f\)/.test(toolRaw) && /myIpList/.test(toolRaw));
  ok('bấm chip IP đã dò để tra ngay', /window\.useDetectedIp = function/.test(toolRaw));
  ok('nút IP của tôi KHÔNG bắt đăng nhập (khách vẫn dùng được)', !/Đăng nhập để xem IP hiện tại/.test(toolRaw));
  ok('có dự phòng IP server thấy khi dịch vụ ngoài bị chặn', /seen\.wan_ip/.test(toolRaw));

  // ============================================================
  console.log('\n== Kết quả từng nguồn: dòng mở rộng (collapse) ==');
  // ============================================================
  // Chạy THẬT các hàm dựng HTML của trang (không cần DOM): tách hàm thuần khỏi
  // <script> rồi gọi với dữ liệu mẫu. Nhờ vậy kiểm được cả nội dung lẫn escape.
  function extractJsFunction(code, name) {
    const start = code.indexOf('function ' + name + '(');
    if (start < 0) throw new Error('không thấy hàm ' + name);
    let i = code.indexOf('{', start);
    let depth = 0;
    for (; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') { depth--; if (depth === 0) return code.slice(start, i + 1); }
    }
    throw new Error('hàm ' + name + ' không cân dấu ngoặc');
  }
  function extractJsVar(code, name) {
    const start = code.indexOf('var ' + name + ' =');
    if (start < 0) throw new Error('không thấy biến ' + name);
    const end = code.indexOf('];', start);
    return code.slice(start, end + 2);
  }
  const escFn = (v) => v == null ? '' : String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  let builders = null;
  try {
    const parts = [
      extractJsVar(toolRaw, 'DETAIL_FIELDS'),
      extractJsFunction(toolRaw, 'detailValue'),
      extractJsFunction(toolRaw, 'srcRowHtml'),
      extractJsFunction(toolRaw, 'srcDetailHtml')
    ].join('\n');
    builders = new Function('esc', parts + '; return { detailValue, srcRowHtml, srcDetailHtml };')(escFn);
  } catch (e) {
    ok('tách được hàm dựng HTML của trang công cụ', false, e.message);
  }
  if (builders) {
    const okRes = {
      source: 'dbip', label: 'DB-IP', ok: true, cached: false, ms: 812,
      data: {
        country: 'United States', countryCode: 'US', continent: 'North America', city: 'Mountain View',
        lat: 37.3861, lon: -122.084, timezone: 'America/Los_Angeles', gmtOffset: -7,
        asn: 'AS16591', asnName: 'GOOGLE-FIBER', isp: 'Google Fiber Inc.',
        isProxy: false, isHosting: true, threatLevel: 'low',
        evil: '<img src=x onerror=alert(1)>'
      }
    };
    const okHtml = builders.srcRowHtml(okRes, 0) + builders.srcDetailHtml(okRes, 0);
    ok('dòng nguồn có id + tabindex + aria-controls', /id="srcRow-0"/.test(okHtml)
      && /tabindex="0"/.test(okHtml) && /aria-controls="srcDetail-0"/.test(okHtml));
    ok('dòng nguồn mặc định THU GỌN (aria-expanded=false)', /aria-expanded="false"/.test(okHtml));
    ok('có dòng chi tiết ẩn (hidden) ngay sau dòng nguồn', /class="src-detail" id="srcDetail-0" hidden/.test(okHtml));
    ok('chi tiết có caret xoay khi mở (class open + caret)', /class="fas fa-chevron-right caret"/.test(okHtml)
      && /\.src-row\.open \.caret/.test(toolRaw));
    ok('chi tiết liệt kê trường của nguồn', /Quốc gia/.test(okHtml) && /AS16591/.test(okHtml)
      && /Proxy \/ VPN/.test(okHtml) && /Hosting \/ datacenter/.test(okHtml));
    ok('chi tiết có JSON riêng của nguồn', /JSON của nguồn này/.test(okHtml) && /&quot;asn&quot;: &quot;AS16591&quot;/.test(okHtml));
    ok('liệt kê trường nguồn KHÔNG trả', /Nguồn không trả:/.test(okHtml) && /Tên miền/.test(okHtml));
    ok('boolean hiển thị Có/Không, offset ra UTC±n', /Không/.test(okHtml) && /Có/.test(okHtml) && /UTC-7/.test(okHtml));
    ok('giá trị lạ của nguồn bị escape (chống XSS)', !/<img/.test(okHtml) && /&lt;img src=x/.test(okHtml));

    const failRes = { source: 'ipinfo', label: 'IPinfo', ok: false, cached: false, ms: 30, error: 'Chưa cấu hình API key <x>' };
    const failHtml = builders.srcRowHtml(failRes, 1) + builders.srcDetailHtml(failRes, 1);
    ok('nguồn lỗi vẫn mở rộng được để xem lỗi', /id="srcDetail-1" hidden/.test(failHtml) && /det-err/.test(failHtml));
    ok('nguồn lỗi vẫn giữ class fail', /class="src-row fail"/.test(failHtml));
    ok('lỗi của nguồn được escape', !/<x>/.test(failHtml) && /&lt;x&gt;/.test(failHtml));

    ok('detailValue: false → Không, true → Có', builders.detailValue('isProxy', false) === 'Không'
      && builders.detailValue('isHosting', true) === 'Có');
    ok('detailValue: gmtOffset → UTC+7', builders.detailValue('gmtOffset', 7) === 'UTC+7');
    ok('detailValue: toạ độ làm tròn 6 chữ số', builders.detailValue('lat', 1.23456789) === '1.234568');
    ok('detailValue: null → ẩn trường', builders.detailValue('city', null) === null);
  }
  ok('có nút Mở rộng/Thu gọn tất cả', /id="srcExpandAll"/.test(toolRaw) && /window\.toggleAllSrcDetails/.test(toolRaw));
  ok('bàn phím mở được chi tiết (Enter/Space)', /function srcRowKey/.test(toolRaw) && /ev\.key === 'Enter'/.test(toolRaw));
  ok('CSS cho dòng mở rộng + lưới chi tiết', /\.src-detail > td/.test(toolRaw) && /\.det-grid/.test(toolRaw));

  const adminHtml = read('public/admin.html');
  ok('admin.html có sidebar item ipx', adminHtml.includes('data-section="ipx"'));
  ok('admin.html có #section-ipx', adminHtml.includes('id="section-ipx"'));
  ok('admin.html có 3 tab con', ['ipxtab-sources', 'ipxtab-logs', 'ipxtab-config'].every(id => adminHtml.includes('id="' + id + '"')));
  ok('admin.html có bảng nguồn + form', adminHtml.includes('id="ipxSourceBody"') && adminHtml.includes('id="ipxFormCard"'));
  ok('admin.html có form cấu hình', adminHtml.includes('id="ipxPublicEnabled"') && adminHtml.includes('id="ipxUserDaily"'));

  const adminJs = read('public/admin.js');
  ok('admin.js có switchIpTab', /function switchIpTab\(/.test(adminJs));
  ok('admin.js nạp dữ liệu khi mở section ipx', /name === 'ipx'[\s\S]{0,80}loadIpSources\(\)/.test(adminJs));
  ok('admin.js có CRUD nguồn', ['saveIpSource', 'deleteIpSource', 'toggleIpSource', 'moveIpSource', 'testIpSource', 'runIpLookupTest'].every(f => adminJs.includes('function ' + f) || adminJs.includes('async function ' + f)));
  ok('admin.js export hàm ra window', /switchIpTab, loadIpSources/.test(adminJs));
  ok('admin.js không nhúng JSON vào onclick (dùng index)', adminJs.includes('moveIpSource(${i}, -1)'));

  const authjs = read('public/auth.js');
  ok('auth.js có link công cụ tra IP', authjs.includes('/tools/ip-lookup.html'));
  ok('auth.js có nhãn i18n cho công cụ', /ipLookupTxt/.test(authjs));

  const toolHtml = read(path.join('public', 'tools', 'ip-lookup.html'));
  ok('trang công cụ nạp auth.js', toolHtml.includes('src="/auth.js"'));
  ok('trang công cụ initNavbar', toolHtml.includes('Auth.initNavbar()'));
  ok('trang công cụ khai báo đủ biến navbar', ['--header-bg', '--bg-surface', '--bg-surface2', '--bg-btn-primary', '--border-focus']
    .every(v => (toolHtml.match(new RegExp(v.replace(/-/g, '\\-') + '\\s*:', 'g')) || []).length >= 2));
  ok('trang công cụ gọi guest + user endpoint', toolHtml.includes('/api/tools/ip-lookup/guest?ip=') && toolHtml.includes("'/api/tools/ip-lookup?ip='"));
  ok('trang công cụ escape dữ liệu nguồn', /function esc\(/.test(toolHtml));

  const dbSrc = read('database.js');
  for (const t of ['ip_lookup_sources', 'ip_lookup_cache', 'ip_lookup_logs', 'ip_guest_trials']) {
    ok(`database.js tạo bảng ${t}`, new RegExp('CREATE TABLE IF NOT EXISTS ' + t).test(dbSrc));
  }
  ok('database.js seed nguồn qua ip-lookup', /require\('\.\/ip-lookup'\)\.SOURCE_DEFAULTS/.test(dbSrc));
  ok('database.js export TRƯỚC khi seed (tránh circular rỗng)', (() => {
    const iExport = dbSrc.indexOf('module.exports = db;');
    const iSeed = dbSrc.lastIndexOf('seedIpLookupSources();');
    return iExport > 0 && iSeed > iExport;
  })());
  for (const k of ['ip_lookup_public_enabled', 'ip_lookup_public_guest_daily', 'ip_lookup_user_daily',
    'ip_lookup_console_enabled', 'ip_lookup_console_per_day', 'ip_lookup_day_cutoff_hour', 'ip_lookup_log_retention_days']) {
    ok(`database.js seed setting ${k}`, dbSrc.includes(`'${k}'`));
  }

  // ============================================================
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  // Đóng DB tạm rồi thoát (tránh giữ file handle trên Windows).
  try { db.close(() => process.exit(fail ? 1 : 0)); } catch (e) { process.exit(fail ? 1 : 0); }
  setTimeout(() => process.exit(fail ? 1 : 0), 1500);
}

main().catch(e => { console.error('Lỗi test:', e && e.stack || e); process.exit(1); });
