/**
 * Test quản lý phiên bản: version.js (parser + cache) và wiring (route API, UI).
 * Chạy: node _version.test.js
 *
 * Thuần đọc file + package.json + CHANGELOG.md thật, không đụng DB.
 */
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`); }
}
function eq(name, actual, expected) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });
}

const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

console.log('\n== package.json ==');
const pkg = JSON.parse(read('package.json'));
ok('có trường version', typeof pkg.version === 'string' && pkg.version.length > 0, pkg.version);
ok('version đúng SemVer x.y.z', /^\d+\.\d+\.\d+$/.test(pkg.version), pkg.version);
ok('có trường name', !!pkg.name, pkg.name);

console.log('\n== CHANGELOG.md ==');
const changelogMd = read('CHANGELOG.md');
ok('file tồn tại và không rỗng', changelogMd.length > 0);
ok('mọi heading release đúng dạng ## [x.y.z] - YYYY-MM-DD (hoặc [Unreleased])',
  [...changelogMd.matchAll(/^##\s+/gm)].every(m => {
    const head = changelogMd.slice(m.index, changelogMd.indexOf('\n', m.index));
    return /##\s*\[Unreleased\]/i.test(head)
      || /##\s*\[[\d.]+\]\s*-\s*\d{4}-\d{2}-\d{2}/.test(head);
  }));
ok('mục mới nhất khớp package.json version', changelogMd.includes(`## [${pkg.version}]`), pkg.version);

console.log('\n== version.js: parseChangelog ==');
const version = require('./version');

// Parser thuần — test bằng markdown dựng sẵn (không phụ thuộc nội dung thật).
const sample = [
  '# Changelog',
  'Giới thiệu chung.',
  '',
  '## [2.1.0] - 2026-12-01',
  '### Added',
  '- Mục A',
  '- Mục B',
  '### Fixed',
  '- Mục C',
  '',
  '## [2.0.0] - 2026-10-09',
  '### Added',
  '- Mục D',
  '',
  '## Không có version'
].join('\n');
const parsed = version.parseChangelog(sample);
eq('parse 2 mục có version', parsed.map(p => p.version), ['2.1.0', '2.0.0']);
eq('giữ đúng ngày', parsed[0].date, '2026-12-01');
eq('gom mục theo section', parsed[0].sections.map(s => s.title), ['Added', 'Fixed']);
eq('gom bullet theo section', parsed[0].sections[0].items, ['Mục A', 'Mục B']);
eq('bỏ mục không có số version', parsed.map(p => p.version).includes('Không có version'), false);
eq('markdown rỗng trả []', version.parseChangelog(''), []);
eq('null trả []', version.parseChangelog(null), []);

