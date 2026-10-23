/**
 * _pwatest.js (TẠM THỜI) — kiểm tra PWA thật bằng Chrome headless + CDP.
 *
 * Cách ly khỏi server đang phục vụ người dùng: chạy MỘT instance riêng ở cổng
 * 3001 rồi TẮT nó để mô phỏng mất mạng thật (chặn URL bằng CDP không đủ tin cậy
 * vì nó can thiệp trước cả service worker).
 *
 *   1. Manifest đọc được, không lỗi
 *   2. Không có lỗi installability (Chrome cho phép cài)
 *   3. SW đăng ký/activated, scope /m/, precache đủ app shell
 *   4. Sau khi TẮT server: mở /m/ vẫn hiện UI (từ cache)
 *   5. Sau khi TẮT server: /m/offline.html render được từ cache
 *   6. Không cache bất kỳ response /api/ nào
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean);
const CHROME = CHROME_CANDIDATES.find((p) => { try { return fs.existsSync(p); } catch (e) { return false; } });
if (!CHROME) {
  console.log('SKIP: không tìm thấy Chrome/Edge. Đặt biến môi trường CHROME_PATH để chạy test PWA.');
  process.exit(0);
}
const CDP_PORT = 9335;
const APP_PORT = 3001;
const ORIGIN = 'http://localhost:' + APP_PORT;
const PROFILE = path.join(os.tmpdir(), 'mobprof-pwa-' + Date.now());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; failures.push(name); console.log('  FAIL  ' + name + (extra !== undefined ? ' -> ' + JSON.stringify(extra).slice(0, 400) : '')); }
}

async function waitHttp(url, tries, label) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.status < 500) return true; } catch (e) {}
    await sleep(300);
  }
  throw new Error('Không chờ được ' + label);
}

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id); this.pending.delete(msg.id);
        msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
      }
    });
  }
  send(method, params) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('timeout ' + method)); } }, 30000);
    });
  }
}

(async () => {
  // Server tạm ở cổng riêng (cùng mã nguồn, cùng DB — chỉ đọc trong test này).
  const server = spawn(process.execPath, ['server.js'], {
    cwd: __dirname, env: { ...process.env, PORT: String(APP_PORT) }, stdio: 'ignore'
  });
  await waitHttp(ORIGIN + '/m/', 80, 'server tạm :' + APP_PORT);

  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + PROFILE, 'about:blank'
  ], { stdio: 'ignore' });

  try {
    await waitHttp('http://127.0.0.1:' + CDP_PORT + '/json/version', 60, 'chrome');
    const t = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' })).json();
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
    const cdp = new CDP(ws);

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

    const evalJs = async (expr) => {
      const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300));
      return r.result.value;
    };

    console.log('\n== 1. Manifest');
    await cdp.send('Page.navigate', { url: ORIGIN + '/m/' });
    await sleep(2500);
    const man = await cdp.send('Page.getAppManifest');
    ok('trình duyệt đọc được manifest', !!man.url && man.url.indexOf('manifest.webmanifest') >= 0, man.url);
    ok('manifest không có lỗi parse', !man.errors || man.errors.length === 0, man.errors);
    const parsed = JSON.parse(man.data || '{}');
    ok('start_url = /m/', parsed.start_url === '/m/', parsed.start_url);
    ok('display standalone', parsed.display === 'standalone', parsed.display);

    console.log('\n== 2. Khả cài đặt (installability)');
    const errs = await cdp.send('Page.getInstallabilityErrors');
    ok('không có lỗi installability (Chrome cho phép cài)',
      !errs.installabilityErrors || errs.installabilityErrors.length === 0, errs.installabilityErrors);

    console.log('\n== 3. Service worker + precache');
    await cdp.send('Page.navigate', { url: ORIGIN + '/m/' });
    await sleep(2000);
    const swState = await evalJs(`(async () => {
      if (!('serviceWorker' in navigator)) return { supported: false };
      const regs = await navigator.serviceWorker.getRegistrations();
      return {
        supported: true, count: regs.length,
        scope: regs[0] && regs[0].scope,
        active: !!(regs[0] && regs[0].active),
        controller: !!navigator.serviceWorker.controller
      };
    })()`);
    ok('có registration SW', swState.count >= 1, swState);
    ok('scope là /m/', swState.scope === ORIGIN + '/m/', swState.scope);
    ok('SW đã activated', swState.active === true, swState);
    ok('trang đang được SW điều khiển', swState.controller === true, swState);

    const cached = await evalJs(`(async () => {
      const names = await caches.keys();
      const name = names.find((k) => k.indexOf('cell-m-') === 0);
      if (!name) return [];
      const c = await caches.open(name);
      return (await c.keys()).map((r) => new URL(r.url).pathname);
    })()`);
    ok('có cache cell-m-*', Array.isArray(cached) && cached.length > 0, cached);
    ok('precache có app shell /m/', cached.indexOf('/m/') >= 0, cached);
    ok('precache có app.js + app.css',
      cached.indexOf('/m/app.js') >= 0 && cached.indexOf('/m/app.css') >= 0, cached);
    ok('precache có offline.html', cached.indexOf('/m/offline.html') >= 0, cached);
    ok('precache có /auth.js', cached.indexOf('/auth.js') >= 0, cached);

    console.log('\n== 4. TẮT server tạm → mô phỏng mất mạng thật');
    server.kill();
    await sleep(1200);
    let down = false;
    try { await fetch(ORIGIN + '/m/'); } catch (e) { down = true; }
    ok('server tạm đã tắt (mất mạng)', down === true);

    await cdp.send('Page.navigate', { url: ORIGIN + '/m/' });
    await sleep(2500);
    const offlineUi = await evalJs(`(() => {
      const auth = document.getElementById('authScreen');
      const app = document.getElementById('appScreen');
      return {
        title: document.title,
        hasForm: !!document.getElementById('mLoginForm'),
        hasAppJs: typeof window.mTab,
        visible: (auth && !auth.hidden) || (app && !app.hidden)
      };
    })()`);
    ok('OFFLINE vẫn hiện UI đăng nhập (từ cache, không phải trang lỗi)',
      offlineUi.hasForm && offlineUi.hasAppJs === 'function' && offlineUi.visible, offlineUi);

    console.log('\n== 5. Offline: trang offline.html từ cache');
    await cdp.send('Page.navigate', { url: ORIGIN + '/m/offline.html' });
    await sleep(1800);
    const offPage = await evalJs(`(() => ({ title: document.title, txt: (document.body && document.body.innerText || '').slice(0, 140) }))()`);
    ok('trang offline.html hiện thông báo mất mạng',
      /Mất kết nối|Không có kết nối/.test(offPage.title + ' ' + offPage.txt), offPage);

    console.log('\n== 6. Không cache dữ liệu API');
    const apiCached = await evalJs(`(async () => {
      const names = await caches.keys();
      let hits = [];
      for (const n of names) {
        const c = await caches.open(n);
        hits = hits.concat((await c.keys()).map((r) => new URL(r.url).pathname).filter((p) => p.indexOf('/api/') === 0));
      }
      return hits;
    })()`);
    ok('không có response /api/ nào bị cache', Array.isArray(apiCached) && apiCached.length === 0, apiCached);

    console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
    if (fail) { console.log('Thất bại:'); failures.forEach((f) => console.log('  - ' + f)); }
    ws.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
    try { server.kill(); } catch (e) {}
    try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}
  }
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('LỖI:', e && e.stack || e); process.exit(1); });
