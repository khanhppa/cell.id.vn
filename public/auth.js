// Shared authentication module for Cell.id.vn
const Auth = {
  TOKEN_KEY: 'cell_tracker_token',
  // Đánh dấu đã gặp 403 SITE_CLOSED → requireAuth không đè điều hướng bằng goLogin().
  _siteClosed: false,

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  setToken(token) {
    localStorage.setItem(this.TOKEN_KEY, token);
  },

  clearToken() {
    localStorage.removeItem(this.TOKEN_KEY);
  },

  /**
   * Giải mã payload JWT (không verify chữ ký — chỉ đọc `exp`).
   * @returns {object|null} payload, hoặc null nếu token không phải JWT hợp lệ.
   */
  decodeToken(token) {
    try {
      const part = String(token || '').split('.')[1];
      if (!part) return null;
      const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(
        atob(b64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
      );
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  },

  /**
   * Token còn hạn không. Token KHÔNG parse được (không phải JWT) → coi là còn
   * hạn để không chặn nhầm; server vẫn là nơi quyết định cuối cùng (401).
   */
  isTokenExpired() {
    const token = this.getToken();
    if (!token) return true;
    const payload = this.decodeToken(token);
    if (!payload || !payload.exp) return false;
    return Date.now() >= payload.exp * 1000;
  },

  isLoggedIn() {
    return !this.isTokenExpired();
  },

  getUser() {
    const stored = localStorage.getItem('cell_tracker_user');
    return stored ? JSON.parse(stored) : null;
  },

  setUser(user) {
    localStorage.setItem('cell_tracker_user', JSON.stringify(user));
  },

  clearUser() {
    localStorage.removeItem('cell_tracker_user');
  },

  isAdmin() {
    const user = this.getUser();
    return user && user.role === 'admin';
  },

  getCreditBalance() {
    const user = this.getUser();
    return user && user.credit_balance != null ? Number(user.credit_balance) : null;
  },

  setCreditBalance(balance) {
    const user = this.getUser();
    if (!user) return;
    user.credit_balance = Number(balance) || 0;
    this.setUser(user);
    if (typeof window.updateCreditBadge === 'function') window.updateCreditBadge(user.credit_balance);
  },

  /** Chỉ xoá token + user, KHÔNG điều hướng. Dùng cho nhánh 401. */
  clearSession() {
    this.clearToken();
    this.clearUser();
  },

  /**
   * Website đang bảo trì? Server trả 403 kèm header `X-Site-Closed: 1`.
   * Chuyển ngay về trang thông báo (trừ khi đang ở đó) để hành vi giống trang
   * chủ; trả true để caller dừng xử lý (không xoá phiên oan).
   */
  redirectIfSiteClosed(res) {
    if (!res || res.status !== 403) return false;
    if (!res.headers || res.headers.get('X-Site-Closed') !== '1') return false;
    this._siteClosed = true;
    if (!/\/maintenance\.html$/.test(window.location.pathname)) {
      window.location.replace('/maintenance.html');
    }
    return true;
  },

  /** Người dùng bấm "Đăng xuất": xoá session rồi về trang chủ. */
  logout() {
    this.clearSession();
    // Luôn quay về trang chủ (trang chủ tự mở popup đăng nhập cho khách).
    this.goLogin();
  },

  async login(username, password) {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      // Ném kèm dữ liệu để UI biết đây là "chưa kích hoạt email" (mở màn nhập mã).
      const err = new Error(data.error || 'Login failed');
      err.data = data;
      throw err;
    }
    this.setToken(data.token);
    this.setUser(data.user);
    return data;
  },

  async register(payload) {
    // payload: { username, password, email, captchaId, captcha, acceptTerms }
    const body = (typeof payload === 'string')
      ? { username: arguments[0], password: arguments[1] }
      : payload;
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || 'Registration failed');
      err.data = data;
      throw err;
    }
    return data;
  },

  async checkSession() {
    const token = this.getToken();
    if (!token) return null;
    if (this.isTokenExpired()) { this.clearToken(); this.clearUser(); return null; }
    try {
      const res = await fetch('/api/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        // Website đóng: giữ phiên (không xoá token) và chuyển trang bảo trì.
        if (this.redirectIfSiteClosed(res)) return null;
        this.clearSession();
        return null;
      }
      const user = await res.json();
      this.setUser(user);
      return user;
    } catch (e) {
      this.clearSession();
      return null;
    }
  },

  getHeaders(extra = {}) {
    const headers = { ...extra };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  },

  async fetch(url, options = {}) {
    const opts = { ...options };
    if (!opts.headers) opts.headers = {};
    const token = this.getToken();
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, opts);
    if (this.redirectIfSiteClosed(res)) {
      throw new Error('Website đang bảo trì');
    }
    if (res.status === 401) {
      // Hết phiên giữa chừng: xoá session nhưng KHÔNG tự điều hướng (tránh
      // reload/nhảy trang khi người dùng đang thao tác). UI gọi __onSessionExpired.
      this.clearSession();
      if (typeof window.__onSessionExpired === 'function') window.__onSessionExpired();
      throw new Error('Session expired');
    }
    return res;
  }
};

