#!/usr/bin/env node
/**
 * scripts/verify-theme.js — chặn hồi quy "mỗi trang một bảng màu".
 *
 * Vì sao có file này: mọi trang public dùng CHUNG /public/theme.css làm nguồn
 * token màu duy nhất. Nếu một trang tự khai báo lại palette, hoặc dùng token
 * không tồn tại (var() rỗng), giao diện tối sẽ lệch màu/không đọc được nhưng
 * rất khó thấy khi chỉ review code.
 *
 * Kiểm tra:
 *  1. Trang có nạp /theme.css và nạp TRƯỚC <style> đầu tiên.
 *  2. Trang không khai báo lại token của theme.
 *  3. Mọi var(--x) trong trang đều có giá trị (theme / trang / JS gán lúc chạy).
 *  4. Ngoặc nhọn cân bằng trong từng <style> và trong theme.css.
 *  5. Mọi token khai báo ở theme sáng đều có bản tối (trừ alias var() / --map-bg).
 *  6. Đủ bộ token bắt buộc (nền/chữ/viền/nhấn/trạng thái/scrollbar).
 *
 * Chạy: node scripts/verify-theme.js   (hoặc: npm run check:theme)
 * Exit: 0 = đạt, 1 = có lỗi (in rõ trang/token vi phạm).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

const PAGES = [
  'index.html', 'admin.html', 'credits.html', 'topup.html', 'version.html',
  'terms.html', 'payment-result.html', 'tools/port-check.html',
  'tools/ebn-eci.html', 'tools/ip-lookup.html', 'tools/ip-tracker.html',
];

const theme = fs.readFileSync(path.join(PUBLIC, 'theme.css'), 'utf8');
const themeTokens = new Set([...theme.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map(m => m[1]));
// Token do JS gán lúc chạy hoặc do style attribute inline.
const RUNTIME = new Set(['--mc', '--rc', '--toggle-left', '--sidebar-width', '--sidebar-collapsed']);

let fail = 0;
const bad = (msg) => { fail++; console.log('  ✗ ' + msg); };
const ok = (msg) => console.log('  ✓ ' + msg);

function styleBlocks(html) {
  return [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]);
}

for (const rel of PAGES) {
  const file = path.join(PUBLIC, rel);
  const html = fs.readFileSync(file, 'utf8');
  console.log('\n== ' + rel);

  // 1. Link theme.css và phải nằm TRƯỚC <style> đầu tiên.
  const linkPos = html.search(/<link[^>]+href=["']\/theme\.css["']/i);
  const stylePos = html.search(/<style[^>]*>/i);
  if (linkPos < 0) bad('thiếu <link href="/theme.css">');
  else if (stylePos >= 0 && linkPos > stylePos) bad('theme.css nạp SAU <style> (trang sẽ đè token)');
  else ok('nạp /theme.css trước <style>');

  // 2. Không còn palette riêng (khai báo trùng token trong <style> của trang).
  const local = new Set();
  for (const css of styleBlocks(html)) {
    for (const m of css.matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*([^;}]+)/g)) local.add(m[1]);
  }
  const dup = [...local].filter(t => themeTokens.has(t));
  if (dup.length) bad('trang tự khai báo lại token của theme: ' + dup.join(', '));
  else ok('không khai báo lại token theme');

  // 3. Mọi var(--x) phải có nguồn.
  const used = new Set([...html.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)].map(m => m[1]));
  const missing = [...used].filter(t => !themeTokens.has(t) && !local.has(t) && !RUNTIME.has(t));
  if (missing.length) bad('token chưa định nghĩa: ' + missing.join(', '));
  else ok('mọi token dùng trong trang đều có giá trị');

  // 4. Ngoặc nhọn cân bằng trong từng <style>.
  for (const [i, css] of styleBlocks(html).entries()) {
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const open = (stripped.match(/{/g) || []).length;
    const close = (stripped.match(/}/g) || []).length;
    if (open !== close) bad(`style #${i + 1}: { = ${open}, } = ${close}`);
  }
}

// 5. theme.css: cân bằng ngoặc + luôn có bộ token cho cả 2 theme.
console.log('\n== theme.css');
const tStripped = theme.replace(/\/\*[\s\S]*?\*\//g, '');
const tOpen = (tStripped.match(/{/g) || []).length;
const tClose = (tStripped.match(/}/g) || []).length;
if (tOpen !== tClose) { fail++; console.log(`  ✗ { = ${tOpen}, } = ${tClose}`); }
else console.log(`  ✓ ngoặc cân bằng (${tOpen} rule)`);

const lightBlock = theme.split('[data-theme="dark"]')[0];
const darkBlock = theme.split('[data-theme="dark"]')[1] || '';
const lightDecls = new Map([...lightBlock.matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*([^;}]+)/g)].map(m => [m[1], m[2].trim()]));
const darkTokens = new Set([...darkBlock.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map(m => m[1]));
// Ngoại lệ có chủ đích: map luôn sáng; alias `var(...)` tự theo theme; --transition không phải màu.
const DARK_BY_DESIGN = new Set(['--map-bg', '--transition']);
const notOverridden = [...lightDecls]
  .filter(([t, v]) => !darkTokens.has(t) && !DARK_BY_DESIGN.has(t) && !/^var\(--/.test(v))
  .map(([t]) => t);
if (notOverridden.length) { fail++; console.log('  ✗ token chỉ có ở light (sẽ rò màu sáng sang dark): ' + notOverridden.join(', ')); }
else console.log('  ✓ mọi token sáng đều có bản tối (alias var() tự theo theme)');

// 6. Các token quan trọng bắt buộc phải có.
const REQUIRED = ['--bg-body', '--bg-card', '--bg-surface', '--bg-surface2', '--bg-hover',
  '--text-primary', '--text-secondary', '--text-muted', '--text-faint',
  '--border-color', '--border-focus', '--bg-btn-primary', '--accent',
  '--accent-soft', '--accent-line', '--success', '--danger', '--warning',
  '--success-soft', '--success-line', '--danger-soft', '--danger-line',
  '--warning-soft', '--warning-line', '--header-bg', '--shadow', '--scrollbar-thumb'];
const miss = REQUIRED.filter(t => !themeTokens.has(t));
if (miss.length) { fail++; console.log('  ✗ thiếu token bắt buộc: ' + miss.join(', ')); }
else console.log('  ✓ đủ token bắt buộc');

console.log('\n' + (fail ? `THẤT BẠI: ${fail} lỗi` : 'OK: tất cả kiểm tra đều đạt'));
process.exit(fail ? 1 : 0);