console.log('\n== version.js: getInfo + cache ==');
const info = version.getInfo();
eq('version khớp package.json', info.version, pkg.version);
ok('latest = version', info.latest === info.version, info);
ok('buildDate dạng YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(info.buildDate), info.buildDate);
ok('nodeVersion có tiền tố v', /^v\d+\./.test(info.nodeVersion), info.nodeVersion);
ok('changelogCount >= 1', info.changelogCount >= 1, info.changelogCount);
ok('KHÔNG lộ đường dẫn file trong payload', !JSON.stringify(info).includes(__dirname), info);
ok('getInfo() luôn trả object mới (tránh client sửa cache)', version.getInfo() !== info);
ok('cache nội bộ: load() lần 2 trả cùng object', version.load() === version.load());
eq('dữ liệu 2 lần gọi giống nhau', version.getInfo(), info);
ok('reload() đọc lại từ đĩa và giữ đúng version', version.reload().version === pkg.version);
eq('nội dung sau reload không đổi', version.getInfo().version, info.version);
ok('getChangelog() luôn là mảng', Array.isArray(version.getChangelog()));
ok('changelog thật parse được ít nhất 1 mục', version.getChangelog().length >= 1);

console.log('\n== Wiring server.js ==');
const server = read('server.js');
ok('require ./version', /require\(['"]\.\/version['"]\)/.test(server));
ok('route GET /api/version', /app\.get\(['"]\/api\/version['"]/.test(server));
ok('route GET /api/version/changelog', /app\.get\(['"]\/api\/version\/changelog['"]/.test(server));
ok('/api/version GIỮ công khai (panel foot cần)',
  /app\.get\(['"]\/api\/version['"],\s*\(req, res\)/.test(server));
ok('/api/version/changelog CHỈ admin',
  /app\.get\(['"]\/api\/version\/changelog['"],\s*requireAuth,\s*requireAdmin/.test(server));

console.log('\n== Wiring frontend ==');
const vjs = read(path.join('public', 'version.js'));
ok('public/version.js có AppVersion', /window\.AppVersion\s*=/.test(vjs));
ok('version.js KHÔNG còn renderBadge', !vjs.includes('renderBadge'));
ok('version.js có renderPanelVersion', vjs.includes('renderPanelVersion'));
ok('renderPanelVersion vẽ #cellPanelVer', /renderPanelVersion[\s\S]{0,600}cellPanelVer/.test(vjs));
ok('renderPanelVersion KHÔNG còn link /version.html (nhãn tĩnh)',
  !/renderPanelVersion[\s\S]{0,1400}setAttribute\('href'/.test(vjs));
ok('renderPanelVersion đặt title "Phiên bản"', /renderPanelVersion[\s\S]{0,600}title\s*=\s*'Phiên bản'/.test(vjs));
ok('version.js gọi /api/version', vjs.includes('/api/version'));
ok('version.js gọi /api/version/changelog', vjs.includes('/api/version/changelog'));

const authjs = read(path.join('public', 'auth.js'));
ok('auth.js KHÔNG còn badge version ở navbar', !authjs.includes('verBadgeCommon'));
ok('auth.js gọi AppVersion.renderPanelVersion', authjs.includes('AppVersion.renderPanelVersion'));
ok('auth.js có link /version.html', authjs.includes('/version.html'));

const versionHtml = read(path.join('public', 'version.html'));
ok('version.html nạp version.js', versionHtml.includes('/version.js'));
ok('version.html có #verList', versionHtml.includes('id="verList"'));
ok('version.html renderChangelog', versionHtml.includes('renderChangelog'));
ok('version.html gate admin (về trang chủ qua Auth.goLogin khi không phải admin)',
  /!Auth\.isLoggedIn\(\) \|\| !Auth\.isAdmin\(\)/.test(versionHtml) && /Auth\.goLogin\(\)/.test(versionHtml));

const adminHtml = read(path.join('public', 'admin.html'));
ok('admin.html có section version', adminHtml.includes('id="section-version"'));
ok('admin.html có #verAdminList', adminHtml.includes('id="verAdminList"'));
const adminJs = read(path.join('public', 'admin.js'));
ok('admin.js render changelog khi mở section version', /version[\s\S]{0,120}renderChangelog\('verAdminList'/.test(adminJs));
ok('admin.js chỉ hiện phiên bản đang chạy (currentOnly)', /renderChangelog\('verAdminList',\s*\{\s*currentOnly:\s*true\s*\}\)/.test(adminJs));
const versionJs = read(path.join('public', 'version.js'));
ok('version.js có lọc currentOnly', /opts\.currentOnly/.test(versionJs));
ok('version.js fallback entry đầu khi không khớp version', /list\.slice\(0,\s*1\)/.test(versionJs));
ok('version.js chip "Đang chạy" khi currentOnly', /currentOnly\s*\?\s*'Đang chạy'/.test(versionJs));

const indexHtml = read(path.join('public', 'index.html'));
ok('index.html có chân panel #cellPanelVer', indexHtml.includes('id="cellPanelVer"'));

for (const page of ['index.html', path.join('tools', 'port-check.html'), path.join('tools', 'ebn-eci.html'), 'credits.html', 'topup.html', 'admin.html']) {
  ok(`${page} nạp version.js`, read(path.join('public', page)).includes('version.js'));
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
