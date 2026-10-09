/**
 * Harness test cho RAT style + marker icon (public/app.js).
 * Chạy: node _radiotest.js
 *
 * app.js không phải module → nạp bằng vm trong context giả có document/window/L... 
 * Chỉ cần RADIO_STYLE / radioKey / radioStyle / makeCellDivIcon / radioPopupLine.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`); }
}
function eq(name, actual, expected) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });
}

// --- Sandbox tối thiểu ---
function fakeEl() {
  const el = {
    style: { setProperty() {}, getPropertyValue: () => '', removeProperty() {} }, dataset: {}, children: [], innerHTML: '', textContent: '', value: '', checked: false,
    classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
    appendChild() {}, removeChild() {}, setAttribute() {}, removeAttribute() {},
    addEventListener() {}, removeEventListener() {}, focus() {}, blur() {}, insertBefore() {},
    querySelector: () => null, querySelectorAll: () => [], closest: () => null,
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
    getContext: () => null, remove() {}, click() {}
  };
  return el;
}
const divIcons = [];
const mapStub = {
  setView() { return this; }, fitBounds() { return this; }, removeLayer() { return this; },
  addLayer() { return this; }, on() { return this; }, off() { return this; },
  invalidateSize() {}, getZoom: () => 12, getCenter: () => ({ lat: 0, lng: 0 }),
  eachLayer() {}, hasLayer: () => false, remove() {}, zoomControl: { setPosition() {} },
  getBounds: () => ({ pad: () => ({}), extend() { return this; }, isValid: () => true }),
  addControl() { return this; }, removeControl() { return this; },
  flyTo() { return this; }, setZoom() { return this; }, panTo() { return this; },
  whenReady(cb) { if (cb) cb(); return this; }, createPane: () => fakeEl(),
  getContainer: () => fakeEl(), getPanes: () => ({}), getPixelBounds: () => ({}),
  latLngToContainerPoint: () => ({ x: 0, y: 0 }),
  containerPointToLatLng: () => ({ lat: 0, lng: 0 }),
  mouseEventToLatLng: () => ({ lat: 0, lng: 0 }),
  removeLayerGroup() { return this; }, addLayerGroup() { return this; },
  pm: { addControls() {}, enableDraw() {}, disableDraw() {} }
};
// Layer stub: mọi method chain đều trả về chính nó.
function Layer() {
  this.addTo = () => this;
  this.bindPopup = () => this;
  this.bindTooltip = () => this;
  this.openPopup = () => this;
  this.closePopup = () => this;
  this.on = () => this;
  this.off = () => this;
  this.setLatLng = () => this;
  this.getLatLng = () => ({ lat: 0, lng: 0 });
  this.setStyle = () => this;
  this.removeLayer = () => this;
  this.addLayer = () => this;
  this.clearLayers = () => {};
  this.eachLayer = () => {};
  this.getBounds = () => ({ pad: () => ({}), extend() { return this; }, isValid: () => true });
  this.setView = () => this;
  this.fitBounds = () => this;
  this.toGeoJSON = () => ({});
  this.addData = () => this;
  this.remove = () => {};
  this.getElement = () => fakeEl();
  this.onAdd = () => fakeEl();
  this.feature = {};
}
const Lstub = {
  map: () => mapStub,
  divIcon: (o) => { divIcons.push(o); return { __divIcon: o }; },
  circle: function () { return new Layer(); },
  circleMarker: function () { return new Layer(); },
  marker: function () { return new Layer(); },
  featureGroup: function () { return new Layer(); },
  layerGroup: function () { return new Layer(); },
  geoJSON: function () { return new Layer(); },
  polygon: function () { return new Layer(); },
  polyline: function () { return new Layer(); },
  rectangle: function () { return new Layer(); },
  tileLayer: function () { return new Layer(); },
  FeatureGroup: function () { return new Layer(); },
  LayerGroup: function () { return new Layer(); },
  Marker: function () { return new Layer(); },
  Circle: function () { return new Layer(); },
  CircleMarker: function () { return new Layer(); },
  GeoJSON: function () { return new Layer(); },
  control: {
    layers: () => ({ addTo() { return this; } }),
    zoom: () => ({ addTo() { return this; } }),
    scale: () => ({ addTo() { return this; } }),
    attribution: () => ({ addTo() { return this; } })
  },
  Draw: { Event: { CREATED: 'draw:created', EDITED: 'draw:edited', DELETED: 'draw:deleted' } }, drawLocal: {},
  Control: Object.assign(
    function () { return new Layer(); },
    { extend: () => function Ctl() { this.addTo = () => this; this.onAdd = () => fakeEl(); }, include: () => {},
      Draw: function () { return new Layer(); } }
  ),
  Draw: { Event: { CREATED: 'draw:created', EDITED: 'draw:edited', DELETED: 'draw:deleted' } }, drawLocal: {},
  Icon: { Default: { prototype: {}, mergeOptions() {} } },
  DomUtil: { create: () => fakeEl(), addClass() {}, removeClass() {}, setClass() {} },
  DomEvent: {
    on: function () { return this; }, off: function () { return this; },
    stop() {}, stopPropagation() {}, disableClickPropagation() { return this; }, disableScrollPropagation() { return this; }
  },
  latLng: (a, b) => ({ lat: a, lng: b }),
  latLngBounds: () => ({ pad: () => ({}), extend() { return this; }, isValid: () => true })
};
const sandbox = {
  console,
  document: {
    createElement: fakeEl,
    createElementNS: fakeEl,
    getElementById: () => fakeEl(),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    body: fakeEl(),
    documentElement: fakeEl(),
    cookie: '',
    readyState: 'complete'
  },
  window: {
    addEventListener: () => {}, removeEventListener: () => {},
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    location: { href: 'http://localhost:3000/', search: '', hash: '' },
    innerWidth: 1280, innerHeight: 800,
    setTimeout, clearTimeout, setInterval, clearInterval
  },
  navigator: { language: 'vi-VN', userAgent: 'node' },
  location: { href: 'http://localhost:3000/', search: '', hash: '', reload() {} },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  fetch: () => Promise.reject(new Error('no fetch')),
  setTimeout, clearTimeout, setInterval, clearInterval,
  L: Lstub,
  XLSX: { read() { return { SheetNames: [], Sheets: {} }; }, utils: { sheet_to_json: () => [] } },
  Auth: { isAdmin: () => false, isLoggedIn: () => true, token: () => '' },
  alert() {}, confirm: () => true, prompt: () => null
};
sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);
vm.runInContext(src, ctx, { filename: 'public/app.js' });

const get = (expr) => vm.runInContext(expr, ctx);

console.log('\n== radioKey (chuẩn hoá) ==');
eq('GSM',      get("radioKey('GSM')"), 'GSM');
eq('gsm thường', get("radioKey('gsm')"), 'GSM');
eq('2G',       get("radioKey('2G')"), 'GSM');
eq('LTE',      get("radioKey('LTE')"), 'LTE');
eq('4G',       get("radioKey('4G')"), 'LTE');
eq('LTE-M',    get("radioKey('LTE-M')"), 'LTE');
eq('UMTS',     get("radioKey('UMTS')"), 'UMTS');
eq('WCDMA',    get("radioKey('WCDMA')"), 'UMTS');
eq('3G',       get("radioKey('3G')"), 'UMTS');
eq('NR',       get("radioKey('NR')"), 'NR');
eq('5G',       get("radioKey('5G')"), 'NR');
eq('NB-IoT',   get("radioKey('NB-IoT')"), 'NBIOT');
eq('nb_iot',   get("radioKey('nb_iot')"), 'NBIOT');
eq('NBIOT',    get("radioKey('NBIOT')"), 'NBIOT');
eq('CDMA',     get("radioKey('CDMA')"), 'CDMA');
eq('EVDO',     get("radioKey('EVDO')"), 'EVDO');
eq('iDEN',     get("radioKey('iDEN')"), 'IDEN');
eq('null',     get('radioKey(null)'), '');
eq('undefined', get('radioKey(undefined)'), '');
eq('rác',      get("radioKey('XYZ')"), '');

console.log('\n== radioStyle (màu + nhãn) ==');
eq('LTE màu', get("radioStyle('LTE').color"), '#3d7ce0');
eq('LTE label', get("radioStyle('LTE').label"), '4G');
eq('GSM label', get("radioStyle('GSM').label"), '2G');
eq('NR label', get("radioStyle('5G').label"), '5G');
eq('NBIOT label', get("radioStyle('NB-IoT').label"), 'NB');
eq('NBIOT full', get("radioStyle('NB-IoT').full"), 'NB-IoT');
ok('fallback key rỗng', get("radioStyle(null).key") === '');
eq('fallback label ?', get("radioStyle(null).label"), '?');
eq('fallback màu xám', get("radioStyle(undefined).color"), '#8892a0');
ok('mọi RAT đều có màu riêng', (() => {
  const ks = get('Object.keys(RADIO_STYLE)');
  const colors = ks.map(k => get(`RADIO_STYLE['${k}'].color`));
  return new Set(colors).size === ks.length;
})(), get('Object.keys(RADIO_STYLE).length'));

console.log('\n== makeCellDivIcon ==');
divIcons.length = 0;
get("makeCellDivIcon(radioStyle('LTE'))");
const ic = divIcons[divIcons.length - 1];
ok('dùng L.divIcon', !!ic);
ok('html chứa màu', String(ic.html).includes('--mc:#3d7ce0'), ic.html);
ok('html chứa nhãn 4G', String(ic.html).includes('>4G<'), ic.html);
ok('html chứa fa-map-marker-alt', String(ic.html).includes('fa-map-marker-alt'));
eq('iconSize', ic.iconSize, [26, 34]);
eq('iconAnchor', ic.iconAnchor, [13, 32]);
eq('popupAnchor', ic.popupAnchor, [0, -30]);

console.log('\n== radioPopupLine ==');
ok('LTE có dòng', String(get("radioPopupLine('LTE')")).includes('LTE (4G)'));
ok('LTE có tên i18n', String(get("radioPopupLine('LTE')")).includes('Công nghệ mạng'));
eq('null → rỗng', get('radioPopupLine(null)'), '');
eq('rác → rỗng', get("radioPopupLine('XYZ')"), '');

console.log('\n== legend "Công nghệ mạng" đồng bộ RADIO_STYLE ==');
const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
const legendBody = (html.match(/id="legendRadioBody"[\s\S]*?<\/div>\s*<\/div>/) || [''])[0];
const legendColors = (legendBody.match(/background:(#[0-9a-f]{6})/gi) || []).map(s => s.split(':')[1].toLowerCase());
const styleColors = get('Object.values(RADIO_STYLE).map(s => s.color.toLowerCase())');
ok('legend có đủ mọi màu RADIO_STYLE', styleColors.every(c => legendColors.includes(c)),
   'thiếu: ' + styleColors.filter(c => !legendColors.includes(c)).join(','));
ok('legend có màu unknown', legendColors.includes('#8892a0'));
ok('legend radio không trùng', new Set(legendColors).size === legendColors.length, legendColors.length + ' dots');
ok('legend sub collapsible (CSS .legend-sub.open)', html.includes('.legend-sub.open .legend-sub-body'));
ok('nút toggle gọi toggleLegendRadio', html.includes('onclick="toggleLegendRadio()"'));
ok('toggleLegendRadio định nghĩa trong app.js', /function toggleLegendRadio\s*\(/.test(src));
ok('i18n legend.radio EN', get("I18N.en['legend.radio']") === 'Network technology');
ok('i18n legend.radio VI', get("I18N.vi['legend.radio']") === 'Công nghệ mạng');
ok('i18n legend.towerHint EN', !!get("I18N.en['legend.towerHint']"));
ok('i18n legend.towerHint VI', !!get("I18N.vi['legend.towerHint']"));
ok('i18n legend.radioUnknown cả 2 ngôn ngữ', !!get("I18N.en['legend.radioUnknown']") && !!get("I18N.vi['legend.radioUnknown']"));

console.log('\n== ruler icon hover nền đục ==');
ok('hover có background-color đục (#f4f4f4)', /a\.leaflet-draw-measure:hover[\s\S]{0,200}background-color:\s*#f4f4f4/.test(html));
ok('hover tắt background-image !important', /a\.leaflet-draw-measure:hover[\s\S]{0,200}background-image:\s*none\s*!important/.test(html));
ok('base tắt background-image !important', /a\.leaflet-draw-measure\s*\{[\s\S]{0,300}background-image:\s*none\s*!important/.test(html));
ok('active cũng đục', /a\.leaflet-draw-measure\.active[\s\S]{0,150}background-color/.test(html));
ok('dark theme override dùng [data-theme="dark"]', html.includes('[data-theme="dark"] .leaflet-draw-toolbar a.leaflet-draw-measure:hover'));
ok('giữ icon fa-ruler \\f545', html.includes('f545'));
ok('không còn hover nền trong suốt var(--bg-hover)', !/a\.leaflet-draw-measure:hover[\s\S]{0,200}var\(--bg-hover\)/.test(html));

console.log('\n== lọc lịch sử theo ngày ==');
ok('isValidIsoDate ngày hợp lệ', get("isValidIsoDate('2026-10-08')") === true);
ok('isValidIsoDate rỗng', get("isValidIsoDate('')") === false);
ok('isValidIsoDate null', get('isValidIsoDate(null)') === false);
ok('isValidIsoDate undefined', get('isValidIsoDate(undefined)') === false);
ok('isValidIsoDate thiếu số 0', get("isValidIsoDate('2026-1-8')") === false);
ok('isValidIsoDate rác', get("isValidIsoDate('garbage')") === false);
ok('isValidIsoDate datetime đầy đủ', get("isValidIsoDate('2026-10-08T12:00:00Z')") === false);
ok('isValidIsoDate không phải string', get('isValidIsoDate(20261008)') === false);
ok('onHistDateChange định nghĩa', /function onHistDateChange\s*\(/.test(src));
ok('clearHistDate định nghĩa', /function clearHistDate\s*\(/.test(src));
ok('syncHistDateClear định nghĩa', /function syncHistDateClear\s*\(/.test(src));
ok('loadLookupHistory gửi &date=', /loadLookupHistory[\s\S]{0,900}&date=/.test(src));
ok('loadLookupHistory encode date', /\&date=' \+ encodeURIComponent\(date\)/.test(src));
ok('loadLookupHistory encode mode', /encodeURIComponent\(mode\)/.test(src));
ok('loadLookupHistory gọi syncHistDateClear', /syncHistDateClear\(\)/.test(src));
ok('HTML có input#histDate', html.includes('id="histDate"'));
ok('HTML có type=date', /id="histDate"[^>]*/.test(html) && /<input type="date" id="histDate"/.test(html));
ok('HTML có nút clear ngày', html.includes('id="histDateClear"'));
ok('HTML có onclick clearHistDate', html.includes('onclick="clearHistDate()"'));
ok('HTML date nằm cùng .hist-toolbar với select', /class="hist-toolbar">[\s\S]{0,600}id="histModeFilter"[\s\S]{0,400}id="histDate"/.test(html));
ok('CSS date không co giãn (flex 0 0 auto)', /\.hist-toolbar input\[type="date"\]\s*\{[\s\S]{0,120}flex:\s*0 0 auto/.test(html));
ok('CSS select vẫn co giãn (flex 1)', /\.hist-toolbar select\s*\{[\s\S]{0,60}flex:\s*1/.test(html));
ok('CSS .hist-date-clear', html.includes('.hist-date-clear'));
ok('CSS .hidden', /\.hidden\s*\{\s*display:\s*none\s*!important/.test(html));
ok('applyI18n xử lý data-i18n-title', /data-i18n-title/.test(src) && /dataset\.i18nTitle/.test(src));
ok('i18n hist.filterDate EN', get("I18N.en['hist.filterDate']") === 'Filter by date');
ok('i18n hist.filterDate VI', get("I18N.vi['hist.filterDate']") === 'Lọc theo ngày');
ok('i18n hist.clearDate EN', !!get("I18N.en['hist.clearDate']"));
ok('i18n hist.clearDate VI', !!get("I18N.vi['hist.clearDate']"));

console.log('\n== nguồn opencellid_web (scrape web, không key) ==');
const srvSrc = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
ok('khai báo OCID_WEB_BASE trỏ opencellid.org', /const OCID_WEB_BASE = 'https:\/\/opencellid\.org'/.test(srvSrc));
ok('OCID_WEB_RADIO GSM=1', /OCID_WEB_RADIO\s*=\s*\{[^}]*GSM:\s*'1'/.test(srvSrc));
ok('OCID_WEB_RADIO CDMA=2', /OCID_WEB_RADIO\s*=\s*\{[^}]*CDMA:\s*'2'/.test(srvSrc));
ok('OCID_WEB_RADIO UMTS=3', /OCID_WEB_RADIO\s*=\s*\{[^}]*UMTS:\s*'3'/.test(srvSrc));
ok('OCID_WEB_RADIO LTE=4', /OCID_WEB_RADIO\s*=\s*\{[^}]*LTE:\s*'4'/.test(srvSrc));
ok('OCID_WEB_RADIO NR=5', /OCID_WEB_RADIO\s*=\s*\{[^}]*NR:\s*'5'/.test(srvSrc));
ok('OCID_WEB_RADIO NBIOT=10', /OCID_WEB_RADIO\s*=\s*\{[^}]*NBIOT:\s*'10'/.test(srvSrc));
ok('gọi endpoint /ajax/searchCell.php', /\/ajax\/searchCell\.php/.test(srvSrc));
ok('gửi header X-Requested-With XMLHttpRequest', /X-Requested-With':\s*'XMLHttpRequest'/.test(srvSrc));
ok('gửi Referer opencellid.org', /Referer.*OCID_WEB_BASE/.test(srvSrc));
ok('gửi User-Agent browser (OCID_WEB_UA)', /'User-Agent':\s*OCID_WEB_UA/.test(srvSrc));
ok('có cooldown toàn cục ocidWebBlockedUntil', /let ocidWebBlockedUntil\s*=/.test(srvSrc));
ok('cooldown 90s', /OCID_WEB_COOLDOWN_MS\s*=\s*90000/.test(srvSrc));
ok('nhận diện "Too many requests" -> set cooldown', /Too many requests[\s\S]{0,600}ocidWebBlockedUntil\s*=\s*Date\.now\(\)/.test(srvSrc));
ok('xử lý HTTP 429', /429/.test(srvSrc));
ok('giới hạn số cell/lần batch', /OCID_WEB_MAX_PER_BATCH\s*=\s*20/.test(srvSrc));
ok('throttle giữa các request', /OCID_WEB_THROTTLE_MS\s*=\s*1200/.test(srvSrc));
ok('đăng ký type opencellid_web', /ONLINE_SOURCE_TYPES\s*=\s*\[[^\]]*'opencellid_web'/.test(srvSrc));
ok('opencellid_web mặc định TẮT', /ONLINE_SOURCE_DEFAULT_DISABLED\s*=\s*\[[^\]]*'opencellid_web'/.test(srvSrc));
ok('seed tôn trọng DEFAULT_DISABLED', /ONLINE_SOURCE_DEFAULT_DISABLED\.includes\(type\)/.test(srvSrc));
const ocidIdx = srvSrc.indexOf(String.fromCharCode(39) + 'opencellid_web' + String.fromCharCode(39)); const ocid2 = srvSrc.indexOf(String.fromCharCode(39) + 'opencellid' + String.fromCharCode(39));
ok('opencellid_web xếp sau opencellid (ưu tiên thấp hơn)', ocid2 !== -1 && ocidIdx > ocid2);
ok('dispatch nguồn trong /api/cells/resolve', /else if \(src\.type === 'opencellid_web'\)/.test(srvSrc));
ok('dispatch nguồn trong resolve-batch có throttle', /webCalls\s*>=\s*OCID_WEB_MAX_PER_BATCH/.test(srvSrc));
ok('batch sleep giữa các lần gọi web', /await sleep\(OCID_WEB_THROTTLE_MS\)/.test(srvSrc));
ok('có helper sleep', /(const|let|var)\s+sleep\s*=|function\s+sleep\s*\(/.test(srvSrc));

const adminSrc = fs.readFileSync(path.join(__dirname, 'public', 'admin.js'), 'utf8');
const adminHtml = fs.readFileSync(path.join(__dirname, 'public', 'admin.html'), 'utf8');
ok('admin.html có option opencellid_web', /<option value="opencellid_web">/.test(adminHtml));
ok('admin.html có nhãn tiếng Việt "không cần key"', /opencellid_web"[^>]*>[^<]*không cần key/.test(adminHtml));
ok('admin.js xử lý type opencellid_web', /type === 'opencellid_web'/.test(adminSrc));
ok('admin.js disable ô API key cho nguồn web', /type === 'opencellid_web'[\s\S]{0,200}disabled = true/.test(adminSrc));
ok('admin.js có hint rate limit ~5 request/phút', /5 request\/phút/.test(adminSrc));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
