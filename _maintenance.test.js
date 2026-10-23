/**
 * Test tính năng bật/đóng website (chế độ bảo trì).
 *
 * Chạy: node _maintenance.test.js
 *
 * Dùng DB tạm + PORT tạm qua _test-server.js (KHÔNG đụng database.sqlite thật).
 * Kiểm tra:
 *  - mặc định website MỞ, API/trang hoạt động như cũ;
 *  - đóng website → status/message, chặn API người thường, chỉ admin đăng nhập;
 *  - message tùy chỉnh (kể cả HTML) được escape ở /maintenance.html;
 *  - /site-status.js sinh đúng trạng thái; mở lại → mọi thứ trở về bình thường;
 *  - cấu trúc UI: tab Website + banner Dashboard + script gate ở các trang.
 */
process.env.AUTH_TEST_NO_RATELIMIT = '1';

const fs = require('fs');
const path = require('path');
const { start } = require('./_test-server');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`); }
}

(async () => {
  const h = await start();
  try {
    // Import sau start() để dùng đúng module đã nạp với DB tạm.
    const siteStatus = require('./site-status');
    const { DEFAULT_MESSAGE } = siteStatus;

    console.log('\n== Mặc định: website MỞ ==');
    let r = await h.req('GET', '/api/site/status');
    ok('GET /api/site/status 200', r.status === 200, r.status);
    ok('status mặc định open:true, closed:false',
      r.body && r.body.open === true && r.body.closed === false, r.body);

    await h.createUser({ username: 'siteadmin', role: 'admin' });
    await h.createUser({ username: 'siteuser', role: 'user' });
    const adminToken = await h.login('siteadmin');
    const userToken = await h.login('siteuser');
    ok('đăng nhập admin + user khi mở', !!adminToken && !!userToken);

    r = await h.req('GET', '/api/lookup-history', undefined, userToken);
    ok('API user hoạt động khi mở', r.status === 200, r.status);

    console.log('\n== Đóng website ==');
    r = await h.req('PUT', '/api/settings', { settings: { site_open: '0', site_closed_message: '' } }, adminToken);
    ok('admin đóng website (PUT /api/settings) 200', r.status === 200, r.body);

    r = await h.req('GET', '/api/site/status');
    ok('status closed:true', r.body && r.body.closed === true, r.body);
    ok('message rỗng → thông báo mặc định', r.body && r.body.message === DEFAULT_MESSAGE, r.body && r.body.message);

    r = await h.req('POST', '/api/login', { username: 'siteuser', password: 'pw12345' });
    ok('user thường đăng nhập → 403 SITE_CLOSED', r.status === 403 && r.body && r.body.reason === 'SITE_CLOSED', r);
    ok('response chặn có header X-Site-Closed', r.headers && r.headers['x-site-closed'] === '1', r.headers);

    r = await h.req('POST', '/api/login', { username: 'siteadmin', password: 'pw12345' });
    ok('admin vẫn đăng nhập được khi đóng', r.status === 200 && !!(r.body && r.body.token), r.body);

    console.log('\n== Gate API ==');
    r = await h.req('GET', '/api/lookup-history', undefined, userToken);
    ok('API user bị chặn khi đóng', r.status === 403 && r.body && r.body.reason === 'SITE_CLOSED', r);
    ok('API bị chặn có header X-Site-Closed', r.headers && r.headers['x-site-closed'] === '1', r.headers);

    r = await h.req('GET', '/api/settings', undefined, adminToken);
    ok('API admin vẫn chạy khi đóng', r.status === 200, r.status);

    const allowed = [
      ['GET', '/api/captcha'],
      ['GET', '/api/version'],
      ['GET', '/api/me', undefined, userToken],
      ['GET', '/api/v1/health'],
      ['POST', '/api/payos/webhook', {}]
    ];
    for (const [method, url, body, token] of allowed) {
      const res = await h.req(method, url, body, token);
      const blocked = res.status === 403 && res.body && res.body.reason === 'SITE_CLOSED';
      ok(`allowlist: ${method} ${url} không bị gate`, !blocked, { status: res.status, body: res.body });
    }

    r = await h.req('GET', '/api/v1/me', undefined, userToken);
    ok('API v1 (trừ health) cũng bị chặn khi đóng',
      r.status === 403 && r.body && r.body.reason === 'SITE_CLOSED', r);

    console.log('\n== Trang bảo trì + message ==');
    const custom = 'Bảo trì nâng cấp <script>alert(1)</script> & thử nghiệm\nDòng thứ hai';
    r = await h.req('PUT', '/api/settings', { settings: { site_open: '0', site_closed_message: custom } }, adminToken);
    ok('lưu message tùy chỉnh 200', r.status === 200, r.body);

    r = await h.req('GET', '/api/site/status');
    ok('message tùy chỉnh được trả nguyên văn', r.body && r.body.message === custom, r.body);

    r = await h.req('GET', '/maintenance.html');
    const page = typeof r.body === 'string' ? r.body : '';
    ok('GET /maintenance.html → 503', r.status === 503, r.status);
    ok('trang bảo trì có nội dung message', page.includes('Bảo trì nâng cấp'), page.slice(0, 120));
    ok('HTML trong message bị escape (không XSS)',
      page.includes('&lt;script&gt;alert(1)&lt;/script&gt;') && !page.includes('<script>alert(1)</script>'));
    ok('trang bảo trì KHÔNG có nút đăng nhập', !page.includes('href="/login.html"'));
    ok('trang bảo trì có nút thử lại', page.includes('href="/"'));
    ok('trang bảo trì no-store', String(r.headers['cache-control'] || '').includes('no-store'));

    r = await h.req('GET', '/maintenance.html?from=login');
    ok('?from=login có ghi chú đã đăng nhập', typeof r.body === 'string' && r.body.includes('đăng nhập thành công'));

    r = await h.req('GET', '/site-status.js');
    const gateJs = typeof r.body === 'string' ? r.body : '';
    ok('GET /site-status.js 200 JS', r.status === 200 && String(r.headers['content-type'] || '').includes('javascript'), r.headers);
    ok('gate JS báo closed:true', gateJs.includes('closed: true'));
    ok('gate JS cho admin đi qua (role === admin)', gateJs.includes("role === 'admin'"));
    ok('gate JS no-store', String(r.headers['cache-control'] || '').includes('no-store'));

    console.log('\n== Mở lại website ==');
    r = await h.req('PUT', '/api/settings', { settings: { site_open: '1' } }, adminToken);
    ok('admin mở lại website 200', r.status === 200, r.body);

    r = await h.req('GET', '/maintenance.html');
    ok('khi mở, /maintenance.html redirect 302 về /',
      r.status === 302 && r.headers.location === '/', { status: r.status, location: r.headers.location });

    r = await h.req('GET', '/api/lookup-history', undefined, userToken);
    ok('API user hoạt động lại sau khi mở', r.status === 200, r.status);

    r = await h.req('GET', '/site-status.js');
    ok('gate JS báo closed:false', typeof r.body === 'string' && r.body.includes('closed: false'));

    console.log('\n== Cấu trúc UI / trang ==');
    const root = __dirname;
    const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
    const adminHtml = read('public/admin.html');
    const adminJs = read('public/admin.js');
    const maintHtml = read('public/maintenance.html');

    ok('admin.html có tab Website', /data-settingstab="site"[\s\S]{0,160}switchSettingsTab\('site'\)/.test(adminHtml));
    ok('admin.html có pane #settingstab-site + field bật/tắt + message',
      /id="settingstab-site"[\s\S]*?id="setSiteOpen"[\s\S]*?id="setSiteClosedMessage"[\s\S]*?\/settingstab-site/.test(adminHtml));
    ok('admin.html có banner Dashboard #dashSiteBanner',
      adminHtml.includes('id="dashSiteBanner"') && adminHtml.includes('id="dashSiteBannerMsg"'));
    ok('admin.js có refreshSiteBanner/openSiteSettings/quickReopenSite',
      /function refreshSiteBanner\(/.test(adminJs)
      && /function openSiteSettings\(/.test(adminJs)
      && /function quickReopenSite\(/.test(adminJs));
    ok('admin.js load/save site_open + site_closed_message',
      /settings\.site_open/.test(adminJs) && /settings\.site_closed_message/.test(adminJs));

    ok('maintenance.html có placeholder {{MESSAGE}} + {{NOTE}}, không nút login, có nút thử lại',
      maintHtml.includes('{{MESSAGE}}') && maintHtml.includes('{{NOTE}}')
      && !maintHtml.includes('href="/login.html"') && maintHtml.includes('href="/"'));

    const loginHtml = read('public/login.html');
    ok('login.html không còn 2 nút mở popup đăng nhập/đăng ký',
      !loginHtml.includes('Mở popup đăng nhập') && !loginHtml.includes('Mở popup đăng ký'));

    const gated = [
      'public/index.html', 'public/m/index.html', 'public/admin.html',
      'public/credits.html', 'public/topup.html', 'public/payment-result.html',
      'public/version.html', 'public/terms.html',
      'public/tools/ebn-eci.html', 'public/tools/ip-lookup.html',
      'public/tools/ip-tracker.html', 'public/tools/port-check.html'
    ];
    const tag = '<script src="/site-status.js"></script>';
    for (const p of gated) {
      const src = read(p);
      const n = src.split(tag).length - 1;
      ok(`${p} có đúng 1 script gate`, n === 1, n);
    }
    for (const p of ['public/login.html', 'public/maintenance.html', 'public/m/offline.html']) {
      const src = read(p);
      ok(`${p} KHÔNG gắn script gate`, !src.includes(tag));
    }
  } finally {
    await h.cleanup();
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
