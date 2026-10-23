/**
 * _maplink.test.js — lối tắt "Xem vị trí trên bản đồ" ở tab Tra cứu:
 *   • mặc định (chưa tra) ẩn
 *   • tra ra kết quả → hiện, bấm mở sheet bản đồ
 *   • tra miss → ẩn lại
 *   • gọi mOpenMap() khi chưa có toạ độ → KHÔNG rời app sang /index.html
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const db = require('./database');

const CHROME = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].filter(Boolean).find((p) => { try { return fs.existsSync(p); } catch (e) { return false; } });
if (!CHROME) { console.log('SKIP: không có Chrome/Edge.'); process.exit(0); }

const PORT = 9376, APP = 3008;
const ORIGIN = 'http://localhost:' + APP;
const PROFILE = path.join(os.tmpdir(), 'mobprof-maplink-' + Date.now());
const SHOTS = path.join(os.tmpdir(), 'mobshots-maplink');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const failures = [];
const ok = (n, c, x) => {
  if (c) { pass++; console.log('  PASS  ' + n); }
  else { fail++; failures.push(n); console.log('  FAIL  ' + n + (x !== undefined ? ' -> ' + JSON.stringify(x).slice(0, 300) : '')); }
};

(async () => {
  const server = spawn(process.execPath, ['server.js'], { cwd: __dirname, env: { ...process.env, PORT: String(APP) }, stdio: 'ignore' });
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(ORIGIN + '/m/'); if (r.status < 500) break; } catch (e) { /* chờ */ }
    await sleep(300);
  }

  const cap = await (await fetch(ORIGIN + '/api/captcha')).json();
  const TS = Date.now(), uname = '__maplink_' + TS;
  await fetch(ORIGIN + '/api/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: uname, password: 'MapLink123', email: 'ml+' + TS + '@example.com', captchaId: cap.id, captcha: cap.text, acceptTerms: true })
  });
  const rows = await new Promise((r) => db.all(
    `SELECT u.id, v.code FROM users u JOIN email_verifications v ON v.user_id = u.id
     WHERE u.username = ? AND v.purpose = 'verify' AND v.used_at IS NULL ORDER BY v.id DESC LIMIT 1`,
    [uname], (e, x) => r(e ? [] : x)));
  const uid = rows[0].id;
  const ver = await (await fetch(ORIGIN + '/api/verify-email', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: uname, code: rows[0].code })
  })).json();

  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--hide-scrollbars', '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE, 'about:blank'
  ], { stdio: 'ignore' });

  try {
    for (let i = 0; i < 60; i++) {
      try { const r = await fetch('http://127.0.0.1:' + PORT + '/json/version'); if (r.ok) break; } catch (e) { /* chờ */ }
      await sleep(300);
    }
    const target = await (await fetch('http://127.0.0.1:' + PORT + '/json/new?about:blank', { method: 'PUT' })).json();
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
    let id = 0; const pend = new Map(); const errs = [];
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pend.has(m.id)) {
        const p = pend.get(m.id); pend.delete(m.id);
        m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
        return;
      }
      if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails.text || 'exception'));
    });
    const send = (method, params) => new Promise((resolve, reject) => {
      const i = ++id; pend.set(i, { resolve, reject });
      ws.send(JSON.stringify({ id: i, method, params: params || {} }));
      setTimeout(() => { if (pend.has(i)) { pend.delete(i); reject(new Error('timeout ' + method)); } }, 40000);
    });
    const ev = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 260));
      return r.result.value;
    };
    const shot = async (f) => {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      fs.mkdirSync(SHOTS, { recursive: true });
      fs.writeFileSync(path.join(SHOTS, f), Buffer.from(r.data, 'base64'));
    };
    const mapBtn = () => ev(`(() => { const b = document.getElementById('mLkMapBtn');
      return { hidden: b.hidden, h: Math.round(b.getBoundingClientRect().height) }; })()`);

    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `try {
        localStorage.setItem('cell_tracker_token', ${JSON.stringify(ver.token)});
        localStorage.setItem('cell_tracker_user', ${JSON.stringify(JSON.stringify(ver.user))});
        localStorage.setItem('theme', 'dark');
        localStorage.setItem('m_install_dismissed', '1');
      } catch (e) {}`
    });
    await send('Page.navigate', { url: ORIGIN + '/m/#lookup' });
    await sleep(3000);

    console.log('\n== 1. Trạng thái mặc định (chưa tra gì)');
    const s0 = await mapBtn();
    ok('lối tắt bản đồ ẩn', s0.hidden === true && s0.h === 0, s0);
    await shot('01-default.png');

    console.log('\n== 2. Gọi mOpenMap() khi chưa có toạ độ');
    const before = await ev('location.pathname + location.search');
    await ev('mOpenMap()');
    await sleep(1200);
    const after = await ev('location.pathname + location.search');
    const toastTxt = await ev(`(document.getElementById('mToast') || {}).innerText || ''`);
    ok('KHÔNG bị đá sang trang desktop', after === before && !/index\.html/.test(after), { before, after });
    ok('vẫn ở trang /m/', after.indexOf('/m/') === 0, after);
    ok('có thông báo hướng dẫn', /Chưa có vị trí/.test(toastTxt), toastTxt);
    ok('sheet bản đồ không mở', await ev(`document.getElementById('mMapSheet').hidden`) === true);

    console.log('\n== 3. Tra cứu MISS → vẫn ẩn');
    await ev(`(() => {
      document.getElementById('mLkMcc').value = '452';
      document.getElementById('mLkMnc').value = '99';
      document.getElementById('mLkLac').value = '9999';
      document.getElementById('mLkCell').value = '999999';
      return true;
    })()`);
    await ev('mDoLookup(null)');
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      const done = await ev(`(() => { const b = document.getElementById('mLkResult');
        return !b.hidden && !/Đang tra/.test(b.innerText); })()`);
      if (done) break;
    }
    const missView = await ev(`(() => ({
      cls: document.getElementById('mLkResult').className,
      txt: document.getElementById('mLkResult').innerText.replace(/\\s+/g, ' ').slice(0, 60)
    }))()`);
    const s1 = await mapBtn();
    ok('kết quả miss/lỗi', /miss|err/.test(missView.cls), missView);
    ok('lối tắt bản đồ vẫn ẩn', s1.hidden === true && s1.h === 0, s1);
    await shot('02-miss.png');

    console.log('\n== 4. Tra cứu HIT → hiện lối tắt + mở được bản đồ');
    await ev(`(() => {
      document.getElementById('mLkMcc').value = '452';
      document.getElementById('mLkMnc').value = '1';
      document.getElementById('mLkLac').value = '10068';
      document.getElementById('mLkCell').value = '5293';
      return true;
    })()`);
    await ev('mDoLookup(null)');
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      const done = await ev(`(() => { const b = document.getElementById('mLkResult');
        return !b.hidden && b.className.indexOf('ok') !== -1; })()`);
      if (done) break;
    }
    const s2 = await mapBtn();
    ok('kết quả có toạ độ', await ev(`document.getElementById('mLkResult').className.indexOf('ok') !== -1`));
    ok('lối tắt bản đồ hiện ra', s2.hidden === false && s2.h > 0, s2);
    await shot('03-hit.png');

    await ev(`document.getElementById('mLkMapBtn').click()`);
    await sleep(2200);
    const mapOpen = await ev(`(() => ({
      open: !document.getElementById('mMapSheet').hidden,
      marker: !!document.querySelector('#mMap .cell-pin'),
      sub: document.getElementById('mMapSub').textContent
    }))()`);
    ok('bấm lối tắt mở bản đồ trong app', mapOpen.open === true && mapOpen.marker === true, mapOpen);
    ok('vẫn ở /m/ (không sang desktop)', (await ev('location.pathname')).indexOf('/m/') === 0);
    await shot('04-map.png');

    await ev('mCloseMap()');
    await sleep(600);

    console.log('\n== 5. Đăng xuất → ẩn lại');
    await ev(`window.confirm = () => true`);
    await ev('mLogout()');
    await sleep(900);
    const s3 = await mapBtn();
    ok('sau đăng xuất lối tắt ẩn', s3.hidden === true, s3);

    console.log('\n== 6. Không lỗi JS');
    ok('không exception', errs.length === 0, errs.slice(0, 3));

    console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
    if (fail) failures.forEach((f) => console.log('  - ' + f));
    console.log('Ảnh: ' + SHOTS);
    ws.close();
  } finally {
    try { chrome.kill(); } catch (e) { /* ignore */ }
    try { server.kill(); } catch (e) { /* ignore */ }
    try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) { /* ignore */ }
    const del = (sql, p) => new Promise((r) => db.run(sql, p, () => r()));
    await del('DELETE FROM lookup_history WHERE user_id = ?', [uid]);
    await del('DELETE FROM credit_transactions WHERE user_id = ?', [uid]);
    await del('DELETE FROM email_verifications WHERE user_id = ?', [uid]);
    await del('DELETE FROM users WHERE id = ?', [uid]);
  }
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('LỖI:', e && e.stack || e); process.exit(1); });
