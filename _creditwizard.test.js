/**
 * Test RUNTIME cho wizard nạp điểm trên `public/topup.html`.
 * Chạy: node _creditwizard.test.js
 *
 * Vì sao cần: bug "bấm Tiếp tục thanh toán không sang bước 3" lọt qua mọi test
 * regex tĩnh (chúng chỉ xác nhận `fillConfirmStep(d)` + `wzGotoStep(2)` tồn tại,
 * không thấy được `activeOrder` chưa được gán). Ở đây eval ĐÚNG khối <script>
 * của trang trong một DOM stub tối thiểu rồi chạy chuỗi thao tác thật:
 *   createOrder(1) -> confirmOrderNext() -> #wzStep3 hiện, #wzStep1/2/4 ẩn.
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
    // `img.src = url` (property) phải soi được như attribute để test QR đọc lại được.
    get src() { return this.attrs.src || ''; },
    set src(v) { this.attrs.src = v; },
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

// #wzStep1..#wzStep4 mang attribute `hidden` ngay trong markup → stub phải khớp.
byId('wzStep1').hidden = true;
byId('wzStep2').hidden = true;
byId('wzStep3').hidden = true;
byId('wzStep4').hidden = true;
byId('payCard').hidden = false;
byId('wzSteps').querySelectorAll = sel => (sel === '.wz-step' ? WZ_STEPS : []);

// #payQr nằm trong #payQrBox; showPayCard ẩn/hiện qua qr.parentElement.
byId('payQr').parentElement = byId('payQrBox');

// Dialog huỷ đơn (#cancelModal) là overlay bật/tắt bằng .hidden.
byId('cancelModal').hidden = true;

// 4 mốc wizard phải khớp markup thật (#wzSteps .wz-step[data-wz]).
const WZ_STEPS = [1, 2, 3, 4].map(n => {
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
const syncLog = [];
sandbox.__syncLog = syncLog;
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
          checkout_url: 'https://pay.payos.vn/web/abc',
          // payOS trả chuỗi VietQR, server dựng sẵn ảnh → `qr_image` là data-URL.
          qr_code: '00020101021238540010A000000727012400069704220110970422000000000802VNQRIB',
          qr_image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
          expires_at: new Date(Date.now() + 900000).toISOString(), test_mode: true
        })
      };
    }
    // Đối soát payOS (fallback webhook): đơn vẫn PENDING cho tới khi payOS báo.
    if (/\/sync$/.test(url)) {
      syncLog.push(url);
      return { ok: true, json: async () => ({ success: true, status: 'PENDING', synced: false }) };
    }
    return { ok: true, json: async () => [] };
  }
};
sandbox.fetch = sandbox.Auth.fetch;

const ctx = vm.createContext(sandbox);
vm.runInContext(
  appJs + '\n;globalThis.__t = { createOrder, confirmOrderNext, confirmOrderBack, renderWizard, showResult, showPayCard, payBack, openCancelConfirm, closeCancelConfirm, cancelOrder, syncOrderStatus };',
  ctx, { filename: 'topup-inline.js' }
);

// ---------------------------------------------------------------------------
(async () => {
  const T = ctx.__t;
  console.log('\n== Wizard: createOrder -> confirmOrderNext -> bước 3 ==');

  ok('#wzStep1..4 đều ẩn lúc đầu (chờ loadPackages xong mới hiện)',
    byId('wzStep1').hidden === true && byId('wzStep2').hidden === true
    && byId('wzStep3').hidden === true && byId('wzStep4').hidden === true,
    { s1: byId('wzStep1').hidden });

  T.renderWizard(1);
  ok('renderWizard(1): #wzStep1 hiện, #wzStep2..4 ẩn',
    byId('wzStep1').hidden === false && byId('wzStep2').hidden === true
    && byId('wzStep3').hidden === true && byId('wzStep4').hidden === true);

  await T.createOrder(1);
  ok('createOrder gọi POST /api/credits/topup/create',
    callLog.some(c => /\/api\/credits\/topup\/create$/.test(c.url)), callLog.map(c => c.url).slice(-3));
  ok('sau createOrder: bước 3 (đơn nạp) hiện, bước 1+2+4 ẩn',
    byId('wzStep1').hidden === true && byId('wzStep2').hidden === false
    && byId('wzStep3').hidden === true && byId('wzStep4').hidden === true,
    { s1: byId('wzStep1').hidden, s2: byId('wzStep2').hidden, s3: byId('wzStep3').hidden });
  ok('bảng xác nhận đổ đúng đơn (#wzOrderCode/#wzCredits/#wzAmount)',
    byId('wzOrderCode').textContent === '#4242'
    && byId('wzCredits').textContent === '50 điểm'
    && /50/.test(byId('wzAmount').textContent),
    { code: byId('wzOrderCode').textContent, amount: byId('wzAmount').textContent });

  // Bug đã báo: bấm "Tiếp tục thanh toán" phải sang bước thanh toán (3).
  T.confirmOrderNext();
  ok('confirmOrderNext(): #wzStep3 HIỆN (bug cũ: đứng ở bước đơn nạp)',
    byId('wzStep3').hidden === false, { s3: byId('wzStep3').hidden });
  ok('confirmOrderNext(): #wzStep1/#wzStep2/#wzStep4 ẩn',
    byId('wzStep1').hidden === true && byId('wzStep2').hidden === true
    && byId('wzStep4').hidden === true);
  ok('thanh tiến trình: mốc 3 active, mốc 1+2 done, mốc 4 chưa',
    WZ_STEPS[2].classList.contains('active') && WZ_STEPS[0].classList.contains('done')
    && WZ_STEPS[1].classList.contains('done')
    && !WZ_STEPS[3].classList.contains('done'),
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
  ok('đơn CÓ qr_image → #payQr hiển thị đúng ảnh data-URL',
    byId('payQr').parentElement.hidden === false
    && /^data:image\/png;base64,/.test(byId('payQr').attrs.src || ''),
    { hidden: byId('payQr').parentElement.hidden, src: (byId('payQr').attrs.src || '').slice(0, 32) });
  ok('đơn CÓ qr_image → nhánh dự phòng #payFallback ẩn (không cần link payOS)',
    byId('payFallback').hidden === true);
  ok('KHÔNG còn nút "Thanh toán" mở popup ở bước 3 (QR hiện sẵn trên trang)',
    !/function payNow\(/.test(appJs) && !/id="payNowBtn"/.test(html) && !/id="payModal"/.test(html));
  // Test biên: đơn không có ảnh QR (payOS trả qr_code rỗng / link lỗi / test mode)
  // → ẩn QR và hiện nhánh dự phòng mở trang payOS.
  T.showPayCard({
    order_code: 4242, amount_vnd: 50000, credits: 50, qr_image: '',
    account_number: '123456', description: 'NAP 4242',
    checkout_url: 'https://pay.payos.vn/web/abc',
    expires_at: new Date(Date.now() + 900000).toISOString(), test_mode: true
  });
  ok('đơn KHÔNG có qr_image → ẩn QR + hiện #payFallback + link payOS có href thật',
    byId('payQr').parentElement.hidden === true && byId('payFallback').hidden === false
    && byId('payCheckoutLink').href === 'https://pay.payos.vn/web/abc',
    { qrBox: byId('payQr').parentElement.hidden, fb: byId('payFallback').hidden, href: byId('payCheckoutLink').href });
  ok('bước 4 (kết quả) chưa hiện khi đơn còn PENDING', byId('wzStep4').hidden === true);

  console.log('\n== Bước 3: huỷ đơn qua dialog gộp "Hủy đơn / Đóng" ==');
  // Đang ở bước 3 với đơn PENDING (từ createOrder + confirmOrderNext ở trên).
  T.openCancelConfirm();
  ok('openCancelConfirm(): dialog #cancelModal MỞ + đổ đúng mã đơn',
    byId('cancelModal').hidden === false && byId('cancelModalCode').textContent === '#4242',
    { hidden: byId('cancelModal').hidden, code: byId('cancelModalCode').textContent });
  T.closeCancelConfirm();
  ok('closeCancelConfirm(): dialog đóng, vẫn ở bước 3, KHÔNG gọi /cancel',
    byId('cancelModal').hidden === true && byId('wzStep3').hidden === false
    && !callLog.some(c => /\/api\/credits\/topup\/4242\/cancel$/.test(c.url)),
    { hidden: byId('cancelModal').hidden, calls: callLog.map(c => c.url).slice(-3) });

  T.openCancelConfirm();
  await T.cancelOrder();
  ok('cancelOrder(): gọi /cancel rồi về bước 4 với trạng thái CANCELLED',
    callLog.some(c => /\/api\/credits\/topup\/4242\/cancel$/.test(c.url))
    && byId('cancelModal').hidden === true && byId('wzStep4').hidden === false
    && /CANCELLED/.test(byId('resStatus').innerHTML),
    { st: byId('resStatus').innerHTML, calls: callLog.map(c => c.url).slice(-2) });

  // Về lại bước 3 để kiểm tra đối soát định kỳ.
  T.confirmOrderNext();
  ok('quay lại bước 3 sau khi huỷ: #payCard hiện, dialog đã đóng',
    byId('wzStep3').hidden === false && byId('cancelModal').hidden === true);

  console.log('\n== Đối soát payOS định kỳ (fallback webhook) ==');
  const syncBefore = ctx.__syncLog.length;
  const syncRes = await T.syncOrderStatus(4242);
  ok('syncOrderStatus(): POST /api/credits/topup/<code>/sync + trả status PENDING',
    ctx.__syncLog.length === syncBefore + 1
    && ctx.__syncLog[ctx.__syncLog.length - 1].endsWith('/api/credits/topup/4242/sync')
    && syncRes && syncRes.status === 'PENDING',
    { log: ctx.__syncLog.slice(-1), res: syncRes });

  console.log('\n== Bước 4: showResult(PAID) ==');
  await T.showResult({ order_code: 4242, status: 'PAID', amount_vnd: 50000, credits: 50 });
  ok('showResult(PAID): #wzStep4 hiện, #wzStep3 ẩn',
    byId('wzStep4').hidden === false && byId('wzStep3').hidden === true);
  ok('showResult(PAID): dialog huỷ đơn tự đóng',
    byId('cancelModal').hidden === true);
  ok('kết quả đổ đúng mã đơn + trạng thái PAID',
    byId('resOrder').textContent === '#4242' && /PAID/.test(byId('resStatus').innerHTML),
    { code: byId('resOrder').textContent, st: byId('resStatus').innerHTML });
  ok('thanh tiến trình: cả 4 mốc done/active khi hoàn tất',
    WZ_STEPS.every(s => s.classList.contains('done') || s.classList.contains('active')),
    WZ_STEPS.map(s => [...s.classList._s]));

  console.log('\n== Wizard: guard khi state lệch ==');
  await T.confirmOrderBack();
  ok('confirmOrderBack(): về bước 1 + gọi POST .../cancel',
    byId('wzStep1').hidden === false && byId('wzStep4').hidden === true
    && callLog.some(c => /\/api\/credits\/topup\/4242\/cancel$/.test(c.url)),
    { s1: byId('wzStep1').hidden, calls: callLog.map(c => c.url).slice(-3) });
  T.confirmOrderNext();
  ok('confirmOrderNext() khi chưa có đơn: KHÔNG sang bước 3 + báo lỗi rõ ở #wzMsg',
    byId('wzStep3').hidden === true && byId('wzMsg').textContent.length > 0,
    { s3: byId('wzStep3').hidden, msg: byId('wzMsg').textContent });

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('LỖI TEST:', e); process.exit(1); });
