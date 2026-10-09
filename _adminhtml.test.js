/**
 * Harness cấu trúc DOM cho public/admin.html (không cần jsdom).
 * Chạy: node _adminhtml.test.js
 *
 * Kiểm tra:
 *  - Sidebar đúng 4 mục: dashboard, cells, users, settings (đã gộp credits + celldb).
 *  - Mỗi `id="section-X"` khớp với 1 mục sidebar; không còn section mồ côi.
 *  - Các phần tử credits nằm BÊN TRONG #section-users, phần tử CSDL cells nằm
 *    BÊN TRONG #section-cells (không còn top-level rời).
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

console.log('== Sidebar ==');
const sidebarBlock = html.slice(html.indexOf('<div class="sidebar">'), html.indexOf('<div class="content">'));
const sections = [...sidebarBlock.matchAll(/data-section="([^"]+)"/g)].map(m => m[1]);
ok('sidebar có đúng 4 mục', sections.length === 4, sections);
ok('thứ tự: dashboard, cells, users, settings',
  JSON.stringify(sections) === JSON.stringify(['dashboard', 'cells', 'users', 'settings']), sections);
ok('nav tới cells gọi switchSection(\'cells\')', /data-section="cells"\s+onclick="switchSection\('cells'\)"/.test(sidebarBlock));
ok('nav tới users gọi switchSection(\'users\')', /data-section="users"\s+onclick="switchSection\('users'\)"/.test(sidebarBlock));

console.log('\n== Section ↔ nav khớp ==');
const secIds = [...html.matchAll(/id="section-([a-z]+)"/g)].map(m => m[1]);
ok('không còn section-credits', !secIds.includes('credits'), secIds);
ok('không còn section-celldb', !secIds.includes('celldb'), secIds);
ok('có section-cells', secIds.includes('cells'), secIds);
ok('có section-users', secIds.includes('users'), secIds);
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
const usersSec = sliceSection('users');
const cellsSec = sliceSection('cells');

console.log('\n== Gộp credits vào section-users ==');
ok('creditUserFilter trong section-users', usersSec.includes('id="creditUserFilter"'));
ok('KHÔNG còn bảng creditUsersBody (đã gộp)', !usersSec.includes('id="creditUsersBody"'));
ok('creditTxBody trong section-users', usersSec.includes('id="creditTxBody"'));
ok('btnReconcile trong section-users', usersSec.includes('id="btnReconcile"'));
ok('userTableBody vẫn trong section-users', usersSec.includes('id="userTableBody"'));
ok('section-users chỉ còn 1 bảng user', (usersSec.match(/id="userTableBody"/g) || []).length === 1);
ok('section-users còn bảng lịch sử giao dịch', /Lịch sử giao dịch/.test(usersSec));
ok('bảng gộp có 8 cột', (usersSec.match(/<th\b/g) || []).length - 6 === 8, (usersSec.match(/<th\b/g) || []).length);
ok('bảng user có cột Số dư', /Số dư<\/th>/.test(usersSec));
ok('bảng user có cột Đã dùng', /Đã dùng<\/th>/.test(usersSec));
ok('bảng user có cột Trạng thái', /Trạng thái<\/th>/.test(usersSec));
ok('bảng user có cột Ngày tạo', /Ngày tạo<\/th>/.test(usersSec));
ok('filter trỏ renderUsersTable()', /oninput="renderUsersTable\(\)"/.test(usersSec));
ok('filter admin_adjust đổi nhãn "Khởi tạo user"', /value="admin_adjust">Khởi tạo user/.test(usersSec));

console.log('\n== Gộp CSDL cells vào section-cells ==');
ok('cdbBody trong section-cells', cellsSec.includes('id="cdbBody"'));
ok('cdbAuditBody trong section-cells', cellsSec.includes('id="cdbAuditBody"'));
ok('cdbQ trong section-cells', cellsSec.includes('id="cdbQ"'));
ok('cdbSelAll trong section-cells', cellsSec.includes('id="cdbSelAll"'));
ok('nút sub-page Nguồn Online vẫn còn', cellsSec.includes('showSourcePage()'));

console.log('\n== goBackToCells trỏ đúng section đã gộp ==');
const adminJs = fs.readFileSync(path.join(__dirname, 'public', 'admin.js'), 'utf8');
ok('goBackToCells dùng section-cells',
  /function goBackToCells\(\)[\s\S]{0,300}getElementById\('section-cells'\)/.test(adminJs));
ok('goBackToCells vẫn chọn sidebar data-section="cells"',
  /function goBackToCells\(\)[\s\S]{0,400}data-section="cells"/.test(adminJs));

console.log('\n== admin.js gộp bảng user ==');
ok('có renderUsersTable', /function renderUsersTable\(\)/.test(adminJs));
ok('KHÔNG còn loadUsers', !/function loadUsers\(/.test(adminJs));
ok('KHÔNG còn renderCreditUsers', !/function renderCreditUsers\(/.test(adminJs));
ok('KHÔNG còn creditUsersBody trong JS', !/creditUsersBody/.test(adminJs));
ok('KHÔNG còn gọi loadUsers()', !/\bloadUsers\(\)/.test(adminJs));
ok('loadCreditUsers render vào userTableBody', /function loadCreditUsers\(\)[\s\S]{0,400}userTableBody/.test(adminJs));
ok('renderUsersTable render vào userTableBody', /function renderUsersTable\(\)[\s\S]{0,200}userTableBody/.test(adminJs));
ok('renderUsersTable có nút Nạp điểm', /function renderUsersTable\(\)[\s\S]{0,2600}openCreditModal/.test(adminJs));
ok('renderUsersTable có nút Sửa user', /function renderUsersTable\(\)[\s\S]{0,2600}editUser\(/.test(adminJs));
ok('renderUsersTable có nút Xoá user', /function renderUsersTable\(\)[\s\S]{0,2600}deleteUser\(/.test(adminJs));
ok('switchSection users KHÔNG còn loadUsers', /name === 'users'\)\s*\{[^}]*loadCreditUsers\(\)[^}]*loadCreditTx\(\)/.test(adminJs));

console.log('\n== Modal ==');
ok('có creditModal', html.includes('id="creditModal"'));
ok('creditModal không còn mode ẩn phụ thuộc adjust', !/id="creditMode"/.test(html));
ok('creditModal có nút submitCreditModal', /onclick="submitCreditModal\(\)"/.test(html));
ok('có cdbEditModal', html.includes('id="cdbEditModal"'));
ok('KHÔNG còn userFormCredit', !/id="userFormCredit"/.test(html));
ok('KHÔNG còn userCreditGroup', !/id="userCreditGroup"/.test(html));

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
