/**
 * _mobileui.test.js — kiểm thử GIAO DIỆN mobile trên nhiều "điện thoại" thật.
 *
 * Cách ly: tự chạy một server riêng ở cổng 3002 (cùng mã nguồn, cùng DB, có dọn
 * dữ liệu) nên KHÔNG đụng server đang phục vụ người dùng ở cổng 3000.
 *
 * Với mỗi cấu hình máy (viewport CSS + deviceScaleFactor + UA + touch):
 *   • không tràn ngang (scrollWidth == clientWidth)
 *   • phần tử chính nằm trong khung nhìn
 *   • input ≥ 16px (iOS không tự zoom khi focus)
 *   • vùng chạm: nút chính ≥ 44px, tab đáy ≥ 56px
 *   • chạm THẬT (Input.dispatchTouchEvent) vào tab / nút để kiểm tra phản hồi
 *   • tra cứu thật → có kết quả, thẻ kết quả không tràn
 *   • lịch sử: thẻ + nút thao tác đủ lớn, không tràn
 *   • xoay ngang (landscape) vẫn dùng được
 *   • chụp ảnh từng máy vào %TEMP%\mobui\<máy>\*.png
 *
 * Chạy: node _mobileui.test.js
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean).find((p) => { try { return fs.existsSync(p); } catch (e) { return false; } });

if (!CHROME) {
  console.log('SKIP: không tìm thấy Chrome/Edge — đặt CHROME_PATH để chạy test giao diện.');
  process.exit(0);
}

const db = require('./database');
const credits = require('./credits');

const CDP_PORT = 9340;
const APP_PORT = 3002;
const ORIGIN = 'http://localhost:' + APP_PORT;
const PROFILE = path.join(os.tmpdir(), 'mobprof-ui-' + Date.now());
const SHOTS = path.join(os.tmpdir(), 'mobui');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Thiết bị: [tên, width, height, dsf, UA, touch]
const DEVICES = [
  ['iPhone-SE', 375, 667, 2, 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1', true],
  ['iPhone-14-Pro', 393, 852, 3, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', true],
  ['Pixel-7', 412, 915, 2.625, 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36', true],
  ['Galaxy-S20', 360, 800, 3, 'Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36', true],
  ['Android-nhỏ-360x640', 360, 640, 2, 'Mozilla/5.0 (Linux; Android 9; Redmi 7A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Mobile Safari/537.36', true],
  ['iPad-mini', 768, 1024, 2, 'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1', true]
];

let pass = 0, fail = 0;
const failures = [];
function ok(dev, name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  [' + dev + '] ' + name); }
  else {
    fail++; failures.push('[' + dev + '] ' + name);
    console.log('  FAIL  [' + dev + '] ' + name + (extra !== undefined ? ' -> ' + JSON.stringify(extra).slice(0, 300) : ''));
  }
}

async function waitHttp(url, tries) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.status < 500) return true; } catch (e) {}
    await sleep(300);
  }
  return false;
}

class Session {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.errors = [];
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const p = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
        return;
      }
      if (m.method === 'Runtime.exceptionThrown') {
        this.errors.push(String((m.params.exceptionDetails && m.params.exceptionDetails.text) || 'exception'));
      }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        this.errors.push((m.params.args || []).map((a) => a.value || a.description || '').join(' '));
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
  async ev(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 240));
    return r.result.value;
  }
  async tap(x, y) {
    await this.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x, y: y, radiusX: 12, radiusY: 12, force: 1 }] });
    await sleep(40);
    await this.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(160);
  }
  /** Chạm vào giữa phần tử (selector) — tự cuộn vào khung nhìn, tránh tabbar che. */
  async tapSel(sel) {
    const box = await this.ev(`(() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return null;
      el.scrollIntoView({ block: 'center', inline: 'center' });
      let r = el.getBoundingClientRect();
      const vh = document.documentElement.clientHeight;
      if (r.width < 1 || r.height < 1) return null;
      // Nếu tâm rơi vào dải tabbar (đáy màn hình) thì cuộn thêm cho thoáng.
      if (r.top + r.height / 2 > vh - 90) {
        window.scrollBy(0, Math.ceil(r.top + r.height / 2 - (vh - 120)));
        r = el.getBoundingClientRect();
      }
      const x = Math.round(r.left + r.width / 2);
      const y = Math.round(r.top + r.height / 2);
      const hit = document.elementFromPoint(x, y);
      return { x: x, y: y, ok: !!(hit && (hit === el || el.contains(hit))) };
    })()`);
    if (!box) return false;
    await sleep(120);
    await this.tap(box.x, box.y);
    return box.ok;
  }
  async shot(file) {
    const r = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    return file;
  }
}

