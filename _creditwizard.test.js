/**
 * Test RUNTIME cho wizard nạp điểm trên `public/topup.html`.
 * Chạy: node _creditwizard.test.js
 *
 * Vì sao cần: bug "bấm Tiếp tục thanh toán không sang bước 3" lọt qua mọi test
 * regex tĩnh (chúng chỉ xác nhận `fillConfirmStep(d)` + `wzGotoStep(3)` tồn tại,
 * không thấy được `activeOrder` chưa được gán). Ở đây eval ĐÚNG khối <script>
 * của trang trong một DOM stub tối thiểu rồi chạy chuỗi thao tác thật:
 *   createOrder(1) -> confirmOrderNext() -> #wzStep4 hiện, #wzStep1..3 ẩn.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`); }
}

const html = fs.readFileSync(path.join(__dirname, 'public', 'topup.html'), 'utf8');

// ---------------------------------------------------------------------------
// DOM stub tối thiểu (không thêm dependency).
// ---------------------------------------------------------------------------
function makeEl(id) {
  return {
    id, _text: '', _html: '', hidden: false, disabled: false, href: '',
    className: '', style: {}, attrs: {}, children: [],
    // <dialog>: openPayDialog/closePayDialog dùng open + showModal()/close().
    open: false,
    showModal() { this.open = true; },
    close() { this.open = false; },
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, on) {
        if (on === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); }
        else if (on) this._s.add(c); else this._s.delete(c);
      },
      contains(c) { return this._s.has(c); }
    },
    get textContent() { return this._text; },
    set textContent(v) { this._text = String(v); },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); },
    getAttribute(n) { return this.attrs[n] === undefined ? null : this.attrs[n]; },
    setAttribute(n, v) { this.attrs[n] = v; if (n === 'class') this.className = v; },
    removeAttribute(n) { delete this.attrs[n]; },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener() {}, removeEventListener() {},
    scrollIntoView() {}, closest() { return makeEl('card'); }, click() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    insertAdjacentHTML() {}
  };
}

const els = new Map();
function byId(id) {
  if (!els.has(id)) els.set(id, makeEl(id));
  return els.get(id);
}

// #wzStep2..#wzStep5 mang attribute `hidden` ngay trong markup → stub phải khớp.
byId('wzStep2').hidden = true;
byId('wzStep3').hidden = true;
byId('wzStep4').hidden = true;
byId('wzStep5').hidden = true;
byId('payCard').hidden = false;
byId('wzSteps').querySelectorAll = sel => (sel === '.wz-step' ? WZ_STEPS : []);

// #payQr nằm trong #payQrBox; showPayCard ẩn/hiện qua qr.parentElement.
byId('payQr').parentElement = byId('payQrBox');

// 5 mốc wizard phải khớp markup thật (#wzSteps .wz-step[data-wz]).
const WZ_STEPS = [1, 2, 3, 4, 5].map(n => {
  const e = makeEl('wz-step-' + n);
  e.attrs['data-wz'] = String(n);
  return e;
});
WZ_STEPS[0].classList.add('active');

const doc = {
  hidden: false,
  getElementById: byId,
  querySelector: () => null,
  querySelectorAll(sel) {
    if (sel === '#wzSteps .wz-step') return WZ_STEPS;
    return [];
  },
  createElement: () => makeEl('new'),
  body: { appendChild() {}, removeChild() {} },
  addEventListener() {}
};

const loc = { href: 'http://localhost/topup.html', origin: 'http://localhost', search: '' };
const historyStub = { replaceState() {} };

// ---------------------------------------------------------------------------
// Nạp khối <script> app thật vào sandbox.
// ---------------------------------------------------------------------------
const appJs = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
if (!/function confirmOrderNext\(/.test(appJs)) {
  console.error('Không trích được JS app từ topup.html');
  process.exit(1);
}

const callLog = [];
const sandbox = {
  document: doc, location: loc, history: historyStub,
  console, setTimeout, clearInterval, setInterval, setImmediate,
  URLSearchParams, URL, Number, JSON, Math, String, Object, Array, Date,
  RegExp, Boolean, isNaN, parseInt, parseFloat
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

// Auth stub: trả đơn nạp giả cho POST /api/credits/topup/create.
sandbox.Auth = {
  isLoggedIn: () => true,
  initNavbar() {},
  setCreditBalance() {},
  fetch: async (url) => {
    callLog.push({ url });
    if (/topup\/create$/.test(url)) {
      return {
        ok: true,
        json: async () => ({
          order_code: 4242, amount_vnd: 50000, credits: 50,
          package_label: 'Gói test 50k', description: 'NAP 4242',
          account_number: '123456',
          checkout_url: 'https://pay.payos.vn/web/abc', qr_code: '',
          expires_at: new Date(Date.now() + 900000).toISOString(), test_mode: true
        })
      };
    }
    return { ok: true, json: async () => [] };
  }
};
sandbox.fetch = sandbox.Auth.fetch;

const ctx = vm.createContext(sandbox);
vm.runInContext(
  appJs + '\n;globalThis.__t = { createOrder, confirmOrderNext, confirmOrderBack, renderWizard, showResult };',
  ctx, { filename: 'topup-inline.js' }
);

// ---------------------------------------------------------------------------
(async () => {
  const T = ctx.__t;
  console.log('\n== Wizard: createOrder -> confirmOrderNext -> bước 4 ==');

  ok('#wzStep1 hiện, #wzStep2..5 ẩn lúc đầu',
    byId('wzStep1').hidden === false && byId('wzStep2').hidden === true
    && byId('wzStep3').hidden === true, byId('wzStep1').hidden);

  await T.createOrder(1);
  ok('createOrder gọi POST /api/credits/topup/create',
    callLog.some(c => /\/api\/credits\/topup\/create$/.test(c.url)), callLog.map(c => c.url).slice(-3));
  ok('sau createOrder: bước 3 (đơn nạp) hiện, bước 1+2+4 ẩn',
    byId('wzStep1').hidden === true && byId('wzStep3').hidden === false
    && byId('wzStep4').hidden === true,
    { s1: byId('wzStep1').hidden, s3: byId('wzStep3').hidden, s4: byId('wzStep4').hidden });
  ok('bảng xác nhận đổ đúng đơn (#wzOrderCode/#wzCredits/#wzAmount)',
    byId('wzOrderCode').textContent === '#4242'
    && byId('wzCredits').textContent === '50 điểm'
    && /50/.test(byId('wzAmount').textContent),
    { code: byId('wzOrderCode').textContent, amount: byId('wzAmount').textContent });

  // Bug đã báo: bấm "Tiếp tục thanh toán" phải sang bước thanh toán (4).
  T.confirmOrderNext();
  ok('confirmOrderNext(): #wzStep4 HIỆN (bug cũ: đứng ở bước đơn nạp)',
    byId('wzStep4').hidden === false, { s4: byId('wzStep4').hidden });
  ok('confirmOrderNext(): #wzStep1/#wzStep2/#wzStep3 ẩn',
    byId('wzStep1').hidden === true && byId('wzStep2').hidden === true
    && byId('wzStep3').hidden === true);
  ok('thanh tiến trình: mốc 4 active, mốc 1+2+3 done, mốc 5 chưa',
    WZ_STEPS[3].classList.contains('active') && WZ_STEPS[0].classList.contains('done')
    && WZ_STEPS[1].classList.contains('done') && WZ_STEPS[2].classList.contains('done')
    && !WZ_STEPS[4].classList.contains('done'),
    WZ_STEPS.map(s => ({ n: s.attrs['data-wz'], cls: [...s.classList._s] })));
  ok('thẻ thanh toán #payCard hiện + đúng mã đơn',
    byId('payCard').hidden === false && /4242/.test(byId('payOrderCode').textContent),
    { hidden: byId('payCard').hidden, code: byId('payOrderCode').textContent });
  ok('không báo lỗi ở #wzMsg khi đơn hợp lệ',
    byId('wzMsg').textContent === '', byId('wzMsg').textContent);
  ok('KHÔNG hiển thị tên chủ tài khoản nhận tiền (không còn nhãn markup)',
    !/payAccName/.test(html) && !/>\s*Chủ tài khoản/.test(html),
    /payAccName|>\s*Chủ tài khoản/.exec(html));
  ok('vẫn hiển thị số tài khoản (#payAccNo) + nội dung CK (#payDesc)',
    byId('payAccNo').textContent === '123456' && byId('payDesc').textContent === 'NAP 4242',
    { acc: byId('payAccNo').textContent, desc: byId('payDesc').textContent });
  ok('đơn thiếu QR → #payQrBox ẩn', byId('payQr').parentElement.hidden === true);
  ok('nút mở trang payOS trỏ đúng checkout_url',
    byId('payCheckout').href === 'https://pay.payos.vn/web/abc', byId('payCheckout').href);
  ok('bước 5 (kết quả) chưa hiện khi đơn còn PENDING', byId('wzStep5').hidden === true);

  console.log('\n== Bước 5: showResult(PAID) ==');
  await T.showResult({ order_code: 4242, status: 'PAID', amount_vnd: 50000, credits: 50 });
  ok('showResult(PAID): #wzStep5 hiện, #wzStep4 ẩn',
    byId('wzStep5').hidden === false && byId('wzStep4').hidden === true);
  ok('kết quả đổ đúng mã đơn + trạng thái PAID',
    byId('resOrder').textContent === '#4242' && /PAID/.test(byId('resStatus').innerHTML),
    { code: byId('resOrder').textContent, st: byId('resStatus').innerHTML });
  ok('thanh tiến trình: cả 5 mốc done/active khi hoàn tất',
    WZ_STEPS.every(s => s.classList.contains('done') || s.classList.contains('active')),
    WZ_STEPS.map(s => [...s.classList._s]));

  console.log('\n== Wizard: guard khi state lệch ==');
  await T.confirmOrderBack();
  ok('confirmOrderBack(): về bước 1 + gọi POST .../cancel',
    byId('wzStep1').hidden === false && byId('wzStep4').hidden === true
    && callLog.some(c => /\/api\/credits\/topup\/4242\/cancel$/.test(c.url)),
    { s1: byId('wzStep1').hidden, calls: callLog.map(c => c.url).slice(-3) });
  T.confirmOrderNext();
  ok('confirmOrderNext() khi chưa có đơn: KHÔNG sang bước 4 + báo lỗi rõ ở #wzMsg',
    byId('wzStep4').hidden === true && byId('wzMsg').textContent.length > 0,
    { s4: byId('wzStep4').hidden, msg: byId('wzMsg').textContent });

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('LỖI TEST:', e); process.exit(1); });