// `const` ở top-level không tự tạo property trên `window` — các file khác
// (auth-popup.js, index.html) kiểm tra `window.Auth`, nên phải gán tường minh.
// Thiếu dòng này, finishLogin() bỏ qua việc lưu token và login "thành công"
// nhưng người dùng vẫn ở chế độ khách sau khi tải lại trang.
window.Auth = Auth;

// Điều hướng về trang chủ và mở popup đăng nhập. Đang ở trang chủ thì phải NẠP LẠI
// trang (chỉ đổi hash không chạy lại app.js → UI vẫn ở trạng thái cũ).
Auth.goLogin = function () {
  if (/\/index\.html$/.test(window.location.pathname) || window.location.pathname === '/') {
    window.location.hash = 'login';
    window.location.reload();
  } else {
    window.location.href = '/index.html#login';
  }
};

// Redirect to login if not authenticated
Auth.requireAuth = async function() {
  const goLogin = () => Auth.goLogin();
  if (!this.isLoggedIn()) {
    goLogin();
    return false;
  }
  try {
    const user = await this.checkSession();
    if (!user) {
      // checkSession đã chuyển sang /maintenance.html (403 SITE_CLOSED) → thôi.
      if (this._siteClosed) return false;
      goLogin();
      return false;
    }
    return true;
  } catch (e) {
    console.error('Session check failed:', e);
    goLogin();
    return false;
  }
};

