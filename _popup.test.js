/**
 * Test cho PA-D: reset dữ liệu rút list (local + server) + popup cell title
 * "MCC-MNC-LAC/TAC-CELLID" + cú pháp tra cứu 1 dòng dùng '-'.
 * Chạy: node _popup.test.js
 *
 * Kiểm tra tĩnh (regex) trên server.js / public/app.js / public/index.html /
 * CHANGELOG.md — không cần khởi động server.
 */
const fs = require('fs');
const path = require('path');

const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const server = read('server.js');
const app = read(path.join('public', 'app.js'));
const html = read(path.join('public', 'index.html'));
const changelog = read('CHANGELOG.md');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`); }
}

// Lấy thân một hàm top-level theo tên (từ "function name" tới dòng "}" cấp 0 kế tiếp).
function fnBody(src, name) {
  const re = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{', 'g');
  const m = re.exec(src);
  if (!m) return '';
  let i = src.indexOf('{', m.index);
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(i, j + 1); }
  }
  return '';
}

// === 1. Endpoint xoá toàn bộ dữ liệu rút list của user ===
console.log('\n== 1. DELETE /api/call-logs (bulk, user-scoped) ==');
ok('có route DELETE /api/call-logs',
  /app\.delete\(\s*['"]\/api\/call-logs['"]\s*,\s*requireAuth/.test(server));
const bulkDel = (server.match(/app\.delete\(\s*['"]\/api\/call-logs['"][\s\S]*?\r?\n\}\);/g) || [])[0] || '';
ok('bulk delete dùng requireAuth', /requireAuth/.test(bulkDel));
ok('bulk delete WHERE user_id = ?', /DELETE FROM call_logs WHERE user_id = \?/.test(bulkDel));
ok('bulk delete KHÔNG nhận id từ params', !/req\.params\.id/.test(bulkDel));
ok('bulk delete trả deleted (this.changes qua biến n)', /const n = this\.changes;/.test(bulkDel) && /deleted:\s*n\b/.test(bulkDel));
ok('vẫn còn route DELETE /api/call-logs/:id (xoá 1 bản ghi)',
  /app\.delete\(\s*['"]\/api\/call-logs\/:id['"]\s*,\s*requireAuth/.test(server));
ok('route :id dùng WHERE id = ? AND user_id = ?',
  /DELETE FROM call_logs WHERE id = \? AND user_id = \?/.test(server));

// === 2. resetCallSession xoá local + server ===
console.log('\n== 2. resetCallSession xoá local + server ==');
const rcs = fnBody(app, 'resetCallSession');
ok('resetCallSession là async', /async function resetCallSession/.test(app));
ok('gọi clearCallSession() (local)', /clearCallSession\(\)/.test(rcs));
ok('gọi apiRequest DELETE /api/call-logs', /apiRequest\(\s*['"]DELETE['"]\s*,\s*['"]\/api\/call-logs['"]\s*\)/.test(rcs));
ok('có confirm() trước khi xoá', /confirm\(/.test(rcs));
ok('reset myLogsCache = []', /myLogsCache\s*=\s*\[\]/.test(rcs));
ok('i18n calllogs.confirmReset tồn tại (EN)', /'calllogs\.confirmReset'/.test(app));
ok('nút Xoá phiên gọi resetCallSession()', /onclick="resetCallSession\(\)"/.test(html));

// === 3. cellPopupTitle ===
console.log('\n== 3. cellPopupTitle MCC-MNC-LAC/TAC-CELLID ==');
ok('có hàm cellPopupTitle', /function cellPopupTitle\s*\(/.test(app));
const cpt = fnBody(app, 'cellPopupTitle');
ok('dựng chuỗi bằng dấu "-" (mcc-mnc-lac-cellid)', /`\$\{mcc\}-\$\{mnc\}-\$\{lac\}-\$\{dispId\}`/.test(cpt));
ok('dùng classifyCellId phân short/long', /classifyCellId\(/.test(cpt));
ok('trả text + kind', /text:/.test(cpt) && /kind:/.test(cpt));

console.log('\n== 4. popup dùng cellPopupTitle (bỏ nhãn "Cell:") ==');
const scm = fnBody(app, 'showCellOnMap');
ok('showCellOnMap dùng cellPopupTitle', /cellPopupTitle\(opts\.mcc/.test(scm));
ok('showCellOnMap KHÔNG còn "hist.cell: mcc-mnc-lac" cũ', !/hist\.cell'\}\s*:\s*\$\{histEsc\(opts\.mcc/.test(scm));
const hob = fnBody(app, 'histOpenBatchOnMap');
ok('histOpenBatchOnMap dùng cellPopupTitle', /cellPopupTitle\(r\.mcc/.test(hob));
ok('histOpenBatchOnMap KHÔNG còn title cũ', !/hist\.cell'\}\s*:\s*\$\{histEsc\(r\.mcc/.test(hob));

// === 5. Cú pháp tra cứu 1 dòng ===
console.log('\n== 5. searchCells split "-" hoặc "," ==');
const sc = fnBody(app, 'searchCells');
ok('split chấp nhận "-"', /split\(\/\[,\\-\\s\]\+\//.test(sc));
ok('vẫn tra khi đủ 4 phần', /parts\.length === 4/.test(sc));
ok('placeholder mới MCC-MNC-LAC-CellID', /placeholder="MCC-MNC-LAC-CellID"/.test(html));
ok('placeholder cũ MCC,MNC,LAC,CellID đã bỏ', !/placeholder="MCC,MNC,LAC,CellID"/.test(html));

// === 6. CHANGELOG ===
console.log('\n== 6. CHANGELOG ghi thay đổi ==');
ok('CHANGELOG có mục Unreleased', /## \[Unreleased\]/.test(changelog));
ok('CHANGELOG nhắc DELETE /api/call-logs', /DELETE \/api\/call-logs/.test(changelog));
ok('CHANGELOG nhắc MCC-MNC-LAC', /MCC-MNC-LAC/.test(changelog));

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
