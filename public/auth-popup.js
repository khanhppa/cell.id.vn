/**
 * auth-popup.js — popup Đăng nhập / Đăng ký / Kích hoạt / Quên mật khẩu.
 *
 * Thiết kế:
 *  - TỰ CHỨA: nhúng <script src="/auth-popup.js"></script> là có popup; không phụ
 *    thuộc app.js (index có app.js, các trang khác thì không).
 *  - i18n riêng (vi/en) đọc localStorage 'lang' — khớp app.js/auth.js.
 *  - /login.html vẫn giữ cho link cũ; trang đó gọi AuthPopup.autoOpen() nên
 *    /login.html#register mở thẳng tab Đăng ký của popup.
 *  - Captcha là "captcha chữ": server trả text, client vẽ canvas + nhiễu nhẹ.
 *    Chặn bot ngây thơ; KHÔNG chống bot biết đọc JSON (xem ghi chú server.js).
 */
(function () {
  'use strict';

  var I18N = {
    vi: {
      title: 'Cell.id.vn',
      tabLogin: 'Đăng nhập', tabRegister: 'Đăng ký',
      loginTitle: 'Đăng nhập', loginSub: 'Dùng tài khoản để tra cứu không giới hạn.',
      registerTitle: 'Tạo tài khoản', registerSub: 'Miễn phí. Xác nhận qua email để kích hoạt.',
      usernameOrEmail: 'Tên đăng nhập hoặc Email',
      username: 'Tên đăng nhập', password: 'Mật khẩu', email: 'Email',
      confirmPassword: 'Nhập lại mật khẩu', newPassword: 'Mật khẩu mới',
      captchaLabel: 'Mã xác nhận', captchaClick: 'Bấm để đổi mã',
      captchaPlaceholder: 'Nhập 6 ký tự',
      acceptTerms: 'Tôi đồng ý với', termsLink: 'điều khoản sử dụng',
      termsTitle: 'Điều khoản sử dụng', termsBack: '← Về đăng ký',
      loginBtn: 'Đăng nhập', registerBtn: 'Đăng ký', submitting: 'Đang xử lý…',
      forgot: 'Quên mật khẩu?', noAccount: 'Chưa có tài khoản?', backToLogin: '← Về đăng nhập',
      verifyTitle: 'Kích hoạt tài khoản',
      verifySub: 'Nhập mã 6 số đã gửi tới {email}. Nếu chưa thấy, kiểm tra Spam hoặc bấm gửi lại.',
      verifyBtn: 'Kích hoạt', resend: 'Gửi lại mã', resending: 'Đang gửi lại…',
      resent: 'Đã gửi lại mã tới {email}',
      forgotTitle: 'Quên mật khẩu', forgotSub: 'Nhập email đăng ký — chúng tôi gửi mã đặt lại mật khẩu.',
      forgotBtn: 'Gửi mã đặt lại',
      resetTitle: 'Đặt lại mật khẩu', resetSub: 'Nhập mã 6 số trong email và mật khẩu mới.',
      resetCode: 'Mã xác nhận (6 số)', resetBtn: 'Đổi mật khẩu', close: 'Đóng',
      errMatch: 'Hai mật khẩu không khớp', errTerms: 'Bạn cần đồng ý điều khoản sử dụng',
      errCaptcha: 'Nhập mã xác nhận trong ảnh', errEmail: 'Email không hợp lệ',
      errEmpty: 'Vui lòng nhập đủ thông tin',
      errUser: 'Tên đăng nhập phải từ 3–32 ký tự (chữ, số, . _ -)',
      errPass: 'Mật khẩu phải có ít nhất 6 ký tự', errCode: 'Mã xác nhận gồm 6 chữ số',
      registerOk: 'Đăng ký thành công! Nhập mã kích hoạt đã gửi tới {email}.',
      registerOkNoMail: 'Đăng ký thành công! SMTP chưa cấu hình — dùng mã bên dưới để kích hoạt.',
      verifyOk: 'Kích hoạt thành công! Đang vào hệ thống…',
      resetOk: 'Đổi mật khẩu thành công! Đang vào hệ thống…',
      forgotSent: 'Nếu email tồn tại, mã đặt lại đã được gửi.',
      forgotSentDev: 'Mã đặt lại (SMTP chưa cấu hình): {code}',
      devLink: 'Link thử (dev):', copy: 'Copy', copied: 'Đã copy!',
      errNetwork: 'Không kết nối được máy chủ',
      errRate: 'Bạn thao tác quá nhanh. Vui lòng đợi vài phút rồi thử lại.',
      captchaFail: 'Không tải được mã — bấm để thử lại'
    },
    en: {
      title: 'Cell.id.vn',
      tabLogin: 'Sign in', tabRegister: 'Sign up',
      loginTitle: 'Sign in', loginSub: 'Sign in for unlimited lookups.',
      registerTitle: 'Create account', registerSub: 'Free. Confirm your email to activate.',
      usernameOrEmail: 'Username or Email',
      username: 'Username', password: 'Password', email: 'Email',
      confirmPassword: 'Confirm password', newPassword: 'New password',
      captchaLabel: 'Verification code', captchaClick: 'Click to refresh',
      captchaPlaceholder: 'Enter 6 characters',
      acceptTerms: 'I agree to the', termsLink: 'terms of use',
      termsTitle: 'Terms of use', termsBack: '← Back to sign up',
      loginBtn: 'Sign in', registerBtn: 'Sign up', submitting: 'Working…',
      forgot: 'Forgot password?', noAccount: 'No account yet?', backToLogin: '← Back to sign in',
      verifyTitle: 'Activate account',
      verifySub: 'Enter the 6-digit code sent to {email}. Check Spam or resend if you do not see it.',
      verifyBtn: 'Activate', resend: 'Resend code', resending: 'Resending…',
      resent: 'Code resent to {email}',
      forgotTitle: 'Forgot password', forgotSub: 'Enter your registered email — we will send a reset code.',
      forgotBtn: 'Send reset code',
      resetTitle: 'Reset password', resetSub: 'Enter the 6-digit code from the email and a new password.',
      resetCode: 'Code (6 digits)', resetBtn: 'Change password', close: 'Close',
      errMatch: 'Passwords do not match', errTerms: 'You must accept the terms of use',
      errCaptcha: 'Enter the code shown', errEmail: 'Invalid email',
      errEmpty: 'Please fill in all fields',
      errUser: 'Username must be 3–32 chars (letters, digits, . _ -)',
      errPass: 'Password must be at least 6 characters', errCode: 'The code must be 6 digits',
      registerOk: 'Registered! Enter the activation code sent to {email}.',
      registerOkNoMail: 'Registered! SMTP not configured — use the code below to activate.',
      verifyOk: 'Activated! Signing you in…',
      resetOk: 'Password changed! Signing you in…',
      forgotSent: 'If the email exists, a reset code has been sent.',
      forgotSentDev: 'Reset code (SMTP not configured): {code}',
      devLink: 'Dev link:', copy: 'Copy', copied: 'Copied!',
      errNetwork: 'Cannot reach the server',
      errRate: 'Too many attempts. Please wait a few minutes and try again.',
      captchaFail: 'Could not load code — click to retry'
    }
  };

  function lang() { return localStorage.getItem('lang') === 'en' ? 'en' : 'vi'; }

  function T(key, vars) {
    var s = (I18N[lang()] && I18N[lang()][key]) || I18N.vi[key] || key;
    if (vars) {
      for (var k in vars) {
        if (Object.prototype.hasOwnProperty.call(vars, k)) s = s.replace('{' + k + '}', vars[k]);
      }
    }
    return s;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Mã lỗi server → key hiển thị (server trả tiếng Việt; UI EN thì dịch lại).
  var SERVER_ERR = { BAD_CAPTCHA: 'errCaptcha', BAD_CODE: 'errCode' };
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  var state = { view: 'login', captcha: null, email: null, username: null, busy: false };

  function idVal(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '') : '';
  }

  // ==========================================================================
  // CSS — chèn 1 lần; ưu tiên biến theme của trang, có fallback sáng.
  // ==========================================================================
  function injectCss() {
    if (document.getElementById('authPopupStyle')) return;
    var st = document.createElement('style');
    st.id = 'authPopupStyle';
    st.textContent = [
      '#authPopupOverlay{position:fixed;inset:0;background:rgba(6,10,22,.62);backdrop-filter:blur(4px);',
      'display:none;align-items:center;justify-content:center;z-index:4000;padding:16px}',
      '#authPopupOverlay.show{display:flex}',
      // overflow:hidden + flex column: chỉ #apBody cuộn, nên scrollbar KHÔNG chồng
      // lên viền bo góc 16px và không cắt mất nút đóng. dvh ưu tiên mobile.
      // Padding gọn (18/22/20) + các class dưới nén lại để form vừa khung,
      // KHÔNG phát sinh nhu cầu cuộn trên phần lớn màn hình.
      '#authPopupBox{width:100%;max-width:410px;max-height:92vh;max-height:calc(100dvh - 32px);',
      'overflow:hidden;display:flex;flex-direction:column;background:var(--bg-surface,#fff);',
      'color:var(--text-primary,#1a1a2e);border:1px solid var(--border-color,rgba(0,0,0,.12));border-radius:16px;',
      'box-shadow:0 24px 70px rgba(0,0,0,.35);padding:18px 22px 20px;position:relative;font-size:14px;',
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}",
      // Vùng cuộn DỰ PHÒNG: form đã nén nên thường không cuộn; trên màn rất thấp
      // vẫn cuộn được nhưng thanh mảnh + chỉ hiện khi hover (overlay, không chiếm chỗ).
      '#apBody{overflow-y:auto;overflow-x:hidden;flex:1 1 auto;min-height:0;',
      'scrollbar-width:thin;scrollbar-color:var(--border-color,rgba(0,0,0,.22)) transparent}',
      '#apBody::-webkit-scrollbar{width:6px}',
      '#apBody::-webkit-scrollbar-track{background:transparent}',
      '#apBody::-webkit-scrollbar-thumb{background:transparent;border-radius:8px}',
      '#apBody:hover::-webkit-scrollbar-thumb{background:var(--border-color,rgba(0,0,0,.22))}',
      '#apBody::-webkit-scrollbar-thumb:hover{background:var(--text-faint,rgba(0,0,0,.35))}',
      // Thanh tiêu đề (brand + nút đóng) đứng yên khi form cuộn.
      '.ap-top{flex:0 0 auto}',
      '.ap-close{position:absolute;top:12px;right:12px;border:0;background:transparent;cursor:pointer;',
      'font-size:18px;color:var(--text-secondary,#667);line-height:1;padding:4px}',
      '.ap-brand{font-size:17px;font-weight:800;text-align:center;margin:0 0 2px;color:var(--text-primary,#1a1a2e)}',
      '.ap-tabs{display:flex;gap:6px;background:var(--bg-surface2,rgba(0,0,0,.04));border-radius:10px;padding:4px;margin:10px 0 12px}',
      '.ap-tab{flex:1;padding:8px;border:0;border-radius:8px;background:transparent;cursor:pointer;',
      'font-size:13px;font-weight:600;color:var(--text-secondary,#556)}',
      '.ap-tab.active{background:var(--bg-btn-primary,#4444cc);color:#fff}',
      '.ap-h2{font-size:15px;font-weight:700;margin:0 0 2px}',
      '.ap-sub{font-size:12px;color:var(--text-secondary,#667);margin:0 0 10px;line-height:1.4}',
      '.ap-field{margin-bottom:9px}',
      // Nhãn đã chuyển vào placeholder; giữ class rỗng phòng khi cần định vị.
      '.ap-label{display:block;font-size:12.5px;font-weight:600;margin-bottom:5px;color:var(--text-secondary,#556)}',
      // Bọc input + icon: icon tuyệt đối bên trái, input chừa lề trái.
      '.ap-iw{position:relative;display:block}',
      '.ap-ic{position:absolute;left:11px;top:50%;transform:translateY(-50%);display:flex;',
      'color:var(--text-secondary,#667);opacity:.75;pointer-events:none}',
      '.ap-ic svg{width:17px;height:17px;display:block}',
      '.ap-iw .ap-input{padding-left:36px}',
      '.ap-input{width:100%;box-sizing:border-box;padding:9px 11px;border-radius:9px;',
      'border:1px solid var(--border-color,rgba(0,0,0,.16));background:var(--bg-surface,#fff);',
      'color:var(--text-primary,#1a1a2e);font-size:14px;outline:none}',
      '.ap-input:focus{border-color:var(--border-focus,#4444cc)}',
      '.ap-captcha{display:flex;gap:10px;align-items:center}',
      '.ap-captcha .ap-iw{flex:1 1 auto;min-width:0}',
      '.ap-canvas{flex:0 0 auto;border-radius:9px;border:1px solid var(--border-color,rgba(0,0,0,.16));',
      'cursor:pointer;background:#0f172a;user-select:none}',
      '.ap-check{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;line-height:1.5;margin:4px 0 11px;',
      'color:var(--text-secondary,#556)}',
      '.ap-check input{margin-top:2px}.ap-check a{color:var(--accent,#2563eb);font-weight:600}',
      '.ap-btn{width:100%;padding:10px;border:0;border-radius:9px;background:var(--bg-btn-primary,#4444cc);',
      'color:#fff;font-size:14.5px;font-weight:700;cursor:pointer}',
      '.ap-btn:disabled{opacity:.6;cursor:not-allowed}',
      '.ap-btn-ghost{width:100%;padding:9px;margin-top:8px;border:1px solid var(--border-color,rgba(0,0,0,.16));',
      'border-radius:9px;background:transparent;color:var(--text-primary,#1a1a2e);font-size:13px;font-weight:600;cursor:pointer}',
      '.ap-link{color:var(--accent,#2563eb);cursor:pointer;font-weight:600;font-size:12.5px;background:none;border:0;padding:0}',
      '.ap-foot{display:flex;justify-content:space-between;align-items:center;margin-top:12px;gap:8px}',
      '.ap-msg{margin-top:10px;font-size:12.5px;line-height:1.5;min-height:16px}',
      // Rỗng thì không chiếm chỗ -> bớt ~26px chiều cao mỗi lần render.
      '.ap-msg:empty{display:none}',
      '.ap-msg.err{color:#e5484d}.ap-msg.ok{color:#1f9e5a}.ap-msg.info{color:var(--text-secondary,#667)}',
      '.ap-dev{margin-top:10px;padding:10px;border-radius:9px;background:rgba(120,180,255,.12);',
      'border:1px dashed rgba(80,140,220,.5);font-size:12px;word-break:break-all}',
      '.ap-copy{margin-top:6px;font-size:11.5px;padding:4px 9px;border-radius:6px;cursor:pointer;',
      'border:1px solid var(--border-color,rgba(0,0,0,.16));background:transparent;color:inherit}',
      // View "điều khoản" trong popup: nội dung nạp từ /terms.html, tự ăn màu theme
      // của trang (biến --text-* / --border-color) nên khớp cả sáng lẫn tối.
      '.ap-terms{margin-top:6px;font-size:12.5px;line-height:1.62;color:var(--text-secondary,#556)}',
      '.ap-terms h1{font-size:15px;margin:0 0 2px;color:var(--text-primary,#1a1a2e)}',
      '.ap-terms h2{font-size:13px;margin:14px 0 4px;color:var(--border-focus,#4444cc)}',
      '.ap-terms p,.ap-terms li{font-size:12.5px;line-height:1.62;color:var(--text-secondary,#556)}',
      '.ap-terms ul{margin:5px 0 0 18px}',
      '.ap-terms .updated{font-size:11.5px;color:var(--text-faint,#aaaabb);margin-bottom:6px}',
      '.ap-terms .note,.ap-terms .foot{display:none}',
      '.ap-terms a{color:var(--accent,#2563eb)}',
      '.ap-terms.loading{color:var(--text-muted,#888899);font-style:italic}'
    ].join('');
    document.head.appendChild(st);
  }

  // ==========================================================================
  // Icon + field — nhãn đã chuyển vào placeholder nên cần icon để nhận diện.
  // SVG inline (stroke=currentColor) để không phụ thuộc thư viện icon nào.
  // ==========================================================================
  var ICON = {
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5c0-4 3.4-6.4 7.5-6.4s7.5 2.4 7.5 6.4"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.6 6.6 12 13l8.4-6.4"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.2 5 6v6c0 4.3 3 7.6 7 8.8 4-1.2 7-4.5 7-8.8V6l-7-2.8Z"/><path d="m9.2 12.2 2 2 3.6-4"/></svg>',
    key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="8.2" cy="15.8" r="3.6"/><path d="m10.9 13.1 7.6-7.6M16 8l2.3 2.3M18.4 5.6l2.3 2.3"/></svg>'
  };

  function ic(name) {
    return '<span class="ap-ic" aria-hidden="true">' + (ICON[name] || '') + '</span>';
  }

  /**
   * Bọc input trong .ap-iw kèm icon bên trái.
   * @param {string} iconName khoá trong ICON
   * @param {string} inputHtml thẻ <input> đã dựng
   */
  function field(iconName, inputHtml) {
    return '<div class="ap-iw">' + ic(iconName) + inputHtml + '</div>';
  }

  // ==========================================================================
  // Markup — render lại theo state.view
  // ==========================================================================
  function tabsHtml() {
    return '<div class="ap-tabs">' +
      '<button class="ap-tab ' + (state.view === 'login' ? 'active' : '') + '" onclick="AuthPopup.view(\'login\')">' + esc(T('tabLogin')) + '</button>' +
      '<button class="ap-tab ' + (state.view === 'register' ? 'active' : '') + '" onclick="AuthPopup.view(\'register\')">' + esc(T('tabRegister')) + '</button>' +
      '</div>';
  }

  function captchaField() {
    return '<div class="ap-field">' +
      '<div class="ap-captcha">' +
      field('shield',
        '<input class="ap-input" id="apCaptcha" maxlength="6" autocapitalize="characters"' +
        ' placeholder="' + esc(T('captchaPlaceholder')) + '"' +
        ' aria-label="' + esc(T('captchaLabel')) + '" title="' + esc(T('captchaLabel')) + '">') +
      '<canvas class="ap-canvas" id="apCaptchaCanvas" width="118" height="42" title="' + esc(T('captchaClick')) + '" onclick="AuthPopup.refreshCaptcha()"></canvas>' +
      '</div></div>';
  }

  function loginHtml() {
    return tabsHtml() +
      '<h2 class="ap-h2">' + esc(T('loginTitle')) + '</h2>' +
      '<p class="ap-sub">' + esc(T('loginSub')) + '</p>' +
      '<div class="ap-field">' + field('user',
        '<input class="ap-input" id="apUser" autocomplete="username"' +
        ' placeholder="' + esc(T('usernameOrEmail')) + '"' +
        ' aria-label="' + esc(T('usernameOrEmail')) + '" title="' + esc(T('usernameOrEmail')) + '">') + '</div>' +
      '<div class="ap-field">' + field('lock',
        '<input class="ap-input" id="apPass" type="password" autocomplete="current-password"' +
        ' placeholder="' + esc(T('password')) + '"' +
        ' aria-label="' + esc(T('password')) + '" title="' + esc(T('password')) + '">') + '</div>' +
      '<button class="ap-btn" id="apSubmit" onclick="AuthPopup.submitLogin()">' + esc(T('loginBtn')) + '</button>' +
      '<div class="ap-foot"><button class="ap-link" onclick="AuthPopup.view(\'forgot\')">' + esc(T('forgot')) + '</button>' +
      '<button class="ap-link" onclick="AuthPopup.view(\'register\')">' + esc(T('noAccount')) + '</button></div>' +
      '<div class="ap-msg" id="apMsg"></div>';
  }

  function registerHtml() {
    return tabsHtml() +
      '<h2 class="ap-h2">' + esc(T('registerTitle')) + '</h2>' +
      '<p class="ap-sub">' + esc(T('registerSub')) + '</p>' +
      '<div class="ap-field">' + field('user',
        '<input class="ap-input" id="apUser" autocomplete="username"' +
        ' placeholder="' + esc(T('username')) + '"' +
        ' aria-label="' + esc(T('username')) + '" title="' + esc(T('username')) + '">') + '</div>' +
      '<div class="ap-field">' + field('mail',
        '<input class="ap-input" id="apEmail" type="email" autocomplete="email" placeholder="you@example.com"' +
        ' aria-label="' + esc(T('email')) + '" title="' + esc(T('email')) + '">') + '</div>' +
      '<div class="ap-field">' + field('lock',
        '<input class="ap-input" id="apPass" type="password" autocomplete="new-password"' +
        ' placeholder="' + esc(T('password')) + '"' +
        ' aria-label="' + esc(T('password')) + '" title="' + esc(T('password')) + '">') + '</div>' +
      '<div class="ap-field">' + field('lock',
        '<input class="ap-input" id="apPass2" type="password" autocomplete="new-password"' +
        ' placeholder="' + esc(T('confirmPassword')) + '"' +
        ' aria-label="' + esc(T('confirmPassword')) + '" title="' + esc(T('confirmPassword')) + '">') + '</div>' +
      captchaField() +
      '<label class="ap-check"><input type="checkbox" id="apTerms"> <span>' + esc(T('acceptTerms')) +
      ' <a href="/terms.html" onclick="AuthPopup.view(\'terms\');return false;">' + esc(T('termsLink')) + '</a></span></label>' +
      '<button class="ap-btn" id="apSubmit" onclick="AuthPopup.submitRegister()">' + esc(T('registerBtn')) + '</button>' +
      '<div class="ap-msg" id="apMsg"></div>';
  }

  function verifyHtml() {
    return '<h2 class="ap-h2">' + esc(T('verifyTitle')) + '</h2>' +
      '<p class="ap-sub">' + esc(T('verifySub', { email: state.email || '' })) + '</p>' +
      '<div class="ap-field">' + field('key',
        '<input class="ap-input" id="apCode" maxlength="6" inputmode="numeric" placeholder="000000"' +
        ' aria-label="' + esc(T('resetCode')) + '" title="' + esc(T('resetCode')) + '"' +
        ' style="letter-spacing:6px;font-size:18px;text-align:center">') + '</div>' +
      '<button class="ap-btn" id="apSubmit" onclick="AuthPopup.submitVerify()">' + esc(T('verifyBtn')) + '</button>' +
      '<button class="ap-btn-ghost" id="apResend" onclick="AuthPopup.resend()">' + esc(T('resend')) + '</button>' +
      '<div class="ap-msg" id="apMsg"></div>' +
      '<div class="ap-foot"><button class="ap-link" onclick="AuthPopup.view(\'login\')">' + esc(T('backToLogin')) + '</button></div>';
  }

  function forgotHtml() {
    return '<h2 class="ap-h2">' + esc(T('forgotTitle')) + '</h2>' +
      '<p class="ap-sub">' + esc(T('forgotSub')) + '</p>' +
      '<div class="ap-field">' + field('mail',
        '<input class="ap-input" id="apEmail" type="email" autocomplete="email" placeholder="you@example.com"' +
        ' aria-label="' + esc(T('email')) + '" title="' + esc(T('email')) + '">') + '</div>' +
      captchaField() +
      '<button class="ap-btn" id="apSubmit" onclick="AuthPopup.submitForgot()">' + esc(T('forgotBtn')) + '</button>' +
      '<div class="ap-msg" id="apMsg"></div>' +
      '<div class="ap-foot"><button class="ap-link" onclick="AuthPopup.view(\'login\')">' + esc(T('backToLogin')) + '</button></div>';
  }

  function resetHtml() {
    return '<h2 class="ap-h2">' + esc(T('resetTitle')) + '</h2>' +
      '<p class="ap-sub">' + esc(T('resetSub')) + '</p>' +
      '<div class="ap-field">' + field('mail',
        '<input class="ap-input" id="apEmail" type="email" value="' + esc(state.email || '') + '" placeholder="you@example.com"' +
        ' aria-label="' + esc(T('email')) + '" title="' + esc(T('email')) + '">') + '</div>' +
      '<div class="ap-field">' + field('key',
        '<input class="ap-input" id="apCode" maxlength="6" inputmode="numeric" placeholder="000000"' +
        ' aria-label="' + esc(T('resetCode')) + '" title="' + esc(T('resetCode')) + '"' +
        ' style="letter-spacing:6px;font-size:18px;text-align:center">') + '</div>' +
      '<div class="ap-field">' + field('lock',
        '<input class="ap-input" id="apPass" type="password" autocomplete="new-password"' +
        ' placeholder="' + esc(T('newPassword')) + '"' +
        ' aria-label="' + esc(T('newPassword')) + '" title="' + esc(T('newPassword')) + '">') + '</div>' +
      '<button class="ap-btn" id="apSubmit" onclick="AuthPopup.submitReset()">' + esc(T('resetBtn')) + '</button>' +
      '<div class="ap-msg" id="apMsg"></div>' +
      '<div class="ap-foot"><button class="ap-link" onclick="AuthPopup.view(\'login\')">' + esc(T('backToLogin')) + '</button></div>';
  }

  // Điều khoản hiển thị NGAY TRONG popup (thay vì mở tab /terms.html). Nội dung
  // lấy từ /terms.html rồi trích `#termsCard` -> chỉ một nguồn duy nhất, không
  // phải chép lại văn bản vào JS. Màu do CSS .ap-terms ăn biến theme của trang.
  function termsHtml() {
    return '<h2 class="ap-h2">' + esc(T('termsTitle')) + '</h2>' +
      '<div class="ap-terms loading" id="apTermsBody">…</div>' +
      '<div class="ap-foot"><button class="ap-link" onclick="AuthPopup.view(\'register\')">' + esc(T('termsBack')) + '</button></div>';
  }

  /** Eager-load /terms.html rồi nhét nội dung #termsCard vào khung .ap-terms. */
  function loadTerms() {
    var box = document.getElementById('apTermsBody');
    if (!box) return;
    fetch('/terms.html').then(function (r) { return r.text(); }).then(function (html) {
      var box2 = document.getElementById('apTermsBody');
      if (!box2) return; // người dùng đã rời view
      // Lấy ruột #termsCard: từ sau thẻ mở tới ngay trước khối .foot
      // (bám .foot vì card chứa nhiều </div> lồng nhau, không đếm cho chắc được).
      var m = html.match(/id="termsCard"[^>]*>([\s\S]*?)<\/div>\s*<div class="foot">/);
      var inner = m ? m[1] : '';
      if (!inner) {
        // Fallback: từ <h1> tới hết khối .note (nếu markup .foot đổi).
        var m2 = html.match(/<h1[\s\S]*?<div class="note">[\s\S]*?<\/div>/);
        inner = m2 ? m2[0] : '';
      }
      box2.className = 'ap-terms';
      box2.innerHTML = inner || esc(T('errNetwork'));
    }).catch(function () {
      var box2 = document.getElementById('apTermsBody');
      if (box2) { box2.className = 'ap-terms'; box2.textContent = T('errNetwork'); }
    });
  }

  function render() {
    var body = document.getElementById('apBody');
    if (!body) return;
    if (state.view === 'login') body.innerHTML = loginHtml();
    else if (state.view === 'register') body.innerHTML = registerHtml();
    else if (state.view === 'verify') body.innerHTML = verifyHtml();
    else if (state.view === 'forgot') body.innerHTML = forgotHtml();
    else if (state.view === 'terms') body.innerHTML = termsHtml();
    else body.innerHTML = resetHtml();

    if (state.view === 'terms') { loadTerms(); return; } // không có input -> bỏ focus/Enter
    if (document.getElementById('apCaptchaCanvas')) refreshCaptcha();
    var focusId = (state.view === 'verify' || state.view === 'reset') ? 'apCode'
      : (state.view === 'forgot' ? 'apEmail' : 'apUser');
    var el = document.getElementById(focusId);
    if (el) setTimeout(function () { el.focus(); }, 30);
    bindEnter();
  }

  function bindEnter() {
    var box = document.getElementById('authPopupBox');
    if (!box) return;
    box.onkeydown = function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (state.view === 'terms') return;
      if (state.view === 'login') AuthPopup.submitLogin();
      else if (state.view === 'register') AuthPopup.submitRegister();
      else if (state.view === 'verify') AuthPopup.submitVerify();
      else if (state.view === 'forgot') AuthPopup.submitForgot();
      else AuthPopup.submitReset();
    };
  }

  function setMsg(html, kind) {
    var el = document.getElementById('apMsg');
    if (!el) return;
    el.className = 'ap-msg ' + (kind || '');
    el.innerHTML = html || '';
  }

  function setBusy(busy) {
    state.busy = busy;
    var btn = document.getElementById('apSubmit');
    if (btn) btn.disabled = busy;
    var rs = document.getElementById('apResend');
    if (rs) rs.disabled = busy;
  }

  // Khối "dev": hiện mã/link khi SMTP chưa cấu hình (đỡ phải mở console server).
  function showDevTip(msgKey, code, link) {
    var html = '<div class="ap-dev">';
    if (code) html += '<b>' + esc(T(msgKey, { code: code })) + '</b>';
    if (link) {
      html += '<div style="margin-top:6px">' + esc(T('devLink')) +
        ' <a href="' + esc(link) + '">' + esc(link) + '</a><br>' +
        '<button class="ap-copy" onclick="AuthPopup.copy(\'' + esc(link) + '\')">' + esc(T('copy')) + '</button></div>';
    }
    html += '</div>';
    setMsg(html, 'info');
  }

  // ==========================================================================
  // Captcha: server trả {id, text}; client vẽ canvas + nhiễu nhẹ.
  // ==========================================================================
  function refreshCaptcha() {
    var cv = document.getElementById('apCaptchaCanvas');
    if (!cv) return;
    var tries = 0;
    // Retry nhẹ: 429/timeout tạm thời không nên để canvas trắng câm lặng.
    (function attempt() {
      fetch('/api/captcha').then(function (r) { return r.json().catch(function () { return {}; }); }).then(function (d) {
        if (d && d.text) { state.captcha = { id: d.id, text: d.text }; drawCaptcha(cv, d.text); return; }
        throw new Error('bad captcha payload');
      }).catch(function () {
        if (++tries < 3) { setTimeout(attempt, 400 * tries); return; }
        state.captcha = null;
        drawCaptchaHint(cv, T('captchaFail'));
      });
    })();
  }

  /** Vẽ khung báo lỗi lên canvas (thay vì để trắng — người dùng biết bấm để thử lại). */
  function drawCaptchaHint(cv, text) {
    var ctx = cv.getContext('2d');
    var w = cv.width, h = cv.height;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f87171';
    ctx.font = 'bold 11px -apple-system,Segoe UI,Roboto,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(text || 'Lỗi tải mã'), w / 2, h / 2, w - 8);
    ctx.textAlign = 'start';
  }

  function drawCaptcha(cv, text) {
    var ctx = cv.getContext('2d');
    var w = cv.width, h = cv.height, i;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);
    // Nhiễu 1: đường chéo mảnh.
    for (i = 0; i < 4; i++) {
      ctx.strokeStyle = 'rgba(120,170,230,' + (0.12 + Math.random() * 0.18) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.random() * w, Math.random() * h);
      ctx.lineTo(Math.random() * w, Math.random() * h);
      ctx.stroke();
    }
    // Nhiễu 2: chấm nhỏ.
    for (i = 0; i < 22; i++) {
      ctx.fillStyle = 'rgba(150,200,255,' + (0.08 + Math.random() * 0.2) + ')';
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    // Ký tự: mỗi ký tự xoay/lệch nhẹ.
    var chars = String(text).split('');
    var step = (w - 14) / Math.max(1, chars.length);
    var colors = ['#7dd3fc', '#a5b4fc', '#86efac', '#fdba74', '#f9a8d4'];
    ctx.font = 'bold 22px Consolas, monospace';
    ctx.textBaseline = 'middle';
    for (i = 0; i < chars.length; i++) {
      ctx.save();
      ctx.translate(10 + i * step + step / 2, h / 2);
      ctx.rotate((Math.random() - 0.5) * 0.5);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillText(chars[i], -7, 0);
      ctx.restore();
    }
  }

  // ==========================================================================
  // API helpers
  // ==========================================================================
  function post(url, body) {
    return fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        return { ok: r.ok, status: r.status, d: d };
      });
    });
  }

  // Server trả lỗi tiếng Việt; UI EN thì dịch các mã lỗi đã biết.
  // status 429 = rate limit → thông báo rõ thay vì câu thô từ server.
  function errText(d, status) {
    if (status === 429) return T('errRate');
    if (!d) return T('errNetwork');
    if (d.reason && SERVER_ERR[d.reason] && lang() === 'en') return T(SERVER_ERR[d.reason]);
    return d.error || T('errNetwork');
  }

  function closePopup() {
    var ov = document.getElementById('authPopupOverlay');
    if (ov) ov.classList.remove('show');
    document.body.style.overflow = '';
  }

  function finishLogin(d) {
    if (window.Auth) {
      if (d.token) Auth.setToken(d.token);
      if (d.user) Auth.setUser(d.user);
    }
    closePopup();
    // Nếu đang ở trang chủ: chỉ đổi hash (`#welcome=1`) KHÔNG nạp lại app.js, nên
    // navbar vẫn ở trạng thái khách cho tới khi người dùng F5. Buộc nạp lại trang
    // để initAuth() chạy lại và dựng UI đã đăng nhập. Ở trang khác (login.html...)
    // thì điều hướng về trang chủ như cũ.
    if (/\/index\.html$/.test(window.location.pathname) || window.location.pathname === '/') {
      window.location.hash = 'welcome=1';
      window.location.reload();
    } else {
      window.location.href = '/index.html#welcome=1';
    }
  }

  // ==========================================================================
  // Public API
  // ==========================================================================
  var AuthPopup = {
    /** Chèn overlay + CSS vào DOM. Idempotent. */
    install: function () {
      if (document.getElementById('authPopupOverlay')) return;
      injectCss();
      var ov = document.createElement('div');
      ov.id = 'authPopupOverlay';
      ov.setAttribute('role', 'dialog');
      ov.setAttribute('aria-modal', 'true');
      ov.innerHTML = '<div id="authPopupBox">' +
        '<button class="ap-close" onclick="AuthPopup.close()" title="' + esc(T('close')) + '">&times;</button>' +
        '<div class="ap-top"><div class="ap-brand">' + esc(T('title')) + '</div></div>' +
        '<div id="apBody"></div>' +
        '</div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', function (e) {
        if (e.target && e.target.id === 'authPopupOverlay') AuthPopup.close();
      });
      document.addEventListener('keydown', function (e) {
        var el = document.getElementById('authPopupOverlay');
        if (e.key === 'Escape' && el && el.classList.contains('show')) AuthPopup.close();
      });
    },

    /** Mở popup: login | register | verify | forgot | reset */
    open: function (view) {
      this.install();
      var v = view || 'login';
      // Đã đăng nhập thì thôi (trừ luồng kích hoạt), tránh popup đè.
      if (window.Auth && Auth.isLoggedIn() && v !== 'verify') return;
      state.view = v;
      state.captcha = null;
      render();
      var body = document.getElementById('apBody');
      if (body) body.scrollTop = 0; // mở lại luôn bắt đầu từ đầu form
      document.getElementById('authPopupOverlay').classList.add('show');
      document.body.style.overflow = 'hidden';
    },

    view: function (v) { state.view = v; render(); },
    close: closePopup,
    refreshCaptcha: refreshCaptcha,

    copy: function (text) {
      var done = function () {
        var m = document.getElementById('apMsg');
        if (m) m.insertAdjacentHTML('beforeend',
          '<div class="ap-dev" style="border-style:solid">' + esc(T('copied')) + '</div>');
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () { /* ignore */ });
      } else {
        try {
          var ta = document.createElement('textarea');
          ta.value = text; document.body.appendChild(ta); ta.select();
          document.execCommand('copy'); document.body.removeChild(ta); done();
        } catch (e) { /* ignore */ }
      }
    },

    /**
     * Đọc hash URL để mở đúng view. Dùng cho link cũ:
     *   #login / #register / #forgot → popup tương ứng
     *   #reset&email=..&code=..      → form đặt lại (điền sẵn mã)
     * @returns {boolean} có mở popup không
     */
    autoOpen: function () {
      var h = String(location.hash || '').replace(/^#/, '');
      if (!h) return false;
      var parts = h.split('&');
      var head = parts[0];
      var kv = {};
      for (var i = 1; i < parts.length; i++) {
        var p = parts[i].split('=');
        if (p.length === 2) kv[decodeURIComponent(p[0])] = decodeURIComponent(p[1].replace(/\+/g, ' '));
      }
      var map = { login: 'login', register: 'register', signup: 'register', verify: 'verify', forgot: 'forgot' };
      if (map[head]) { this.open(map[head]); return true; }
      if (head === 'reset') {
        if (kv.email) state.email = kv.email;
        this.open('reset');
        var el = document.getElementById('apCode');
        if (el && kv.code) el.value = kv.code;
        return true;
      }
      return false;
    }
  };

  window.AuthPopup = AuthPopup;
  window.showLoginPopup = function () { AuthPopup.open('login'); };
  window.showRegisterPopup = function () { AuthPopup.open('register'); };

  // ----- Đăng nhập -----
  AuthPopup.submitLogin = function () {
    if (state.busy) return;
    var u = idVal('apUser'), p = idVal('apPass');
    if (!u.trim() || !p) { setMsg(esc(T('errEmpty')), 'err'); return; }
    setBusy(true); setMsg(esc(T('submitting')), 'info');
    post('/api/login', { username: u.trim(), password: p }).then(function (r) {
      setBusy(false);
      if (r.ok) return finishLogin(r.d);
      // Đúng mật khẩu nhưng chưa kích hoạt → sang màn nhập mã và gửi lại mã luôn.
      if (r.d && r.d.reason === 'EMAIL_NOT_VERIFIED') {
        state.email = r.d.email || u.trim();
        state.username = u.trim();
        state.view = 'verify';
        render();
        setMsg(esc(r.d.error), 'err');
        AuthPopup.resend();
        return;
      }
      setMsg(esc(errText(r.d, r.status)), 'err');
    }).catch(function () { setBusy(false); setMsg(esc(T('errNetwork')), 'err'); });
  };

  // ----- Đăng ký -----
  AuthPopup.submitRegister = function () {
    if (state.busy) return;
    var u = idVal('apUser'), em = idVal('apEmail'), p = idVal('apPass'), p2 = idVal('apPass2'), cc = idVal('apCaptcha');
    var terms = document.getElementById('apTerms');
    if (!u.trim() || !em.trim() || !p) { setMsg(esc(T('errEmpty')), 'err'); return; }
    if (u.trim().length < 3 || u.trim().length > 32 || !/^[A-Za-z0-9._-]+$/.test(u.trim())) { setMsg(esc(T('errUser')), 'err'); return; }
    if (!EMAIL_RE.test(em.trim())) { setMsg(esc(T('errEmail')), 'err'); return; }
    if (p.length < 6) { setMsg(esc(T('errPass')), 'err'); return; }
    if (p !== p2) { setMsg(esc(T('errMatch')), 'err'); return; }
    if (!cc.trim()) { setMsg(esc(T('errCaptcha')), 'err'); return; }
    if (!terms || !terms.checked) { setMsg(esc(T('errTerms')), 'err'); return; }

    setBusy(true); setMsg(esc(T('submitting')), 'info');
    post('/api/register', {
      username: u.trim(), password: p, email: em.trim(),
      captchaId: state.captcha && state.captcha.id, captcha: cc.trim(), acceptTerms: true
    }).then(function (r) {
      setBusy(false);
      if (r.ok) {
        state.email = r.d.email || em.trim();
        state.username = r.d.username || u.trim();
        state.view = 'verify';
        render();
        if (r.d.mail_sent) setMsg(esc(T('registerOk', { email: state.email })), 'ok');
        else showDevTip('registerOkNoMail', r.d.dev_code, r.d.dev_link);
        return;
      }
      setMsg(esc(errText(r.d, r.status)), 'err');
      // Chỉ lấy mã mới khi sai captcha — tránh tốn quota vô ích mỗi lần lỗi khác.
      if (r.d && r.d.reason === 'BAD_CAPTCHA') refreshCaptcha();
    }).catch(function () { setBusy(false); setMsg(esc(T('errNetwork')), 'err'); });
  };

  // ----- Kích hoạt (mã trong email, hoặc sau khi đăng nhập báo chưa kích hoạt) -----
  AuthPopup.submitVerify = function () {
    if (state.busy) return;
    var code = idVal('apCode');
    if (!/^\d{6}$/.test(code.trim())) { setMsg(esc(T('errCode')), 'err'); return; }
    setBusy(true); setMsg(esc(T('submitting')), 'info');
    post('/api/verify-email', { email: state.email, username: state.username, code: code.trim() }).then(function (r) {
      setBusy(false);
      if (r.ok) { setMsg(esc(T('verifyOk')), 'ok'); return finishLogin(r.d); }
      setMsg(esc(errText(r.d, r.status)), 'err');
    }).catch(function () { setBusy(false); setMsg(esc(T('errNetwork')), 'err'); });
  };

  AuthPopup.resend = function () {
    var btn = document.getElementById('apResend');
    if (btn) { btn.disabled = true; btn.textContent = T('resending'); }
    post('/api/resend-verification', { email: state.email, username: state.username }).then(function (r) {
      if (btn) { btn.disabled = false; btn.textContent = T('resend'); }
      if (r.ok && r.d && r.d.sent) { setMsg(esc(T('resent', { email: state.email || '' })), 'ok'); return; }
      if (r.ok && r.d && (r.d.dev_code || r.d.dev_link)) { showDevTip('registerOkNoMail', r.d.dev_code, r.d.dev_link); return; }
      if (r.ok) setMsg(esc(T('forgotSent')), 'info');
      else setMsg(esc(errText(r.d, r.status)), 'err');
    }).catch(function () {
      if (btn) { btn.disabled = false; btn.textContent = T('resend'); }
      setMsg(esc(T('errNetwork')), 'err');
    });
  };

  // ----- Quên mật khẩu -----
  AuthPopup.submitForgot = function () {
    if (state.busy) return;
    var em = idVal('apEmail'), cc = idVal('apCaptcha');
    if (!EMAIL_RE.test(em.trim())) { setMsg(esc(T('errEmail')), 'err'); return; }
    if (!cc.trim()) { setMsg(esc(T('errCaptcha')), 'err'); return; }
    setBusy(true); setMsg(esc(T('submitting')), 'info');
    post('/api/forgot-password', {
      email: em.trim(), captchaId: state.captcha && state.captcha.id, captcha: cc.trim()
    }).then(function (r) {
      setBusy(false);
      if (r.ok) {
        state.email = em.trim();
        state.view = 'reset';
        render();
        if (r.d && r.d.sent) { setMsg(esc(T('forgotSent')), 'ok'); return; }
        if (r.d && (r.d.dev_code || r.d.dev_link)) { showDevTip('forgotSentDev', r.d.dev_code, r.d.dev_link); return; }
        setMsg(esc(T('forgotSent')), 'ok');
        return;
      }
      setMsg(esc(errText(r.d, r.status)), 'err');
      if (r.d && r.d.reason === 'BAD_CAPTCHA') refreshCaptcha();
    }).catch(function () { setBusy(false); setMsg(esc(T('errNetwork')), 'err'); });
  };

  // ----- Đặt lại mật khẩu -----
  AuthPopup.submitReset = function () {
    if (state.busy) return;
    var em = idVal('apEmail'), code = idVal('apCode'), np = idVal('apPass');
    if (!EMAIL_RE.test(em.trim())) { setMsg(esc(T('errEmail')), 'err'); return; }
    if (!/^\d{6}$/.test(code.trim())) { setMsg(esc(T('errCode')), 'err'); return; }
    if (np.length < 6) { setMsg(esc(T('errPass')), 'err'); return; }
    setBusy(true); setMsg(esc(T('submitting')), 'info');
    post('/api/reset-password', { email: em.trim(), code: code.trim(), newPassword: np }).then(function (r) {
      setBusy(false);
      if (r.ok) { setMsg(esc(T('resetOk')), 'ok'); return finishLogin(r.d); }
      setMsg(esc(errText(r.d, r.status)), 'err');
    }).catch(function () { setBusy(false); setMsg(esc(T('errNetwork')), 'err'); });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { AuthPopup.install(); });
  } else {
    AuthPopup.install();
  }
})();
