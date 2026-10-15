/**
 * Client-side version helper — đọc /api/version và vẽ badge + lịch sử phiên bản.
 * Cache trong localStorage để badge hiện ngay (không nhấp nháy) rồi làm mới từ server.
 */
(function () {
  const CACHE_KEY = 'app_version_cache';

  const AppVersion = {
    info: null,

    /** Bản cache (localStorage) — dùng để render trước khi có mạng. */
    cached() {
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },

    /** Nạp thông tin phiên bản; trả cache nếu request lỗi (offline vẫn hiện badge). */
    async load() {
      if (this.info) return this.info;
      try {
        const res = await fetch('/api/version');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        this.info = data;
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) { /* quota */ }
        return data;
      } catch (e) {
        this.info = this.cached();
        return this.info;
      }
    },

    /** Chuỗi hiển thị gọn: `v2.0.0`. */
    label(info) {
      const v = (info || this.info || {}).version;
      return v ? 'v' + v : 'v?';
    },

    /**
     * Vẽ chân panel trái (left bar): chỉ còn số lượt thử của khách
     * (`#cellPanelTrial`) — số phiên bản/ngày build đã bỏ khỏi UI.
     * Idempotent — gọi lại ở mỗi lần đổi tab đều an toàn.
     */
    async renderPanelVersion() {
      const trial = document.getElementById('cellPanelTrial');
      if (!trial) return;

      // Số lượt thử còn lại: chỉ hiện với khách (body.guest-mode).
      if (typeof window !== 'undefined' && window.__guestMode) {
        try {
          const res = await fetch('/api/guest/status');
          if (res.ok) {
            const s = await res.json();
            const up = s.remaining <= 0;
            trial.classList.toggle('exhausted', up);
            trial.textContent = up
              ? 'Đã hết lượt thử'
              : `Còn ${s.remaining}/${s.max} lượt thử`;
            trial.hidden = false;
          }
        } catch (e) { /* offline: ẩn, không chặn UI */ }
      } else {
        trial.hidden = true;
      }
    },

    /**
     * Vẽ lịch sử phiên bản vào 1 element.
     *  - /version.html : mặc định — hiện TOÀN BỘ lịch sử.
     *  - admin panel   : truyền `{ currentOnly: true }` — chỉ hiện phiên bản đang chạy,
     *    tránh đổ cả CHANGELOG vào trang quản trị.
     */
    async renderChangelog(container, opts) {
      opts = opts || {};
      const el = typeof container === 'string' ? document.getElementById(container) : container;
      if (!el) return;
      const info = await this.load();
      if (!info) { el.innerHTML = '<p class="muted">Không tải được thông tin phiên bản.</p>'; return; }

      // `/api/version/changelog` yêu cầu quyền admin → PHẢI gửi token. Trước đây
      // gọi `fetch()` trần nên server trả 401, `list` rỗng và trang in nhầm
      // "Chưa có lịch sử phiên bản" dù CHANGELOG có dữ liệu. `Auth.fetch` tự gắn
      // `Authorization: Bearer <token>` (xem public/auth.js).
      let list = [];
      let loadError = null;
      try {
        const res = (typeof window.Auth !== 'undefined' && window.Auth.fetch)
          ? await window.Auth.fetch('/api/version/changelog')
          : await fetch('/api/version/changelog');
        if (res.ok) list = (await res.json()).changelog || [];
        else loadError = 'HTTP ' + res.status;
      } catch (e) {
        loadError = e && e.message ? e.message : 'network';
      }
      // Fallback: cache localStorage chỉ có ích khi có sẵn changelog (không thì rỗng).
      if (!list.length) list = (this.cached() || {}).changelog || [];

      // Chỉ phiên bản đang chạy: tìm entry khớp info.version (fallback: entry đầu tiên).
      if (opts.currentOnly) {
        const cur = list.find(e => e.version === info.version);
        list = cur ? [cur] : list.slice(0, 1);
      }

      const head = `<div class="ver-head">
        <div class="ver-num">${this.label(info)}</div>
        <div class="ver-meta">
          <div><b>${info.title || 'Cell.id.vn'}</b></div>
          <div class="muted">Build ${info.buildDate || '?'} · Node ${info.nodeVersion || '?'}</div>
        </div>
      </div>`;

      // Rỗng do LỖI (401/403/500/mạng) khác hẳn rỗng do CHANGELOG thật sự trống —
      // nếu gộp làm một thì lỗi quyền bị che thành "Chưa có lịch sử".
      if (!list.length && loadError) {
        el.innerHTML = head + `<p class="muted">Không tải được lịch sử phiên bản (${loadError}).</p>`;
        return;
      }
      if (!list.length) { el.innerHTML = head + '<p class="muted">Chưa có lịch sử phiên bản.</p>'; return; }

      const chip = opts.currentOnly ? 'Đang chạy' : 'Mới nhất';
      const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      // Bullet có thể là string (mục đơn giản) hoặc { text, children } — bullet con
      // render thành <p> trong cùng <li> để giữ đúng nghĩa "list con" của CHANGELOG.
      const renderItem = (it) => {
        const text = typeof it === 'string' ? it : (it.text || '');
        const kids = (typeof it === 'string' ? [] : (it.children || []));
        const childHtml = kids.length
          ? `<p class="ver-sub">${kids.map(esc).join('<br>')}</p>`
          : '';
        return `<li>${esc(text)}${childHtml}</li>`;
      };
      const blocks = list.map((entry, idx) => {
        const sections = (entry.sections || []).map(sec => `
          <div class="ver-section">
            <div class="ver-section-title">${esc(sec.title)}</div>
            <ul>${(sec.items || []).map(renderItem).join('')}</ul>
          </div>`).join('');
        return `<div class="ver-entry${idx === 0 ? ' latest' : ''}">
          <div class="ver-entry-head">
            <span class="ver-tag">${esc(entry.version)}</span>
            <span class="muted">${esc(entry.date || '')}</span>
            ${idx === 0 ? `<span class="ver-chip">${chip}</span>` : ''}
          </div>
          ${sections}
        </div>`;
      }).join('');

      el.innerHTML = head + blocks;
    }
  };

  window.AppVersion = AppVersion;
})();
