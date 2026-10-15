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

console.log('\n== package-lock.json ==');
// Version trong lockfile hay bị bỏ quên khi bump → khoá lại để không trôi.
const lock = JSON.parse(read('package-lock.json'));
ok('lockfile version (root) khớp package.json', lock.version === pkg.version,
  { lock: lock.version, pkg: pkg.version });
ok('lockfile packages[""] version khớp package.json',
  lock.packages && lock.packages[''] && lock.packages[''].version === pkg.version,
  lock.packages && lock.packages[''] && lock.packages[''].version);

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

// Dòng tiếp nối (bullet xuống dòng cho dễ đọc) phải được GỘP, không cắt cụt.
const wrapped = [
  '## [9.9.9] - 2026-12-31',
  '### Fixed',
  '- **Lỗi dài** mô tả trên nhiều dòng',
  '  nên dòng này phải nối vào bullet trên.',
  '  Và cả dòng này nữa.',
  '- Mục ngắn',
  '### Changed',
  '- Mục có con:',
  '  - Con 1',
  '  - Con 2 nối',
  '    tiếp dòng.',
  '- Mục ngắn 2'
].join('\n');
const wr = version.parseChangelog(wrapped);
eq('gộp dòng nối vào bullet (không cắt cụt)',
  wr[0].sections[0].items[0],
  '**Lỗi dài** mô tả trên nhiều dòng nên dòng này phải nối vào bullet trên. Và cả dòng này nữa.');
eq('bullet ngắn không bị dính vào bullet trước', wr[0].sections[0].items[1], 'Mục ngắn');
eq('bullet con gom vào children của bullet cha',
  wr[0].sections[1].items[0],
  { text: 'Mục có con:', children: ['Con 1', 'Con 2 nối tiếp dòng.'] });
eq('bullet ngắn sau bullet có con vẫn là mục cùng cấp',
  wr[0].sections[1].items[1], 'Mục ngắn 2');
ok('entry thật 2.6.0 có nội dung đầy đủ (bullet Fixed > 100 ký tự, không cụt)',
  (() => {
    const e = version.getChangelog().find(x => x.version === '2.6.0');
    if (!e) return false;
    const fixed = e.sections.find(s => s.title === 'Fixed');
    if (!fixed) return false;
    const first = fixed.items[0];
    const text = typeof first === 'string' ? first : first.text;
    return text.length > 100;
  })());

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

console.log('\n== Chống cache changelog (2.6.2) ==');
const versionSrc = read('version.js');
ok('load() so mtime file nguồn (tự nạp lại khi CHANGELOG.md đổi)',
  /loadedMtime/.test(versionSrc) && /mtimeOf/.test(versionSrc)
  && /mtime\.changelog !== loadedMtime\.changelog/.test(versionSrc));
ok('load() có mtimeOf() đọc statSync',
  /function mtimeOf[\s\S]{0,120}statSync/.test(versionSrc));
ok('express.static ép no-cache cho version.js/version.html',
  /ALWAYS_REVALIDATE/.test(server) && /setHeaders/.test(server)
  && /Cache-Control',\s*'no-cache'/.test(server));
ok('ALWAYS_REVALIDATE chỉ khớp version.js / version.html',
  (() => {
    const m = server.match(/const ALWAYS_REVALIDATE = (\/.*?\/);/);
    if (!m) return false;
    const re = eval(m[1]); // eslint-disable-line no-eval
    return re.test('D:\\app\\public\\version.js') && re.test('D:\\app\\public\\version.html')
      && !re.test('D:\\app\\public\\admin.js') && !re.test('D:\\app\\public\\version2.html');
  })());
ok('cả 2 route version trả Cache-Control: no-store',
  (server.match(/Cache-Control',\s*'no-store'/g) || []).length >= 2);

console.log('\n== Wiring frontend ==');
const vjs = read(path.join('public', 'version.js'));
ok('public/version.js có AppVersion', /window\.AppVersion\s*=/.test(vjs));
ok('version.js KHÔNG còn renderBadge', !vjs.includes('renderBadge'));
ok('version.js có renderPanelVersion', vjs.includes('renderPanelVersion'));
ok('renderPanelVersion KHÔNG còn vẽ #cellPanelVer (đã bỏ khỏi UI)',
  !/cellPanelVer/.test(vjs));
ok('renderPanelVersion vẫn vẽ #cellPanelTrial (chỉ khách)',
  /renderPanelVersion[\s\S]{0,400}cellPanelTrial/.test(vjs));
ok('renderPanelVersion KHÔNG còn link /version.html (nhãn tĩnh)',
  !/renderPanelVersion[\s\S]{0,1400}setAttribute\('href'/.test(vjs));
ok('version.js KHÔNG còn nhãn "Build"/title "Phiên bản"',
  !/'Build ' \+/.test(vjs) && !/title\s*=\s*'Phiên bản'/.test(vjs));
ok('version.js gọi /api/version', vjs.includes('/api/version'));
ok('version.js gọi /api/version/changelog', vjs.includes('/api/version/changelog'));
ok('renderChangelog gửi token qua Auth.fetch (route yêu cầu admin)',
  /renderChangelog[\s\S]{0,1200}Auth\.fetch\('\/api\/version\/changelog'\)/.test(vjs));
ok('fetch changelog có gắn token (Auth.fetch là đường mặc định, fetch trần chỉ là fallback)',
  /typeof window\.Auth !== 'undefined' && window\.Auth\.fetch/.test(vjs));
ok('renderChangelog tách lỗi HTTP khỏi "Chưa có lịch sử"',
  /loadError\s*=\s*'HTTP '\s*\+\s*res\.status/.test(vjs)
  && vjs.includes('Không tải được lịch sử phiên bản')
  && vjs.includes('Chưa có lịch sử phiên bản'));

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
ok('index.html KHÔNG còn chân panel #cellPanelVer (đã gỡ)', !indexHtml.includes('id="cellPanelVer"'));
ok('index.html KHÔNG còn #cellPanelVerNote (đã gỡ)', !indexHtml.includes('id="cellPanelVerNote"'));

for (const page of ['index.html', path.join('tools', 'port-check.html'), path.join('tools', 'ebn-eci.html'), 'credits.html', 'topup.html', 'admin.html']) {
  ok(`${page} nạp version.js`, read(path.join('public', page)).includes('version.js'));
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
