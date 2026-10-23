/* ==========================================================================
   Cell.id.vn — Ứng dụng di động (/m)
   --------------------------------------------------------------------------
   Một file, không build tool, không phụ thuộc thư viện ngoài Font Awesome.
   Dùng chung `Auth` (public/auth.js) nên đăng nhập ở /m/ có hiệu lực luôn trên
   bản web và ngược lại (cùng origin, cùng localStorage key).

   Bố cục:
     1. Hằng số + tiện ích (esc, toast, thời gian, clipboard)
     2. Gọi API (mApi) — tự xử lý 401/402
     3. Màn đăng nhập / đăng ký / kích hoạt / quên mật khẩu
     4. Khung app: 4 tab, số dư điểm
     5. Tra cứu cell đơn lẻ
     6. Lịch sử tra cứu (CHỈ cell đơn lẻ)
     7. Công cụ: check số điện thoại (VNTA) + chuyển đổi eNB ↔ ECI
     8. Tài khoản
     9. PWA (cài đặt + service worker)
    10. Khởi động
   ========================================================================== */
(function () {
  'use strict';

  // ==========================================================================
  // 1. HẰNG SỐ + TIỆN ÍCH
  // ==========================================================================
  var LS_FORM = 'm_lookup_form';
  var LS_INSTALL = 'm_install_dismissed';

  var RADIO = {
    GSM: { label: '2G', full: 'GSM / 2G', color: '#d9534f' },
    CDMA: { label: 'CDMA', full: 'CDMA', color: '#8b6fd1' },
    UMTS: { label: '3G', full: 'UMTS / 3G', color: '#d9952a' },
    LTE: { label: '4G', full: 'LTE / 4G', color: '#2e9e5b' },
    NR: { label: '5G', full: 'NR / 5G', color: '#1a6cf0' },
    'NB-IoT': { label: 'NB', full: 'NB-IoT', color: '#0d9488' },
    IOT: { label: 'IoT', full: 'IoT', color: '#0d9488' }
  };

  // Nguồn dữ liệu → nhãn hiển thị (khớp bảng ONLINE_SOURCE_DEFAULTS ở server.js).
  var SOURCES = {
    local: 'CSDL nội bộ',
    opencellid: 'OpenCellID.org',
    opencellid_web: 'OpenCellID.org (web)',
    t0stbrot: 't0stbrot.net',
    google: 'Google Geolocation',
    combain: 'Combain.com'
  };

  var ECI_MAX = 268435455; // 2^28 - 1
  var SHORT_MAX = 1048576; // 2^20 — trên mức này coi là ECI

  var CREDIT_CFG = null;
  var LAST_LOOKUP = null;

  function $(id) { return document.getElementById(id); }

  /** Escape cho mọi dữ liệu do máy chủ trả về trước khi nhúng vào innerHTML. */
  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /**
   * SQLite trả `created_at` dạng "2026-10-20 14:57:13" theo UTC **không kèm
   * hậu tố múi giờ**; `new Date(chuỗi)` của JS sẽ hiểu là giờ địa phương và
   * lệch đúng offset người xem. Chuỗi không có zone → dựng bằng Date.UTC.
   */
  function parseServerTime(ts) {
    if (ts === null || ts === undefined || ts === '') return null;
    if (ts instanceof Date) return isNaN(ts.getTime()) ? null : ts;
    if (typeof ts === 'number') { var dn = new Date(ts); return isNaN(dn.getTime()) ? null : dn; }
    var s = String(ts).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/);
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)));
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  /** "21:57" nếu hôm nay, "20/10/2026 21:57" nếu khác ngày. */
  function fmtTime(ts) {
    var d = parseServerTime(ts);
    if (!d) return '—';
    var now = new Date();
    var hm = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    if (d.toDateString() === now.toDateString()) return hm;
    return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + hm;
  }

  function fmtNum(n) {
    var v = Number(n);
    if (!isFinite(v)) return '—';
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
  }

  function radioStyle(radio) {
    var key = String(radio || '').trim();
    var upper = key.toUpperCase();
    var hit = null;
    Object.keys(RADIO).forEach(function (k) {
      if (!hit && k.toUpperCase() === upper) hit = RADIO[k];
    });
    if (!hit && upper === 'NBIOT') hit = RADIO['NB-IoT'];
    return hit ? { key: key, label: hit.label, full: hit.full, color: hit.color } : null;
  }

  function sourceLabel(src) {
    if (!src) return 'Không rõ';
    return SOURCES[src] || src;
  }

  /** Toast ngắn ở đáy màn hình. type: '' | 'ok' | 'err'. */
  function toast(msg, type) {
    var wrap = $('mToast');
    if (!wrap) return;
    var el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    el.textContent = String(msg == null ? '' : msg);
    wrap.appendChild(el);
    setTimeout(function () {
      el.style.opacity = '0';
      el.style.transition = 'opacity .25s';
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
    }, 3200);
  }

  /** Copy có fallback cho trình duyệt không có Clipboard API / không HTTPS. */
  function copyText(text) {
    var s = String(text == null ? '' : text);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(s).then(function () { toast('Đã copy: ' + s, 'ok'); },
        function () { legacyCopy(s); });
      return;
    }
    legacyCopy(s);
  }
  function legacyCopy(s) {
    try {
      var ta = document.createElement('textarea');
      ta.value = s;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      toast(ok ? 'Đã copy: ' + s : 'Không copy được, hãy chọn và copy tay: ' + s, ok ? 'ok' : 'err');
    } catch (e) {
      toast('Không copy được: ' + s, 'err');
    }
  }

  function showErr(id, msg) {
    var el = $(id);
    if (!el) { toast(msg, 'err'); return; }
    el.textContent = String(msg || '');
    el.hidden = !msg;
  }
  function clearErr(id) { var el = $(id); if (el) { el.textContent = ''; el.hidden = true; } }

  function setBusy(btn, busy, label) {
    if (!btn) return;
    btn.classList.toggle('busy', !!busy);
    btn.disabled = !!busy;
    if (label) {
      var t = btn.querySelector('.btn-txt');
      if (t) t.innerHTML = label;
    }
  }

  // ==========================================================================
  // 2. GỌI API
  // ==========================================================================
  /**
   * Gọi API nội bộ. Ném Error có `.code` = mã HTTP (0 = mất mạng).
   * 401 → kết thúc phiên + về màn đăng nhập (trừ khi đang ở màn đăng nhập).
   * 402 → giữ `.balance` / `.required` để UI hiện "không đủ điểm".
   */
  async function mApi(method, path, body) {
    var headers = { Accept: 'application/json' };
    var tok = Auth.getToken();
    if (tok) headers.Authorization = 'Bearer ' + tok;
    var opts = { method: method, headers: headers };
    if (body !== undefined && body !== null) {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }

    var res;
    try { res = await fetch(path, opts); }
    catch (e) {
      var ne = new Error('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
      ne.code = 0;
      throw ne;
    }

    var txt = '';
    try { txt = await res.text(); } catch (e) { txt = ''; }
    var data = null;
    if (txt) { try { data = JSON.parse(txt); } catch (e) { data = null; } }

    if (res.status === 401) {
      sessionExpired();
      var ae = new Error((data && data.error) || 'Phiên đăng nhập đã hết hạn');
      ae.code = 401;
      throw ae;
    }
    // Website đóng giữa phiên → về trang thông báo bảo trì ngay.
    if (res.status === 403 && res.headers.get('X-Site-Closed') === '1') {
      window.location.replace('/maintenance.html');
      var ce = new Error((data && data.error) || 'Website đang bảo trì');
      ce.code = 403;
      ce.reason = 'SITE_CLOSED';
      throw ce;
    }
    if (!res.ok) {
      var err = new Error((data && data.error) || ('Máy chủ trả về ' + res.status));
      err.code = res.status;
      if (data) {
        err.balance = data.balance;
        err.required = data.required;
        err.reason = data.reason;
        err.data = data;
      }
      throw err;
    }
    return data || {};
  }

  function sessionExpired() {
    if (!Auth.getToken()) return;
    Auth.clearSession();
    mAuthView('login');
    showErr('mLoginErr', 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
  }

  // ==========================================================================
  // 3. ĐĂNG NHẬP / ĐĂNG KÝ / KÍCH HOẠT / QUÊN MẬT KHẨU
  // ==========================================================================
  var authState = { view: 'login', captcha: { reg: null, forgot: null }, email: '', username: '' };

  var AUTH_SUB = {
    login: 'Đăng nhập để tra cứu cell',
    register: 'Tạo tài khoản miễn phí',
    verify: 'Kích hoạt tài khoản bằng mã trong email',
    forgot: 'Đặt lại mật khẩu qua email',
    reset: 'Nhập mã xác nhận và mật khẩu mới'
  };

  function mAuthView(view) {
    var v = view || 'login';
    authState.view = v;
    var auth = $('authScreen'), app = $('appScreen');
    if (app) app.hidden = true;
    if (auth) auth.hidden = false;

    var forms = {
      login: 'mLoginForm', register: 'mRegisterForm', verify: 'mVerifyForm',
      forgot: 'mForgotForm', reset: 'mResetForm'
    };
    Object.keys(forms).forEach(function (k) {
      var f = $(forms[k]);
      if (f) f.hidden = (k !== v);
    });

    var tabs = document.querySelector('.auth-tabs');
    if (tabs) tabs.hidden = !(v === 'login' || v === 'register');

    var tl = $('authTabLogin'), tr = $('authTabRegister');
    if (tl) { tl.classList.toggle('active', v === 'login'); tl.setAttribute('aria-selected', v === 'login' ? 'true' : 'false'); }
    if (tr) { tr.classList.toggle('active', v === 'register'); tr.setAttribute('aria-selected', v === 'register' ? 'true' : 'false'); }

    var sub = $('authSub');
    if (sub) sub.textContent = AUTH_SUB[v] || AUTH_SUB.login;

    ['mLoginErr', 'mRegErr', 'mVerifyErr', 'mForgotErr', 'mResetErr'].forEach(clearErr);

    if (v === 'register' && !authState.captcha.reg) mLoadCaptcha('reg');
    if (v === 'forgot' && !authState.captcha.forgot) mLoadCaptcha('forgot');
    if (v === 'reset') {
      var re = $('mResetEmail');
      if (re && authState.email) re.value = authState.email;
    }
    // Banner "Cài ứng dụng" neo ở đáy màn hình → ẩn khi quay về màn đăng nhập
    // (không được che nút Đăng nhập / Tạo tài khoản).
    mMaybeShowInstall();
    window.scrollTo(0, 0);
  }

  function mAuthTab(name) {
    if (name === 'register') { authState.captcha.reg = null; }
    mAuthView(name === 'register' ? 'register' : 'login');
    if (name === 'register') mLoadCaptcha('reg');
  }

  /**
   * Captcha chữ: `/api/captcha` trả `{ id, text }`, client tự vẽ lên canvas rồi
   * đổi thành dataURL cho thẻ <img>. `which` = 'reg' | 'forgot'.
   */
  function mLoadCaptcha(which) {
    var w = which === 'forgot' ? 'forgot' : 'reg';
    var img = $(w === 'forgot' ? 'mCapImgF' : 'mCapImg');
    var ph = $(w === 'forgot' ? 'mCapPhF' : 'mCapPh');
    if (img) { img.hidden = true; img.removeAttribute('src'); }
    if (ph) {
      ph.hidden = false;
      ph.innerHTML = '<i class="fas fa-spinner spin"></i>';
    }
    authState.captcha[w] = null;

    var tries = 0;
    (function attempt() {
      fetch('/api/captcha', { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || !d.text || !d.id) throw new Error('bad captcha');
          authState.captcha[w] = { id: d.id };
          drawCaptcha(img, ph, d.text);
        })
        .catch(function () {
          if (++tries < 3) { setTimeout(attempt, 400 * tries); return; }
          if (ph) {
            ph.hidden = false;
            ph.innerHTML = '<span style="font-size:10px;line-height:1.2;text-align:center">Lỗi tải mã<br>bấm thử lại</span>';
          }
        });
    })();
  }

  function drawCaptcha(img, ph, text) {
    if (!img) return;
    var W = 132, H = 44, scale = 2;
    var cv = document.createElement('canvas');
    cv.width = W * scale;
    cv.height = H * scale;
    var ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);
    var i;
    for (i = 0; i < 4; i++) {
      ctx.strokeStyle = 'rgba(120,170,230,' + (0.12 + Math.random() * 0.18) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.random() * W, Math.random() * H);
      ctx.lineTo(Math.random() * W, Math.random() * H);
      ctx.stroke();
    }
    for (i = 0; i < 22; i++) {
      ctx.fillStyle = 'rgba(150,200,255,' + (0.08 + Math.random() * 0.2) + ')';
      ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
    var chars = String(text).split('');
    var step = (W - 12) / Math.max(1, chars.length);
    var colors = ['#7dd3fc', '#a5b4fc', '#86efac', '#fdba74', '#f9a8d4'];
    ctx.font = 'bold 22px Consolas, monospace';
    ctx.textBaseline = 'middle';
    for (i = 0; i < chars.length; i++) {
      ctx.save();
      ctx.translate(8 + i * step + step / 2, H / 2);
      ctx.rotate((Math.random() - 0.5) * 0.5);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillText(chars[i], -7, 0);
      ctx.restore();
    }
    img.src = cv.toDataURL('image/png');
    img.hidden = false;
    if (ph) ph.hidden = true;
  }

  function mTogglePass(inputId, btn) {
    var inp = $(inputId);
    if (!inp) return;
    var show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    if (btn) {
      btn.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
      btn.innerHTML = '<i class="fas ' + (show ? 'fa-eye-slash' : 'fa-eye') + '"></i>';
    }
  }

  // ----- Đăng nhập -----
  async function mDoLogin(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    clearErr('mLoginErr');
    var user = ($('mLoginUser').value || '').trim();
    var pass = $('mLoginPass').value || '';
    if (!user) { showErr('mLoginErr', 'Nhập tên đăng nhập hoặc email.'); return; }
    if (!pass) { showErr('mLoginErr', 'Nhập mật khẩu.'); return; }

    var btn = $('mLoginBtn');
    setBusy(btn, true);
    try {
      var d = await Auth.login(user, pass);
      mFinishLogin(d);
    } catch (e) {
      var data = e && e.data;
      // Website đang bảo trì: chỉ admin được đăng nhập, người thường về trang
      // thông báo giống trang chủ.
      if (data && data.reason === 'SITE_CLOSED') {
        window.location.replace('/maintenance.html?from=login');
        return;
      }
      if (data && data.reason === 'EMAIL_NOT_VERIFIED') {
        authState.email = '';
        authState.username = user;
        var note = $('mVerifyNote');
        if (note) {
          note.textContent = 'Tài khoản chưa kích hoạt. Nhập mã 6 số đã gửi tới ' +
            (data.email || 'email của bạn') + '.';
        }
        var code = $('mVerifyCode');
        if (code) code.value = '';
        mAuthView('verify');
        return;
      }
      showErr('mLoginErr', friendlyAuthError(data, e));
    } finally {
      setBusy(btn, false);
    }
  }

  /** Dịch thông điệp lỗi auth của server sang tiếng Việt dễ hiểu. */
  function friendlyAuthError(data, e) {
    var raw = (data && data.error) || (e && e.message) || 'Đăng nhập không thành công';
    if (/invalid credentials/i.test(raw)) return 'Sai tên đăng nhập hoặc mật khẩu.';
    if (/no token|invalid token/i.test(raw)) return 'Phiên đăng nhập không hợp lệ, thử lại.';
    if (/too many/i.test(raw)) return 'Bạn thử quá nhiều lần, chờ ít phút rồi thử lại.';
    return raw;
  }

  // ----- Đăng ký -----
  async function mDoRegister(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    clearErr('mRegErr');
    var uname = ($('mRegUser').value || '').trim();
    var email = ($('mRegEmail').value || '').trim();
    var p1 = $('mRegPass').value || '';
    var p2 = $('mRegPass2').value || '';
    var cap = ($('mRegCaptcha').value || '').trim();
    var terms = $('mRegTerms').checked;

    if (uname.length < 3 || uname.length > 32) { showErr('mRegErr', 'Tên đăng nhập phải từ 3 đến 32 ký tự.'); return; }
    if (!/^[A-Za-z0-9._-]+$/.test(uname)) { showErr('mRegErr', 'Tên đăng nhập chỉ dùng chữ, số và . _ -'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { showErr('mRegErr', 'Email không hợp lệ.'); return; }
    if (p1.length < 6) { showErr('mRegErr', 'Mật khẩu phải có ít nhất 6 ký tự.'); return; }
    if (p1 !== p2) { showErr('mRegErr', 'Hai mật khẩu không khớp.'); return; }
    if (!cap) { showErr('mRegErr', 'Nhập mã xác nhận bên phải.'); return; }
    if (!terms) { showErr('mRegErr', 'Bạn cần đồng ý điều khoản sử dụng.'); return; }
    var capId = authState.captcha.reg && authState.captcha.reg.id;
    if (!capId) { showErr('mRegErr', 'Mã xác nhận chưa tải xong, bấm vào ô mã để tải lại.'); return; }

    var btn = $('mRegBtn');
    setBusy(btn, true);
    try {
      var d = await Auth.register({
        username: uname, password: p1, email: email,
        captchaId: capId, captcha: cap, acceptTerms: true
      });
      authState.username = uname;
      authState.email = email;

      var note = $('mVerifyNote');
      var mailTxt = d && d.mail_sent
        ? 'Đã gửi mã 6 số tới ' + (d.email || email) + '. Nhập mã để kích hoạt tài khoản.'
        : 'Nhập mã 6 số đã gửi tới ' + ((d && d.email) || email) + '.';
      if (d && d.dev_code) {
        mailTxt += ' (Máy chủ chưa cấu hình SMTP — mã dùng thử: ' + d.dev_code + ')';
      }
      if (note) note.textContent = mailTxt;
      var vc = $('mVerifyCode');
      if (vc) vc.value = (d && d.dev_code) ? String(d.dev_code) : '';
      toast('Đã tạo tài khoản. Kiểm tra email để lấy mã kích hoạt.', 'ok');
      mAuthView('verify');
    } catch (e) {
      var data = e && e.data;
      showErr('mRegErr', (data && data.error) || (e && e.message) || 'Đăng ký không thành công');
      if (data && data.reason === 'BAD_CAPTCHA') {
        authState.captcha.reg = null;
        mLoadCaptcha('reg');
        var ci = $('mRegCaptcha');
        if (ci) ci.value = '';
      }
    } finally {
      setBusy(btn, false);
    }
  }

  // ----- Kích hoạt email -----
  async function mDoVerify(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    clearErr('mVerifyErr');
    var code = ($('mVerifyCode').value || '').trim();
    if (!/^\d{6}$/.test(code)) { showErr('mVerifyErr', 'Mã xác nhận gồm 6 chữ số.'); return; }
    var btn = $('mVerifyBtn');
    setBusy(btn, true);
    try {
      var d = await mApi('POST', '/api/verify-email', {
        email: authState.email || undefined,
        username: authState.username || undefined,
        code: code
      });
      mFinishLogin(d);
      toast('Kích hoạt thành công!', 'ok');
    } catch (e) {
      var extra = (e.data && e.data.attempts_left != null) ? ' (còn ' + e.data.attempts_left + ' lần)' : '';
      showErr('mVerifyErr', (e.message || 'Không kích hoạt được') + extra);
    } finally {
      setBusy(btn, false);
    }
  }

  async function mResendVerify() {
    clearErr('mVerifyErr');
    try {
      var d = await mApi('POST', '/api/resend-verification', {
        email: authState.email || undefined,
        username: authState.username || undefined
      });
      if (d && d.sent) { toast('Đã gửi lại mã tới ' + (d.email || 'email của bạn'), 'ok'); return; }
      if (d && d.dev_code) {
        var vc = $('mVerifyCode');
        if (vc) vc.value = String(d.dev_code);
        toast('Chưa cấu hình SMTP — mã dùng thử: ' + d.dev_code, 'ok');
        return;
      }
      toast('Nếu tài khoản tồn tại, mã mới đã được gửi.', '');
    } catch (e) {
      showErr('mVerifyErr', e.message || 'Không gửi lại được mã');
    }
  }

  // ----- Quên mật khẩu -----
  async function mForgot() {
    authState.email = authState.email || ($('mLoginUser').value || '').trim();
    if (authState.email && /@/.test(authState.email)) {
      var fe = $('mForgotEmail');
      if (fe) fe.value = authState.email;
    }
    authState.captcha.forgot = null;
    mAuthView('forgot');
    mLoadCaptcha('forgot');
  }

  async function mDoForgot(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    clearErr('mForgotErr');
    var email = ($('mForgotEmail').value || '').trim();
    var cap = ($('mForgotCaptcha').value || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { showErr('mForgotErr', 'Email không hợp lệ.'); return; }
    if (!cap) { showErr('mForgotErr', 'Nhập mã xác nhận bên phải.'); return; }
    var capId = authState.captcha.forgot && authState.captcha.forgot.id;
    if (!capId) { showErr('mForgotErr', 'Mã xác nhận chưa tải xong, bấm vào ô mã để tải lại.'); return; }

    var btn = $('mForgotBtn');
    setBusy(btn, true);
    try {
      var d = await mApi('POST', '/api/forgot-password', {
        email: email, captchaId: capId, captcha: cap
      });
      authState.email = email;
      var note = $('mResetNote');
      var txt = 'Nhập mã 6 số đã gửi tới ' + ((d && d.email) || email) + ' và mật khẩu mới.';
      if (d && d.dev_code) txt += ' (Máy chủ chưa cấu hình SMTP — mã dùng thử: ' + d.dev_code + ')';
      if (note) note.textContent = txt;
      var rc = $('mResetCode');
      if (rc) rc.value = (d && d.dev_code) ? String(d.dev_code) : '';
      mAuthView('reset');
      toast('Đã gửi mã đặt lại mật khẩu.', 'ok');
    } catch (e) {
      showErr('mForgotErr', e.message || 'Không gửi được mã');
      if (e.reason === 'BAD_CAPTCHA') {
        authState.captcha.forgot = null;
        mLoadCaptcha('forgot');
        var ci = $('mForgotCaptcha');
        if (ci) ci.value = '';
      }
    } finally {
      setBusy(btn, false);
    }
  }

  async function mDoReset(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    clearErr('mResetErr');
    var email = ($('mResetEmail').value || '').trim();
    var code = ($('mResetCode').value || '').trim();
    var p1 = $('mResetPass').value || '';
    var p2 = $('mResetPass2').value || '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { showErr('mResetErr', 'Email không hợp lệ.'); return; }
    if (!/^\d{6}$/.test(code)) { showErr('mResetErr', 'Mã xác nhận gồm 6 chữ số.'); return; }
    if (p1.length < 6) { showErr('mResetErr', 'Mật khẩu phải có ít nhất 6 ký tự.'); return; }
    if (p1 !== p2) { showErr('mResetErr', 'Hai mật khẩu không khớp.'); return; }

    var btn = $('mResetBtn');
    setBusy(btn, true);
    try {
      var d = await mApi('POST', '/api/reset-password', { email: email, code: code, newPassword: p1 });
      mFinishLogin(d);
      toast('Đã đổi mật khẩu và đăng nhập.', 'ok');
    } catch (e) {
      var extra = (e.data && e.data.attempts_left != null) ? ' (còn ' + e.data.attempts_left + ' lần)' : '';
      showErr('mResetErr', (e.message || 'Không đổi được mật khẩu') + extra);
    } finally {
      setBusy(btn, false);
    }
  }

  /** Lưu token + user rồi vào app (dùng cho login, kích hoạt, đặt lại mật khẩu). */
  function mFinishLogin(d) {
    if (!d || !d.token) {
      showErr('mLoginErr', 'Máy chủ không trả token đăng nhập.');
      return;
    }
    Auth.setToken(d.token);
    if (d.user) Auth.setUser(d.user);
    mEnterApp();
  }

  // ==========================================================================
  // 4. KHUNG APP
  // ==========================================================================
  var mState = { tab: 'lookup', firstHistory: true, creditLoaded: false };

  var TAB_TITLES = {
    lookup: 'Tra cứu cell',
    history: 'Lịch sử tra cứu',
    tools: 'Công cụ',
    account: 'Tài khoản'
  };

  function mEnterApp() {
    var auth = $('authScreen'), app = $('appScreen');
    if (auth) auth.hidden = true;
    if (app) app.hidden = false;

    var user = Auth.getUser() || {};
    var hello = $('topHello');
    if (hello) hello.textContent = user.username ? ('Xin chào, ' + user.username) : 'Xin chào';
    var av = $('mAcctAvatar');
    if (av) av.textContent = (user.username || '?').slice(0, 2).toUpperCase();
    var nm = $('mAcctName');
    if (nm) nm.textContent = user.username || '—';
    var rl = $('mAcctRole');
    if (rl) rl.textContent = user.email || (user.role === 'admin' ? 'Quản trị viên' : 'Thành viên');

    mSetCredit(user.credit_balance != null ? user.credit_balance : null);
    mTab(['lookup', 'history', 'tools', 'account'].indexOf(hashTab()) >= 0 ? hashTab() : 'lookup');

    mLoadCreditConfig();
    mRefreshBalance();
    mLoadVersion();
    // Trình duyệt có thể đã bắn `beforeinstallprompt` trước khi đăng nhập xong.
    // (service worker đăng ký 1 lần trong mBoot, không phụ thuộc đăng nhập.)
    mMaybeShowInstall();
  }

  function mTab(name, silent) {
    var tab = TAB_TITLES[name] ? name : 'lookup';
    mState.tab = tab;

    // Ghi tab vào URL để: (1) shortcut PWA mở đúng tab, (2) nút Back của
    // Android quay về tab trước thay vì thoát app. `pushState` không bắn
    // `hashchange` nên không gây vòng lặp; lần đầu dùng `replaceState` để
    // không tạo thêm 1 mục lịch sử ngay khi mở app.
    if (!silent) {
      var h = '#' + tab;
      if (location.hash !== h) {
        try {
          if (mState.navReady) history.pushState({ tab: tab }, '', h);
          else { history.replaceState({ tab: tab }, '', h); mState.navReady = true; }
        } catch (e) { mState.navReady = true; }
      } else {
        mState.navReady = true;
      }
    } else {
      mState.navReady = true;
    }

    var pages = document.querySelectorAll('.page');
    for (var i = 0; i < pages.length; i++) {
      pages[i].classList.toggle('active', pages[i].getAttribute('data-page') === tab);
    }
    var btns = document.querySelectorAll('.tabbtn');
    for (var j = 0; j < btns.length; j++) {
      var on = btns[j].getAttribute('data-tab') === tab;
      btns[j].classList.toggle('active', on);
      if (on) btns[j].setAttribute('aria-current', 'page');
      else btns[j].removeAttribute('aria-current');
    }
    var title = $('topTitle');
    if (title) title.textContent = TAB_TITLES[tab];

    if (tab === 'history') {
      if (mState.firstHistory || histState.dirty) {
        mState.firstHistory = false;
        histState.dirty = false;
        mHistLoad(true);
      }
    } else if (tab === 'tools') {
      // Captcha VNTA chỉ tải khi người dùng thực sự mở công cụ check số
      // (xem mToolToggle) — mặc định công cụ đóng nên không tải trước.
    } else if (tab === 'account') {
      mRefreshBalance();
    }
    window.scrollTo(0, 0);
  }

  /** Số dư điểm hiển thị ở topbar + tab Tài khoản. */
  function mSetCredit(balance) {
    var txt = balance === null || balance === undefined ? '—' : fmtNum(balance);
    var top = $('topCreditTxt');
    if (top) top.textContent = txt;
    var acc = $('mAcctCredit');
    if (acc) acc.textContent = txt;
  }

  async function mLoadCreditConfig() {
    try {
      var cfg = await mApi('GET', '/api/credits/config');
      CREDIT_CFG = cfg || null;
      mUpdateCostHint();
    } catch (e) { /* không chặn UI */ }
  }

  function mUpdateCostHint() {
    var el = $('mLkCost');
    if (!el) return;
    if (!CREDIT_CFG) { el.textContent = 'Mỗi lần tra cứu thành công sẽ trừ điểm theo cấu hình hệ thống.'; return; }
    if (!CREDIT_CFG.enabled) { el.textContent = 'Hệ thống đang miễn phí — tra cứu không tốn điểm.'; return; }
    var cost = fmtNum(CREDIT_CFG.cost);
    var bal = Auth.getCreditBalance();
    el.textContent = 'Mỗi cell tra thành công tốn ' + cost + ' điểm' +
      (bal != null ? ' (bạn còn ' + fmtNum(bal) + ' điểm).' : '.');
  }

  async function mRefreshBalance() {
    if (!Auth.getToken()) return;
    try {
      var d = await mApi('GET', '/api/credits/balance');
      if (d && d.balance != null) {
        Auth.setCreditBalance(d.balance);
        mSetCredit(d.balance);
        if (!CREDIT_CFG && d.cost != null) {
          CREDIT_CFG = { enabled: !!d.enabled, cost: d.cost, signup_bonus: d.signup_bonus };
          mUpdateCostHint();
        }
      }
    } catch (e) { /* im lặng */ }
  }

  async function mLoadVersion() {
    try {
      var d = await mApi('GET', '/api/version');
      var el = $('mVer');
      if (el && d && d.version) el.textContent = 'Cell.id.vn v' + d.version + ' · bản di động';
    } catch (e) { /* im lặng */ }
  }

  function mRefreshMe() {
    Auth.checkSession().then(function (user) {
      if (!user) { mAuthView('login'); return; }
      var hello = $('topHello');
      if (hello) hello.textContent = 'Xin chào, ' + user.username;
      var nm = $('mAcctName');
      if (nm) nm.textContent = user.username;
      var rl = $('mAcctRole');
      if (rl) rl.textContent = user.email || (user.role === 'admin' ? 'Quản trị viên' : 'Thành viên');
      var av = $('mAcctAvatar');
      if (av) av.textContent = (user.username || '?').slice(0, 2).toUpperCase();
      mSetCredit(user.credit_balance);
      mRefreshBalance();
      mLoadVersion();
      toast('Đã làm mới thông tin.', 'ok');
    });
  }

  function mLogout() {
    if (!window.confirm('Đăng xuất khỏi ứng dụng?')) return;
    Auth.clearSession();
    LAST_LOOKUP = null;
    mLkMapBtnToggle(false);   // không còn cell nào → ẩn lối tắt bản đồ
    histState.rows = {};
    var list = $('mHistList');
    if (list) list.innerHTML = '';
    var res = $('mLkResult');
    if (res) { res.hidden = true; res.innerHTML = ''; }
    mState.firstHistory = true;
    mAuthView('login');
    toast('Đã đăng xuất.', '');
  }

  function mOpenDesktop() { window.location.href = '/index.html'; }

  // ==========================================================================
  // 4a. NẠP ĐIỂM (payOS) — bottom sheet toàn màn hình
  // ==========================================================================
  // Luồng: chọn gói (hoặc nhập số tiền tự do) → POST tạo đơn → hiện QR/đơn chờ
  // → hỏi trạng thái định kỳ (kèm đối soát với payOS) → PAID thì cộng số dư.
  // Server tự tính điểm từ gói; client KHÔNG gửi số điểm lên.
  var TP = {
    cfg: null,        // { available, vnd_per_credit, min_vnd, max_vnd, packages, test_mode }
    pkgId: null,      // gói đang chọn; null = nạp tự do
    amount: 0,        // số tiền tự do (VND)
    order: null,      // đơn hiện tại
    skipResume: false, // true = đừng tự mở lại đơn PENDING (sau khi bấm "Tạo đơn khác")
    pollTimer: null,
    tickTimer: null,
    syncAt: 0,
    loading: false,
    paidShown: false
  };

  var TP_STATUS = {
    PENDING: { label: 'Chờ thanh toán', cls: 'pending' },
    PAID: { label: 'Đã thanh toán', cls: 'ok' },
    CANCELLED: { label: 'Đã huỷ', cls: 'off' },
    EXPIRED: { label: 'Hết hạn', cls: 'off' },
    UNDERPAID: { label: 'Chuyển thiếu tiền', cls: 'warn' },
    FAILED: { label: 'Thất bại', cls: 'err' }
  };

  function tpStatus(s) {
    return TP_STATUS[String(s || '').toUpperCase()] || { label: String(s || '—'), cls: 'off' };
  }

  function tpVnd(n) {
    var v = Number(n);
    if (!isFinite(v)) return '—';
    return Math.round(v).toLocaleString('vi-VN') + 'đ';
  }

  function tpCredits(amount) {
    var per = TP.cfg && Number(TP.cfg.vnd_per_credit) > 0 ? Number(TP.cfg.vnd_per_credit) : 1000;
    return Math.round((Number(amount) / per) * 10000) / 10000;
  }

  function tpStopTimers() {
    if (TP.pollTimer) { clearInterval(TP.pollTimer); TP.pollTimer = null; }
    if (TP.tickTimer) { clearInterval(TP.tickTimer); TP.tickTimer = null; }
  }

  function tpBody() { return $('mTopupBody'); }

  function tpSub(text) {
    var el = $('mTopupSub');
    if (el) el.textContent = text;
  }

  /** Số dư hiện tại (đọc từ topbar, fallback tab Tài khoản). */
  function tpBalanceText() {
    var el = $('topCreditTxt') || $('mAcctCredit');
    var v = el ? String(el.textContent || '').trim() : '';
    return (v && v !== '—') ? v : '—';
  }

  function mOpenTopup() {
    var sheet = $('mTopupSheet');
    if (!sheet) return;
    // Mở lại thì LUÔN bắt đầu từ màn chọn gói. Không xoá `TP.order` ở đây thì
    // lần mở sau vẫn hiện đơn vừa nạp xong (màn "Đã thanh toán" của lần trước)
    // thay vì trang nạp tiền — đơn PENDING (nếu có) sẽ được mTopupLoad tự mở lại.
    tpStopTimers();
    TP.order = null;
    TP.paidShown = false;
    TP.skipResume = false;
    TP.pkgId = null;
    TP.amount = 0;
    sheet.hidden = false;
    sheet.setAttribute('aria-hidden', 'false');
    document.body.classList.add('map-open');
    try { history.pushState({ topup: 1 }, '', location.hash || '#account'); } catch (e) { /* ignore */ }
    tpSub('Số dư: ' + tpBalanceText() + ' điểm');
    mTopupLoad();
  }

  function mCloseTopup(fromHistory) {
    var sheet = $('mTopupSheet');
    if (!sheet || sheet.hidden) return;
    tpStopTimers();
    // Đóng là kết thúc phiên nạp: lần mở sau phải vào màn chọn gói, không phải
    // màn kết quả của đơn vừa thanh toán.
    TP.order = null;
    TP.paidShown = false;
    sheet.hidden = true;
    sheet.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('map-open');
    if (!fromHistory) {
      try { if (history.state && history.state.topup) history.back(); } catch (e) { /* ignore */ }
    }
  }

  /** Tải cấu hình + gói + đơn gần đây rồi vẽ màn chọn gói. */
  async function mTopupLoad() {
    var body = tpBody();
    if (!body) return;
    if (TP.loading) return;
    TP.loading = true;
    if (!TP.order) {
      body.innerHTML = '<div class="topup-loading"><i class="fas fa-spinner spin"></i> Đang tải…</div>';
    }
    try {
      var cfg = await mApi('GET', '/api/credits/packages');
      TP.cfg = cfg || {};
      var orders = [];
      try { orders = await mApi('GET', '/api/credits/topup?limit=5'); } catch (e) { orders = []; }
      if (!Array.isArray(orders)) orders = [];
      // Đơn đang chờ → vào thẳng màn đơn đó thay vì bắt tạo đơn mới
      // (trừ khi người dùng vừa bấm "Tạo đơn khác").
      var pending = TP.skipResume ? null :
        orders.filter(function (o) { return o && String(o.status).toUpperCase() === 'PENDING'; })[0];
      TP.skipResume = false;
      if (pending && !TP.order) {
        TP.order = pending;
        tpRenderOrder(pending);
        tpStartPolling();
      } else if (!TP.order) {
        tpRenderChoose(orders);
      }
    } catch (e) {
      if (e.code === 401) return; // đã chuyển về màn đăng nhập
      body.innerHTML = '<div class="tp-msg err"><i class="fas fa-triangle-exclamation"></i>' +
        esc(e.message || 'Không tải được thông tin nạp điểm.') +
        '<button type="button" class="btn-ghost" onclick="mTopupLoad()">Thử lại</button></div>';
    } finally {
      TP.loading = false;
    }
  }

  // ----- Màn 1: chọn gói -----
  function tpRenderChoose(orders) {
    var body = tpBody();
    if (!body) return;
    var cfg = TP.cfg || {};
    var pkgs = Array.isArray(cfg.packages) ? cfg.packages : [];
    var avail = cfg.available === true;

    var html = '';

    if (!avail) {
      html += '<div class="tp-note warn"><i class="fas fa-circle-info"></i>' +
        'Cổng nạp điểm đang tạm đóng. Vui lòng quay lại sau hoặc liên hệ quản trị viên.</div>';
    }

    html += '<div class="tp-sec-hd">Chọn gói nạp</div>';
    if (pkgs.length) {
      html += '<div class="tp-pkgs">' + pkgs.map(function (p) {
        var on = String(TP.pkgId) === String(p.id);
        return '<button type="button" class="tp-pkg' + (on ? ' on' : '') + '" data-pkg="' + esc(p.id) + '"' +
          (avail ? ' onclick="mPickPackage(' + Number(p.id) + ')"' : ' disabled') + '>' +
          '<b>' + esc(p.label || tpVnd(p.amount_vnd)) + '</b>' +
          '<span class="tp-pkg-amt">' + esc(tpVnd(p.amount_vnd)) + '</span>' +
          '<span class="tp-pkg-cr"><i class="fas fa-gem"></i> ' + esc(fmtNum(p.credits)) + ' điểm</span>' +
          '</button>';
      }).join('') + '</div>';
    } else if (avail) {
      html += '<div class="tp-note"><i class="fas fa-circle-info"></i>Chưa có gói nạp nào được bật — dùng nạp tự do bên dưới.</div>';
    }

    if (avail) {
      html += '<div class="tp-sec-hd">Hoặc nạp số tiền tự do</div>' +
        '<label class="fld"><span class="fld-lbl">Số tiền (VND)</span>' +
        '<input type="tel" inputmode="numeric" id="mTpAmount" placeholder="' + esc(cfg.min_vnd || 10000) + '"' +
        ' value="' + esc(TP.amount || '') + '" oninput="mTpAmountInput(this.value)"></label>' +
        '<p class="hint" id="mTpAmountHint">Từ ' + esc(tpVnd(cfg.min_vnd || 10000)) +
        ' đến ' + esc(tpVnd(cfg.max_vnd || 5000000)) + ' · 1 điểm = ' +
        esc(tpVnd(cfg.vnd_per_credit || 1000)) + '</p>';

      html += '<div class="tp-preview" id="mTpPreview">' + tpPreviewHtml() + '</div>';

      html += '<button type="button" class="btn-primary" id="mTpCreate" onclick="mCreateTopup()">' +
        '<span class="btn-txt"><i class="fas fa-bolt"></i> Tạo đơn nạp</span></button>';
    }

    if (TP.cfg && TP.cfg.test_mode) {
      html += '<p class="hint tp-test"><i class="fas fa-flask"></i> Cổng đang ở <b>chế độ thử</b>: ' +
        'đơn sẽ có nút "Thanh toán thử" để cộng điểm ngay, không trừ tiền thật.</p>';
    }

    // Đơn gần đây
    if (orders && orders.length) {
      html += '<div class="tp-sec-hd">Đơn gần đây</div><div class="tp-orders">' +
        orders.map(function (o) {
          var st = tpStatus(o.status);
          return '<button type="button" class="tp-order" onclick="mResumeTopup(' + Number(o.order_code) + ')">' +
            '<div class="tp-order-main"><b>#' + esc(o.order_code) + '</b>' +
            '<span>' + esc(tpVnd(o.amount_vnd)) + ' · ' + esc(fmtNum(o.credits)) + ' điểm</span></div>' +
            '<span class="tp-badge ' + esc(st.cls) + '">' + esc(st.label) + '</span>' +
            '</button>';
        }).join('') + '</div>';
    }

    body.innerHTML = html;
    tpSub('Số dư: ' + tpBalanceText() + ' điểm');
  }

  function tpPreviewHtml() {
    var amount = TP.pkgId ? tpPkgAmount() : Number(TP.amount || 0);
    if (!(amount > 0)) {
      return '<span class="tp-preview-lbl">Nhận được</span><b class="tp-preview-cr">—</b>';
    }
    return '<span class="tp-preview-lbl">Nhận được</span>' +
      '<b class="tp-preview-cr">' + esc(fmtNum(tpCredits(amount))) + ' điểm</b>' +
      '<span class="tp-preview-amt">' + esc(tpVnd(amount)) + '</span>';
  }

  function tpPkgAmount() {
    var list = (TP.cfg && TP.cfg.packages) || [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(TP.pkgId)) return Number(list[i].amount_vnd);
    }
    return 0;
  }

  function mPickPackage(id) {
    TP.pkgId = (String(TP.pkgId) === String(id)) ? null : id;
    TP.amount = 0;
    var input = $('mTpAmount');
    if (input) input.value = '';
    var cards = document.querySelectorAll('#mTopupBody .tp-pkg');
    for (var i = 0; i < cards.length; i++) {
      cards[i].classList.toggle('on', String(cards[i].getAttribute('data-pkg')) === String(TP.pkgId));
    }
    var prev = $('mTpPreview');
    if (prev) prev.innerHTML = tpPreviewHtml();
  }

  function mTpAmountInput(v) {
    var digits = String(v || '').replace(/[^\d]/g, '').slice(0, 9);
    TP.amount = digits ? Number(digits) : 0;
    // Nhập tiền tự do thì bỏ chọn gói (2 cách nạp loại trừ nhau).
    if (TP.amount > 0 && TP.pkgId !== null) {
      TP.pkgId = null;
      var cards = document.querySelectorAll('#mTopupBody .tp-pkg');
      for (var i = 0; i < cards.length; i++) cards[i].classList.remove('on');
    }
    var prev = $('mTpPreview');
    if (prev) prev.innerHTML = tpPreviewHtml();
  }

  // ----- Tạo đơn -----
  async function mCreateTopup() {
    if (!TP.cfg || TP.cfg.available !== true) { toast('Cổng nạp đang tạm đóng.', 'err'); return; }
    var btn = $('mTpCreate');
    var payload;
    if (TP.pkgId) {
      payload = { package_id: Number(TP.pkgId) };
    } else {
      var amount = Number(TP.amount || 0);
      var min = Number(TP.cfg.min_vnd) || 10000;
      var max = Number(TP.cfg.max_vnd) || 5000000;
      if (!(amount >= min && amount <= max)) {
        toast('Số tiền phải từ ' + tpVnd(min) + ' đến ' + tpVnd(max) + '.', 'err');
        var inp = $('mTpAmount');
        if (inp) inp.focus();
        return;
      }
      payload = { amount_vnd: amount };
    }
    setBusy(btn, true, '<i class="fas fa-spinner spin"></i> Đang tạo đơn…');
    try {
      var d = await mApi('POST', '/api/credits/topup/create', payload);
      TP.order = {
        order_code: d.order_code, status: 'PENDING', amount_vnd: d.amount_vnd,
        credits: d.credits, qr_code: d.qr_code, qr_image: d.qr_image,
        checkout_url: d.checkout_url, expires_at: d.expires_at,
        description: d.description, package_label: d.package_label
      };
      tpRenderOrder(TP.order);
      tpStartPolling();
      toast('Đã tạo đơn nạp #' + d.order_code, 'ok');
    } catch (e) {
      if (e.code === 401) return;
      toast(e.message || 'Không tạo được đơn nạp', 'err');
      setBusy(btn, false, '<span class="btn-txt"><i class="fas fa-bolt"></i> Tạo đơn nạp</span>');
      return;
    }
    setBusy(btn, false, '<span class="btn-txt"><i class="fas fa-bolt"></i> Tạo đơn nạp</span>');
  }

  // ----- Màn 2: đơn chờ / kết quả -----
  function tpRemainMs() {
    if (!TP.order || !TP.order.expires_at) return 0;
    var t = parseServerTime(TP.order.expires_at);
    return isFinite(t) ? Math.max(0, t - Date.now()) : 0;
  }

  function tpRemainText() {
    var ms = tpRemainMs();
    if (!ms) return '';
    var m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function tpRenderOrder(o) {
    var body = tpBody();
    if (!body) return;
    var st = tpStatus(o.status);
    var pending = String(o.status).toUpperCase() === 'PENDING';
    var paid = String(o.status).toUpperCase() === 'PAID';
    var testMode = !!(TP.cfg && TP.cfg.test_mode);

    var html = '<div class="tp-order-box ' + esc(st.cls) + '">' +
      '<div class="tp-order-top"><span class="tp-badge ' + esc(st.cls) + '">' + esc(st.label) + '</span>' +
      '<span class="mono tp-code">#' + esc(o.order_code) + '</span></div>' +
      '<div class="tp-order-amt">' + esc(tpVnd(o.amount_vnd)) + '</div>' +
      '<div class="tp-order-cr"><i class="fas fa-gem"></i> ' + esc(fmtNum(o.credits)) + ' điểm' +
      (o.package_label ? ' · ' + esc(o.package_label) : '') + '</div>' +
      (pending && tpRemainText() ? '<div class="tp-order-exp" id="mTpExp">Hết hạn sau ' + esc(tpRemainText()) + '</div>' : '') +
      '</div>';

    if (paid) {
      html += '<div class="tp-note ok"><i class="fas fa-circle-check"></i>' +
        'Đã cộng <b>' + esc(fmtNum(o.credits)) + ' điểm</b> vào tài khoản. Cảm ơn bạn!</div>' +
        '<button type="button" class="btn-ghost" onclick="mTpNewOrder()">' +
        '<i class="fas fa-plus"></i> Nạp thêm điểm</button>' +
        '<button type="button" class="btn-primary" onclick="mCloseTopup()">' +
        '<span class="btn-txt"><i class="fas fa-check"></i> Xong</span></button>';
    } else if (pending) {
      if (o.qr_image) {
        html += '<div class="tp-qr"><img src="' + esc(o.qr_image) + '" alt="Mã QR thanh toán" width="240" height="240">' +
          '<p class="hint">Mở app ngân hàng và quét mã VietQR để chuyển khoản đúng số tiền và nội dung.</p></div>';
      }
      if (o.description) {
        html += '<div class="tp-row"><span>Nội dung chuyển khoản</span>' +
          '<b class="mono">' + esc(o.description) + '</b>' +
          '<button type="button" class="link-line" onclick="mTpCopyDesc()" aria-label="Copy nội dung"><i class="fas fa-copy"></i></button></div>';
      }
      if (o.checkout_url) {
        html += '<a class="btn-ghost tp-link" href="' + esc(o.checkout_url) + '" target="_blank" rel="noopener">' +
          '<i class="fas fa-arrow-up-right-from-square"></i> Mở trang thanh toán payOS</a>';
      }
      if (testMode) {
        html += '<button type="button" class="btn-primary tp-testbtn" onclick="mTpMockPaid()">' +
          '<span class="btn-txt"><i class="fas fa-flask"></i> Thanh toán thử (test mode)</span></button>';
      }
      html += '<button type="button" class="btn-ghost" onclick="mTpSyncNow()">' +
        '<i class="fas fa-rotate"></i> Tôi đã chuyển khoản — kiểm tra lại</button>' +
        '<button type="button" class="btn-ghost danger" onclick="mTpCancel()">' +
        '<i class="fas fa-xmark"></i> Huỷ đơn</button>';
    } else {
      html += '<div class="tp-note"><i class="fas fa-circle-info"></i>' +
        'Đơn này đã kết thúc (' + esc(st.label) + '). Tạo đơn mới nếu bạn vẫn muốn nạp thêm điểm.</div>' +
        '<button type="button" class="btn-primary" onclick="mTpNewOrder()">' +
        '<span class="btn-txt"><i class="fas fa-plus"></i> Tạo đơn khác</span></button>';
    }

    body.innerHTML = html;
  }

  function mTpCopyDesc() {
    if (!TP.order || !TP.order.description) return;
    copyText(TP.order.description);
  }

  function mTpNewOrder() {
    tpStopTimers();
    TP.order = null;
    TP.skipResume = true;   // người dùng muốn đơn mới, đừng tự mở lại đơn PENDING
    TP.paidShown = false;
    mTopupLoad();
  }

  function tpStartPolling() {
    tpStopTimers();
    TP.syncAt = Date.now() + 20000; // cho webhook 20s trước khi đối soát chủ động
    TP.pollTimer = setInterval(function () { tpPoll(); }, 4000);
    TP.tickTimer = setInterval(function () {
      var el = $('mTpExp');
      var t = tpRemainText();
      if (el && t) el.textContent = 'Hết hạn sau ' + t;
      if (!t && TP.order && String(TP.order.status).toUpperCase() === 'PENDING') tpPoll();
    }, 1000);
    tpPoll();
  }

  async function tpPoll() {
    if (!TP.order) { tpStopTimers(); return; }
    var code = TP.order.order_code;
    try {
      var o = await mApi('GET', '/api/credits/topup/' + encodeURIComponent(code));
      if (!o) return;
      var changed = String(o.status) !== String(TP.order.status);
      TP.order = Object.assign({}, TP.order, o);
      if (changed) tpRenderOrder(TP.order);
      if (String(o.status).toUpperCase() !== 'PENDING') {
        tpStopTimers();
        tpOnFinal(o);
        return;
      }
      // PENDING lâu mà webhook chưa tới → nhờ server đối soát với payOS.
      if (Date.now() > TP.syncAt) {
        TP.syncAt = Date.now() + 20000;
        mTpSyncNow(true);
      }
    } catch (e) {
      if (e.code === 401) { tpStopTimers(); return; }
      // Lỗi mạng tạm thời: giữ nguyên đơn, vòng poll sau thử lại.
    }
  }

  async function mTpSyncNow(silent) {
    if (!TP.order) return;
    try {
      var r = await mApi('POST', '/api/credits/topup/' + encodeURIComponent(TP.order.order_code) + '/sync', {});
      if (r && r.status && String(r.status).toUpperCase() !== 'PENDING') {
        TP.order.status = r.status;
        tpStopTimers();
        tpRenderOrder(TP.order);
        tpOnFinal(TP.order);
      } else if (!silent) {
        toast('Chưa thấy thanh toán. Thử lại sau ít phút.', '');
      }
    } catch (e) {
      if (!silent) toast(e.message || 'Không kiểm tra được trạng thái', 'err');
    }
  }

  async function mTpMockPaid() {
    if (!TP.order) return;
    try {
      var r = await mApi('POST', '/api/credits/topup/' + encodeURIComponent(TP.order.order_code) + '/mock-paid', {});
      TP.order.status = (r && r.order && r.order.status) || 'PAID';
      tpStopTimers();
      tpRenderOrder(TP.order);
      tpOnFinal(TP.order);
    } catch (e) {
      toast(e.message || 'Không thanh toán thử được', 'err');
    }
  }

  async function mTpCancel() {
    if (!TP.order) return;
    if (!window.confirm('Huỷ đơn nạp #' + TP.order.order_code + '?\nĐơn đã huỷ không thanh toán được nữa.')) return;
    try {
      await mApi('POST', '/api/credits/topup/' + encodeURIComponent(TP.order.order_code) + '/cancel', {});
      TP.order.status = 'CANCELLED';
      tpStopTimers();
      tpRenderOrder(TP.order);
      toast('Đã huỷ đơn nạp.', 'ok');
    } catch (e) {
      toast(e.message || 'Không huỷ được đơn', 'err');
    }
  }

  /** Chạy khi đơn có kết quả cuối: cập nhật số dư + thông báo. */
  function tpOnFinal(o) {
    var paid = String(o.status).toUpperCase() === 'PAID';
    if (paid && !TP.paidShown) {
      TP.paidShown = true;
      toast('Đã cộng ' + fmtNum(o.credits) + ' điểm vào tài khoản.', 'ok');
      // `mRefreshBalance` là async → phải chờ xong mới đọc lại số dư, nếu không
      // tiêu đề vẫn hiện số cũ (đã gặp: đơn PAID mà vẫn "Số dư: 5 điểm").
      Promise.resolve(mRefreshBalance()).then(function () {
        tpSub('Số dư: ' + tpBalanceText() + ' điểm');
      }, function () {
        tpSub('Số dư: ' + tpBalanceText() + ' điểm');
      });
      try { if (navigator.vibrate) navigator.vibrate([30, 40, 30]); } catch (e) { /* ignore */ }
    }
  }

  /** Mở lại một đơn trong danh sách gần đây. */
  async function mResumeTopup(code) {
    try {
      var o = await mApi('GET', '/api/credits/topup/' + encodeURIComponent(code));
      if (!o) return;
      TP.order = o;
      TP.paidShown = String(o.status).toUpperCase() === 'PAID';
      tpRenderOrder(o);
      if (String(o.status).toUpperCase() === 'PENDING') tpStartPolling();
      else tpStopTimers();
    } catch (e) {
      toast(e.message || 'Không mở được đơn', 'err');
    }
  }

  // ==========================================================================
  // 4b. BẢN ĐỒ (Leaflet, nạp lười)
  // ==========================================================================
  // Dùng cùng bộ lớp nền với bản máy tính (mã nguồn web) để toạ độ hiển thị
  // giống nhau ở cả hai nơi. Leaflet nạp bằng `defer` từ CDN; nếu CDN hỏng thì
  // `L` không tồn tại → hiện khối dự phòng + nút mở Google Maps thay vì màn trắng.
  var MAP = { map: null, marker: null, circle: null, layer: null, point: null, initing: false };

  var MAP_LAYERS = {
    streets: {
      url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      attribution: 'Google', maxZoom: 20
    },
    satellite: {
      url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      attribution: 'Google', maxZoom: 20
    },
    terrain: {
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>', maxZoom: 17
    }
  };
  var MAP_KEY = 'm_map_layer';

  /** Bán kính vẽ vòng tròn: ưu tiên bán kính thật, tối thiểu 60 m để nhìn thấy. */
  function mapRadius(raw) {
    var r = Number(raw);
    if (!isFinite(r) || r <= 0) return 120;
    return Math.max(60, Math.min(r, 50000));
  }

  function mapLayer() {
    var k = null;
    try { k = localStorage.getItem(MAP_KEY); } catch (e) { /* private mode */ }
    return MAP_LAYERS[k] ? k : 'streets';
  }

  function mapLangLabel(key) {
    return key === 'satellite' ? 'Vệ tinh' : (key === 'terrain' ? 'Địa hình' : 'Đường phố');
  }

  function mapSyncChips() {
    var chips = document.querySelectorAll('#mMapLayers .chip');
    var cur = mapLayer();
    for (var i = 0; i < chips.length; i++) {
      chips[i].classList.toggle('active', chips[i].getAttribute('data-layer') === cur);
    }
  }

  function mapSetLayer(key) {
    if (!MAP_LAYERS[key]) key = 'streets';
    try { localStorage.setItem(MAP_KEY, key); } catch (e) { /* quota */ }
    if (MAP.map && MAP.layer) {
      MAP.map.removeLayer(MAP.layer);
      var cfg = MAP_LAYERS[key];
      MAP.layer = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: cfg.maxZoom });
      MAP.layer.addTo(MAP.map);
    }
    mapSyncChips();
  }

  /** Vẽ marker + vòng bán kính cho một điểm. */
  function mapDraw(p) {
    if (!MAP.map) return;
    if (MAP.marker) { MAP.map.removeLayer(MAP.marker); MAP.marker = null; }
    if (MAP.circle) { MAP.map.removeLayer(MAP.circle); MAP.circle = null; }

    var icon = L.divIcon({
      className: 'cell-marker', html: '<div class="cell-pin"></div>',
      iconSize: [18, 18], iconAnchor: [9, 9]
    });
    MAP.marker = L.marker([p.lat, p.lon], { icon: icon, keyboard: false })
      .addTo(MAP.map)
      .bindPopup(
        '<b>' + esc(p.key || 'Cell') + '</b>' +
        (p.range != null && p.range !== '' ? '<br>Bán kính ' + esc(fmtNum(p.range)) + ' m' : '') +
        '<br><span class="mono">' + esc(p.lat.toFixed(6)) + ', ' + esc(p.lon.toFixed(6)) + '</span>',
        { closeButton: false, autoPan: false }
      );

    MAP.circle = L.circle([p.lat, p.lon], {
      radius: mapRadius(p.range),
      color: '#1a6cf0', weight: 1.5, opacity: 0.9,
      fillColor: '#1a6cf0', fillOpacity: 0.16
    }).addTo(MAP.map);

    MAP.map.setView([p.lat, p.lon], 16, { animate: false });
  }

  function mapShowFallback(show) {
    var fb = $('mMapFallback');
    if (fb) fb.hidden = !show;
    var ctrl = document.querySelector('.map-ctrl');
    if (ctrl) ctrl.hidden = !!show;
    var layers = $('mMapLayers');
    if (layers) layers.hidden = !!show;
  }

  function bindMapSheet() {
    // Leaflet không tự cập nhật kích thước khi container đổi kích thước (mở
    // sheet, xoay máy) → phải gọi invalidateSize, nếu không bản đồ xám/lệch.
    window.addEventListener('orientationchange', function () {
      if (!MAP.map) return;
      setTimeout(function () { MAP.map.invalidateSize(); mapRecenter(); }, 320);
    });
    window.addEventListener('resize', function () {
      if (!MAP.map || $('mMapSheet').hidden) return;
      MAP.map.invalidateSize();
    });
    // Nút Back của điện thoại đóng bản đồ thay vì thoát app.
    window.addEventListener('popstate', function () {
      if ($('mMapSheet') && !$('mMapSheet').hidden) mCloseMap(true);
    });
  }

  /**
   * Mở bản đồ cho một cell.
   * @param {object} p { lat, lon, key, range, source }
   */
  function mOpenMap(p) {
    var sheet = $('mMapSheet');
    if (!sheet) return;
    var src = p || LAST_LOOKUP;
    if (!src || !isFinite(Number(src.lat)) || !isFinite(Number(src.lon))) {
      // Không có toạ độ → KHÔNG đá sang trang máy tính nữa (người dùng mobile
      // bị đẩy ra khỏi app). Chỉ báo cho biết cần tra cứu trước.
      toast('Chưa có vị trí để hiển thị. Hãy tra cứu một cell trước.', '');
      return;
    }
    var point = {
      lat: Number(src.lat), lon: Number(src.lon),
      key: src.key || (src.mcc ? src.mcc + '-' + src.mnc + '-' + src.lac + '-' + src.cellid : 'Cell'),
      range: src.range, source: src.source
    };
    MAP.point = point;

    var sub = $('mMapSub');
    if (sub) {
      sub.textContent = point.lat.toFixed(6) + ', ' + point.lon.toFixed(6) +
        (point.source ? ' · ' + sourceLabel(point.source) : '') +
        (point.range != null && point.range !== '' ? ' · ' + fmtNum(point.range) + ' m' : '');
    }

    sheet.hidden = false;
    sheet.setAttribute('aria-hidden', 'false');
    document.body.classList.add('map-open');
    try { history.pushState({ map: 1 }, '', location.hash || '#lookup'); } catch (e) { /* ignore */ }

    if (!window.L) {
      // CDN Leaflet hỏng/bị chặn.
      mapShowFallback(true);
      return;
    }
    mapShowFallback(false);

    if (!MAP.map) {
      MAP.map = L.map('mMap', {
        center: [point.lat, point.lon], zoom: 16,
        zoomControl: false, attributionControl: true,
        preferCanvas: true, tap: true, touchZoom: true, dragging: true
      });
      // Chỉ một ngón để kéo bản đồ, hai ngón để zoom trang → giữ cuộn dọc mượt
      // khi người dùng muốn thoát khỏi bản đồ (bản đồ chiếm toàn màn hình nên
      // mặc định Leaflet đã đúng; `tapHold` tránh menu ngữ cảnh iOS).
      MAP.layer = L.tileLayer(MAP_LAYERS[mapLayer()].url, {
        attribution: MAP_LAYERS[mapLayer()].attribution,
        maxZoom: MAP_LAYERS[mapLayer()].maxZoom
      }).addTo(MAP.map);
      mapSyncChips();
    } else {
      mapSetLayer(mapLayer());
    }
    mapDraw(point);
    // Container vừa hiện (display:flex) → Leaflet cần biết kích thước thật.
    setTimeout(function () { if (MAP.map) MAP.map.invalidateSize(); }, 60);
  }

  function mCloseMap(fromHistory) {
    var sheet = $('mMapSheet');
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true;
    sheet.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('map-open');
    if (!fromHistory) {
      try {
        if (history.state && history.state.map) history.back();
      } catch (e) { /* ignore */ }
    }
  }

  function mMapLayer(key) { mapSetLayer(key); }

  function mMapZoom(delta) {
    if (!MAP.map) return;
    if (delta > 0) MAP.map.zoomIn();
    else MAP.map.zoomOut();
  }

  function mMapRecenter() {
    if (!MAP.map || !MAP.point) return;
    MAP.map.setView([MAP.point.lat, MAP.point.lon], Math.max(MAP.map.getZoom(), 15), { animate: true });
  }

  function mMapCopy() {
    if (!MAP.point) return;
    copyText(MAP.point.lat + ',' + MAP.point.lon);
  }

  function mMapGoogle() {
    var p = MAP.point || LAST_LOOKUP;
    if (!p) return;
    var q = Number(p.lat).toFixed(6) + ',' + Number(p.lon).toFixed(6);
    window.open('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q), '_blank', 'noopener');
  }

  /** Trạng thái bản đồ (dùng cho kiểm thử + chẩn đoán). */
  function mMapState() {
    return {
      ready: !!MAP.map,
      zoom: MAP.map ? MAP.map.getZoom() : null,
      center: MAP.map ? MAP.map.getCenter() : null,
      layer: mapLayer(),
      point: MAP.point
    };
  }

  function mapRecenter() {
    if (!MAP.map || !MAP.point) return;
    MAP.map.setView([MAP.point.lat, MAP.point.lon]);
  }

  /** Mở bản đồ cho một dòng lịch sử (có lat/lng). */
  function mMapHistory(id) {
    var r = histState.rows[String(id)];
    if (!r) return;
    var lat = r.lat != null ? Number(r.lat) : null;
    var lon = r.lng != null ? Number(r.lng) : (r.lon != null ? Number(r.lon) : null);
    if (!isFinite(lat) || !isFinite(lon)) return;
    mOpenMap({
      lat: lat, lon: lon, range: r.range, source: r.source,
      key: [r.mcc, r.mnc, r.lac, r.cellid].join('-')
    });
  }

  // ==========================================================================
  // 5. TRA CỨU CELL
  // ==========================================================================
  function mSaveForm() {
    try {
      localStorage.setItem(LS_FORM, JSON.stringify({
        mcc: $('mLkMcc').value, mnc: $('mLkMnc').value,
        lac: $('mLkLac').value, cell: $('mLkCell').value,
        sector: $('mLkSector').value, radio: $('mLkRadio').value
      }));
    } catch (e) { /* quota */ }
  }

  function mRestoreForm() {
    var raw = null;
    try { raw = localStorage.getItem(LS_FORM); } catch (e) { raw = null; }
    if (!raw) return;
    var f;
    try { f = JSON.parse(raw); } catch (e) { return; }
    if (!f) return;
    if (f.mcc) $('mLkMcc').value = f.mcc;
    if (f.mnc) $('mLkMnc').value = f.mnc;
    if (f.lac) $('mLkLac').value = f.lac;
    if (f.cell) $('mLkCell').value = f.cell;
    if (f.sector) $('mLkSector').value = f.sector;
    if (f.radio) $('mLkRadio').value = f.radio;
  }

  function mFillLookup(cell) {
    if (!cell) return;
    if (cell.mcc != null) $('mLkMcc').value = cell.mcc;
    if (cell.mnc != null) $('mLkMnc').value = cell.mnc;
    if (cell.lac != null) $('mLkLac').value = cell.lac;
    if (cell.cellid != null) $('mLkCell').value = cell.cellid;
    $('mLkSector').value = cell.sector == null ? '' : cell.sector;
    if (cell.radio) $('mLkRadio').value = cell.radio;
    mSaveForm();
  }

  async function mDoLookup(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    var box = $('mLkResult');
    var mcc = ($('mLkMcc').value || '').trim();
    var mnc = ($('mLkMnc').value || '').trim();
    var lac = ($('mLkLac').value || '').trim();
    var cellid = ($('mLkCell').value || '').trim();
    var sector = ($('mLkSector').value || '').trim();
    var radio = $('mLkRadio').value || '';

    if (!mcc || !mnc || !lac || !cellid) {
      mShowResult(box, 'err', '<i class="fas fa-triangle-exclamation res-ico"></i>', 'Nhập đủ MCC, MNC, LAC và Cell ID.');
      return;
    }
    if (!/^\d+$/.test(mcc) || !/^\d+$/.test(mnc) || !/^\d+$/.test(lac) || !/^\d+$/.test(cellid)) {
      mShowResult(box, 'err', '<i class="fas fa-triangle-exclamation res-ico"></i>', 'MCC, MNC, LAC và Cell ID phải là số.');
      return;
    }
    mSaveForm();

    var btn = $('mLkBtn');
    setBusy(btn, true);
    mShowResult(box, '', '<i class="fas fa-spinner spin res-ico"></i>', 'Đang tra cứu…');
    try {
      var q = '/api/cells/resolve?mcc=' + encodeURIComponent(mcc) +
        '&mnc=' + encodeURIComponent(mnc) +
        '&lac=' + encodeURIComponent(lac) +
        '&cellid=' + encodeURIComponent(cellid) +
        (sector ? '&sector=' + encodeURIComponent(sector) : '') +
        (radio ? '&radio=' + encodeURIComponent(radio) : '');
      var d = await mApi('GET', q);
      renderLookup(d, { mcc: mcc, mnc: mnc, lac: lac, cellid: cellid, sector: sector });
      if (d && d.credit && d.credit.balance != null) {
        Auth.setCreditBalance(d.credit.balance);
        mSetCredit(d.credit.balance);
        // Gợi ý chi phí cũng nhắc số dư → phải vẽ lại sau khi trừ điểm.
        mUpdateCostHint();
      }
      histState.dirty = true;
    } catch (e) {
      if (e.code === 404) {
        mShowResult(box, 'miss',
          '<i class="fas fa-circle-xmark res-ico"></i>',
          'Không tìm thấy cell <span class="res-cell">' + esc(mcc + '-' + mnc + '-' + lac + '-' + cellid) + '</span>' +
          '<div class="hint" style="margin-top:6px">' + esc(e.message || '') + '</div>');
      } else if (e.code === 402) {
        mShowResult(box, 'err',
          '<i class="fas fa-gem res-ico"></i>',
          'Không đủ điểm để tra cứu.<br>Còn <b>' + esc(fmtNum(e.balance)) + '</b>, cần <b>' + esc(fmtNum(e.required)) + '</b>.' +
          '<div class="res-actions"><button type="button" class="btn-ghost" onclick="mOpenTopup()">' +
          '<i class="fas fa-plus-circle"></i> Nạp thêm điểm</button></div>');
      } else {
        mShowResult(box, 'err',
          '<i class="fas fa-triangle-exclamation res-ico"></i>',
          esc(e.message || 'Tra cứu không thành công.'));
      }
    } finally {
      setBusy(btn, false);
    }
  }

  function mShowResult(box, kind, iconHtml, bodyHtml) {
    if (!box) return;
    box.className = 'result' + (kind ? ' ' + kind : '');
    box.hidden = false;
    box.innerHTML = '<div class="res-hd">' + iconHtml + '</div>' + bodyHtml;
    // Kết quả tra cứu KHÔNG thành công (miss/lỗi) → không có toạ độ để xem,
    // ẩn luôn lối tắt bản đồ.
    if (box.id === 'mLkResult') mLkMapBtnToggle(false);
  }

  /** Hiện/ẩn lối tắt "Xem vị trí trên bản đồ" ở tab Tra cứu. */
  function mLkMapBtnToggle(show) {
    var btn = $('mLkMapBtn');
    if (btn) btn.hidden = !show;
  }

  function resRow(k, v, plain) {
    return '<div class="res-row"><div class="res-k">' + esc(k) + '</div>' +
      '<div class="res-v' + (plain ? ' plain' : '') + '">' + v + '</div></div>';
  }

  function renderLookup(payload, input) {
    var box = $('mLkResult');
    var d = (payload && payload.data) || {};
    var mcc = d.mcc || input.mcc;
    var mnc = d.mnc || input.mnc;
    var lac = d.lac || input.lac;
    var cellid = d.cellid || input.cellid;
    var sector = d.sector != null && d.sector !== '' ? d.sector : input.sector;
    var lat = Number(d.lat);
    var lon = Number(d.lon != null ? d.lon : d.lng);
    if (!isFinite(lat) || !isFinite(lon)) {
      mShowResult(box, 'miss',
        '<i class="fas fa-circle-xmark res-ico"></i>',
        'Nguồn dữ liệu trả về toạ độ không hợp lệ. Thử lại hoặc chọn công nghệ mạng khác.');
      return;
    }
    var range = d.range;
    var key = mcc + '-' + mnc + '-' + lac + '-' + cellid;
    var rs = radioStyle(d.radio);
    var bal = payload && payload.credit ? payload.credit.balance : null;

    LAST_LOOKUP = {
      mcc: mcc, mnc: mnc, lac: lac, cellid: cellid, sector: sector,
      lat: lat, lon: lon, radio: d.radio, range: range,
      source: payload && payload.source, key: key
    };

    var html = '<div class="res-hd">' +
      '<i class="fas fa-circle-check res-ico" style="color:var(--ok)"></i>' +
      '<span class="res-cell">' + esc(key) + '</span>' +
      (rs ? '<span class="res-badge" style="background:' + rs.color + '">' + esc(rs.full) + '</span>' : '') +
      '</div>';

    html += resRow('Toạ độ',
      '<span class="mono">' + esc(lat.toFixed(6)) + ', ' + esc(lon.toFixed(6)) + '</span>' +
      ' <button type="button" class="link-line" data-act="copy" data-value="' +
      esc(lat + ',' + lon) + '" title="Copy toạ độ" aria-label="Copy toạ độ" style="padding:0 4px">' +
      '<i class="fas fa-copy"></i></button>');
    if (range != null && range !== '') html += resRow('Bán kính', esc(fmtNum(range)) + ' m');
    html += resRow('Nguồn', esc(sourceLabel(payload && payload.source)));
    if (d.description) html += resRow('Mô tả', esc(d.description), true);
    if (bal != null) html += resRow('Điểm còn lại', esc(fmtNum(bal)));
    if (payload && payload.radioConfident === false && rs) {
      html += '<div class="hint" style="margin-top:6px;color:var(--warn)">' +
        '<i class="fas fa-triangle-exclamation"></i> Công nghệ mạng có thể chưa chính xác — kiểm tra lại Cell ID / sector.</div>';
    }

    html += '<div class="res-actions">' +
      '<button type="button" class="btn-ghost" data-act="maps"><i class="fas fa-map-location-dot"></i> Bản đồ</button>' +
      '<button type="button" class="btn-ghost" data-act="conv"><i class="fas fa-right-left"></i> eNB ↔ ECI</button>' +
      '</div>';

    box.className = 'result ok';
    box.hidden = false;
    box.innerHTML = html;
    // Có toạ độ → hiện lối tắt bản đồ dưới khung kết quả.
    mLkMapBtnToggle(true);
  }

  /** Uỷ quyền sự kiện cho các nút trong khung kết quả tra cứu. */
  function bindLookupActions() {
    var box = $('mLkResult');
    if (!box) return;
    box.addEventListener('click', function (ev) {
      var btn = ev.target.closest ? ev.target.closest('[data-act]') : null;
      if (!btn || !box.contains(btn)) return;
      var act = btn.getAttribute('data-act');
      if (act === 'copy') {
        copyText(btn.getAttribute('data-value') || '');
      } else if (act === 'maps') {
        if (!LAST_LOOKUP) return;
        mOpenMap(LAST_LOOKUP);
      } else if (act === 'conv') {
        if (!LAST_LOOKUP) return;
        mTab('tools');
        // Công cụ mặc định đóng → phải mở trước, không thì kết quả bị ẩn.
        mToolOpen('convert');
        $('mConvInp').value = LAST_LOOKUP.cellid;
        $('mConvSector').value = LAST_LOOKUP.sector == null ? '' : LAST_LOOKUP.sector;
        mDoConvert(null);
      }
    });
  }

  // ==========================================================================
  // 6. LỊCH SỬ TRA CỨU — CHỈ CELL ĐƠN LẺ
  // ==========================================================================
  // Server luôn được gọi với `mode=single` nên phiên tra theo danh sách (batch)
  // KHÔNG BAO GIỜ xuất hiện ở đây. Chip lọc chỉ lọc trong tập single đó.
  var histState = { page: 1, filter: 'all', loading: false, exhausted: false, shown: 0, rows: {}, dirty: false };

  function mHistMode(mode) {
    var f = (mode === 'found' || mode === 'miss') ? mode : 'all';
    histState.filter = f;
    var chips = document.querySelectorAll('#page-history .chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].classList.toggle('active', chips[i].getAttribute('data-mode') === f);
    }
    mHistLoad(true);
  }

  function histMatch(r) {
    if (histState.filter === 'found') return Number(r.found) === 1;
    if (histState.filter === 'miss') return Number(r.found) !== 1;
    return true;
  }

  function histCard(r) {
    var key = [r.mcc, r.mnc, r.lac, r.cellid].map(function (v) {
      return v == null ? '' : String(v);
    }).join('-');
    var found = Number(r.found) === 1 && r.lat != null && r.lng != null;
    var rs = radioStyle(r.radio);
    var lat = r.lat != null ? Number(r.lat) : null;
    var lon = (r.lng != null ? r.lng : r.lon) != null ? Number(r.lng != null ? r.lng : r.lon) : null;

    var meta = '<span><i class="fas fa-clock"></i>' + esc(fmtTime(r.created_at)) + '</span>';
    if (found) {
      meta += '<span class="ok"><i class="fas fa-location-dot"></i>' +
        esc(lat.toFixed(5)) + ', ' + esc(lon.toFixed(5)) + '</span>';
    } else {
      meta += '<span class="miss-t"><i class="fas fa-circle-xmark"></i>Không có kết quả</span>';
    }
    if (found && r.source) meta += '<span><i class="fas fa-server"></i>' + esc(sourceLabel(r.source)) + '</span>';

    return '<div class="hist-card' + (found ? '' : ' miss') + '" data-id="' + esc(r.id) + '" data-mode="single"' +
      ' data-found="' + (found ? '1' : '0') + '">' +
      '<div class="hist-main">' +
        '<div class="hist-cell">' + esc(key) +
          (rs ? ' <span class="res-badge" style="background:' + rs.color + ';font-size:9.5px">' + esc(rs.label) + '</span>' : '') +
        '</div>' +
        '<div class="hist-meta">' + meta + '</div>' +
      '</div>' +
      '<div class="hist-acts">' +
        // Nút "Tra lại" CHỈ ở cell chưa tra được — cell đã có toạ độ thì tra lại
        // chỉ tốn điểm vô ích (giống bản web, turn 21).
        (found ? '' : '<button type="button" class="hist-btn retry" data-act="retry" data-id="' + esc(r.id) +
          '" title="Tra lại" aria-label="Tra lại"><i class="fas fa-arrow-rotate-right"></i></button>') +
        (found ? '<button type="button" class="hist-btn" data-act="map" data-id="' + esc(r.id) +
          '" title="Xem bản đồ" aria-label="Xem bản đồ"><i class="fas fa-map-location-dot"></i></button>' : '') +
        (found ? '<button type="button" class="hist-btn" data-act="copy" data-id="' + esc(r.id) +
          '" title="Copy toạ độ" aria-label="Copy toạ độ"><i class="fas fa-copy"></i></button>' : '') +
        '<button type="button" class="hist-btn del" data-act="del" data-id="' + esc(r.id) +
          '" title="Xoá" aria-label="Xoá"><i class="fas fa-trash-can"></i></button>' +
      '</div>' +
    '</div>';
  }

  function histEmpty(html) {
    var list = $('mHistList');
    if (list) list.innerHTML = '<div class="hist-empty">' + html + '</div>';
  }

  function histPager(text, show) {
    var el = $('mHistPager');
    if (!el) return;
    el.textContent = text || '';
    el.hidden = !show;
  }

  async function mHistLoad(reset) {
    var list = $('mHistList');
    var more = $('mHistMore');
    if (!list || histState.loading) return;

    if (reset) {
      histState.page = 1;
      histState.exhausted = false;
      histState.shown = 0;
      histState.rows = {};
      list.innerHTML = '';
    }
    histState.loading = true;
    if (more) more.hidden = true;
    histPager('Đang tải…', true);

    try {
      var guard = 0;
      while (guard++ < 8) {
        var d = await mApi('GET', '/api/lookup-history?mode=single&page=' + histState.page + '&limit=20');
        var rows = Array.isArray(d.data) ? d.data : [];
        var totalPages = Number(d.totalPages) || 1;
        var html = '';
        for (var i = 0; i < rows.length; i++) {
          var r = rows[i];
          histState.rows[String(r.id)] = r;
          if (!histMatch(r)) continue;
          html += histCard(r);
          histState.shown++;
        }
        if (html) list.insertAdjacentHTML('beforeend', html);
        histState.exhausted = histState.page >= totalPages;
        histState.page++;
        // Trang này không có dòng nào khớp bộ lọc và còn trang sau → nạp tiếp
        // (tránh màn trống dù vẫn còn dữ liệu).
        if (!histState.exhausted && !html) continue;
        break;
      }

      if (histState.shown === 0) {
        if (histState.filter === 'found') {
          histEmpty('<i class="fas fa-crosshairs"></i>Chưa có lần tra nào ra kết quả.<br>Tra một cell ở tab Tra cứu.');
        } else if (histState.filter === 'miss') {
          histEmpty('<i class="fas fa-circle-check"></i>Không có lần tra nào bị miss.');
        } else {
          histEmpty('<i class="fas fa-clock-rotate-left"></i>Chưa có lịch sử tra cứu.<br>Bắt đầu bằng tab Tra cứu.');
        }
        histPager('', false);
        if (more) more.hidden = true;
      } else {
        histPager('Đã hiển thị ' + histState.shown + ' lượt tra', true);
        if (more) more.hidden = histState.exhausted;
        if (histState.exhausted) histPager('Đã hiển thị ' + histState.shown + ' lượt tra (hết)', true);
      }
    } catch (e) {
      histPager('', false);
      if (histState.shown === 0) {
        histEmpty('<i class="fas fa-triangle-exclamation"></i>' + esc(e.message || 'Không tải được lịch sử') +
          '<div style="margin-top:12px"><button type="button" class="btn-ghost" id="mHistRetry">Thử lại</button></div>');
        var rty = $('mHistRetry');
        if (rty) rty.addEventListener('click', function () { mHistLoad(true); });
      } else {
        toast(e.message || 'Không tải thêm được lịch sử', 'err');
      }
    } finally {
      histState.loading = false;
    }
  }

  function mHistMore() { mHistLoad(false); }

  function bindHistActions() {
    var list = $('mHistList');
    if (!list) return;
    list.addEventListener('click', async function (ev) {
      var btn = ev.target.closest ? ev.target.closest('[data-act]') : null;
      if (!btn || !list.contains(btn)) return;
      var act = btn.getAttribute('data-act');
      var id = btn.getAttribute('data-id');
      var row = histState.rows[id];

      if (act === 'retry') {
        if (!row) return;
        mTab('lookup');
        mFillLookup(row);
        mDoLookup(null);
        return;
      }
      if (act === 'copy') {
        if (!row) return;
        var lat = row.lat != null ? Number(row.lat) : null;
        var lon = row.lng != null ? Number(row.lng) : (row.lon != null ? Number(row.lon) : null);
        if (lat == null || lon == null) { toast('Dòng này không có toạ độ.', 'err'); return; }
        copyText(lat + ',' + lon);
        return;
      }
      if (act === 'map') {
        if (!row) return;
        mMapHistory(id);
        return;
      }
      if (act === 'del') {
        var ok = window.confirm('Xoá lượt tra này khỏi lịch sử?\nThao tác không lấy lại được.');
        if (!ok) return;
        try {
          await mApi('DELETE', '/api/lookup-history/' + encodeURIComponent(id));
          var card = list.querySelector('.hist-card[data-id="' + cssEsc(id) + '"]');
          if (card) card.parentNode.removeChild(card);
          delete histState.rows[id];
          histState.shown = Math.max(0, histState.shown - 1);
          histPager('Đã hiển thị ' + histState.shown + ' lượt tra', histState.shown > 0);
          if (histState.shown === 0) mHistLoad(true);
          toast('Đã xoá.', 'ok');
        } catch (e) {
          toast(e.message || 'Không xoá được', 'err');
        }
      }
    });
  }

  /** Escape cho selector CSS (id số/chuỗi đơn giản). */
  function cssEsc(s) { return String(s).replace(/["\\]/g, '\\$&'); }

  // ==========================================================================
  // 7. CÔNG CỤ
  // ==========================================================================
  // Ba công cụ xếp thành accordion: mặc định ĐÓNG cả ba, bấm tiêu đề để mở,
  // mở công cụ khác thì công cụ đang mở tự đóng (chỉ một cái mở tại một thời điểm).
  var TOOLS = {
    phone: { hd: 'mPhoneHd', body: 'mPhoneBody', card: 'mPhoneCard' },
    convert: { hd: 'mConvHd', body: 'mConvBody', card: 'mConvCard' },
    ip: { hd: 'mIpHd', body: 'mIpBody', card: 'mIpCard' }
  };
  var toolOpen = null; // tên công cụ đang mở, null = đóng hết

  /**
   * Mở/đóng một công cụ.
   * @param {string} name  'phone' | 'convert' | 'ip'
   * @param {boolean} [force]  true = luôn mở (dùng khi nhảy từ nơi khác tới)
   */
  function mToolToggle(name, force) {
    if (!TOOLS[name]) return;
    var open = force === true ? true : (toolOpen !== name);

    for (var key in TOOLS) {
      if (!Object.prototype.hasOwnProperty.call(TOOLS, key)) continue;
      var cfg = TOOLS[key];
      var on = open && key === name;
      var body = $(cfg.body);
      var hd = $(cfg.hd);
      var card = $(cfg.card);
      if (body) body.hidden = !on;
      if (hd) hd.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (card) card.classList.toggle('open', on);
    }
    toolOpen = open ? name : null;

    // Captcha của VNTA chỉ tải khi công cụ check số được mở lần đầu.
    if (open && name === 'phone' && !phoneCaptcha.sessionId) mLoadPhoneCaptcha();

    // Mở công cụ thì đưa tiêu đề lên đầu khung nhìn để thấy toàn bộ nội dung,
    // tránh trường hợp mở ra mà phần dưới nằm ngoài màn hình.
    if (open) {
      var hdEl = $(TOOLS[name].hd);
      if (hdEl && hdEl.scrollIntoView) {
        try { hdEl.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) { hdEl.scrollIntoView(); }
      }
    }
  }

  /** Bảo đảm một công cụ đang mở — dùng khi điều hướng từ màn khác tới. */
  function mToolOpen(name) { mToolToggle(name, true); }

  // ----- 7a. Check số điện thoại (VNTA — tra nhà mạng hiện tại) -----
  var phoneCaptcha = { sessionId: null, loading: false };

  async function mLoadPhoneCaptcha() {
    if (phoneCaptcha.loading) return;
    phoneCaptcha.loading = true;
    var img = $('mPhoneCapImg');
    var ph = $('mPhoneCapPh');
    if (img) { img.hidden = true; img.removeAttribute('src'); }
    if (ph) ph.innerHTML = '<i class="fas fa-spinner spin"></i>';
    try {
      var d = await mApi('GET', '/api/tools/port-check/captcha');
      if (!d || !d.captchaBase64 || !d.sessionId) throw new Error('Máy chủ không trả captcha');
      phoneCaptcha.sessionId = d.sessionId;
      if (img) {
        img.src = 'data:image/png;base64,' + d.captchaBase64;
        img.hidden = false;
      }
      if (ph) ph.hidden = true;
    } catch (e) {
      phoneCaptcha.sessionId = null;
      if (ph) {
        ph.hidden = false;
        ph.innerHTML = '<span style="font-size:10px;line-height:1.2;text-align:center">Lỗi tải mã<br>bấm thử lại</span>';
      }
    } finally {
      phoneCaptcha.loading = false;
    }
  }

  /** Chuẩn hoá số VN về dạng 0xxxxxxxxx; trả '' nếu không hợp lệ. */
  function normalizePhone(raw) {
    var s = String(raw || '').replace(/[\s.\-()]/g, '');
    if (/^\+84\d{9,10}$/.test(s)) s = '0' + s.slice(3);
    if (/^84\d{9,10}$/.test(s)) s = '0' + s.slice(2);
    if (!/^0\d{9,10}$/.test(s)) return '';
    return s;
  }

  async function mCheckPhone(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    var box = $('mPhoneResult');
    var phone = normalizePhone($('mPhoneInp').value);
    var cap = ($('mPhoneCaptcha').value || '').trim();

    if (!phone) {
      mShowResult(box, 'err', '<i class="fas fa-triangle-exclamation res-ico"></i>',
        'Số điện thoại không hợp lệ. Nhập 10 số bắt đầu bằng 0, ví dụ 0912345678.');
      return;
    }
    if (!cap) {
      mShowResult(box, 'err', '<i class="fas fa-triangle-exclamation res-ico"></i>', 'Nhập mã xác nhận bên phải.');
      return;
    }
    if (!phoneCaptcha.sessionId) {
      mShowResult(box, 'err', '<i class="fas fa-triangle-exclamation res-ico"></i>',
        'Mã xác nhận chưa tải xong. Bấm vào ô mã để tải lại.');
      return;
    }

    var btn = $('mPhoneBtn');
    setBusy(btn, true);
    mShowResult(box, '', '<i class="fas fa-spinner spin res-ico"></i>', 'Đang tra cứu…');
    try {
      var d = await mApi('POST', '/api/tools/port-check/search', {
        phone: phone, captcha: cap, sessionId: phoneCaptcha.sessionId
      });
      var html = '<div class="res-hd"><i class="fas fa-circle-check res-ico" style="color:var(--ok)"></i>' +
        '<span class="res-cell">' + esc(d.subscriber || d.phone || phone) + '</span></div>';
      html += resRow('Nhà mạng hiện tại', esc(d.currentCarrier || d.carrier || '—'), true);
      html += resRow('Nhà mạng gốc', esc(d.originalCarrier || '—'), true);
      html += resRow('Trạng thái', esc(d.details || '—'), true);
      box.className = 'result ok';
      box.hidden = false;
      box.innerHTML = html;
    } catch (e) {
      var msg = e.message || 'Tra cứu không thành công';
      if (/phiên|session/i.test(msg)) msg = 'Phiên tra cứu đã hết hạn, mã mới đã được tải lại — thử lại.';
      else if (/VNTA|kết nối|EAI_AGAIN|ENOTFOUND|fetch|mạng/i.test(msg)) {
        // Lỗi hạ tầng/DNS của cổng VNTA — đừng đổ nguyên văn lỗi kỹ thuật cho user.
        msg = 'Không kết nối được cổng thông tin VNTA. Có thể cổng đang bảo trì — thử lại sau ít phút.';
      }
      mShowResult(box, 'err', '<i class="fas fa-circle-xmark res-ico"></i>', esc(msg));
    } finally {
      setBusy(btn, false);
      // Captcha của VNTA là one-shot: mỗi lần tra (kể cả lỗi) phải lấy mã mới.
      phoneCaptcha.sessionId = null;
      var ci = $('mPhoneCaptcha');
      if (ci) ci.value = '';
      mLoadPhoneCaptcha();
    }
  }

  // ----- 7b. Chuyển đổi eNB ↔ ECI -----
  function decideCellId(value) {
    var n = parseInt(value, 10);
    if (!isFinite(n) || n < 0) return null;
    if (n > ECI_MAX) return null;
    if (n > SHORT_MAX) {
      return { kind: 'long', isShort: false, eci: n, enbId: Math.floor(n / 256), sector: n % 256, input: n };
    }
    return { kind: 'short', isShort: true, eci: null, enbId: n, sector: null, input: n };
  }

  async function mDoConvert(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    var box = $('mConvResult');
    var raw = ($('mConvInp').value || '').trim();
    var sectorRaw = ($('mConvSector').value || '').trim();
    if (!raw) {
      mShowResult(box, 'err', '<i class="fas fa-triangle-exclamation res-ico"></i>', 'Nhập Cell ID cần chuyển đổi.');
      return;
    }
    if (!/^\d+$/.test(raw)) {
      mShowResult(box, 'err', '<i class="fas fa-triangle-exclamation res-ico"></i>', 'Cell ID phải là số.');
      return;
    }
    if (sectorRaw && !/^\d+$/.test(sectorRaw)) {
      mShowResult(box, 'err', '<i class="fas fa-triangle-exclamation res-ico"></i>', 'Sector phải là số (0–255).');
      return;
    }

    var btn = $('mConvBtn');
    setBusy(btn, true);
    try {
      var q = '/api/cells/convert?value=' + encodeURIComponent(raw) +
        (sectorRaw ? '&sector=' + encodeURIComponent(sectorRaw) : '');
      var d = await mApi('GET', q);
      var isShort = !!d.isShort;
      var html = '<div class="res-hd"><i class="fas fa-right-left res-ico"></i>' +
        '<span class="res-cell">' + esc(raw) + '</span>' +
        '<span class="res-badge" style="background:' + (isShort ? '#8b6fd1' : '#2e9e5b') + '">' +
        (isShort ? 'eNB ngắn' : 'ECI dài') + '</span></div>';

      html += resRow('eNB ID', esc(d.enbId) + copyBtn(d.enbId));
      html += resRow('Sector', esc(d.sector) + copyBtn(d.sector));
      html += resRow('ECI', esc(d.eci) + copyBtn(d.eci));
      html += resRow('Công thức', '<span class="mono">ECI = eNB × 256 + sector</span>', true);

      html += '<div class="res-actions">' +
        '<button type="button" class="btn-ghost" data-act="fill" data-eci="' + esc(d.eci) + '" data-sector="' + esc(d.sector) + '">' +
        '<i class="fas fa-crosshairs"></i> Dùng ECI để tra cứu</button></div>';

      box.className = 'result ok';
      box.hidden = false;
      box.innerHTML = html;
    } catch (e) {
      mShowResult(box, 'err', '<i class="fas fa-triangle-exclamation res-ico"></i>',
        esc(e.message || 'Cell ID không hợp lệ.'));
    } finally {
      setBusy(btn, false);
    }
  }

  function copyBtn(value) {
    return ' <button type="button" class="link-line" data-act="copy" data-value="' + esc(value) +
      '" title="Copy" aria-label="Copy" style="padding:0 4px"><i class="fas fa-copy"></i></button>';
  }

  function bindConvertActions() {
    var box = $('mConvResult');
    if (!box) return;
    box.addEventListener('click', function (ev) {
      var btn = ev.target.closest ? ev.target.closest('[data-act]') : null;
      if (!btn || !box.contains(btn)) return;
      var act = btn.getAttribute('data-act');
      if (act === 'copy') { copyText(btn.getAttribute('data-value') || ''); return; }
      if (act === 'fill') {
        var eci = btn.getAttribute('data-eci');
        var sector = btn.getAttribute('data-sector');
        $('mLkCell').value = eci || '';
        $('mLkSector').value = sector || '';
        var mnc = $('mLkMnc').value;
        var lac = $('mLkLac').value;
        mTab('lookup');
        if (!mnc || !lac) {
          toast('Đã điền ECI. Nhập thêm MNC và LAC để tra cứu.', '');
        } else {
          mDoLookup(null);
        }
      }
    });
  }

  // ==========================================================================
  // 7c. TRA CỨU IP (đa nguồn) — cùng endpoint với bản web
  // ==========================================================================
  // Bản mobile gọi `/api/tools/ip-lookup` (đăng nhập) và hiển thị:
  //   • vài dòng tổng hợp (giá trị nhiều nguồn đồng ý nhất),
  //   • danh sách nguồn dạng accordion (<details>) — chạm vào nguồn để xem đủ
  //     trường mà nguồn đó trả về.
  // Nút "IP của tôi" dò IP WAN cho CẢ IPv4 và IPv6 bằng 2 endpoint một họ (một
  // request HTTP chỉ đi qua một họ địa chỉ nên server không thể biết cả hai).
  // Chỉ dùng dịch vụ có CORS (`Access-Control-Allow-Origin: *`).
  var IP_SELF_PROVIDERS = {
    4: ['https://ipv4.ident.me', 'https://api-ipv4.ip.sb/ip', 'https://ipv4.icanhazip.com'],
    6: ['https://ipv6.ident.me', 'https://api-ipv6.ip.sb/ip', 'https://ipv6.icanhazip.com']
  };
  var IP_SELF_TIMEOUT_MS = 4500;
  var IP_SELF = { 4: null, 6: null };

  // [khoá trong data, nhãn hiển thị, hiển thị font mono]
  var IP_DETAIL_FIELDS = [
    ['country', 'Quốc gia'], ['countryCode', 'Mã quốc gia', true],
    ['continent', 'Châu lục'], ['continentCode', 'Mã châu lục', true],
    ['region', 'Vùng / tiểu bang'], ['city', 'Thành phố'],
    ['postal', 'Mã bưu chính', true], ['lat', 'Vĩ độ', true], ['lon', 'Kinh độ', true],
    ['timezone', 'Múi giờ', true], ['gmtOffset', 'GMT offset', true],
    ['asn', 'ASN', true], ['asnName', 'Tên ASN'], ['isp', 'ISP'], ['org', 'Tổ chức'],
    ['domain', 'Tên miền', true], ['linkType', 'Loại kết nối'], ['usageType', 'Loại sử dụng'],
    ['isProxy', 'Proxy / VPN', true], ['proxyType', 'Loại proxy'],
    ['isHosting', 'Hosting / datacenter', true], ['isMobile', 'Mạng di động', true],
    ['threatLevel', 'Mức đe doạ']
  ];

  function ipFamily(s) {
    var v = String(s || '').trim();
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) {
      var oct = v.split('.');
      for (var i = 0; i < oct.length; i++) if (Number(oct[i]) > 255) return 0;
      return 4;
    }
    if (v.indexOf(':') !== -1 && /^[0-9a-f:.%]+$/i.test(v) && v.split(':').length >= 3) return 6;
    return 0;
  }

  /** fetch có timeout: dịch vụ dò bị chặn/treo không được làm đơ nút. */
  async function ipFetchText(url) {
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, IP_SELF_TIMEOUT_MS) : null;
    try {
      var res = await fetch(url, { cache: 'no-store', mode: 'cors', signal: ctl ? ctl.signal : undefined });
      if (!res.ok) return '';
      return String(await res.text() || '').trim();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function ipDetectWan(family) {
    var urls = IP_SELF_PROVIDERS[family] || [];
    for (var i = 0; i < urls.length; i++) {
      try {
        var raw = await ipFetchText(urls[i]);
        if (raw.charAt(0) === '{') {
          try { var j = JSON.parse(raw); raw = String((j && (j.ip || j.address)) || '').trim(); }
          catch (e) { raw = ''; }
        }
        if (ipFamily(raw) === family) return raw;
      } catch (e) { /* endpoint kế tiếp */ }
    }
    return null;
  }

  function ipFieldValue(key, v) {
    if (v === null || v === undefined || v === '') return null;
    if (v === true) return 'Có';
    if (v === false) return 'Không';
    if (key === 'gmtOffset') {
      var n = Number(v);
      if (isFinite(n)) return 'UTC' + (n >= 0 ? '+' : '') + n;
    }
    if ((key === 'lat' || key === 'lon') && isFinite(Number(v))) {
      return String(Math.round(Number(v) * 1e6) / 1e6);
    }
    return String(v);
  }

  function ipDetRow(k, v, plain) {
    return '<div class="m-ip-row"><span class="m-ip-k">' + esc(k) + '</span>' +
      '<span class="m-ip-v' + (plain ? ' plain' : '') + '">' + v + '</span></div>';
  }

  /** Một nguồn = một <details>: chạm vào tiêu đề để mở rộng chi tiết. */
  function ipSourceHtml(r) {
    var label = esc(r.label || r.source || 'nguồn');
    // Mũi tên bằng icon Font Awesome (không dùng ::before vì ký tự '›' hiển thị
    // lệch/đè lên tên nguồn trên một số máy Android).
    var caret = '<i class="fas fa-chevron-right m-ip-caret" aria-hidden="true"></i>';
    if (!r.ok || !r.data) {
      return '<details class="m-ip-src"><summary>' + caret +
        '<span class="m-ip-name">' + label + '</span>' +
        '<span class="m-ip-tag">lỗi</span></summary>' +
        '<div class="m-ip-det">' +
        ipDetRow('Lỗi', esc(r.error || 'Không có dữ liệu'), true) +
        '</div></details>';
    }
    var x = r.data;
    var rows = [];
    var missing = [];
    for (var i = 0; i < IP_DETAIL_FIELDS.length; i++) {
      var key = IP_DETAIL_FIELDS[i][0];
      var lbl = IP_DETAIL_FIELDS[i][1];
      var mono = IP_DETAIL_FIELDS[i][2];
      var val = ipFieldValue(key, x[key]);
      if (val === null) { missing.push(lbl); continue; }
      rows.push(ipDetRow(lbl, esc(val), !mono));
    }
    var tag = (r.cached ? 'cache' : 'mới') + (r.ms != null ? ' · ' + r.ms + 'ms' : '');
    return '<details class="m-ip-src"><summary>' + caret +
      '<span class="m-ip-name">' + label + '</span>' +
      '<span class="m-ip-tag">' + esc(tag) + '</span></summary>' +
      '<div class="m-ip-det">' +
      (rows.length ? rows.join('') : ipDetRow('Dữ liệu', 'Nguồn không trả trường nào', true)) +
      (missing.length ? '<div class="m-ip-missing">Nguồn không trả: ' + esc(missing.join(', ')) + '</div>' : '') +
      '</div></details>';
  }

  /** Vẽ toàn bộ kết quả tra cứu IP. Tách riêng để kiểm thử gọi trực tiếp được. */
  function mRenderIpResult(payload) {
    var box = $('mIpResult');
    if (!box) return;
    var d = payload || {};
    var agg = d.aggregate || {};
    var f = agg.fields || {};
    var okCount = Number(agg.sources_ok) || 0;
    var total = Number(agg.sources_total) || 0;

    var head = '<i class="fas fa-' + (okCount ? 'circle-check' : 'circle-xmark') + ' res-ico"></i>' +
      '<span class="res-cell">' + esc(d.ip || '') + '</span>' +
      '<span class="res-badge">IPv' + esc(d.ipVersion || '?') + '</span>' +
      (d.cacheHits ? '<span class="res-badge">cache ' + esc(d.cacheHits) + '</span>' : '');

    function pickV(k) { var v = f[k]; return v && v.value ? v.value : '—'; }
    function agree(k) { var v = f[k]; return v && v.count > 1 ? ' (' + v.count + ' nguồn)' : ''; }

    var body = '';
    var countryTxt = pickV('country');
    var cc = f.countryCode && f.countryCode.value ? String(f.countryCode.value) : '';
    body += resRow('Quốc gia',
      esc(countryTxt) + (cc && countryTxt !== '—' ? esc(' (' + cc + ')') : '') + esc(agree('country')), true);
    body += resRow('Vùng / thành phố', esc([pickV('region'), pickV('city')].filter(function (x) { return x && x !== '—'; }).join(' · ') || '—'), true);
    body += resRow('ASN', esc(pickV('asn')) + esc(agree('asn')));
    body += resRow('Nhà mạng / tổ chức', esc(pickV('isp') !== '—' ? pickV('isp') : pickV('org')), true);
    if (agg.lat != null && agg.lon != null) {
      body += resRow('Toạ độ (trung vị)', esc(Number(agg.lat).toFixed(4) + ', ' + Number(agg.lon).toFixed(4)));
    }
    if (f.timezone && f.timezone.value) body += resRow('Múi giờ', esc(f.timezone.value));
    body += resRow('Nguồn trả lời', esc(okCount + '/' + total + ' · đồng thuận ' + Math.round((Number(agg.agreement) || 0) * 100) + '%'), true);

    var flags = agg.flags || {};
    if (flags.isProxy) body += resRow('Cảnh báo', 'Có nguồn đánh dấu proxy/VPN', true);
    else if (flags.isHosting) body += resRow('Cảnh báo', 'Có nguồn đánh dấu hosting/datacenter', true);

    body += '<div class="m-ip-srcs">' + (d.results || []).map(ipSourceHtml).join('') + '</div>';
    body += '<div class="m-ip-missing" style="margin-top:8px">Chạm vào từng nguồn để xem chi tiết đầy đủ. ' +
      'Toạ độ là của vùng/nhà mạng, không phải vị trí thiết bị.</div>';

    box.className = 'result ' + (okCount ? 'ok' : 'miss');
    box.hidden = false;
    box.innerHTML = '<div class="res-hd">' + head + '</div>' + body;
  }

  async function mLookupIp(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    var box = $('mIpResult');
    var ip = ($('mIpInp').value || '').trim();
    if (!ip) {
      mShowResult(box, 'err', '<i class="fas fa-triangle-exclamation res-ico"></i>', 'Nhập địa chỉ IP cần tra.');
      return;
    }
    var btn = $('mIpBtn');
    setBusy(btn, true);
    mShowResult(box, '', '<i class="fas fa-spinner spin res-ico"></i>', 'Đang tra cứu…');
    try {
      var d = await mApi('GET', '/api/tools/ip-lookup?ip=' + encodeURIComponent(ip));
      if (!d || !d.ok) throw new Error((d && d.error) || 'Không tra được địa chỉ IP này');
      mRenderIpResult(d);
    } catch (e) {
      var msg = e.message || 'Tra cứu không thành công';
      if (e.code === 429) msg = e.message;
      mShowResult(box, 'err', '<i class="fas fa-circle-xmark res-ico"></i>', esc(msg));
    } finally {
      setBusy(btn, false);
    }
  }

  /** Vẽ chip IPv4/IPv6 đã dò được (kể cả "không có") + ghi chú. */
  function mRenderSelfChips(note) {
    var box = $('mIpSelfBox');
    if (!box) return;
    var fams = [4, 6];
    var html = '';
    for (var i = 0; i < fams.length; i++) {
      var f = fams[i];
      var ip = IP_SELF[f];
      if (ip) {
        html += '<button type="button" class="chip" data-ip="' + esc(ip) + '">' +
          '<span class="fam">IPv' + f + '</span>' + esc(ip) + '</button>';
      } else {
        html += '<span class="chip none"><span class="fam">IPv' + f + '</span>không có</span>';
      }
    }
    html += '<div class="m-ip-self-note">' + esc(note ||
      'Địa chỉ Internet nhìn thấy (sau NAT nhà mạng), không phải IP riêng trong máy.') + '</div>';
    box.innerHTML = html;
    box.hidden = false;
  }

  async function mUseMyIp() {
    var btn = $('mIpSelfBtn');
    var box = $('mIpSelfBox');
    if (!btn || !box) return;
    btn.disabled = true;
    box.hidden = false;
    box.innerHTML = '<div class="m-ip-self-note"><i class="fas fa-spinner spin"></i> Đang xác định IP WAN (IPv4 + IPv6)…</div>';
    try {
      var out = await Promise.all([ipDetectWan(4), ipDetectWan(6)]);
      IP_SELF[4] = out[0];
      IP_SELF[6] = out[1];
      // Dự phòng: IP server thấy, chỉ khi là địa chỉ công khai thật (không LAN).
      if (!IP_SELF[4] || !IP_SELF[6]) {
        try {
          var seen = await mApi('GET', '/api/tools/ip-lookup/me');
          if (seen && seen.wan_ip && seen.ipVersion) {
            var fam = seen.ipVersion === 6 ? 6 : 4;
            if (!IP_SELF[fam]) IP_SELF[fam] = seen.wan_ip;
          }
        } catch (e) { /* không có IP server → vẫn hiện những gì dò được */ }
      }
      var notes = [];
      if (IP_SELF[4] && IP_SELF[6]) notes.push('Máy bạn có cả IPv4 và IPv6 — hai họ độc lập, chạm để tra từng địa chỉ.');
      else if (IP_SELF[4]) notes.push('Mạng hiện tại chỉ ra Internet bằng IPv4. Chạm để tra IP này.');
      else if (IP_SELF[6]) notes.push('Mạng hiện tại chỉ có IPv6 công khai. Chạm để tra IP này.');
      else notes.push('Không xác định được IP WAN — mạng có thể chặn dịch vụ dò (ident.me / ip.sb / icanhazip.com).');
      mRenderSelfChips(notes.join(' '));

      var pick = IP_SELF[4] || IP_SELF[6];
      if (pick) {
        $('mIpInp').value = pick;
        await mLookupIp(null);
      }
    } finally {
      btn.disabled = false;
    }
  }

  function mUseDetectedIp(ip) {
    if (!ip) return;
    $('mIpInp').value = ip;
    mLookupIp(null);
  }

  function bindIpActions() {
    var box = $('mIpSelfBox');
    if (!box) return;
    box.addEventListener('click', function (ev) {
      var chip = ev.target.closest ? ev.target.closest('.chip[data-ip]') : null;
      if (!chip || !box.contains(chip)) return;
      mUseDetectedIp(chip.getAttribute('data-ip') || '');
    });
  }

  // ==========================================================================
  // 8. PWA — cài đặt
  // ==========================================================================
  // Ba tình huống phải xử lý khác nhau:
  //   1. Chrome/Edge/Android + HTTPS  → có `beforeinstallprompt` → nút "Cài" gọi
  //      hộp thoại cài thật.
  //   2. iOS/iPadOS Safari (và mọi trình duyệt iOS — đều là WebKit) → KHÔNG có
  //      API cài; chỉ cài được thủ công: Chia sẻ → "Thêm vào MH chính".
  //   3. Firefox / HTTP không bảo mật / trình duyệt khác → không có API cài;
  //      hiện hướng dẫn thủ công thay vì im lặng (chính là lỗi "không thấy nút
  //      cài" khi mở app bằng http://IP-LAN:3000).
  var deferredPrompt = null;
  var MANUAL_HINT = false; // true = trình duyệt không hỗ trợ cài tự động

  var INSTALL_DEFAULT_HTML = '<i class="fas fa-mobile-screen"></i> Cài ứng dụng vào màn hình chính';
  var INSTALL_IOS_HTML = '<i class="fas fa-mobile-screen"></i> Thêm vào MH chính: bấm ' +
    '<i class="fas fa-arrow-up-from-bracket"></i> (Chia sẻ) → “Thêm vào MH chính”';
  var INSTALL_HTTP_HTML = '<i class="fas fa-lock-open"></i> Cần HTTPS để cài ứng dụng — ' +
    'đang mở bằng HTTP nên trình duyệt không cho cài.';

  function isStandaloneApp() {
    try {
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
      if (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches) return true;
    } catch (e) { /* bỏ qua */ }
    return navigator.standalone === true;
  }

  function isIOSDevice() {
    var ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    // iPadOS 13+ giả UA "Macintosh" → phân biệt bằng cảm ứng đa điểm.
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  }

  /** Secure context: HTTPS, hoặc localhost/127.0.0.1 (được coi là an toàn). */
  function isSecureContextOk() {
    if (window.isSecureContext) return true;
    return location.protocol === 'https:' ||
      location.hostname === 'localhost' || location.hostname === '127.0.0.1' ||
      location.hostname === '[::1]';
  }

  function registerSw() {
    if (!('serviceWorker' in navigator)) return;
    // SW chỉ chạy trong secure context — ngoài ra đăng ký sẽ throw, bỏ qua im lặng.
    if (!isSecureContextOk()) {
      if (window.console) {
        console.warn('[pwa] Bỏ qua service worker: cần HTTPS (hoặc localhost). ' +
          'Mở app qua https:// để cài được PWA.');
      }
      return;
    }
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/m/sw.js', { scope: '/m/' }).catch(function (e) {
        // Không chặn app nếu SW lỗi (chế độ riêng tư, http, ...).
        if (window.console) console.warn('SW register failed:', e && e.message);
      });
    });
  }

  function initInstall() {
    var banner = $('mInstall');
    var btn = $('mInstallBtn');
    if (!banner) return;
    if (localStorage.getItem(LS_INSTALL) === '1' || isStandaloneApp()) { banner.hidden = true; return; }

    // Không phải secure context → trình duyệt chắc chắn không bắn
    // `beforeinstallprompt`; hiện hướng dẫn thay vì để trống.
    if (!isSecureContextOk()) MANUAL_HINT = true;
    else if (isIOSDevice()) MANUAL_HINT = true;

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      MANUAL_HINT = false;
      // Chỉ hiện khi đã vào app: banner neo ở đáy màn hình nên sẽ che nút
      // "Đăng nhập"/"Tạo tài khoản" nếu hiện ngay trên màn auth.
      mMaybeShowInstall();
    });

    if (btn) {
      // Nút đã có onclick="mInstallAction()" trong index.html → không gắn thêm
      // listener ở đây (tránh gọi prompt 2 lần).
    }

    window.addEventListener('appinstalled', function () {
      hideInstall();
      try { localStorage.setItem(LS_INSTALL, '1'); } catch (e) { /* quota */ }
      toast('Đã cài ứng dụng vào màn hình chính.', 'ok');
    });
  }

  function mMaybeShowInstall() {
    var banner = $('mInstall');
    var app = $('appScreen');
    if (!banner) return;
    if ((!deferredPrompt && !MANUAL_HINT) || !app || app.hidden) { banner.hidden = true; return; }

    var txt = banner.querySelector('span');
    var btn = $('mInstallBtn');
    var manual = !deferredPrompt && MANUAL_HINT;

    if (txt) {
      if (!manual) txt.innerHTML = INSTALL_DEFAULT_HTML;
      else if (!isSecureContextOk()) txt.innerHTML = INSTALL_HTTP_HTML;
      else if (isIOSDevice()) txt.innerHTML = INSTALL_IOS_HTML;
      else txt.innerHTML = INSTALL_DEFAULT_HTML;
    }
    if (btn) {
      btn.hidden = false;
      // Có prompt thật → "Cài"; chỉ hướng dẫn → "Xem cách cài" (mở bottom sheet).
      btn.textContent = manual ? 'Cách cài' : 'Cài';
    }

    banner.hidden = false;
    document.body.classList.add('install-open');
  }

  function hideInstall() {
    var banner = $('mInstall');
    if (banner) banner.hidden = true;
    document.body.classList.remove('install-open');
  }

  function mDismissInstall() {
    hideInstall();
    try { localStorage.setItem(LS_INSTALL, '1'); } catch (e) { /* quota */ }
  }

  /** Nút trên banner: có hộp thoại cài thật thì gọi luôn, không thì mở hướng dẫn. */
  async function mInstallAction() {
    if (deferredPrompt) {
      var p = deferredPrompt;
      deferredPrompt = null;
      p.prompt();
      try { await p.userChoice; } catch (e) { /* bỏ qua */ }
      hideInstall();
      return;
    }
    mShowInstallHelp();
  }

  /** Hướng dẫn cài thủ công theo trình duyệt hiện tại. */
  function installSteps() {
    var ua = navigator.userAgent || '';
    if (!isSecureContextOk()) {
      return {
        title: 'Cần HTTPS để cài ứng dụng',
        steps: [
          'Trình duyệt chỉ cho phép cài PWA khi trang chạy <b>HTTPS</b>. Địa chỉ hiện tại dùng HTTP nên không có nút cài.',
          'Mở app bằng địa chỉ <b>https://</b> (bản chạy thật, hoặc HTTPS nội bộ khi thử trên máy LAN).',
          'Nếu trình duyệt cảnh báo chứng chỉ tự ký, bấm <b>Nâng cao → Tiến tới</b> rồi tải lại trang.',
          'Sau đó banner này sẽ có nút <b>Cài</b> (hoặc menu ⋮ → “Cài ứng dụng”).'
        ]
      };
    }
    if (isIOSDevice()) {
      var inChrome = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
      return {
        title: 'Cài trên iPhone / iPad',
        steps: inChrome
          ? ['Trình duyệt này trên iOS chỉ cài được qua Safari. Mở link trong <b>Safari</b>.',
             'Trong Safari: bấm nút <b>Chia sẻ</b> (ô vuông có mũi tên lên).',
             'Chọn <b>Thêm vào MH chính</b> → <b>Thêm</b>.']
          : ['Bấm nút <b>Chia sẻ</b> ở thanh dưới (ô vuông có mũi tên lên).',
             'Chọn <b>Thêm vào MH chính</b>.',
             'Bấm <b>Thêm</b> ở góc trên bên phải.']
      };
    }
    if (/Firefox|FxiOS/.test(ua)) {
      return {
        title: 'Cài trên Firefox',
        steps: ['Bấm menu <b>⋮</b> (ba chấm) ở góc phải.',
          'Chọn <b>Cài đặt</b> hoặc <b>Thêm vào MH chính</b>.',
          'Nếu không có: mở app bằng <b>Chrome</b> để cài được.']
      };
    }
    if (/Edg\//.test(ua)) {
      return {
        title: 'Cài trên Edge',
        steps: ['Bấm menu <b>…</b> → <b>Ứng dụng</b> → <b>Cài ứng dụng này</b>.',
          'Hoặc bấm nút <b>Cài</b> trên thanh địa chỉ.']
      };
    }
    return {
      title: 'Cài ứng dụng',
      steps: ['Mở menu trình duyệt (<b>⋮</b> hoặc <b>…</b>).',
        'Chọn <b>Cài ứng dụng</b> / <b>Thêm vào MH chính</b>.',
        'Nếu chưa thấy: tải lại trang, hoặc dùng <b>Chrome</b>.',
        'Trên máy tính: nút <b>Cài</b> nằm cuối thanh địa chỉ.']
    };
  }

  function mShowInstallHelp() {
    var s = installSteps();
    var box = $('mInstallHelpBody');
    var ttl = $('mInstallHelpTitle');
    if (ttl) ttl.textContent = s.title;
    if (box) {
      box.innerHTML = '<ol class="ih-steps">' +
        s.steps.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ol>';
    }
    var sheet = $('mInstallHelp');
    if (sheet) { sheet.hidden = false; sheet.setAttribute('aria-hidden', 'false'); }
    document.body.classList.add('map-open');
  }

  function mCloseInstallHelp() {
    var sheet = $('mInstallHelp');
    if (sheet) { sheet.hidden = true; sheet.setAttribute('aria-hidden', 'true'); }
    document.body.classList.remove('map-open');
  }

  // ==========================================================================
  // 9. CHỦ ĐỀ + ĐIỀU HƯỚNG BẰNG HASH
  // ==========================================================================
  function mInitTheme() {
    var saved = null;
    try { saved = localStorage.getItem('theme'); } catch (e) { saved = null; }
    var theme = (saved === 'light' || saved === 'dark') ? saved
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f4f6fa' : '#0d1117');
  }

  function hashTab() {
    var h = String(location.hash || '').replace(/^#/, '').split('&')[0];
    return TAB_TITLES[h] ? h : '';
  }

  function onHashChange() {
    var h = String(location.hash || '').replace(/^#/, '');
    if (h === 'login' || h === 'register') {
      if ($('appScreen') && !$('appScreen').hidden) return;
      mAuthView(h === 'register' ? 'register' : 'login');
      return;
    }
    var t = hashTab();
    // `silent` = không pushState lại (URL đã đổi rồi, do người dùng bấm Back
    // hoặc mở deep link) → tránh nhân đôi lịch sử.
    if (t && $('appScreen') && !$('appScreen').hidden) mTab(t, true);
  }

  // Nút Back/Forward của điện thoại → quay lại tab trước (không thoát app).
  function onPopState() {
    // Trang nạp điểm đang mở → Back đóng nó trước.
    if ($('mTopupSheet') && !$('mTopupSheet').hidden) { mCloseTopup(true); return; }
    var t = hashTab();
    if (t && $('appScreen') && !$('appScreen').hidden) mTab(t, true);
  }

  // ==========================================================================
  // 10. KHỞI ĐỘNG
  // ==========================================================================
  function bindEvents() {
    bindLookupActions();
    bindHistActions();
    bindConvertActions();
    bindIpActions();
    bindMapSheet();

    var more = $('mHistMore');
    if (more) more.addEventListener('click', function () { mHistMore(); });

    // Các form đã có `onsubmit="..."` trong index.html → KHÔNG gắn thêm listener
    // submit ở đây, tránh gọi handler 2 lần (double request).
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onPopState);

    // 401 từ Auth.fetch (dùng bởi auth.js) → kết thúc phiên.
    window.__onSessionExpired = function () { sessionExpired(); };

    // Enter ở ô captcha đăng ký → submit form.
    var capInp = $('mRegCaptcha');
    if (capInp) {
      capInp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); mDoRegister(null); }
      });
    }
  }

  async function mBoot() {
    mInitTheme();
    bindEvents();
    mRestoreForm();
    initInstall();
    // Đăng ký service worker NGAY khi tải trang, không chờ đăng nhập: màn đăng
    // nhập cũng phải mở được khi mất mạng, và SW chỉ cài 1 lần cho cả phiên.
    registerSw();

    var hash = String(location.hash || '').replace(/^#/, '');

    if (!Auth.isLoggedIn()) {
      mAuthView(hash === 'register' ? 'register' : 'login');
      if (hash === 'verified=1') toast('Email đã kích hoạt, hãy đăng nhập.', 'ok');
      return;
    }

    var user = null;
    try { user = await Auth.checkSession(); } catch (e) { user = null; }
    if (!user) {
      // checkSession đã chuyển sang /maintenance.html khi website đóng.
      if (!Auth._siteClosed) mAuthView('login');
      return;
    }
    mEnterApp();
  }

  // Hiển thị sớm màn đăng nhập để không nháy nội dung khi đang kiểm tra phiên.
  mInitTheme();
  document.addEventListener('DOMContentLoaded', function () {
    mInitTheme();
    mBoot();
  });
  if (document.readyState !== 'loading') {
    mInitTheme();
    mBoot();
  }

  // ----- Xuất các hàm cho inline handler trong index.html -----
  window.mAuthTab = mAuthTab;
  window.mAuthView = mAuthView;
  window.mLoadCaptcha = mLoadCaptcha;
  window.mDoLogin = mDoLogin;
  window.mDoRegister = mDoRegister;
  window.mDoVerify = mDoVerify;
  window.mResendVerify = mResendVerify;
  window.mForgot = mForgot;
  window.mDoForgot = mDoForgot;
  window.mDoReset = mDoReset;
  window.mTogglePass = mTogglePass;
  window.mTab = mTab;
  window.mDoLookup = mDoLookup;
  window.mOpenMap = mOpenMap;
  window.mLkMapBtnToggle = mLkMapBtnToggle;
  window.mOpenDesktop = mOpenDesktop;
  window.mCloseMap = mCloseMap;
  window.mMapLayer = mMapLayer;
  window.mMapZoom = mMapZoom;
  window.mMapRecenter = mMapRecenter;
  window.mMapCopy = mMapCopy;
  window.mMapGoogle = mMapGoogle;
  window.mMapState = mMapState;
  window.mMapHistory = mMapHistory;
  window.mHistMode = mHistMode;
  window.mHistMore = mHistMore;
  window.mLoadPhoneCaptcha = mLoadPhoneCaptcha;
  window.mToolToggle = mToolToggle;
  window.mToolOpen = mToolOpen;
  window.mCheckPhone = mCheckPhone;
  window.mDoConvert = mDoConvert;
  window.mLookupIp = mLookupIp;
  window.mUseMyIp = mUseMyIp;
  window.mUseDetectedIp = mUseDetectedIp;
  window.mRenderIpResult = mRenderIpResult;
  window.mRefreshMe = mRefreshMe;
  window.mLogout = mLogout;
  window.mDismissInstall = mDismissInstall;
  window.mMaybeShowInstall = mMaybeShowInstall;

  // Nạp điểm
  window.mOpenTopup = mOpenTopup;
  window.mCloseTopup = mCloseTopup;
  window.mTopupLoad = mTopupLoad;
  window.mPickPackage = mPickPackage;
  window.mTpAmountInput = mTpAmountInput;
  window.mCreateTopup = mCreateTopup;
  window.mResumeTopup = mResumeTopup;
  window.mTpSyncNow = mTpSyncNow;
  window.mTpCancel = mTpCancel;
  window.mTpMockPaid = mTpMockPaid;
  window.mTpNewOrder = mTpNewOrder;
  window.mTpCopyDesc = mTpCopyDesc;
  window.mInstallAction = mInstallAction;
  window.mShowInstallHelp = mShowInstallHelp;
  window.mCloseInstallHelp = mCloseInstallHelp;

  // Trạng thái phục vụ kiểm thử tự động (không chứa token/mật khẩu).
  // `authState` chỉ giữ id captcha và email/thư đang chờ kích hoạt.
  window.__mState = {
    auth: authState,
    hist: histState,
    lookup: function () { return LAST_LOOKUP; }
  };
  window.__mBooted = true;
})();
