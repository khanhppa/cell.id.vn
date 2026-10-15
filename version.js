/**
 * Quản lý phiên bản — nguồn sự thật là `package.json` (số version) và
 * `CHANGELOG.md` (lịch sử).
 *
 * Không có bảng DB, không có UI ghi: đổi version = sửa file (server tự nạp lại khi
 * mtime file đổi, xem `load()`) — KHÔNG bắt buộc restart.
 * API `/api/version` là công khai; `/api/version/changelog` chỉ admin.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PKG_PATH = path.join(ROOT, 'package.json');
const CHANGELOG_PATH = path.join(ROOT, 'CHANGELOG.md');
const SERVER_PATH = path.join(ROOT, 'server.js');

/** Cache trong RAM — `reload()` để làm mới (dùng cho test / hot reload). */
let cache = null;

/**
 * mtime các file nguồn tại lần nạp gần nhất. Nếu file đổi (sửa CHANGELOG.md khi
 * server đang chạy) thì tự nạp lại — trước đây CHANGELOG chỉ đọc 1 lần lúc start,
 * nên sửa xong mở /version.html vẫn thấy nội dung CŨ tới khi restart server.
 */
let loadedMtime = { changelog: 0, pkg: 0 };

/** mtime (ms) của 1 file, 0 nếu không đọc được. */
function mtimeOf(p) {
  try { return fs.statSync(p).mtimeMs; } catch (e) { return 0; }
}

/**
 * Parse CHANGELOG.md (Keep a Changelog).
 * Chỉ lấy mục có dạng `## [x.y.z] - YYYY-MM-DD`; mục không có số version bị bỏ.
 *
 * Gộp dòng tiếp nối: bullet trong file này hay xuống dòng cho dễ đọc (thụt lề),
 * nên dòng không bắt đầu bằng `-`/`*`/`#` mà nằm NGAY SAU một bullet được nối
 * vào bullet đó. Nhờ vậy nội dung không bị cụt ở dòng đầu như trước.
 *
 * Bullet con (thụt ≥ 2 space, vd `  - Thêm route ...`) của bullet cha được nhận
 * diện bằng thụt lề, gom vào `items[].children` và render thành `<p>` trong `<li>`
 * — không đổ phẳng thành mục cùng cấp (làm sai nghĩa "list con").
 * @param {string} markdown
 * @returns {Array<{version:string, date:string, sections:Array<{title:string, items:Array<string|{text:string, children:string[]}>}>}>}
 */
function parseChangelog(markdown) {
  const out = [];
  if (!markdown) return out;

  let current = null;
  let section = null;
  let item = null;          // { text, children: [] }
  let childIdx = -1;        // index dòng con đang gộp trong item.children (-1 = không có)
  let itemIndent = 0;       // thụt lề của bullet cha

  const indentOf = (line) => (/^(\s*)/.exec(line) || ['', ''])[1].length;

  for (const rawLine of String(markdown).split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const indent = indentOf(line);
    const body = line.slice(indent);

    const verMatch = /^##\s*\[(.+?)\]\s*(?:-\s*(.+?))?\s*$/.exec(line);
    if (verMatch) {
      current = { version: verMatch[1].trim(), date: (verMatch[2] || '').trim(), sections: [] };
      section = null; item = null; childIdx = -1; itemIndent = 0;
      out.push(current);
      continue;
    }

    // Heading cấp 2 không phải version (vd `## Changelog`) → đóng mục hiện tại.
    if (/^##\s+/.test(line)) { current = null; section = null; item = null; childIdx = -1; continue; }
    if (!current) continue;

    const secMatch = indent === 0 && /^###\s+(.+?)\s*$/.exec(line);
    if (secMatch) {
      section = { title: secMatch[1].trim(), items: [] };
      current.sections.push(section);
      item = null; childIdx = -1; itemIndent = 0;
      continue;
    }

    if (!section) continue;

    // Bullet CÙNG CẤP với bullet cha → mục mới.
    if (/^[-*]\s+/.test(body) && indent <= itemIndent) {
      item = { text: body.replace(/^[-*]\s+/, '').trim(), children: [] };
      childIdx = -1; itemIndent = indent;
      section.items.push(item);
      continue;
    }

    // Bullet CON (thụt sâu hơn) → gom vào children để render thành <p>.
    if (/^[-*]\s+/.test(body) && item) {
      item.children.push(body.replace(/^[-*]\s+/, '').trim());
      childIdx = item.children.length - 1;
      continue;
    }

    // Dòng nối (không phải bullet/heading) → nối vào bullet con cuối, hoặc bullet cha.
    if (body) {
      if (childIdx >= 0) item.children[childIdx] += ' ' + body;
      else if (item) item.text += ' ' + body;
    }
  }

  // Rút gọn: bullet không có con giữ nguyên dạng string (giữ tương thích UI cũ).
  return out.map((e) => ({
    version: e.version,
    date: e.date,
    sections: e.sections.map((s) => ({
      title: s.title,
      items: s.items
        .map((it) => (it.children && it.children.length ? { text: it.text, children: it.children } : it.text))
        .filter((it) => (typeof it === 'string' ? it.length > 0 : it.text.length > 0))
    }))
  }));
}

/** Đọc package.json — ném lỗi rõ ràng nếu file hỏng (fail fast lúc start). */
function readPackage() {
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
  if (!pkg.version) throw new Error('package.json thiếu trường "version"');
  return pkg;
}

/** Ngày build = mtime của server.js, ISO date (YYYY-MM-DD). */
function readBuildDate() {
  try { return new Date(fs.statSync(SERVER_PATH).mtime).toISOString().slice(0, 10); }
  catch (e) { return ''; }
}

function readChangelogFile() {
  try { return fs.readFileSync(CHANGELOG_PATH, 'utf8'); }
  catch (e) { return ''; }
}

/**
 * Nạp (hoặc nạp lại) package.json + CHANGELOG.md vào cache.
 * Tự nạp lại khi mtime của file nguồn thay đổi → sửa CHANGELOG.md khi server đang
 * chạy là thấy ngay ở lần gọi API kế tiếp, KHÔNG cần restart.
 */
function load({ force = false } = {}) {
  const mtime = { changelog: mtimeOf(CHANGELOG_PATH), pkg: mtimeOf(PKG_PATH) };
  const changed = mtime.changelog !== loadedMtime.changelog || mtime.pkg !== loadedMtime.pkg;
  if (cache && !force && !changed) return cache;

  const pkg = readPackage();
  const changelog = parseChangelog(readChangelogFile());
  cache = {
    name: pkg.name || 'cell-tracker',
    title: 'Cell.id.vn',
    description: pkg.description || '',
    version: pkg.version,
    buildDate: readBuildDate(),
    nodeVersion: process.version,
    changelog
  };
  loadedMtime = mtime;
  return cache;
}

/**
 * Thông tin phiên bản trả cho client (không lộ đường dẫn file).
 * @returns {{name,title,description,version,buildDate,nodeVersion,latest,changelogCount}}
 */
function getInfo() {
  const info = load();
  return {
    name: info.name,
    title: info.title,
    description: info.description,
    version: info.version,
    buildDate: info.buildDate,
    nodeVersion: info.nodeVersion,
    latest: info.version,
    changelogCount: info.changelog.length
  };
}

/** Lịch sử phiên bản đã parse (mới nhất trước). */
function getChangelog() {
  return load().changelog;
}

/** Xoá cache — buộc lần gọi sau đọc lại từ đĩa. Dùng cho test. */
function reload() {
  cache = null;
  return load({ force: true });
}

module.exports = { parseChangelog, load, getInfo, getChangelog, reload };
