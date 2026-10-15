/**
 * Test cho 2.6.4: nén popup đăng nhập/đăng ký (public/auth-popup.js).
 * Bỏ <label class="ap-label"> trùng placeholder -> dùng placeholder + icon SVG
 * (aria-label/title giữ accessibility). Form gọn để không sinh scrollbar.
 * Chạy: node _authpopup.test.js
 *
 * Kiểm tra tĩnh (regex) trên public/auth-popup.js — không cần browser/server.
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'public', 'auth-popup.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`); }
}
const count = (re) => (src.match(re) || []).length;

// === 1. Bỏ nhãn trên (label) — nhãn đã gộp vào placeholder ===
console.log('\n== 1. Không còn <label class="ap-label"> trong markup ==');
ok('markup KHÔNG còn class="ap-label"',
  !/class="ap-label"/.test(src));
ok('KHÔNG còn chuỗi ghép thẻ <label class="ap-label">',
  !/<label class="ap-label">/.test(src));

// === 2. Field = wrapper .ap-iw + icon .ap-ic ===
console.log('\n== 2. Wrapper .ap-iw + icon .ap-ic ==');
ok('có CSS .ap-iw{position:relative',
  /\.ap-iw\{position:relative/.test(src));
ok('có CSS .ap-ic{position:absolute',
  /\.ap-ic\{position:absolute/.test(src));
ok('có quy tắc chừa lề trái cho input có icon (.ap-iw .ap-input)',
  /\.ap-iw \.ap-input\{padding-left:36px\}/.test(src));
ok('helper ic(name) định nghĩa',
  /function ic\(name\)\s*\{/.test(src));
ok('helper field(iconName, inputHtml) định nghĩa',
  /function field\(iconName, inputHtml\)\s*\{/.test(src));
ok('field() bọc .ap-iw + ic() + input',
  /'<div class="ap-iw">' \+ ic\(iconName\) \+ inputHtml \+ '<\/div>'/.test(src));

// === 3. Icon map: đủ 5 khoá dùng cho 11 field ===
console.log('\n== 3. ICON map (SVG inline) ==');
['user', 'mail', 'lock', 'shield', 'key'].forEach((k) => {
  ok(`ICON.${k} tồn tại`, new RegExp('\\b' + k + ":\\s*'<svg").test(src));
});
ok('SVG dùng stroke="currentColor" (theo theme)',
  /stroke="currentColor"/.test(src));
ok('SVG icon dài 17px qua CSS .ap-ic svg',
  /\.ap-ic svg\{width:17px;height:17px/.test(src));
ok('có >= 5 thẻ <svg (mỗi icon 1 thẻ)',
  count(/<svg /g) >= 5, count(/<svg /g));

// === 4. Số field có icon bọc .ap-iw == 11 (5 view) ===
console.log('\n== 4. Đủ 11 field có icon ==');
// Số lời gọi field() trong mã nguồn: login 2 (user,pass) + register 4
// (user,email,pass,pass2) + captchaField 1 (shield) + verify 1 (key) +
// forgot 1 (email) + reset 3 (email,key,pass) = 12. captchaField() được gọi
// ở cả register lẫn forgot -> tổng field hiển thị = 2+4+1+1+1+1+3 = 13.
const fieldCalls = count(/field\('/g);
ok('có đúng 12 lời gọi field( trong mã nguồn',
  fieldCalls === 12, fieldCalls);
ok('captchaField() dùng field(\'shield\'',
  /field\('shield'/.test(src));
ok('registerHtml chứa 4 field riêng + captchaField()',
  /function registerHtml\(\)[\s\S]*?field\('user'[\s\S]*?field\('mail'[\s\S]*?field\('lock'[\s\S]*?field\('lock'[\s\S]*?captchaField\(\)/.test(src));
ok('resetHtml chứa 3 field (mail + key + lock)',
  /function resetHtml\(\)[\s\S]*?field\('mail'[\s\S]*?field\('key'[\s\S]*?field\('lock'/.test(src));

// === 5. Accessibility: aria-label + title cho mọi input ===
console.log('\n== 5. aria-label/title giữ accessibility ==');
const ariaCount = count(/aria-label="/g);
const titleCount = count(/title="/g);
ok('>= 11 aria-label (1 mỗi input)', ariaCount >= 11, ariaCount);
ok('>= 11 title (1 mỗi input)', titleCount >= 11, titleCount);
ok('id input vẫn nguyên: apUser/apEmail/apPass/apPass2/apCode/apCaptcha',
  ['apUser', 'apEmail', 'apPass', 'apPass2', 'apCode', 'apCaptcha']
    .every((id) => new RegExp('id="' + id + '"').test(src)));

// === 6. Nén CSS để không sinh scrollbar ===
console.log('\n== 6. Nén chiều cao (bỏ scrollbar) ==');
ok('padding box gọn 18px 22px 20px',
  /padding:18px 22px 20px/.test(src));
ok('.ap-field margin-bottom gọn 9px (từ 12px)',
  /\.ap-field\{margin-bottom:9px\}/.test(src));
ok('.ap-input padding gọn 9px 11px (từ 10px 12px)',
  /\.ap-input\{[^}]*padding:9px 11px/.test(src));
ok('.ap-msg:empty ẩn -> không chiếm chỗ',
  /\.ap-msg:empty\{display:none\}/.test(src));
ok('#apBody KHÔNG còn margin âm/padding-right gây gutter',
  !/margin:0 -8px 0 0;padding-right:8px/.test(src));
ok('scrollbar ẩn mặc định, chỉ hiện khi hover (#apBody:hover)',
  /#apBody:hover::-webkit-scrollbar-thumb\{background:/.test(src));
ok('#apBody::-webkit-scrollbar-thumb mặc định transparent',
  /#apBody::-webkit-scrollbar-thumb\{background:transparent/.test(src));

// === 7. Hành vi không đổi: các id/handler quan trọng còn nguyên ===
console.log('\n== 7. Không phá vỡ hành vi ==');
['AuthPopup.submitLogin()', 'AuthPopup.submitRegister()', 'AuthPopup.submitVerify()',
 'AuthPopup.submitForgot()', 'AuthPopup.submitReset()', 'AuthPopup.resend()',
 'AuthPopup.refreshCaptcha()'].forEach((h) => {
  ok(`handler ${h} còn`, src.includes('onclick="' + h + '"'));
});
ok('canvas captcha id/width/height giữ nguyên',
  /id="apCaptchaCanvas" width="118" height="42"/.test(src));
ok('checkbox điều khoản giữ nguyên',
  /id="apTerms"/.test(src) && /href="\/terms\.html"/.test(src));
ok('link điều khoản mở popup tại chỗ (không target=_blank)',
  /AuthPopup\.view\(\\'terms\\'\);return false;/.test(src) && !/href="\/terms\.html" target="_blank"/.test(src));
ok('có view "terms" trong render()',
  /state\.view === 'terms'\) body\.innerHTML = termsHtml\(\)/.test(src));
ok('termsHtml() + loadTerms() định nghĩa',
  /function termsHtml\(\)\s*\{/.test(src) && /function loadTerms\(\)\s*\{/.test(src));
ok('loadTerms nạp /terms.html và trích #termsCard',
  /fetch\('\/terms\.html'\)/.test(src) && /id="termsCard"/.test(src));
ok('i18n có termsTitle + termsBack (vi/en)',
  count(/termsTitle:/g) === 2 && count(/termsBack:/g) === 2);
ok('CSS .ap-terms dùng biến theme (sáng/tối)',
  /\.ap-terms h2\{[^}]*var\(--border-focus/.test(src) && /\.ap-terms\{[^}]*var\(--text-secondary/.test(src));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
