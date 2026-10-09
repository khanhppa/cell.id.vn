// Shared authentication module for Cell.id.vn
const Auth = {
  TOKEN_KEY: 'cell_tracker_token',

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  setToken(token) {
    localStorage.setItem(this.TOKEN_KEY, token);
  },

  clearToken() {
    localStorage.removeItem(this.TOKEN_KEY);
  },

  isLoggedIn() {
    return !!this.getToken();
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

  logout() {
    this.clearToken();
    this.clearUser();
    window.location.href = '/login.html';
  },

  async login(username, password) {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    this.setToken(data.token);
    this.setUser(data.user);
    return data;
  },

  async register(username, password) {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    return data;
  },

  async checkSession() {
    const token = this.getToken();
    if (!token) return null;
    try {
      const res = await fetch('/api/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        this.logout();
        return null;
      }
      const user = await res.json();
      this.setUser(user);
      return user;
    } catch (e) {
      this.logout();
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
    if (res.status === 401) {
      this.logout();
      throw new Error('Session expired');
    }
    return res;
  }
};

// Redirect to login if not authenticated
Auth.requireAuth = async function() {
  if (!this.isLoggedIn()) {
    window.location.href = '/login.html';
    return false;
  }
  try {
    const user = await this.checkSession();
    if (!user) {
      window.location.href = '/login.html';
      return false;
    }
    return true;
  } catch (e) {
    console.error('Session check failed:', e);
    window.location.href = '/login.html';
    return false;
  }
};

// Global unified Navbar initialization
Auth.initNavbar = function() {
  // Check if header element exists, if not create one or find placeholder
  let header = document.querySelector('.header') || document.querySelector('.topbar') || document.querySelector('.navbar');
  if (!header) return;

  const user = this.getUser() || { username: 'guest', role: 'user' };
  const isAdmin = this.isAdmin();
  
  // Detect current path to highlight active nav
  const path = window.location.pathname;

  // Build uniform HTML
  const isEn = (localStorage.getItem('lang') === 'en');
  const appTitle = 'Cell.id.vn';
  const mapTxt = isEn ? 'Map' : 'Bản đồ';
  const toolsTxt = isEn ? 'Tools' : 'Công cụ';
  const portTxt = isEn ? 'Port Check' : 'Tra cứu chuyển mạng';
  const ipTxt = isEn ? 'IP Tracker' : 'IP Tracker';
  const enbEciTxt = isEn ? 'eNB / ECI Converter' : 'Đổi eNB ↔ ECI';
  const adminTxt = isEn ? 'Admin' : 'Admin';
  const logoutTxt = isEn ? 'Logout' : 'Đăng xuất';
  const changePassTxt = isEn ? 'Change Password' : 'Đổi mật khẩu';
  const myDataTxt = isEn ? 'My Data' : 'Dữ liệu của tôi';

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
        background: var(--bg-surface, rgba(255,255,255,0.97)) !important;
        border: 1px solid var(--border-color, rgba(0,0,0,0.1)) !important;
        border-radius: 10px !important;
        box-shadow: 0 10px 40px rgba(0,0,0,0.1) !important;
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
        background: var(--bg-surface, rgba(255,255,255,0.97)) !important;
        border: 1px solid var(--border-color, rgba(0,0,0,0.1)) !important;
        border-radius: 10px !important;
        box-shadow: 0 10px 40px rgba(0,0,0,0.1) !important;
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

      /* Credit badge */
      .credit-badge-common {
        display: inline-flex !important;
        align-items: center !important;
        gap: 5px !important;
        padding: 4px 10px !important;
        border-radius: 14px !important;
        font-size: 12px !important;
        font-weight: 700 !important;
        cursor: pointer !important;
        border: 1px solid rgba(120, 220, 160, 0.4) !important;
        background: rgba(120, 220, 160, 0.14) !important;
        color: #1f9e5a !important;
        height: 30px !important;
        box-sizing: border-box !important;
        line-height: normal !important;
        text-decoration: none !important;
      }
      .credit-badge-common:hover { background: rgba(120, 220, 160, 0.26) !important; }
      .credit-badge-common.low {
        border-color: rgba(255, 100, 100, 0.45) !important;
        background: rgba(255, 100, 100, 0.15) !important;
        color: #e04444 !important;
      }
      .credit-badge-common.low:hover { background: rgba(255, 100, 100, 0.28) !important; }
    `;
    document.head.appendChild(style);
  }

  // Generate uniform navbar inner HTML
  header.innerHTML = `
    <div class="header-left">
      <h1><a href="/index.html" style="color: inherit; text-decoration: none; display: flex; align-items: center; gap: 8px;"><i class="fas fa-signal"></i> <span>${appTitle}</span></a></h1>
      ${isAdmin ? `<span class="nav-badge" style="background: rgba(255,100,100,0.15); color: #ff5555; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: bold; border: 1px solid rgba(255,100,100,0.3); text-transform: uppercase;">Admin</span>` : ''}
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
          <a class="tools-dropdown-item-common" href="/tools/ip-tracker.html" style="${path.includes('/ip-tracker.html') ? 'background: var(--bg-hover, rgba(0,0,0,0.06)); font-weight: bold;' : ''}"><i class="fas fa-crosshairs"></i> ${ipTxt}</a>
          <a class="tools-dropdown-item-common" href="/tools/ebn-eci.html" style="${path.includes('/ebn-eci.html') ? 'background: var(--bg-hover, rgba(0,0,0,0.06)); font-weight: bold;' : ''}"><i class="fas fa-exchange-alt"></i> ${enbEciTxt}</a>
        </div>
      </div>

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
  window.updateCreditBadge(this.getCreditBalance());
  this.refreshCreditBalance();
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
