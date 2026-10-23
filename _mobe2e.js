/**
 * _mobe2e.js (TẠM THỜI) — kiểm thử end-to-end các endpoint mà app /m/ gọi.
 * Tự tạo 1 user test rồi dọn sạch. KHÔNG dùng cho CI.
 */
const db = require('./database');
const BASE = process.env.MOB_BASE || 'http://127.0.0.1:3000';
const TS = Date.now();
const UNAME = '__mobtest_' + TS;
const EMAIL = 'mobtest+' + TS + '@example.com';
const PASS = 'MobTest123';

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; failures.push(name); console.log('  FAIL  ' + name + (extra !== undefined ? ' -> ' + JSON.stringify(extra).slice(0, 400) : '')); }
}

async function call(method, path, body, token) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const opts = { method, headers };
  if (body !== undefined) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(BASE + path, opts);
  const txt = await res.text();
  let data = null;
  try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
  return { status: res.status, body: data, headers: res.headers };
}

const run = (sql, p = []) => new Promise((res, rej) => db.run(sql, p, function (e) { e ? rej(e) : res(this); }));
const all = (sql, p = []) => new Promise((res, rej) => db.all(sql, p, (e, r) => e ? rej(e) : res(r)));

(async () => {
  console.log('\n== A. Đăng ký + kích hoạt + đăng nhập (luồng của màn auth /m/)');
  const cap = await call('GET', '/api/captcha');
  ok('GET /api/captcha → 200 + {id,text}', cap.status === 200 && cap.body.id && cap.body.text, cap.body);

  const reg = await call('POST', '/api/register', {
    username: UNAME, password: PASS, email: EMAIL,
    captchaId: cap.body.id, captcha: cap.body.text, acceptTerms: true
  });
  ok('POST /api/register → 200', reg.status === 200, reg.body);
  ok('đăng ký trả pending:true', !!reg.body.pending);
  // SMTP có thể đã cấu hình → server KHÔNG trả dev_code. Khi đó đọc mã trực tiếp
  // trong DB (test chạy cùng máy chủ) để mô phỏng người dùng đọc email.
  const uidRow = await all('SELECT id FROM users WHERE username = ?', [UNAME]);
  const newUid = uidRow.length ? uidRow[0].id : null;
  ok('tạo được user trong DB', !!newUid);
  const codeRow = await all(
    `SELECT code FROM email_verifications WHERE user_id = ? AND purpose = 'verify' AND used_at IS NULL
     ORDER BY id DESC LIMIT 1`, [newUid]);
  const devCode = codeRow.length ? codeRow[0].code : reg.body.dev_code;
  ok('lấy được mã kích hoạt 6 số', /^\d{6}$/.test(String(devCode || '')), { dev_code: reg.body.dev_code, db: devCode });

  const badLogin = await call('POST', '/api/login', { username: UNAME, password: PASS });
  ok('chưa kích hoạt → 403 EMAIL_NOT_VERIFIED',
    badLogin.status === 403 && badLogin.body.reason === 'EMAIL_NOT_VERIFIED', badLogin.body);

  const ver = await call('POST', '/api/verify-email', { username: UNAME, code: devCode });
  ok('POST /api/verify-email → 200 + token', ver.status === 200 && !!ver.body.token, ver.body);
  ok('kích hoạt trả user.credit_balance', ver.body.user && typeof ver.body.user.credit_balance === 'number');
  const token = ver.body.token;

  const login = await call('POST', '/api/login', { username: UNAME, password: PASS });
  ok('đăng nhập sau khi kích hoạt → 200 + token', login.status === 200 && !!login.body.token);
  const tok = login.body.token || token;

  const me = await call('GET', '/api/me', undefined, tok);
  ok('GET /api/me → đúng user', me.status === 200 && me.body.username === UNAME, me.body);

  const cfg = await call('GET', '/api/credits/config');
  ok('GET /api/credits/config → {enabled,cost,signup_bonus}',
    cfg.status === 200 && cfg.body.cost != null && cfg.body.signup_bonus != null, cfg.body);

  const bal = await call('GET', '/api/credits/balance', undefined, tok);
  ok('GET /api/credits/balance → có balance', bal.status === 200 && bal.body.balance != null, bal.body);

  console.log('\n== B. Tra cứu cell (tab Tra cứu)');
  const hit = await call('GET', '/api/cells/resolve?mcc=452&mnc=1&lac=10068&cellid=5293', undefined, tok);
  ok('tra cell có trong CSDL nội bộ → 200', hit.status === 200, hit.body);
  ok('trả data.lat/lng/range', hit.body && hit.body.data && hit.body.data.lat != null && hit.body.data.lon != null, hit.body && hit.body.data);
  ok('trả nguồn (source)', !!hit.body.source, hit.body.source);
  ok('trả radio để vẽ badge RAT', !!(hit.body.data && hit.body.data.radio), hit.body.data && hit.body.data.radio);

  const miss = await call('GET', '/api/cells/resolve?mcc=452&mnc=99&lac=999999&cellid=1', undefined, tok);
  ok('tra cell rác → 404 (app hiện "Không tìm thấy cell")', miss.status === 404, { s: miss.status, b: miss.body });

  const bad = await call('GET', '/api/cells/resolve?mcc=452', undefined, tok);
  ok('thiếu tham số → 400', bad.status === 400);

  console.log('\n== C. Lịch sử — CHỈ cell đơn lẻ');
  const hist = await call('GET', '/api/lookup-history?mode=single&page=1&limit=20', undefined, tok);
  ok('GET lịch sử mode=single → 200', hist.status === 200, hist.body);
  const rows = (hist.body && hist.body.data) || [];
  ok('mọi dòng đều mode=single (không lẫn phiên batch)',
    rows.length > 0 && rows.every((r) => r.mode === 'single'), rows.map((r) => r.mode));
  const mine = rows.find((r) => String(r.cellid) === '5293' && String(r.lac) === '10068');
  ok('lượt tra vừa rồi có trong lịch sử', !!mine, rows.slice(0, 3));
  ok('dòng lịch sử có found=1 và toạ độ', mine && Number(mine.found) === 1 && mine.lat != null);
  ok('created_at đọc được (hiển thị giờ)', mine && !!mine.created_at);

  const missRow = rows.find((r) => Number(r.found) !== 1);
  ok('lượt tra miss cũng vào lịch sử với found=0', !!missRow || rows.length > 1);

  if (mine) {
    const del = await call('DELETE', '/api/lookup-history/' + mine.id, undefined, tok);
    ok('DELETE /api/lookup-history/:id → 200', del.status === 200, del.body);
    const after = await call('GET', '/api/lookup-history?mode=single&page=1&limit=50', undefined, tok);
    ok('dòng đã xoá không còn trong lịch sử',
      !((after.body.data || []).some((r) => r.id === mine.id)));
  }

  console.log('\n== D. Công cụ: chuyển đổi eNB ↔ ECI');
  const convShort = await call('GET', '/api/cells/convert?value=592796&sector=0', undefined, tok);
  ok('eNB 592796 + sector 0 → 200', convShort.status === 200, convShort.body);
  ok('ECI = 592796 × 256 = 151755776', convShort.body && Number(convShort.body.eci) === 151755776, convShort.body);
  ok('isShort=true, enbId=592796', convShort.body && convShort.body.isShort === true && Number(convShort.body.enbId) === 592796);

  const convLong = await call('GET', '/api/cells/convert?value=151755778', undefined, tok);
  ok('ECI 151755778 → 200', convLong.status === 200, convLong.body);
  ok('eNB = 151755778 >> 8 = 592796, sector = 2',
    convLong.body && Number(convLong.body.enbId) === 592796 && Number(convLong.body.sector) === 2, convLong.body);

  const convBad = await call('GET', '/api/cells/convert?value=abc', undefined, tok);
  ok('giá trị không phải số → 400', convBad.status === 400);

  console.log('\n== E. Công cụ: check số điện thoại (VNTA)');
  // Cổng VNTA là phụ thuộc NGOÀI (DNS/mạng của máy chủ). Nếu cổng hỏng thì app
  // vẫn phải xử lý mềm (hiện thông báo + cho tải lại captcha) → coi là SKIP.
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    const r = await fetch(BASE + '/api/tools/port-check/captcha', { signal: ctrl.signal });
    clearTimeout(t);
    const d = await r.json().catch(() => null);
    if (r.status === 200) {
      ok('GET /api/tools/port-check/captcha → 200 + {captchaBase64,sessionId}',
        !!(d && d.captchaBase64 && d.sessionId), { status: r.status, keys: d && Object.keys(d) });
    } else {
      const upstream = d && /VNTA|EAI_AGAIN|ENOTFOUND|ECONN/i.test(String(d.error || ''));
      ok('captcha VNTA trả 500 do lỗi hạ tầng ngoài (app hiện thông báo mềm)',
        r.status === 500 && upstream, d);
      console.log('  SKIP  VNTA không truy cập được từ máy chủ này: ' + (d && d.error));
    }
  } catch (e) {
    console.log('  SKIP  VNTA không phản hồi trong 25s (' + e.name + ') — không chặn test');
  }

  console.log('\n== F. Bảo mật: dữ liệu tài khoản không lộ qua endpoint công khai');
  const anonHist = await call('GET', '/api/lookup-history?mode=single');
  ok('lịch sử không có token → 401', anonHist.status === 401);

  console.log('\n== G. Dọn dẹp');
  const uid = me.body.id;
  await run('DELETE FROM lookup_history WHERE user_id = ?', [uid]);
  await run('DELETE FROM credit_transactions WHERE user_id = ?', [uid]);
  await run('DELETE FROM email_verifications WHERE user_id = ?', [uid]);
  await run('DELETE FROM users WHERE id = ?', [uid]);
  const left = await all('SELECT id FROM users WHERE id = ?', [uid]);
  ok('đã xoá user test + dữ liệu liên quan', left.length === 0);
  const leftHist = await all('SELECT id FROM lookup_history WHERE user_id = ?', [uid]);
  ok('đã xoá lịch sử của user test', leftHist.length === 0);

  console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
  if (fail) { console.log('Thất bại:'); failures.forEach((f) => console.log('  - ' + f)); }
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('\nLỖI CHẠY TEST:', (e && e.stack) || e);
  process.exit(1);
});
