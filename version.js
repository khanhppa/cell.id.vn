/**
 * Quản lý phiên bản — nguồn sự thật là `package.json` (số version) và
 * `CHANGELOG.md` (lịch sử), đọc 1 lần lúc start rồi cache trong RAM.
 *
 * Không có bảng DB, không có UI ghi: đổi version = sửa file + restart server.
 * API `/api/version` và `/api/version/changelog` là công khai (kể cả khách).
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
 * Parse CHANGELOG.md (Keep a Changelog).
 * Chỉ lấy mục có dạng `## [x.y.z] - YYYY-MM-DD`; mục không có số version bị bỏ.
 * @param {string} markdown
 * @returns {Array<{version:string, date:string, sections:Array<{title:string, items:string[]}>}>}
 */
function parseChangelog(markdown) {
  const out = [];
  if (!markdown) return out;

  let current = null;
  let section = null;

  for (const rawLine of String(markdown).split(/\r?\n/)) {
    const line = rawLine.trimEnd();

    const verMatch = /^##\s*\[(.+?)\]\s*(?:-\s*(.+?))?\s*$/.exec(line);
    if (verMatch) {
      current = { version: verMatch[1].trim(), date: (verMatch[2] || '').trim(), sections: [] };
      section = null;
      out.push(current);
      continue;
    }

    // Heading cấp 2 không phải version (vd `## Changelog`) → đóng mục hiện tại.
    if (/^##\s+/.test(line)) { current = null; section = null; continue; }
    if (!current) continue;

    const secMatch = /^###\s+(.+?)\s*$/.exec(line);
    if (secMatch) {
      section = { title: secMatch[1].trim(), items: [] };
      current.sections.push(section);
      continue;
    }

    const itemMatch = /^[-*]\s+(.+?)\s*$/.exec(line);
    if (itemMatch && section) section.items.push(itemMatch[1].trim());
  }

  return out;
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

/** Nạp (hoặc nạp lại) package.json + CHANGELOG.md vào cache. */
function load({ force = false } = {}) {
  if (cache && !force) return cache;
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