// Global unified Navbar initialization
Auth.initNavbar = function() {
  // Check if header element exists, if not create one or find placeholder
  let header = document.querySelector('.header') || document.querySelector('.topbar') || document.querySelector('.navbar');
  if (!header) return;

  const loggedIn = this.isLoggedIn();
  const user = this.getUser() || null;
  const isAdmin = loggedIn && this.isAdmin();
  
  // Detect current path to highlight active nav
  const path = window.location.pathname;

  // Build uniform HTML
  const isEn = (localStorage.getItem('lang') === 'en');
  const appTitle = 'Cell.id.vn';
  const mapTxt = isEn ? 'Map' : 'Bản đồ';
  const toolsTxt = isEn ? 'Tools' : 'Công cụ';
  const portTxt = isEn ? 'Port Check' : 'Tra cứu chuyển mạng';
  const ipTxt = isEn ? 'IP Trap' : 'Bẫy địa chỉ IP';
  // Tra cứu địa chỉ IP (đa nguồn) — KHÁC "Bẫy địa chỉ IP" (theo dõi lượt click).
  const ipLookupTxt = isEn ? 'IP Lookup' : 'Tra cứu IP';
  const enbEciTxt = isEn ? 'eNB / ECI Converter' : 'Đổi eNB ↔ ECI';
  const adminTxt = isEn ? 'Admin' : 'Admin';
  const logoutTxt = isEn ? 'Logout' : 'Đăng xuất';
  const changePassTxt = isEn ? 'Change Password' : 'Đổi mật khẩu';
  const myDataTxt = isEn ? 'My Data' : 'Dữ liệu của tôi';
  const loginTxt = isEn ? 'Login' : 'Đăng nhập';
  const registerTxt = isEn ? 'Register' : 'Đăng ký';
  const versionTxt = isEn ? 'Version history' : 'Lịch sử phiên bản';
  const guestHintTxt = isEn ? '1 free lookup' : '1 lượt tra cứu miễn phí';
  const ipTrackerGuestTxt = isEn ? 'IP Trap (login required)' : 'Bẫy địa chỉ IP (cần đăng nhập)';

  // Apply common style dynamically to head if not present
  if (!document.getElementById('common-navbar-style')) {
    const style = document.createElement('style');
    style.id = 'common-navbar-style';
    style.innerHTML = `
      .header, .topbar, .navbar {
        position: fixed !important; top: 0; left: 0; right: 0;
        background: var(--header-bg, var(--bg-surface, rgba(255,255,255,0.95))) !important;
        backdrop-filter: blur(12px);
        padding: 8px 16px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        z-index: 1000 !important;
        border-bottom: 1px solid var(--border-color, rgba(0,0,0,0.1)) !important;
        height: 48px !important;
        box-sizing: border-box !important;
      }
      .header-left, .topbar-left, .navbar-left { display: flex !important; align-items: center !important; gap: 12px !important; }
      .header-left h1, .header-left h2, .topbar-left h1, .navbar-left h2 { font-size: 16px !important; margin: 0 !important; color: var(--text-primary, #1a1a2e) !important; font-weight: bold !important; display: flex !important; align-items: center !important; gap: 8px !important; }
      /* Logo chính của ứng dụng (logo.png) — nền trong suốt, đặt trực tiếp trên
         nền navbar. Bản màu cho nền sáng, bản trắng cho nền tối để chữ vẫn rõ. */
      .brand-logo-link { display: flex !important; align-items: center !important; text-decoration: none !important; flex: 0 0 auto !important; }
      .brand-logo {
        display: block !important;
        flex: 0 0 auto !important;
        width: 82px !important;
        aspect-ratio: 477 / 183 !important;
        background: url('/img/logo.png') no-repeat center / contain !important;
      }
      [data-theme="dark"] .brand-logo { background-image: url('/img/logo-white.png') !important; }
      .header-right, .topbar-right, .navbar-right { display: flex !important; align-items: center !important; gap: 8px !important; }
      .header-btn, .btn-nav, .btn-header-common {
        padding: 5px 10px !important;
        border: 1px solid var(--border-color, rgba(0,0,0,0.1)) !important;
        border-radius: 6px !important;
        background: var(--bg-surface2, rgba(0,0,0,0.03)) !important;
        color: var(--text-secondary, #444466) !important;
        cursor: pointer !important;
        font-size: 12px !important;
        text-decoration: none !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 6px !important;
        transition: all 0.2s !important;
        height: 30px !important;
        line-height: normal !important;
        box-sizing: border-box !important;
      }
      .header-btn:hover, .btn-nav:hover, .btn-header-common:hover { background: var(--bg-hover, rgba(0,0,0,0.06)) !important; color: var(--text-primary, #1a1a2e) !important; }
      
      /* Tools dropdown */
      .tools-dropdown-common {
        position: relative !important;
        display: inline-block !important;
      }
      .tools-dropdown-menu-common {
        position: absolute !important;
        top: 100% !important;
        right: 0 !important;
        margin-top: 6px !important;
        min-width: 200px !important;
        background: var(--bg-card, var(--bg-surface, #fff)) !important;
        border: 1px solid var(--border-color, rgba(0,0,0,0.1)) !important;
        border-radius: 10px !important;
        box-shadow: var(--shadow, 0 10px 40px rgba(0,0,0,0.1)) !important;
        padding: 6px !important;
        display: none !important;
        z-index: 2000 !important;
      }
      .tools-dropdown-menu-common.show { display: block !important; }
      .tools-dropdown-item-common {
        display: flex !important;
        align-items: center !important;
        gap: 10px !important;
        width: 100% !important;
        padding: 8px 12px !important;
        border: none !important;
        background: transparent !important;
        color: var(--text-primary, #1a1a2e) !important;
        text-align: left !important;
        cursor: pointer !important;
        font-size: 13px !important;
        border-radius: 6px !important;
        transition: background 0.2s !important;
        text-decoration: none !important;
      }
      .tools-dropdown-item-common:hover { background: var(--bg-hover, rgba(0,0,0,0.06)) !important; }
      
      /* User menu */
      .user-menu-common {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        cursor: pointer !important;
        position: relative !important;
        padding: 3px 8px !important;
        border-radius: 20px !important;
        transition: background 0.2s !important;
      }
      .user-menu-common:hover { background: var(--bg-hover, rgba(0,0,0,0.06)) !important; }
      .user-avatar-common {
        width: 24px !important;
        height: 24px !important;
        border-radius: 50% !important;
        background: var(--bg-btn-primary, #4444cc) !important;
        color: white !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-weight: bold !important;
        font-size: 11px !important;
      }
      .user-name-common { font-size: 13px !important; font-weight: 500 !important; color: var(--text-primary, #1a1a2e) !important; }
      .user-dropdown-common {
        position: absolute !important;
        top: 100% !important;
        right: 0 !important;
        margin-top: 6px !important;
        min-width: 180px !important;
        background: var(--bg-card, var(--bg-surface, #fff)) !important;
        border: 1px solid var(--border-color, rgba(0,0,0,0.1)) !important;
        border-radius: 10px !important;
        box-shadow: var(--shadow, 0 10px 40px rgba(0,0,0,0.1)) !important;
        padding: 6px !important;
        display: none !important;
        z-index: 2000 !important;
      }
      .user-dropdown-common.show { display: block !important; }
      .user-dropdown-item-common {
        display: flex !important;
        align-items: center !important;
        gap: 10px !important;
        width: 100% !important;
        padding: 8px 12px !important;
        border: none !important;
        background: transparent !important;
        color: var(--text-primary, #1a1a2e) !important;
        text-align: left !important;
        cursor: pointer !important;
        font-size: 13px !important;
        border-radius: 6px !important;
        transition: background 0.2s !important;
      }
      .user-dropdown-item-common:hover { background: var(--bg-hover, rgba(0,0,0,0.06)) !important; }
      .user-dropdown-divider-common { height: 1px !important; background: var(--border-color, rgba(0,0,0,0.1)) !important; margin: 6px 0 !important; }

      /* Credit badge — dùng token trạng thái để hợp cả nền sáng lẫn nền tối. */
      .credit-badge-common {
        display: inline-flex !important;
        align-items: center !important;
        gap: 5px !important;
        padding: 4px 10px !important;
        border-radius: 14px !important;
        font-size: 12px !important;
        font-weight: 700 !important;
        cursor: pointer !important;
        border: 1px solid var(--success-line, rgba(120, 220, 160, 0.4)) !important;
        background: var(--success-soft, rgba(120, 220, 160, 0.14)) !important;
        color: var(--success, #1f9e5a) !important;
        height: 30px !important;
        box-sizing: border-box !important;
        line-height: normal !important;
        text-decoration: none !important;
      }
      .credit-badge-common:hover { filter: brightness(1.08); }
      .credit-badge-common.low {
        border-color: var(--danger-line, rgba(255, 100, 100, 0.45)) !important;
        background: var(--danger-soft, rgba(255, 100, 100, 0.15)) !important;
        color: var(--danger, #e04444) !important;
      }
      .credit-badge-common.low:hover { filter: brightness(1.08); }

      /* Version badge */
      .ver-badge-common {
        display: inline-flex !important;
        align-items: center !important;
        padding: 2px 8px !important;
        border-radius: 10px !important;
        font-size: 10px !important;
        font-weight: 700 !important;
        letter-spacing: 0.3px !important;
        border: 1px solid var(--border-color, rgba(0,0,0,0.1)) !important;
        background: var(--bg-surface2, rgba(0,0,0,0.04)) !important;
        color: var(--text-faint, #8a92a6) !important;
        text-decoration: none !important;
        line-height: 1.6 !important;
        white-space: nowrap !important;
      }
      .ver-badge-common:hover { color: var(--text-primary, #1a1a2e) !important; background: var(--bg-hover, rgba(0,0,0,0.07)) !important; }

      /* Nhắc guest còn lượt dùng thử */
      .guest-hint-common {
        display: inline-flex !important;
        align-items: center !important;
        gap: 5px !important;
        padding: 4px 10px !important;
        border-radius: 14px !important;
        font-size: 11px !important;
        font-weight: 600 !important;
        border: 1px solid var(--warning-line, rgba(255, 170, 60, 0.45)) !important;
        background: var(--warning-soft, rgba(255, 170, 60, 0.15)) !important;
        color: var(--warning, #c98a1e) !important;
        height: 30px !important;
        box-sizing: border-box !important;
        line-height: normal !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Generate uniform navbar inner HTML
  header.innerHTML = `
    <div class="header-left">
      <h1><a class="brand-logo-link" href="/index.html" title="${appTitle}" aria-label="${appTitle}"><span class="brand-logo" aria-hidden="true"></span></a></h1>
      ${isAdmin ? `<span class="nav-badge" style="background: var(--danger-soft, rgba(255,100,100,0.15)); color: var(--danger, #ff5555); padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: bold; border: 1px solid var(--danger-line, rgba(255,100,100,0.3)); text-transform: uppercase;">Admin</span>` : ''}
    </div>
    <div class="header-right">
      <button class="btn-header-common" id="langToggle" onclick="toggleLang()" title="Switch language">${isEn ? 'EN' : 'VI'}</button>
      <button class="btn-header-common" id="themeToggle" onclick="toggleTheme()" title="Toggle theme"><i class="fas fa-moon"></i></button>
      
      <a class="btn-header-common" href="/index.html" style="${path === '/' || path.endsWith('/index.html') ? 'border-color: var(--border-focus, #4444cc) !important; font-weight: bold;' : ''}"><i class="fas fa-map-marked-alt"></i> ${mapTxt}</a>
      
      <!-- Tools dropdown -->
      <div class="tools-dropdown-common" id="toolsDropdownCommonContainer">
        <button class="btn-header-common" onclick="Auth.toggleToolsDropdownCommon(event)"><i class="fas fa-wrench"></i> ${toolsTxt} <i class="fas fa-chevron-down" style="font-size: 8px; margin-left: 2px;"></i></button>
        <div class="tools-dropdown-menu-common" id="toolsDropdownCommon">
          <a class="tools-dropdown-item-common" href="/tools/port-check.html" style="${path.includes('/port-check.html') ? 'background: var(--bg-hover, rgba(0,0,0,0.06)); font-weight: bold;' : ''}"><i class="fas fa-search"></i> ${portTxt}</a>
          ${loggedIn ? `<a class="tools-dropdown-item-common" href="/tools/ip-tracker.html" style="${path.includes('/ip-tracker.html') ? 'background: var(--bg-hover, rgba(0,0,0,0.06)); font-weight: bold;' : ''}"><i class="fas fa-crosshairs"></i> ${ipTxt}</a>` : `<span class="tools-dropdown-item-common" style="opacity:.55; cursor:not-allowed;" title="${loginTxt}"><i class="fas fa-lock"></i> ${ipTrackerGuestTxt}</span>`}
          <a class="tools-dropdown-item-common" href="/tools/ebn-eci.html" style="${path.includes('/ebn-eci.html') ? 'background: var(--bg-hover, rgba(0,0,0,0.06)); font-weight: bold;' : ''}"><i class="fas fa-exchange-alt"></i> ${enbEciTxt}</a>
          <a class="tools-dropdown-item-common" href="/tools/ip-lookup.html" style="${path.includes('/ip-lookup.html') ? 'background: var(--bg-hover, rgba(0,0,0,0.06)); font-weight: bold;' : ''}"><i class="fas fa-globe"></i> ${ipLookupTxt}</a>
          <div class="user-dropdown-divider-common"></div>
          ${isAdmin ? `<a class="tools-dropdown-item-common" href="/version.html" style="${path.includes('/version.html') ? 'background: var(--bg-hover, rgba(0,0,0,0.06)); font-weight: bold;' : ''}"><i class="fas fa-code-branch"></i> ${versionTxt}</a>` : ''}
        </div>
      </div>

      ${!loggedIn ? `
        <span class="guest-hint-common" title="Đăng ký để tra cứu không giới hạn"><i class="fas fa-gift"></i> ${guestHintTxt}</span>
        <a class="btn-header-common" href="/index.html#login" onclick="if(window.AuthPopup){event.preventDefault();AuthPopup.open('login');}"><i class="fas fa-sign-in-alt"></i> ${loginTxt}</a>
        <a class="btn-header-common" href="/index.html#register" onclick="if(window.AuthPopup){event.preventDefault();AuthPopup.open('register');}" style="border-color: var(--border-focus, #4444cc) !important; font-weight: bold;"><i class="fas fa-user-plus"></i> ${registerTxt}</a>
      ` : `
      ${isAdmin ? `<a class="btn-header-common" href="/admin.html" style="${path.includes('/admin.html') ? 'border-color: var(--border-focus, #4444cc) !important; font-weight: bold;' : ''}"><i class="fas fa-cog"></i> ${adminTxt}</a>` : ''}
      
      <!-- Credit badge -->
      <a class="credit-badge-common" id="creditBadgeCommon" href="/credits.html" title="${isEn ? 'Your lookup credits' : 'Điểm tra cứu của bạn'}">
        <i class="fas fa-gem"></i><span id="creditBadgeValue">--</span>
      </a>

      <!-- User menu -->
      <div class="user-menu-common" id="userMenuCommon" onclick="Auth.toggleUserDropdownCommon(event)">
        <div class="user-avatar-common">${user.username.substring(0, 2).toUpperCase()}</div>
        <span class="user-name-common">${user.username}</span>
        <i class="fas fa-chevron-down" style="font-size:10px;color:var(--text-faint, #aaaabb)"></i>
        <div class="user-dropdown-common" id="userDropdownCommon">
          <button class="user-dropdown-item-common" onclick="if(window.showChangePassword) { showChangePassword(); } else { alert('Chức năng này khả dụng ở trang chính.'); }"><i class="fas fa-key"></i> ${changePassTxt}</button>
          <button class="user-dropdown-item-common" onclick="if(window.showMyData) { showMyData(); } else { alert('Chức năng này khả dụng ở trang chính.'); }"><i class="fas fa-database"></i> ${myDataTxt}</button>
          <div class="user-dropdown-divider-common"></div>
          <button class="user-dropdown-item-common" onclick="Auth.logout()"><i class="fas fa-sign-out-alt"></i> ${logoutTxt}</button>
        </div>
      </div>
      `}
    </div>
  `;

  // Close dropdowns on outside click
  window.addEventListener('click', function(e) {
    const tMenu = document.getElementById('toolsDropdownCommon');
    const uMenu = document.getElementById('userDropdownCommon');
    if (tMenu && !e.target.closest('#toolsDropdownCommonContainer')) {
      tMenu.classList.remove('show');
    }
    if (uMenu && !e.target.closest('#userMenuCommon')) {
      uMenu.classList.remove('show');
    }
  });

  // Số dư điểm: hiện cache trước (không nhấp nháy), rồi làm mới từ server.
  // Guest không có badge điểm → bỏ qua hẳn.
  if (loggedIn) {
    window.updateCreditBadge(this.getCreditBalance());
    this.refreshCreditBalance();
  }

  // Chân panel trái (chỉ tab tra cứu): version + số lượt thử còn lại (khách).
  if (window.AppVersion) window.AppVersion.renderPanelVersion();
};

// Vẽ số dư lên badge navbar. `null` → chưa biết (chưa đăng nhập).
window.updateCreditBadge = function(balance) {
  const el = document.getElementById('creditBadgeValue');
  const badge = document.getElementById('creditBadgeCommon');
  if (!el || !badge) return;
  if (balance === null || balance === undefined) { badge.style.display = 'none'; return; }
  badge.style.display = '';
  const n = Number(balance);
  el.textContent = (Number.isInteger(n) ? n : n.toFixed(2));
  badge.classList.toggle('low', n <= 1);
};

// Làm mới số dư từ server (không chặn UI nếu lỗi mạng).
Auth.refreshCreditBalance = async function() {
  if (!this.isLoggedIn()) return null;
  try {
    const res = await this.fetch('/api/credits/balance');
    if (!res.ok) return null;
    const data = await res.json();
    this.setCreditBalance(data.balance);
    return data.balance;
  } catch (e) {
    return null;
  }
};

// Cấu hình credit công khai (enabled, cost, signup_bonus) — cache trong session,
// dùng cho ước tính chi phí trước khi tra (không bắt buộc đăng nhập).
Auth.getCreditConfig = async function() {
  if (this._creditCfg !== undefined) return this._creditCfg;
  try {
    const res = await this.fetch('/api/credits/config');
    if (!res.ok) { this._creditCfg = null; return null; }
    this._creditCfg = await res.json();
    return this._creditCfg;
  } catch (e) {
    this._creditCfg = null;
    return null;
  }
};

Auth.toggleToolsDropdownCommon = function(event) {
  event.stopPropagation();
  const dropdown = document.getElementById('toolsDropdownCommon');
  if (dropdown) {
    dropdown.classList.toggle('show');
  }
  const uMenu = document.getElementById('userDropdownCommon');
  if (uMenu) uMenu.classList.remove('show');
};

Auth.toggleUserDropdownCommon = function(event) {
  event.stopPropagation();
  const dropdown = document.getElementById('userDropdownCommon');
  if (dropdown) {
    dropdown.classList.toggle('show');
  }
  const tMenu = document.getElementById('toolsDropdownCommon');
  if (tMenu) tMenu.classList.remove('show');
};

// ============================================
// Theme (light / dark) - global for all pages
// ============================================
window.loadTheme = function() {
  const saved = (typeof localStorage !== 'undefined' && localStorage.getItem('theme')) || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.innerHTML = saved === 'light' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
  }
};

window.toggleTheme = function() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const next = isLight ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('theme', next);
  }
  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.innerHTML = next === 'light' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
  }
};

// ============================================
// Language toggle (EN/VI) - global for all pages
// ============================================
window.toggleLang = function() {
  const current = (typeof localStorage !== 'undefined' && localStorage.getItem('lang')) === 'en';
  const next = current ? 'vi' : 'en';
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('lang', next);
  }
  // Re-render navbar with new language
  Auth.initNavbar();
  // Keep theme button synced after re-render
  if (typeof window.loadTheme === 'function') {
    window.loadTheme();
  }
};

// Apply saved theme early to avoid flash on page load
if (typeof window !== 'undefined' && document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.loadTheme);
} else {
  window.loadTheme();
}
