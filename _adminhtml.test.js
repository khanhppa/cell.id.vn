/**
 * Harness cấu trúc DOM cho public/admin.html (không cần jsdom).
 * Chạy: node _adminhtml.test.js
 *
 * Kiểm tra:
 *  - Sidebar đúng 7 mục: dashboard, cells, users, payments, api, settings, version
 *    (đã gộp credits + celldb; thêm payments cho payOS, version — lịch sử phiên bản chỉ admin).
 *  - Cell ID Database có 3 menu con: sources / local / audit.
 *  - Mỗi `id="section-X"` khớp với 1 mục sidebar; không còn section mồ côi.
 *  - Các phần tử credits nằm BÊN TRONG #section-users; CSDL cells + upload CSV
 *    + CLF nằm trong #sub-local; audit nằm trong #sub-audit.
 *  - Thẻ <div> cân bằng (không thừa/thiếu khi gộp section).
 *  - Không còn dấu vết double-encoding (Ã, Â) trong nội dung.
 */
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`); }
}

const html = fs.readFileSync(path.join(__dirname, 'public', 'admin.html'), 'utf8');
const adminJs = fs.readFileSync(path.join(__dirname, 'public', 'admin.js'), 'utf8');

console.log('== Sidebar ==');
const sidebarBlock = html.slice(html.indexOf('<div class="sidebar">'), html.indexOf('<div class="content">'));
const sections = [...sidebarBlock.matchAll(/data-section="([^"]+)"/g)].map(m => m[1]);
ok('sidebar có đúng 8 mục (thêm tab API + Tra cứu IP)', sections.length === 8, sections);
ok('thứ tự: dashboard, cells, users, payments, api, ipx, settings, version',
  JSON.stringify(sections) === JSON.stringify(['dashboard', 'cells', 'users', 'payments', 'api', 'ipx', 'settings', 'version']), sections);
ok('nav tới cells gọi switchSection(\'cells\')', /data-section="cells"\s+onclick="switchSection\('cells'\)"/.test(sidebarBlock));
ok('nav tới users gọi switchSection(\'users\')', /data-section="users"\s+onclick="switchSection\('users'\)"/.test(sidebarBlock));
ok('nav tới version gọi switchSection(\'version\')', /data-section="version"\s+onclick="switchSection\('version'\)"/.test(sidebarBlock));

console.log('\n== Section ↔ nav khớp ==');
const secIds = [...html.matchAll(/id="section-([a-z]+)"/g)].map(m => m[1]);
ok('không còn section-credits', !secIds.includes('credits'), secIds);
ok('không còn section-celldb', !secIds.includes('celldb'), secIds);
ok('có section-users', secIds.includes('users'), secIds);
ok('có section-version (lịch sử phiên bản)', secIds.includes('version'), secIds);
ok('có section-payments (nạp điểm payOS)', secIds.includes('payments'), secIds);
ok('section-payments có #payStats + #pkgList + #payBody',
  html.includes('id="payStats"') && html.includes('id="pkgList"') && html.includes('id="payBody"'));
ok('section-version có #verAdminList', html.includes('id="verAdminList"'));
ok('admin.html có CSS .ver-entry (kiểu changelog)', html.includes('.ver-entry'));
ok('mọi id section-* đều có mục sidebar tương ứng',
  secIds.every(s => sections.includes(s)), { secIds, sections });

// Cắt nội dung từng section theo vị trí mở/đóng để kiểm tra phần tử con.
function sliceSection(id) {
  const start = html.indexOf(`id="section-${id}"`);
  if (start < 0) return '';
  // Cửa sổ đủ rộng tới section kế tiếp hoặc tới modal.
  const nextIdx = html.indexOf('id="section-', start + 1);
  const modalIdx = html.indexOf('<!-- Toast -->', start + 1);
  let end = html.length;
  if (nextIdx > 0) end = Math.min(end, nextIdx);
  if (modalIdx > 0) end = Math.min(end, modalIdx);
  return html.slice(start, end);
}

// Menu con của Cell ID Database sống trong `id="sub-<name>"` (không phải
// `section-*`), nên tách riêng: cửa sổ từ mở `sub-X` tới `sub-<kế tiếp>`/`section-`.
function sliceSub(name) {
  const start = html.indexOf(`id="sub-${name}"`);
  if (start < 0) return '';
  let end = html.length;
  const nextSub = html.indexOf('id="sub-', start + 1);
  const nextSec = html.indexOf('id="section-', start + 1);
  if (nextSub > 0) end = Math.min(end, nextSub);
  if (nextSec > 0) end = Math.min(end, nextSec);
  return html.slice(start, end);
}
const usersSec = sliceSection('users');
const localSec = sliceSub('local');
const auditSec = sliceSub('audit');
const sourcesSec = sliceSub('sources');

console.log('\n== Gộp credits vào section-users ==');
ok('creditUserFilter trong section-users', usersSec.includes('id="creditUserFilter"'));
ok('KHÔNG còn bảng creditUsersBody (đã gộp)', !usersSec.includes('id="creditUsersBody"'));
ok('creditTxBody trong section-users', usersSec.includes('id="creditTxBody"'));
ok('btnReconcile trong section-users', usersSec.includes('id="btnReconcile"'));
ok('userTableBody vẫn trong section-users', usersSec.includes('id="userTableBody"'));
ok('section-users chỉ còn 1 bảng user', (usersSec.match(/id="userTableBody"/g) || []).length === 1);
ok('section-users còn bảng lịch sử giao dịch', /Lịch sử giao dịch/.test(usersSec));
ok('bảng gộp có 9 cột (đã thêm cột Email)', (usersSec.match(/<th\b/g) || []).length - 6 === 9, (usersSec.match(/<th\b/g) || []).length);
ok('bảng user có cột Email', /Email<\/th>/.test(usersSec));
ok('bảng user có cột Số dư', /Số dư<\/th>/.test(usersSec));
ok('bảng user có cột Đã dùng', /Đã dùng<\/th>/.test(usersSec));
ok('bảng user có cột Trạng thái', /Trạng thái<\/th>/.test(usersSec));
ok('bảng user có cột Ngày tạo', /Ngày tạo<\/th>/.test(usersSec));
ok('filter trỏ renderUsersTable()', /oninput="renderUsersTable\(\)"/.test(usersSec));
ok('filter admin_adjust đổi nhãn "Khởi tạo user"', /value="admin_adjust">Khởi tạo user/.test(usersSec));

console.log('\n== Gộp CSDL cells vào section-cells (menu con) ==');
ok('cdbBody trong #sub-local (Quản lý dữ liệu Local)', localSec.includes('id="cdbBody"'));
ok('cdbQ trong #sub-local', localSec.includes('id="cdbQ"'));
ok('cdbSelAll trong #sub-local', localSec.includes('id="cdbSelAll"'));
ok('upload CSV (bulkZone) trong #sub-local', localSec.includes('id="bulkZone"'));
ok('chuyển đổi CLF (clfZone) trong #sub-local', localSec.includes('id="clfZone"'));
ok('card Nguy hiểm (clearAllCellsBtn) trong #sub-local', localSec.includes('id="clearAllCellsBtn"'));
ok('cdbAuditBody nằm trong #sub-audit', auditSec.includes('id="cdbAuditBody"'));
ok('KHÔNG còn #sub-bulk tách riêng', !/id="sub-bulk"/.test(html));
ok('KHÔNG còn #sub-clf tách riêng', !/id="sub-clf"/.test(html));
ok('KHÔNG còn #section-cells (đã đổi thành #sub-local)', !/id="section-cells"/.test(html));

console.log('\n== Menu con Cell ID Database ==');
const subBlock = html.slice(html.indexOf('class="sidebar-sub"'), html.indexOf('<div class="content">'));
const subIds = [...subBlock.matchAll(/data-sub="([^"]+)"/g)].map(m => m[1]);
ok('có đúng 3 menu con', subIds.length === 3, subIds);
ok('thứ tự: sources, local, audit',
  JSON.stringify(subIds) === JSON.stringify(['sources', 'local', 'audit']), subIds);
ok('menu con gọi switchCellSub(...)', /data-sub="sources"\s+onclick="switchCellSub\('sources'\)"/.test(subBlock)
  && /data-sub="local"\s+onclick="switchCellSub\('local'\)"/.test(subBlock)
  && /data-sub="audit"\s+onclick="switchCellSub\('audit'\)"/.test(subBlock));
ok('nhãn "Quản lý nguồn dữ liệu Online"', html.includes('Quản lý nguồn dữ liệu Online'));
ok('nhãn "Quản lý dữ liệu Local"', html.includes('Quản lý dữ liệu Local'));
ok('nhãn "Lịch sử chỉnh sửa"', html.includes('Lịch sử chỉnh sửa'));
ok('sidebar-item cells có caret menu con', /data-section="cells"[^>]*>[\s\S]{0,200}sidebar-caret/.test(sidebarBlock));
ok('sidebar-sub gắn data-parent="cells"', /class="sidebar-sub"\s+data-parent="cells"/.test(html));

console.log('\n== switchCellSub trong admin.js ==');
ok('có function switchCellSub', /function switchCellSub\(/.test(adminJs));
ok('switchCellSub mở #sub-<name>', /function switchCellSub\([\s\S]{0,600}getElementById\('sub-' \+ sub\)/.test(adminJs));
ok('switchCellSub sources nạp loadSources + loadSyncJobs',
  /sub === 'sources'\)\s*\{[^}]*loadSources\(\)[^}]*loadSyncJobs\(\)/.test(adminJs));
ok('switchCellSub local nạp cdbLoadMeta + cdbSearch',
  /sub === 'local'\)\s*\{[^}]*cdbLoadMeta\(\)[^}]*cdbSearch\(\)/.test(adminJs));
ok('switchCellSub audit nạp cdbLoadAudit',
  /sub === 'audit'\)\s*cdbLoadAudit\(1\)/.test(adminJs));
ok('switchSection cells mở switchCellSub(\'local\')',
  /name === 'cells'\)\s*switchCellSub\('local'\)/.test(adminJs));
ok('goBackToCells quay về switchSection(\'cells\')',
  /function goBackToCells\(\)\s*\{\s*switchSection\('cells'\)/.test(adminJs));
ok('KHÔNG còn showBulkPage trỏ #sub-bulk', !/getElementById\('sub-bulk'\)/.test(adminJs));
ok('KHÔNG còn showClfPage trỏ #sub-clf', !/getElementById\('sub-clf'\)/.test(adminJs));

console.log('\n== admin.js gộp bảng user ==');
ok('có renderUsersTable', /function renderUsersTable\(\)/.test(adminJs));
ok('KHÔNG còn loadUsers', !/function loadUsers\(/.test(adminJs));
ok('KHÔNG còn renderCreditUsers', !/function renderCreditUsers\(/.test(adminJs));
ok('KHÔNG còn creditUsersBody trong JS', !/creditUsersBody/.test(adminJs));
ok('KHÔNG còn gọi loadUsers()', !/\bloadUsers\(\)/.test(adminJs));
ok('loadCreditUsers render vào userTableBody', /function loadCreditUsers\(\)[\s\S]{0,400}userTableBody/.test(adminJs));
ok('renderUsersTable render vào userTableBody', /function renderUsersTable\(\)[\s\S]{0,200}userTableBody/.test(adminJs));
ok('renderUsersTable có nút Nạp điểm', /function renderUsersTable\(\)[\s\S]{0,4200}openCreditModal/.test(adminJs));
ok('renderUsersTable có nút Sửa user', /function renderUsersTable\(\)[\s\S]{0,4200}editUser\(/.test(adminJs));
ok('renderUsersTable có nút Xoá user', /function renderUsersTable\(\)[\s\S]{0,4200}deleteUser\(/.test(adminJs));
ok('switchSection users KHÔNG còn loadUsers', /name === 'users'\)\s*\{[^}]*loadCreditUsers\(\)[^}]*loadCreditTx\(\)/.test(adminJs));

console.log('\n== Modal ==');
ok('có creditModal', html.includes('id="creditModal"'));
ok('creditModal không còn mode ẩn phụ thuộc adjust', !/id="creditMode"/.test(html));
ok('creditModal có nút submitCreditModal', /onclick="submitCreditModal\(\)"/.test(html));
ok('có cdbEditModal', html.includes('id="cdbEditModal"'));
ok('KHÔNG còn userFormCredit', !/id="userFormCredit"/.test(html));
ok('KHÔNG còn userCreditGroup', !/id="userCreditGroup"/.test(html));

console.log('\n== Nguồn Google Geolocation ==');
ok('dropdown nguồn có option value="google"', /<option value="google">/.test(html));
ok('option google nằm trong #srcType', /id="srcType"[\s\S]{0,600}<option value="google">/.test(html));
ok('settings có input #setGoogleMax (max_google_per_batch)', /id="setGoogleMax"/.test(html));
ok('admin.js load #setGoogleMax từ API settings', /setGoogleMax[\s\S]{0,120}max_google_per_batch/.test(adminJs));
ok('admin.js gửi max_google_per_batch khi lưu', /settings\.max_google_per_batch = googleMax/.test(adminJs));
ok('admin.js có nhánh hint google (cảnh báo tốn phí)', /type === 'google'/.test(adminJs) && /Tốn phí theo request/.test(adminJs));
ok('admin.js badge google trong cdbSourceBadge', /s === 'google'/.test(adminJs));

console.log('\n== Lỗi nguồn hiện cho admin (last_error) ==');
ok('bảng nguồn có cột "Lỗi gần nhất"', /<th>Lỗi gần nhất<\/th>/.test(html));
ok('colspan placeholder khớp 7 cột', /id="sourceTableBody"><tr><td colspan="7"/.test(html));
ok('admin.js render s.last_error trong bảng nguồn', /s\.last_error/.test(adminJs));
ok('admin.js hiện last_error_at làm tooltip', /esc\(s\.last_error_at/.test(adminJs));
ok('hint google nhắc xem cột "Lỗi gần nhất"', /Lỗi gần nhất/.test(adminJs));
ok('không còn placeholder colspan="6" trong bảng nguồn', !/id="sourceTableBody"><tr><td colspan="6"/.test(html));

console.log('\n== Dashboard mới + Google Analytics ==');
const dashSec = sliceSection('dashboard');
ok('dashboard có #dashLocalKpis (KPI local)', dashSec.includes('id="dashLocalKpis"'));
ok('dashboard có #dashGaSection (khối GA)', dashSec.includes('id="dashGaSection"'));
ok('dashboard có trạng thái GA rỗng #dashGaEmpty + lỗi #dashGaError',
  dashSec.includes('id="dashGaEmpty"') && dashSec.includes('id="dashGaError"'));
ok('dashboard có 2 canvas biểu đồ',
  dashSec.includes('id="dashTrafficChart"') && dashSec.includes('id="dashLocalChart"'));
ok('dashboard có breakdown trang/nguồn/thiết bị/quốc gia/top user',
  ['dashTopPages', 'dashChannels', 'dashDevices', 'dashCountries', 'dashTopUsers']
    .every(id => dashSec.includes(`id="${id}"`)));
ok('dashboard có #dashActivity + #dashHealth', dashSec.includes('id="dashActivity"') && dashSec.includes('id="dashHealth"'));
ok('dashboard có select khoảng ngày #dashRange', /id="dashRange"[\s\S]{0,400}value="28"/.test(dashSec));
ok('dashboard có nút mở cấu hình GA', /onclick="openGaSettings\(\)"/.test(dashSec));
ok('KHÔNG còn #statUsers cũ', !html.includes('id="statUsers"'));

ok('settings có tab Google Analytics', /data-settingstab="ga"[\s\S]{0,120}switchSettingsTab\('ga'\)/.test(html));
ok('có pane #settingstab-ga', html.includes('id="settingstab-ga"'));
ok('pane GA có #setGaEnabled + Measurement + Property + Service Account',
  /id="settingstab-ga"[\s\S]*?id="setGaEnabled"[\s\S]*?id="setGaMeasurementId"[\s\S]*?id="setGaPropertyId"[\s\S]*?id="setGaServiceAccount"[\s\S]*?\/settingstab-ga/.test(html));
ok('pane GA có email service account + nút test', html.includes('id="gaAccountEmail"') && html.includes('id="gaTestBtn"'));
ok('pane GA có nút lưu riêng #gaSaveBtn', /id="gaSaveBtn"[\s\S]{0,120}saveGaSettings\(\)/.test(html));
ok('admin.js có saveGaSettings + validateGaInputs + applyGaSettingsToForm',
  /function saveGaSettings\(/.test(adminJs) && /function validateGaInputs\(/.test(adminJs)
  && /function applyGaSettingsToForm\(/.test(adminJs));
ok('loadSettings có chống response cũ ghi đè (_settingsLoadSeq)',
  /_settingsLoadSeq/.test(adminJs) && /seq !== _settingsLoadSeq/.test(adminJs));
ok('admin.js có testGaConnection + copyGaEmail + collectAnalyticsSettings',
  /function testGaConnection\(/.test(adminJs) && /function copyGaEmail\(/.test(adminJs)
  && /function collectAnalyticsSettings\(/.test(adminJs));
ok('loadSettings nạp ga_measurement_id', /gaMid[\s\S]{0,120}ga_measurement_id/.test(adminJs));
ok('saveSettings gọi collectAnalyticsSettings', /collectAnalyticsSettings\(settings\)/.test(adminJs));

console.log('\n== Modal sửa user đầy đủ trường ==');
ok('modal có #userEditId (hidden)', html.includes('id="userEditId"'));
ok('modal có username/email/verified/password/role/status',
  ['userFormUsername', 'userFormEmail', 'userFormVerified', 'userFormPassword', 'userFormRole', 'userFormStatus']
    .every(id => html.includes(`id="${id}"`)));
ok('status có option disabled', /id="userFormStatus"[\s\S]{0,500}value="disabled"/.test(html));
ok('modal có vùng meta #userFormMeta', html.includes('id="userFormMeta"'));
ok('bảng user có filter role/status', html.includes('id="userRoleFilter"') && html.includes('id="userStatusFilter"'));
ok('editUser chỉ nhận id (không nhúng chuỗi username vào onclick)',
  /onclick="editUser\(\$\{u\.id\}\)"/.test(adminJs));
ok('saveUser gọi /api/admin/users', /\/api\/admin\/users/.test(adminJs));
ok('admin.js có closeUserModal + load chi tiết user', /function closeUserModal\(/.test(adminJs)
  && /\/api\/admin\/users\/' \+ encodeURIComponent\(id\)/.test(adminJs));

console.log('\n== Cân bằng thẻ ==');
const openDiv = (html.match(/<div\b/g) || []).length;
const closeDiv = (html.match(/<\/div>/g) || []).length;
ok('<div> mở = đóng', openDiv === closeDiv, { openDiv, closeDiv });
const openTbl = (html.match(/<table\b/g) || []).length;
const closeTbl = (html.match(/<\/table>/g) || []).length;
ok('<table> mở = đóng', openTbl === closeTbl, { openTbl, closeTbl });
const openSel = (html.match(/<select\b/g) || []).length;
const closeSel = (html.match(/<\/select>/g) || []).length;
ok('<select> mở = đóng', openSel === closeSel, { openSel, closeSel });

console.log('\n== Encoding ==');
ok('không có dấu hiệu double-encoding (Ã/Â/Ä)', !/[ÃÂÄ]/.test(html));
ok('tiếng Việt còn nguyên (Điểm tra cứu)', html.includes('Điểm tra cứu'));
ok('tiếng Việt còn nguyên (Cấu hình)', html.includes('Cấu hình'));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
