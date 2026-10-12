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
     * Vẽ chân panel trái (left bar):
     *  - `#cellPanelVer`  : số phiên bản — nhãn tĩnh, không liên kết.
     *  - `#cellPanelVerNote`: ngày build.
     *  - `#cellPanelTrial`: số lượt thử còn lại (chỉ hiện với khách).
     * Idempotent — gọi lại ở mỗi lần đổi tab đều an toàn.
     */
    async renderPanelVersion() {
      const el = document.getElementById('cellPanelVer');
      if (!el) return;
      const note = document.getElementById('cellPanelVerNote');
      const trial = document.getElementById('cellPanelTrial');

      const cached = this.cached();
      if (cached) el.textContent = this.label(cached);
      if (note && cached) note.textContent = 'Build ' + (cached.buildDate || '?');

      // Nhãn tĩnh: không còn liên kết tới trang lịch sử (trang đó là nội bộ,
      // chỉ mở được từ menu Tools của admin).
      el.title = 'Phiên bản';

      const info = await this.load();
      if (info) {
        el.textContent = this.label(info);
        if (note) note.textContent = 'Build ' + (info.buildDate || '?');
      }

      // Số lượt thử còn lại: chỉ hiện với khách (body.guest-mode).
      if (trial) {
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

      let list = [];
      try {
        const res = await fetch('/api/version/changelog');
        if (res.ok) list = (await res.json()).changelog || [];
      } catch (e) { /* dùng info.changelog nếu có */ }
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

      if (!list.length) { el.innerHTML = head + '<p class="muted">Chưa có lịch sử phiên bản.</p>'; return; }

      const chip = opts.currentOnly ? 'Đang chạy' : 'Mới nhất';
      const blocks = list.map((entry, idx) => {
        const sections = (entry.sections || []).map(sec => `
          <div class="ver-section">
            <div class="ver-section-title">${sec.title}</div>
            <ul>${(sec.items || []).map(i => `<li>${i}</li>`).join('')}</ul>
          </div>`).join('');
        return `<div class="ver-entry${idx === 0 ? ' latest' : ''}">
          <div class="ver-entry-head">
            <span class="ver-tag">${entry.version}</span>
            <span class="muted">${entry.date || ''}</span>
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
