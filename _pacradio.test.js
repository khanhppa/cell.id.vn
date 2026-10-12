/**
 * Test cho PA-C: chọn "chế độ mạng" (RAT) tuỳ chọn + auto-infer + fallback đa RAT.
 * Chạy: node _pacradio.test.js
 *
 * Kiểm tra tĩnh (regex) trên server.js / public/app.js / public/index.html /
 * radio-util.js — không cần khởi động server.
 */
const fs = require('fs');
const path = require('path');

const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const server = read('server.js');
const app = read(path.join('public', 'app.js'));
const html = read(path.join('public', 'index.html'));
const radioUtil = read('radio-util.js');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`); }
}

console.log('\n== radio-util: radioConfident ==');
const { radioConfident, inferRadio } = require('./radio-util');
ok('hint nguồn → chắc chắn', radioConfident(12345, '', 'LTE') === true);
ok('có sector → chắc chắn (LTE)', radioConfident(12345, '1', '') === true);
ok('id dải ECI → chắc chắn', radioConfident(169492237, '', '') === true);
ok('id > 2^28 → chắc chắn (GSM dài)', radioConfident(300000000, '', '') === true);
ok('id ngắn, không hint/sector → mơ hồ', radioConfident(12345, '', '') === false);
ok('id rác → mơ hồ', radioConfident('abc', '', '') === false);
ok('export radioConfident', /module\.exports\s*=\s*\{[^}]*radioConfident/.test(radioUtil));

console.log('\n== server: nhận radio hint ==');
ok('/api/cells/resolve đọc req.query.radio', /app\.get\('\/api\/cells\/resolve'[\s\S]{0,200}req\.query[\s\S]{0,600}radio/.test(server));
ok('guest lookup đọc req.query.radio', /app\.get\('\/api\/guest\/lookup'[\s\S]{0,200}\{ mcc, mnc, lac, cellid, sector, radio \}/.test(server));
ok('server import radioConfident', /require\('\.\/radio-util'\)[\s\S]{0,40}radioConfident|radioConfident\s*\}\s*=\s*require\('\.\/radio-util'\)/.test(server));
ok('resolve trả radioInferred', /radioInferred:\s*!radioHint/.test(server));
ok('resolve trả radioConfident', /radioConfident:\s*radioConfident\(/.test(server));
ok('online branch dùng radioHint cho storeRadio', /const storeRadio = radioHint \|\| normalizeRadio\(data\.radio\)/.test(server));

console.log('\n== server: multi-RAT fallback ==');
ok('opencellid_web mơ hồ → thử LTE rồi GSM', /const radioCodes = radioLabel \? \[OCID_WEB_RADIO\[radioLabel\] \|\| ''\] : \['4', '1'\]/.test(server));
ok('opencellid_web lặp theo radioCodes', /for \(const radioCode of radioCodes\)/.test(server));
ok('combain fallback [LTE, GSM] khi mơ hồ', /const radioTypes = hint \? \[hint\] : \['LTE', 'GSM'\]/.test(server));
ok('combain lặp theo radioTypes', /for \(const rt of radioTypes\)/.test(server));
ok('combain nhận radio hint param', /async function resolveCombain\(\{ mcc, mnc, lac, cellid, sector, radio \}/.test(server));
ok('combain 403 vẫn throw ngay (không retry)', /if \(code === 403\) throw new Error\(`Combain: hết credits/.test(server));
ok('t0stbrot nhận radio hint', /async function resolveT0stbrot\(\{ mcc, mnc, lac, cellid, sector, radio \}/.test(server));
ok('t0stbrot bỏ qua id ngắn mơ hồ', /t0stbrot: cellid ngắn không rõ RAT/.test(server));

console.log('\n== app.js: gửi radio + cảnh báo ==');
ok('i18n EN cells.radio', /'cells\.radio':\s*'Network technology'/.test(app));
ok('i18n VI cells.radio', /'cells\.radio':\s*'Công nghệ mạng'/.test(app));
ok('i18n cells.radioAuto', /'cells\.radioAuto':/.test(app));
ok('i18n cells.radioWarn', /'cells\.radioWarn':/.test(app));
ok('lookupCell đọc #cellRadio', /document\.getElementById\('cellRadio'\)/.test(app));
ok('lookupCell gửi &radio=', /radioParam[\s\S]{0,120}&radio=\$\{encodeURIComponent\(radio\)\}/.test(app));
ok('guestLookup nhận radio param', /async function guestLookup\(mcc, mnc, lac, cellid, sector, radio\)/.test(app));
ok('guestLookup gửi &radio=', /const radioParam[\s\S]{0,120}&radio=\$\{encodeURIComponent\(radio\)\}/.test(app));
ok('guestLookupFromForm đọc #guestRadio', /val\('guestRadio'\)/.test(app));
ok('badge cảnh báo khi radioConfident===false', /result\.radioConfident === false/.test(app));
ok('guest cũng cảnh báo', /data\.radioConfident === false/.test(app));
ok('SOURCE_LABELS có opencellid_web', /opencellid_web:\s*'OpenCellID web \(online\)'/.test(app));

console.log('\n== index.html: dropdown RAT ==');
ok('form member có #cellRadio', /<select id="cellRadio"/.test(html));
ok('form guest có #guestRadio', /<select id="guestRadio"/.test(html));
ok('option Tự động (đề xuất)', /data-i18n="cells\.radioAuto"/.test(html));
ok('option LTE', /<option value="LTE">4G \/ LTE<\/option>/.test(html));
ok('option GSM', /<option value="GSM">2G \/ GSM<\/option>/.test(html));
ok('label dùng i18n cells.radio', /data-i18n="cells\.radio"/.test(html));

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
