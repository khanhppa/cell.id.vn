/**
 * _toptest.js — e2e trang NẠP ĐIỂM mobile (/m/): mở sheet → chọn gói → tạo đơn →
 * thanh toán thử → số dư tăng → huỷ đơn. Tự chạy server riêng (port 3005) và dọn DB.
 *
 * Chạy: node _toptest.js   (cần Chrome/Edge; bỏ qua nếu không có)
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

if (!CHROME) {
  console.log('SKIP: không tìm thấy Chrome/Edge — đặt CHROME_PATH để chạy test nạp điểm.');
  process.exit(0);
}

const PORT = 9370, APP = 3005;
const ORIGIN = 'http://localhost:' + APP;
const PROFILE = path.join(os.tmpdir(), 'mobprof-top-' + Date.now());
const SHOTS = path.join(os.tmpdir(), 'mobshots-topup');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else {
    fail++; failures.push(name);
    console.log('  FAIL  ' + name + (extra !== undefined ? ' -> ' + JSON.stringify(extra).slice(0, 320) : ''));
  }
}

(async () => {
  const server = spawn(process.execPath, ['server.js'], {
    cwd: __dirname, env: { ...process.env, PORT: String(APP) }, stdio: 'ignore'
  });
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(ORIGIN + '/m/'); if (r.status < 500) break; } catch (e) { /* chờ */ }
    await sleep(300);
  }

  // ---- Tài khoản test ----
  const cap = await (await fetch(ORIGIN + '/api/captcha')).json();
  const TS = Date.now(), uname = '__top_' + TS;
  await fetch(ORIGIN + '/api/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: uname, password: 'TopTest123', email: 'top+' + TS + '@example.com', captchaId: cap.id, captcha: cap.text, acceptTerms: true })
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
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        errs.push((m.params.args || []).map((a) => a.value || a.description || '').join(' '));
      }
    });
    const send = (method, params) => new Promise((resolve, reject) => {
      const i = ++id; pend.set(i, { resolve, reject });
      ws.send(JSON.stringify({ id: i, method, params: params || {} }));
      setTimeout(() => { if (pend.has(i)) { pend.delete(i); reject(new Error('timeout ' + method)); } }, 30000);
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
    /** Chạm thật; tự cuộn ĐÚNG khung chứa (sheet cuộn nội bộ, không phải window). */
    const tap = async (sel) => {
      const b = await ev(`(() => {
        const el = document.querySelector(${JSON.stringify(sel)});
        if (!el) return { miss: true };
        el.scrollIntoView({ block: 'center' });
        const vh = document.documentElement.clientHeight;
        const scrollParent = (node) => {
          let p = node.parentElement;
          while (p) {
            const st = getComputedStyle(p);
            if (/(auto|scroll)/.test(st.overflowY) && p.scrollHeight > p.clientHeight + 2) return p;
            p = p.parentElement;
          }
          return null;
        };
        let r = el.getBoundingClientRect();
        let y = Math.round(r.top + r.height / 2);
        if (y > vh - 110) {
          const sp = scrollParent(el);
          const delta = y - (vh - 140);
          if (sp) sp.scrollTop += delta; else window.scrollBy(0, delta);
          r = el.getBoundingClientRect();
          y = Math.round(r.top + r.height / 2);
        }
        const x = Math.round(r.left + r.width / 2);
        const hit = document.elementFromPoint(x, y);
        return { x: x, y: y, ok: !!(hit && (hit === el || el.contains(hit))), hitTag: hit ? hit.tagName + '.' + hit.className : null };
      })()`);
      if (!b || b.miss) { console.log('    (tap: không thấy ' + sel + ')'); return false; }
      if (!b.ok) console.log('    (tap: trúng ' + b.hitTag + ' thay vì ' + sel + ')');
      await sleep(120);
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x, y: b.y, radiusX: 10, radiusY: 10, force: 1 }] });
      await sleep(40);
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await sleep(500);
      return b.ok;
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `try {
        localStorage.setItem('cell_tracker_token', ${JSON.stringify(ver.token)});
        localStorage.setItem('cell_tracker_user', ${JSON.stringify(JSON.stringify(ver.user))});
        localStorage.setItem('theme', 'dark');
        localStorage.setItem('m_install_dismissed', '1');
      } catch (e) {}`
    });
    await send('Page.navigate', { url: ORIGIN + '/m/#account' });
    await sleep(3200);

    console.log('\n== 1. Mở từ tab Tài khoản');
    const bal0 = await ev(`document.getElementById('mAcctCredit').textContent`);
    await tap('#mAcctTopup');
    await sleep(1800);
    const open = await ev(`(() => {
      const s = document.getElementById('mTopupSheet');
      const b = document.getElementById('mTopupBody');
      return {
        open: !s.hidden,
        sub: document.getElementById('mTopupSub').textContent,
        pkgs: b.querySelectorAll('.tp-pkg').length,
        create: !!document.getElementById('mTpCreate'),
        createDisabled: document.getElementById('mTpCreate') ? document.getElementById('mTpCreate').disabled : null,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    })()`);
    ok('sheet nạp mở', open.open === true, open);
    ok('hiện số dư ở tiêu đề', /Số dư: \d/.test(open.sub), open.sub);
    ok('tải được 4 gói nạp', open.pkgs === 4, open.pkgs);
    ok('có nút tạo đơn và bấm được', open.create === true && open.createDisabled === false, open);
    ok('không tràn ngang', open.overflowX <= 0, open.overflowX);
    await shot('01-choose.png');

    console.log('\n== 2. Chọn gói + xem quy đổi');
    await tap('#mTopupBody .tp-pkg[data-pkg="3"]');
    const pick = await ev(`(() => {
      const p = document.querySelector('#mTopupBody .tp-pkg.on');
      return {
        on: p ? p.getAttribute('data-pkg') : null,
        preview: document.getElementById('mTpPreview').innerText.replace(/\\s+/g, ' ').trim()
      };
    })()`);
    ok('gói 50.000đ được chọn', pick.on === '3', pick);
    ok('xem trước đúng 50 điểm', /50 điểm/.test(pick.preview), pick.preview);
    await shot('02-picked.png');

    console.log('\n== 3. Tạo đơn thật');
    await tap('#mTpCreate');
    await sleep(2500);
    const order = await ev(`(() => {
      const b = document.getElementById('mTopupBody');
      const code = b.querySelector('.tp-code');
      return {
        code: code ? code.textContent.trim() : null,
        badge: b.querySelector('.tp-badge') ? b.querySelector('.tp-badge').textContent : null,
        hasTest: !!b.querySelector('.tp-testbtn'),
        hasSync: /Tôi đã chuyển khoản/.test(b.innerText),
        hasCancel: !!b.querySelector('.btn-ghost.danger'),
        amt: (b.querySelector('.tp-order-amt') || {}).textContent,
        exp: !!document.getElementById('mTpExp')
      };
    })()`);
    ok('có mã đơn', !!order.code && /^#\d+/.test(order.code), order.code);
    ok('trạng thái "Chờ thanh toán"', /Chờ thanh toán/.test(order.badge || ''), order.badge);
    ok('đúng số tiền 50.000đ', /50\.000/.test(order.amt || ''), order.amt);
    ok('có nút thanh toán thử (test mode)', order.hasTest === true);
    ok('có nút đối soát + huỷ đơn', order.hasSync === true && order.hasCancel === true, order);
    ok('có đếm ngược hết hạn', order.exp === true);
    const countdown = await ev(`(document.getElementById('mTpExp') || {}).textContent || ''`);
    ok('đếm ngược có giá trị mm:ss', /^\d+:\d\d$/.test(String(countdown).replace('Hết hạn sau ', '').trim()), countdown);
    await shot('03-order.png');

    console.log('\n== 4. Đơn PENDING hiện trong "Đơn gần đây"');
    await ev(`mTpNewOrder()`);
    await sleep(2200);
    const recent = await ev(`(() => {
      const rows = document.querySelectorAll('#mTopupBody .tp-order');
      return { n: rows.length, first: rows.length ? rows[0].innerText.replace(/\\s+/g, ' ').trim().slice(0, 60) : null };
    })()`);
    ok('có đơn trong "Đơn gần đây"', recent.n >= 1, recent);

    console.log('\n== 5. Thanh toán thử → cộng điểm');
    const code = parseInt(String(order.code).replace('#', ''), 10);
    await ev(`mResumeTopup(${code})`);
    await sleep(1800);
    const before = await ev(`document.getElementById('topCreditTxt').textContent`);
    await tap('.tp-testbtn');
    await sleep(3000);
    const after = await ev(`(() => ({
      badge: (document.querySelector('#mTopupBody .tp-badge') || {}).textContent,
      txt: document.getElementById('mTopupBody').innerText.replace(/\\s+/g, ' ').trim().slice(0, 160),
      credit: document.getElementById('topCreditTxt').textContent,
      acct: document.getElementById('mAcctCredit').textContent
    }))()`);
    ok('trạng thái chuyển "Đã thanh toán"', /Đã thanh toán/.test(after.badge || ''), after.badge);
    ok('báo đã cộng điểm', /Đã cộng/.test(after.txt), after.txt.slice(0, 90));
    ok('số dư topbar tăng 50 điểm', Number(after.credit) === Number(before) + 50, { before, after: after.credit });
    ok('số dư tab Tài khoản khớp', Number(after.acct) === Number(before) + 50, after.acct);
    const subAfter = await ev(`document.getElementById('mTopupSub').textContent`);
    ok('tiêu đề sheet cập nhật số dư mới', new RegExp('Số dư: ' + (Number(before) + 50)).test(subAfter), subAfter);
    await shot('04-paid.png');

    console.log('\n== 5b. Đóng rồi mở lại → phải vào màn chọn gói (không phải kết quả cũ)');
    await tap('#mTopupClose');
    await sleep(900);
    await tap('#mAcctTopup');
    await sleep(1800);
    const reopen = await ev(`(() => {
      const b = document.getElementById('mTopupBody');
      return {
        open: !document.getElementById('mTopupSheet').hidden,
        pkgs: b.querySelectorAll('.tp-pkg').length,
        hasOrderBox: !!b.querySelector('.tp-order-box'),
        create: !!document.getElementById('mTpCreate'),
        // Chỉ xét khung đơn hiện tại; badge "Đã thanh toán" trong "Đơn gần đây" là hợp lệ.
        paidText: /Đã cộng/.test((b.querySelector('.tp-note.ok') || {}).innerText || ''),
        sub: document.getElementById('mTopupSub').textContent
      };
    })()`);
    ok('mở lại thấy màn chọn gói', reopen.open === true && reopen.pkgs === 4 && reopen.create === true, reopen);
    ok('KHÔNG còn hiện đơn "Đã thanh toán" của lần trước', reopen.hasOrderBox === false && reopen.paidText === false, reopen);
    ok('tiêu đề hiện số dư mới', /Số dư: \d/.test(reopen.sub), reopen.sub);
    await shot('05-reopen.png');

    console.log('\n== 6. Dữ liệu thật trong DB');
    const dbBal = await new Promise((r) => db.get('SELECT credit_balance FROM users WHERE id = ?', [uid], (e, x) => r(e ? null : x)));
    ok('DB cộng đúng 50 điểm', Number(dbBal && dbBal.credit_balance) === Number(before) + 50, dbBal);
    const orderRow = await new Promise((r) => db.get('SELECT status, amount_vnd, credits FROM payment_orders WHERE order_code = ?', [code], (e, x) => r(e ? null : x)));
    ok('đơn trong DB là PAID', orderRow && orderRow.status === 'PAID', orderRow);
    ok('đơn đúng 50.000đ / 50 điểm', orderRow && Number(orderRow.amount_vnd) === 50000 && Number(orderRow.credits) === 50, orderRow);

    console.log('\n== 7. Nạp tự do + validate');
    await ev(`mTpNewOrder()`);
    await sleep(1800);
    await ev(`(() => { const i = document.getElementById('mTpAmount'); i.value = '20000'; mTpAmountInput('20000'); return true; })()`);
    await sleep(300);
    const freePreview = await ev(`document.getElementById('mTpPreview').innerText.replace(/\\s+/g, ' ').trim()`);
    ok('nạp tự do 20.000đ → 20 điểm', /20 điểm/.test(freePreview), freePreview);
    await ev(`(() => { const i = document.getElementById('mTpAmount'); i.value = '500'; mTpAmountInput('500'); return true; })()`);
    await tap('#mTpCreate');
    await sleep(900);
    const tooSmall = await ev(`(() => ({
      toast: (document.getElementById('mToast') || {}).innerText || '',
      stillChoose: !!document.getElementById('mTpCreate')
    }))()`);
    ok('số tiền dưới mức tối thiểu bị chặn ngay trên client',
      /phải từ/.test(tooSmall.toast) && tooSmall.stillChoose === true, tooSmall);

    console.log('\n== 8. Huỷ đơn');
    await ev(`(() => { const i = document.getElementById('mTpAmount'); i.value = '20000'; mTpAmountInput('20000'); return true; })()`);
    await ev(`window.confirm = () => true`);
    await tap('#mTpCreate');
    await sleep(2600);
    const code2 = await ev(`(document.querySelector('.tp-code') || {}).textContent`);
    await tap('#mTopupBody .btn-ghost.danger');
    await sleep(2200);
    const cancelled = await ev(`(() => ({
      badge: (document.querySelector('#mTopupBody .tp-badge') || {}).textContent,
      txt: document.getElementById('mTopupBody').innerText.replace(/\\s+/g, ' ').slice(0, 120)
    }))()`);
    ok('huỷ đơn → trạng thái Đã huỷ', /Đã huỷ/.test(cancelled.badge || ''), { code2, cancelled });

    console.log('\n== 9. Đóng sheet');
    await tap('#mTopupClose');
    await sleep(900);
    const closed = await ev(`({
      hidden: document.getElementById('mTopupSheet').hidden,
      unlocked: !document.body.classList.contains('map-open')
    })`);
    ok('đóng được sheet', closed.hidden === true, closed);
    ok('bỏ khoá cuộn trang', closed.unlocked === true, closed);

    console.log('\n== 10. Không lỗi JS');
    ok('không exception/console error', errs.length === 0, errs.slice(0, 3));

    console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
    if (fail) failures.forEach((f) => console.log('  - ' + f));
    console.log('Ảnh: ' + SHOTS);
    ws.close();
  } finally {
    try { chrome.kill(); } catch (e) { /* ignore */ }
    try { server.kill(); } catch (e) { /* ignore */ }
    try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) { /* ignore */ }
    const del = (sql, p) => new Promise((r) => db.run(sql, p, () => r()));
    await new Promise((r) => db.run('DELETE FROM payment_orders WHERE user_id = ?', [uid], () => r()));
    await del('DELETE FROM credit_transactions WHERE user_id = ?', [uid]);
    await del('DELETE FROM lookup_history WHERE user_id = ?', [uid]);
    await del('DELETE FROM email_verifications WHERE user_id = ?', [uid]);
    await del('DELETE FROM users WHERE id = ?', [uid]);
  }
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('LỖI:', e && e.stack || e); process.exit(1); });