(async () => {
  const server = spawn(process.execPath, ['server.js'], {
    cwd: __dirname, env: { ...process.env, PORT: String(APP_PORT) }, stdio: 'ignore'
  });
  const up = await waitHttp(ORIGIN + '/m/', 80);
  if (!up) { console.error('Không khởi động được server test ở cổng ' + APP_PORT); server.kill(); process.exit(1); }

  // ---- Tài khoản test ----
  const cap = await (await fetch(ORIGIN + '/api/captcha')).json();
  const TS = Date.now();
  const uname = '__mobui_' + TS;
  await fetch(ORIGIN + '/api/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: uname, password: 'MobUi123', email: 'mobui+' + TS + '@example.com', captchaId: cap.id, captcha: cap.text, acceptTerms: true })
  });
  const rows = await new Promise((r) => db.all(
    `SELECT u.id, v.code FROM users u JOIN email_verifications v ON v.user_id = u.id
     WHERE u.username = ? AND v.purpose = 'verify' AND v.used_at IS NULL ORDER BY v.id DESC LIMIT 1`,
    [uname], (e, x) => r(e ? [] : x)));
  if (!rows.length) { console.error('Không tạo được user test'); server.kill(); process.exit(1); }
  const uid = rows[0].id;
  const ver = await (await fetch(ORIGIN + '/api/verify-email', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: uname, code: rows[0].code })
  })).json();
  // Nạp thêm điểm để mỗi máy đều tra cứu được (dọn ở cuối).
  await credits.topUp(uid, 100, { adminId: 1, adminIp: '127.0.0.1', note: 'mobile ui test' });

  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--hide-scrollbars', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + PROFILE, 'about:blank'
  ], { stdio: 'ignore' });

  try {
    if (!(await waitHttp('http://127.0.0.1:' + CDP_PORT + '/json/version', 60))) throw new Error('Chrome không lên');
    const target = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' })).json();
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
    const s = new Session(ws);
    await s.send('Page.enable');
    await s.send('Runtime.enable');
    await s.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

    const seed = `try {
      localStorage.setItem('cell_tracker_token', ${JSON.stringify(ver.token)});
      localStorage.setItem('cell_tracker_user', ${JSON.stringify(JSON.stringify(ver.user))});
      localStorage.setItem('theme', 'dark');
      localStorage.removeItem('m_install_dismissed');
    } catch (e) {}`;
    let seedId = null;

    for (const [name, w, h, dsf, ua, touch] of DEVICES) {
      console.log('\n== ' + name + '  (' + w + '×' + h + ' @' + dsf + 'x' + ')');
      await s.send('Emulation.setDeviceMetricsOverride', {
        width: w, height: h, deviceScaleFactor: dsf, mobile: touch
      });
      await s.send('Emulation.setUserAgentOverride', { userAgent: ua });

      // ---------- Màn đăng nhập (KHÔNG seed token) ----------
      // `addScriptToEvaluateOnNewDocument` áp cho MỌI document sau đó → phải gỡ
      // script của máy trước, nếu không token sẽ được bơm lại và màn auth biến mất.
      if (seedId) { await s.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: seedId }); seedId = null; }
      await s.send('Storage.clearDataForOrigin', { origin: ORIGIN, storageTypes: 'local_storage' });
      await s.send('Page.navigate', { url: ORIGIN + '/m/' });
      await sleep(2000);

      const authLayout = await s.ev(`(() => {
        const de = document.documentElement;
        const vw = de.clientWidth;
        const sel = ['.auth', '.auth-tabs', '#mLoginForm', '#mLoginUser', '#mLoginPass', '#mLoginBtn'];
        const out = { vw, overflowX: de.scrollWidth - vw, boxes: {} };
        for (const q of sel) {
          const el = document.querySelector(q);
          if (!el) { out.boxes[q] = null; continue; }
          const r = el.getBoundingClientRect();
          out.boxes[q] = { l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) };
        }
        const inp = document.getElementById('mLoginUser');
        out.inputFontPx = inp ? parseFloat(getComputedStyle(inp).fontSize) : 0;
        const btn = document.getElementById('mLoginBtn');
        out.btnH = btn ? Math.round(btn.getBoundingClientRect().height) : 0;
        out.btnFits = btn ? (btn.getBoundingClientRect().right <= vw + 0.5 && btn.getBoundingClientRect().left >= -0.5) : false;
        return out;
      })()`);
      ok(name, 'không tràn ngang ở màn đăng nhập', authLayout.overflowX <= 0, authLayout.overflowX);
      ok(name, 'form đăng nhập nằm trong khung nhìn', authLayout.btnFits, authLayout.boxes['#mLoginBtn']);
      ok(name, 'input ≥ 16px (iOS không tự zoom)', authLayout.inputFontPx >= 16, authLayout.inputFontPx);
      ok(name, 'nút đăng nhập cao ≥ 44px', authLayout.btnH >= 44, authLayout.btnH);
      await s.shot(path.join(SHOTS, name, '01-login.png'));

      // Chạm thật vào tab Đăng ký
      const tappedReg = await s.tapSel('.auth-tab:nth-child(2)');
      await sleep(1400);
      const regState = await s.ev(`(() => ({
        visible: !document.getElementById('mRegisterForm').hidden,
        capOk: (() => { const i = document.getElementById('mCapImg'); return !!(i && i.src && i.src.indexOf('data:image/png') === 0 && !i.hidden); })(),
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        capBox: (() => { const el = document.getElementById('mCapBox'); if (!el) return null; const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) }; })()
      }))()`);
      ok(name, 'chạm tab Đăng ký mở đúng form', tappedReg && regState.visible, regState);
      ok(name, 'captcha vẽ ra ảnh', regState.capOk, regState.capOk);
      ok(name, 'ô captcha không tràn ngang', regState.capBox && regState.capBox.right <= w + 0.5, regState.capBox);
      await s.shot(path.join(SHOTS, name, '02-register.png'));

      // ---------- Vào app (seed token rồi tải lại) ----------
      seedId = (await s.send('Page.addScriptToEvaluateOnNewDocument', { source: seed })).identifier;
      await s.send('Page.navigate', { url: ORIGIN + '/m/' });
      await sleep(2300);
      const inApp = await s.ev(`!document.getElementById('appScreen').hidden`);
      ok(name, 'vào được app', inApp === true);
      if (!inApp) { await s.shot(path.join(SHOTS, name, '03-fail.png')); continue; }

      const appLayout = await s.ev(`(() => {
        const de = document.documentElement;
        const vw = de.clientWidth, vh = de.clientHeight;
        const bar = document.querySelector('.tabbar').getBoundingClientRect();
        const tabs = Array.from(document.querySelectorAll('.tabbtn')).map((b) => {
          const r = b.getBoundingClientRect();
          return { t: b.getAttribute('data-tab'), w: Math.round(r.width), h: Math.round(r.height) };
        });
        const page = document.querySelector('.page.active').getBoundingClientRect();
        const btn = document.getElementById('mLkBtn').getBoundingClientRect();
        return {
          overflowX: de.scrollWidth - vw,
          bar: { top: Math.round(bar.top), h: Math.round(bar.height), bottom: Math.round(bar.bottom) },
          vh: vh,
          tabs: tabs,
          pageBottom: Math.round(page.bottom),
          lkBtnH: Math.round(btn.height),
          lkBtnRight: Math.round(btn.right),
          vw: vw
        };
      })()`);
      ok(name, 'không tràn ngang trong app', appLayout.overflowX <= 0, appLayout.overflowX);
      ok(name, 'tabbar nằm trong khung nhìn', appLayout.bar.bottom <= appLayout.vh + 1 && appLayout.bar.bottom > appLayout.vh - 120, appLayout.bar);
      ok(name, 'tabbar cao ≥ 56px', appLayout.bar.h >= 56, appLayout.bar.h);
      ok(name, '4 tab mỗi tab rộng ≥ 60px', appLayout.tabs.length === 4 && appLayout.tabs.every((t) => t.w >= 60), appLayout.tabs);
      ok(name, 'nút Tra cứu cao ≥ 44px và không tràn', appLayout.lkBtnH >= 44 && appLayout.lkBtnRight <= appLayout.vw + 1, { h: appLayout.lkBtnH, right: appLayout.lkBtnRight });

      // ---------- Tra cứu bằng chạm thật ----------
      await s.ev(`(() => {
        document.getElementById('mLkMcc').value = '452';
        document.getElementById('mLkMnc').value = '1';
        document.getElementById('mLkLac').value = '10068';
        document.getElementById('mLkCell').value = '5293';
        return true;
      })()`);
      const tappedLookup = await s.tapSel('#mLkBtn');
      await sleep(3500);
      const lk = await s.ev(`(() => {
        const box = document.getElementById('mLkResult');
        const r = box.getBoundingClientRect();
        const txt = (box.innerText || '').replace(/\\s+/g, ' ').trim();
        return {
          hidden: box.hidden,
          cls: box.className,
          text: txt.slice(0, 120),
          overflowRight: Math.round(r.right - document.documentElement.clientWidth),
          hasCoords: /Toạ độ/.test(txt),
          hasActions: !!box.querySelector('[data-act="maps"]')
        };
      })()`);
      ok(name, 'chạm "Tra cứu" trả kết quả', tappedLookup && !lk.hidden && lk.hasCoords, lk);
      ok(name, 'thẻ kết quả không tràn ngang', lk.overflowRight <= 1, lk.overflowRight);
      ok(name, 'kết quả có nút hành động (Bản đồ / eNB↔ECI)', lk.hasActions === true, lk.hasActions);
      await s.shot(path.join(SHOTS, name, '03-lookup.png'));

      // ---------- Chạm sang tab Lịch sử ----------
      await s.tapSel('.tabbtn[data-tab="history"]');
      await sleep(2200);
      const hist = await s.ev(`(() => {
        const list = document.getElementById('mHistList');
        const cards = Array.from(list.querySelectorAll('.hist-card'));
        const vw = document.documentElement.clientWidth;
        const rects = cards.map((c) => {
          const r = c.getBoundingClientRect();
          return { l: Math.round(r.left), r: Math.round(r.right) };
        });
        const btns = cards.length ? Array.from(cards[0].querySelectorAll('.hist-btn')).map((b) => Math.round(b.getBoundingClientRect().height)) : [];
        return {
          active: document.querySelector('.page[data-page="history"]').classList.contains('active'),
          cards: cards.length,
          overflow: rects.filter((x) => x.r > vw + 1 || x.l < -1).length,
          btnHeights: btns
        };
      })()`);
      ok(name, 'chạm tab Lịch sử → đúng trang', hist.active === true);
      ok(name, 'có thẻ lịch sử', hist.cards > 0, hist.cards);
      ok(name, 'thẻ lịch sử không tràn ngang', hist.overflow === 0, hist.overflow);
      ok(name, 'nút thao tác lịch sử cao ≥ 30px', hist.btnHeights.length > 0 && hist.btnHeights.every((x) => x >= 30), hist.btnHeights);
      await s.shot(path.join(SHOTS, name, '04-history.png'));

      // ---------- Công cụ (accordion) + Tài khoản ----------
      await s.tapSel('.tabbtn[data-tab="tools"]');
      await sleep(1500);
      const toolsClosed = await s.ev(`(() => ({
        active: document.querySelector('.page[data-page="tools"]').classList.contains('active'),
        bodies: ['mPhoneBody', 'mConvBody', 'mIpBody'].map((id) => document.getElementById(id).hidden),
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth
      }))()`);
      ok(name, 'tab Công cụ hiển thị', toolsClosed.active === true);
      ok(name, 'mặc định cả 3 công cụ đóng', toolsClosed.bodies.every((x) => x === true), toolsClosed.bodies);
      ok(name, 'trang công cụ không tràn ngang', toolsClosed.overflowX <= 0, toolsClosed.overflowX);
      await s.shot(path.join(SHOTS, name, '05-tools.png'));

      // Mở công cụ Chuyển đổi bằng chạm vào tiêu đề
      await s.tapSel('#mConvHd');
      await sleep(600);
      const toolsOpen = await s.ev(`(() => {
        const vw = document.documentElement.clientWidth;
        const conv = document.getElementById('mConvBtn').getBoundingClientRect();
        const inp = document.getElementById('mConvInp');
        return {
          convOpen: document.getElementById('mConvBody').hidden === false,
          phoneClosed: document.getElementById('mPhoneBody').hidden === true,
          ipClosed: document.getElementById('mIpBody').hidden === true,
          convFits: conv.right <= vw + 1,
          inputFont: parseFloat(getComputedStyle(inp).fontSize)
        };
      })()`);
      ok(name, 'chạm tiêu đề mở đúng công cụ (các công cụ khác đóng)',
        toolsOpen.convOpen === true && toolsOpen.phoneClosed === true && toolsOpen.ipClosed === true, toolsOpen);
      ok(name, 'nút Chuyển đổi không tràn ngang', toolsOpen.convFits === true);
      ok(name, 'input công cụ ≥ 16px', toolsOpen.inputFont >= 16, toolsOpen.inputFont);

      // Chuyển đổi thật (công cụ đang mở)
      await s.ev(`(() => { document.getElementById('mConvInp').value = '592796'; document.getElementById('mConvSector').value = '0'; return true; })()`);
      await s.tapSel('#mConvBtn');
      await sleep(1600);
      const conv = await s.ev(`(() => { const b = document.getElementById('mConvResult'); return { hidden: b.hidden, ok: /151755776/.test(b.innerText || '') }; })()`);
      ok(name, 'chuyển đổi ra ECI 151755776', conv.hidden === false && conv.ok === true, conv);

      // ---------- Tra cứu IP (mobile) ----------
      await s.tapSel('#mIpHd');
      await sleep(600);
      const ipUi = await s.ev(`(() => {
        const de = document.documentElement;
        const inp = document.getElementById('mIpInp');
        const btn = document.getElementById('mIpBtn').getBoundingClientRect();
        return {
          hasCard: !!document.getElementById('mIpCard'),
          open: document.getElementById('mIpBody').hidden === false,
          convClosed: document.getElementById('mConvBody').hidden === true,
          inputFont: parseFloat(getComputedStyle(inp).fontSize),
          btnH: Math.round(btn.height),
          overflowX: de.scrollWidth - de.clientWidth
        };
      })()`);
      ok(name, 'có công cụ tra cứu IP', ipUi.hasCard === true);
      ok(name, 'mở IP thì Chuyển đổi tự đóng', ipUi.open === true && ipUi.convClosed === true, ipUi);
      ok(name, 'input IP ≥ 16px, nút Tra IP ≥ 44px', ipUi.inputFont >= 16 && ipUi.btnH >= 44, ipUi);
      ok(name, 'form IP không tràn ngang', ipUi.overflowX <= 0, ipUi.overflowX);

      // Vẽ kết quả GIẢ để kiểm accordion nguồn mà không phụ thuộc mạng ngoài.
      await s.ev(`(() => { window.mRenderIpResult({
        ok: true, ip: '8.8.8.8', ipVersion: 4, cacheHits: 0,
        aggregate: { sources_total: 2, sources_ok: 2, agreement: 1,
          fields: { country: { value: 'United States', count: 2 }, countryCode: { value: 'US', count: 2 },
                    asn: { value: 'AS15169', count: 2 }, isp: { value: 'Google LLC', count: 2 },
                    city: { value: 'Mountain View', count: 2 }, region: { value: 'California', count: 1 },
                    timezone: { value: 'America/Los_Angeles', count: 2 } },
          lat: 37.4, lon: -122.1, flags: { isProxy: { value: true, sources: ['ip_api_com'] } } },
        results: [
          { source: 'dbip', label: 'DB-IP', ok: true, cached: false, ms: 120,
            data: { country: 'United States', city: 'Mountain View', asn: 'AS15169', isProxy: false } },
          { source: 'ipinfo', label: 'IPinfo', ok: false, cached: false, ms: 30, error: 'Chưa cấu hình API key' }
        ]
      }); return true; })()`);
      await sleep(400);
      const ipView = await s.ev(`(() => {
        const box = document.getElementById('mIpResult');
        const de = document.documentElement;
        const srcs = box.querySelectorAll('details.m-ip-src');
        return {
          hidden: box.hidden,
          text: (box.innerText || '').slice(0, 200),
          srcs: srcs.length,
          open: srcs.length ? srcs[0].open : null,
          overflowX: de.scrollWidth - de.clientWidth,
          rightOver: Math.round(box.getBoundingClientRect().right - de.clientWidth),
          summaryH: srcs.length ? Math.round(srcs[0].querySelector('summary').getBoundingClientRect().height) : 0
        };
      })()`);
      ok(name, 'kết quả IP hiển thị', ipView.hidden === false && /United States/.test(ipView.text), ipView.text);
      ok(name, 'có 2 accordion nguồn (kể cả nguồn lỗi)', ipView.srcs === 2, ipView.srcs);
      ok(name, 'nguồn mặc định đóng', ipView.open === false, ipView.open);
      ok(name, 'vùng chạm tiêu đề nguồn ≥ 44px', ipView.summaryH >= 44, ipView.summaryH);
      ok(name, 'kết quả IP không tràn ngang', ipView.overflowX <= 0 && ipView.rightOver <= 1, ipView);

      await s.ev(`(() => { document.querySelector('#mIpResult details.m-ip-src > summary').click(); return true; })()`);
      await sleep(300);
      const ipOpen = await s.ev(`(() => {
        const d = document.querySelector('#mIpResult details.m-ip-src');
        return { open: d.open, text: (d.innerText || '') };
      })()`);
      ok(name, 'chạm nguồn → mở rộng chi tiết (có trường)',
        ipOpen.open === true && /Quốc gia/.test(ipOpen.text) && /AS15169/.test(ipOpen.text),
        ipOpen.text.slice(0, 120));
      // Cuộn tới form IP để ảnh chụp thể hiện đúng tính năng (trang Công cụ dài).
      // Ẩn banner "Cài ứng dụng" để không che phần chi tiết nguồn trong ảnh.
      await s.ev(`(() => {
        const b = document.getElementById('mInstall'); if (b) b.hidden = true;
        document.getElementById('mIpCard').scrollIntoView({ block: 'start' });
        return true;
      })()`);
      await sleep(350);
      await s.shot(path.join(SHOTS, name, '05b-tools-ip.png'));

      // Tra thật qua API (mạng ngoài): chỉ cần UI phản hồi kết quả hoặc lỗi, không treo.
      await s.ev(`(() => { document.getElementById('mIpInp').value = '8.8.8.8'; return true; })()`);
      await s.tapSel('#mIpBtn');
      let live = null;
      for (let i = 0; i < 40; i++) {
        await sleep(500);
        live = await s.ev(`(() => { const b = document.getElementById('mIpResult');
          return { hidden: b.hidden, cls: b.className, txt: (b.innerText || '').slice(0, 100) }; })()`);
        if (live && !live.hidden && !/Đang tra cứu/.test(live.txt)) break;
      }
      ok(name, 'tra IP thật có phản hồi (kết quả hoặc lỗi)',
        !!live && !live.hidden && !/Đang tra cứu/.test(live.txt), live);

      await s.tapSel('.tabbtn[data-tab="account"]');
      await sleep(1200);
      const acct = await s.ev(`(() => ({
        active: document.querySelector('.page[data-page="account"]').classList.contains('active'),
        credit: document.getElementById('mAcctCredit').textContent,
        logoutH: Math.round(document.querySelector('#page-account .btn-ghost.danger').getBoundingClientRect().height)
      }))()`);
      ok(name, 'tab Tài khoản hiển thị số dư', acct.active === true && acct.credit !== '—', acct);
      ok(name, 'nút Đăng xuất cao ≥ 44px', acct.logoutH >= 44, acct.logoutH);
      await s.shot(path.join(SHOTS, name, '06-account.png'));

      // ---------- Xoay ngang ----------
      await s.send('Emulation.setDeviceMetricsOverride', { width: h, height: w, deviceScaleFactor: dsf, mobile: true });
      await sleep(900);
      const land = await s.ev(`(() => {
        const de = document.documentElement;
        const bar = document.querySelector('.tabbar').getBoundingClientRect();
        return {
          overflowX: de.scrollWidth - de.clientWidth,
          vh: de.clientHeight,
          barBottom: Math.round(bar.bottom),
          barH: Math.round(bar.height)
        };
      })()`);
      ok(name, 'xoay ngang: không tràn ngang', land.overflowX <= 0, land.overflowX);
      ok(name, 'xoay ngang: tabbar vẫn trong khung nhìn', land.barBottom <= land.vh + 1, land);
      await s.shot(path.join(SHOTS, name, '07-landscape.png'));

      // Trả lại chiều dọc cho máy sau
      await s.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dsf, mobile: true });

      ok(name, 'không có exception/console error', s.errors.length === 0, s.errors.slice(0, 3));
      s.errors.length = 0;
    }

    console.log('\nẢnh chụp: ' + SHOTS);
    console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
    if (fail) { console.log('Thất bại:'); failures.forEach((f) => console.log('  - ' + f)); }
    ws.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
    try { server.kill(); } catch (e) {}
    try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}
    const del = (sql, p) => new Promise((r) => db.run(sql, p, () => r()));
    await del('DELETE FROM lookup_history WHERE user_id = ?', [uid]);
    await del('DELETE FROM credit_transactions WHERE user_id = ?', [uid]);
    await del('DELETE FROM email_verifications WHERE user_id = ?', [uid]);
    await del('DELETE FROM users WHERE id = ?', [uid]);
  }
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('LỖI:', e && e.stack || e); process.exit(1); });
