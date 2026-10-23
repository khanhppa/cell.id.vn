/* Cell.id.vn Admin Panel */
// CSV upload: RAW file streamed to server (supports .csv/.gz/.zip/.xlsx).
// Nguồn Online: manage OpenCellID/custom data sources + fetch.

document.addEventListener('DOMContentLoaded', async () => {
  Auth.requireAuth().then(ok => {
    if (!ok) return;
    Auth.initNavbar();
    window.loadTheme();
    switchSection('dashboard');
    initBulkZone();
  });
});

// ========================
// Navigation / Sections
// ========================
let activeSection = 'dashboard';

function switchSection(name) {
  activeSection = name;
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));

  // 'cells' là nhóm cha có menu con: KHÔNG có `#section-cells` (đã thay bằng
  // #sub-sources / #sub-local / #sub-audit, bật qua switchCellSub()). Trước đây
  // đoạn dưới deref thẳng `.getElementById('section-cells').classList` → TypeError
  // → onclick đứt giữa đường → không section nào active → trang trắng.
  const section = document.getElementById('section-' + name);
  if (section) section.classList.add('active');
  else if (name !== 'cells') console.warn('[admin] thiếu section cho menu:', name);

  const item = document.querySelector(`.sidebar-item[data-section="${name}"]`);
  if (item) item.classList.add('active');

  // Mở/gập menu con: chỉ nhóm Cell ID Database có menu con.
  document.querySelectorAll('.sidebar-sub').forEach(sub => {
    sub.classList.toggle('open', sub.dataset.parent === name);
  });
  // Rời nhóm Cell ID Database → bỏ tô sáng mục con, tránh 2 chỗ sáng cùng lúc.
  if (name !== 'cells') {
    document.querySelectorAll('.sidebar-sub-item').forEach(i => i.classList.remove('active'));
  }

  if (name === 'dashboard') { loadDashboard(); refreshSiteBanner(); }
  if (name === 'users') { loadCreditUsers(); loadCreditTx(); }
  if (name === 'settings') loadSettings();
  if (name === 'payments') loadPayments();
  if (name === 'api') loadApiKeys();
  if (name === 'ipx') loadIpSources();

  if (name === 'cells') switchCellSub('local');
  if (name === 'version' && window.AppVersion) window.AppVersion.renderChangelog('verAdminList', { currentOnly: true });
}

// ========================
// Cell ID Database — menu con
// ========================
// 3 mục: sources (nguồn Online) / local (dữ liệu Local) / audit (lịch sử chỉnh sửa).
// Mỗi mục là 1 `<div id="sub-X" class="section">`; sidebar-sub-item active tương ứng.
function switchCellSub(sub) {
  // Đảm bảo nhóm cha đang mở + sidebar-item "cells" sáng.
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  document.querySelectorAll('.sidebar-sub-item').forEach(i => i.classList.remove('active'));

  const section = document.getElementById('sub-' + sub);
  if (section) section.classList.add('active');
  else console.warn('[admin] thiếu section cho menu con:', sub);
  const parent = document.querySelector(`.sidebar-item[data-section="cells"]`);
  if (parent) parent.classList.add('active');
  const subItem = document.querySelector(`.sidebar-sub-item[data-sub="${sub}"]`);
  if (subItem) subItem.classList.add('active');
  const group = document.querySelector('.sidebar-sub[data-parent="cells"]');
  if (group) group.classList.add('open');

  if (sub === 'sources') { loadSources(); loadSyncJobs(); }
  if (sub === 'local') { cdbLoadMeta(); cdbSearch(); initClfZone(); }
  if (sub === 'audit') cdbLoadAudit(1);
}

// ========================
// Quản lý dữ liệu Local — tab con
// ========================
// Mỗi bảng nằm trong 1 `.tab-pane#localtab-<name>`; nút tương ứng
// `.tab-btn[data-localtab="<name>"]`. Khác `.tabs` của #sub-sources: đây là tab
// trong nội dung, KHÔNG đụng sidebar.
let localTab_ = 'cells';

function switchLocalTab(name) {
  const pane = document.getElementById('localtab-' + name);
  if (!pane) { console.warn('[admin] thiếu tab Local:', name); return; }
  localTab_ = name;
  document.querySelectorAll('#localTabs .tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.localtab === name);
  });
  document.querySelectorAll('#sub-local .tab-pane').forEach(p => p.classList.remove('active'));
  pane.classList.add('active');
}

// ========================
// Settings — tab nhóm (Chung / Điểm / payOS / Quy đổi & nạp / SMTP)
// ========================
// Mỗi nhóm nằm trong `.tab-pane#settingstab-<name>`; nút ứng dụng
// `.tab-btn[data-settingstab="<name>"]`. Khác `.tabs` của #localTabs: selector
// bị giới hạn trong #section-settings nên KHÔNG đụng tab Local hay sidebar.
let settingsTab_ = 'general';

function switchSettingsTab(name) {
  const pane = document.getElementById('settingstab-' + name);
  if (!pane) { console.warn('[admin] thiếu tab Cấu hình:', name); return; }
  settingsTab_ = name;
  document.querySelectorAll('#settingsTabs .tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.settingstab === name);
  });
  document.querySelectorAll('#section-settings .tab-pane').forEach(p => p.classList.remove('active'));
  pane.classList.add('active');
}

// ========================
// API — tab nhóm (Khoá API / Nhật ký / Tài liệu)
// ========================
// Cùng pattern với switchSettingsTab: pane `.tab-pane#apitab-<name>`, nút
// `.tab-btn[data-apitab="<name>"]`, selector giới hạn trong #section-api để không
// đụng tab của Cấu hình / Local.
let apiTab_ = 'keys';

function switchApiTab(name) {
  const pane = document.getElementById('apitab-' + name);
  if (!pane) { console.warn('[admin] thiếu tab API:', name); return; }
  apiTab_ = name;
  document.querySelectorAll('#apiTabs .tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.apitab === name);
  });
  document.querySelectorAll('#section-api .tab-pane').forEach(p => p.classList.remove('active'));
  pane.classList.add('active');
  if (name === 'logs') loadApiLogs();
  if (name === 'docs') fillApiBaseUrl();
}

function fillApiBaseUrl() {
  const el = document.getElementById('apiBaseUrl');
  if (el) el.textContent = location.origin;
}

// ========================
// API — danh sách khoá
// ========================
let _apiKeys = [];

async function loadApiKeys() {
  const body = document.getElementById('apiKeyTableBody');
  if (!body) return;
  body.innerHTML = '<tr><td colspan="10" class="loading"><i class="fas fa-spinner fa-spin"></i> Đang tải…</td></tr>';
  fillApiBaseUrl();
  loadApiStats();
  try {
    const res = await Auth.fetch('/api/admin/api/keys');
    const keys = await res.json();
    if (!res.ok) throw new Error(keys.error || 'Không tải được danh sách khoá');
    _apiKeys = Array.isArray(keys) ? keys : [];
    renderApiKeys();
    fillApiLogKeyFilter();
  } catch (e) {
    body.innerHTML = `<tr><td colspan="10" class="muted-text">Lỗi: ${esc(e.message)}</td></tr>`;
  }
}

async function loadApiStats() {
  try {
    const res = await Auth.fetch('/api/admin/api/stats');
    const s = await res.json();
    if (!res.ok) return;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('apiStatKeys', s.keys.total);
    set('apiStatActive', s.keys.active);
    set('apiStatRevoked', s.keys.revoked);
    set('apiStatReq24', s.last24h.requests);
    set('apiStatErr24', s.last24h.errors);
    set('apiStatCells24', s.last24h.cells);
  } catch (e) { /* bỏ qua — stats không quan trọng bằng bảng */ }
}

function apiKeyStatus(k) {
  if (k.revoked_at) return `<span class="badge badge-pending">đã thu hồi</span>`;
  if (!k.enabled) return `<span class="badge badge-pending">đang tắt</span>`;
  if (k.expires_at) {
    const exp = Date.parse(String(k.expires_at).replace(' ', 'T') + 'Z');
    if (Number.isFinite(exp) && Date.now() > exp) return `<span class="badge badge-pending">hết hạn</span>`;
  }
  return `<span class="badge badge-active">hoạt động</span>`;
}

function renderApiKeys() {
  const body = document.getElementById('apiKeyTableBody');
  if (!body) return;
  if (!_apiKeys.length) {
    body.innerHTML = '<tr><td colspan="10" class="muted-text">Chưa có khoá API nào — bấm "Tạo khoá API".</td></tr>';
    return;
  }
  body.innerHTML = _apiKeys.map(k => {
    const scopes = (k.scopes || []).map(s => `<span class="badge badge-user">${esc(s)}</span>`).join(' ');
    const dead = !!k.revoked_at;
    return `<tr>
      <td>${k.id}</td>
      <td>${esc(k.name)}</td>
      <td>${k.require_user === false
        ? '<span class="badge badge-pending">không cần</span>'
        : '<span class="badge badge-user">bắt buộc</span>'}</td>
      <td><code>${esc(k.key_prefix)}…</code></td>
      <td>${scopes}</td>
      <td style="white-space:nowrap">${k.rate_limit_per_min}/ph<br><span class="muted-text">${k.rate_limit_per_day}/ngày</span></td>
      <td style="text-align:right">${k.request_count_24h}<span class="muted-text"> / ${k.request_count}</span></td>
      <td style="white-space:nowrap">${esc(k.last_used_at || '—')}</td>
      <td>${apiKeyStatus(k)}</td>
      <td style="text-align:right;white-space:nowrap">
        ${dead ? '' : `<button class="btn btn-sm" title="${k.enabled ? 'Tắt khoá' : 'Bật khoá'}"
            onclick="apiKeyToggle(${k.id}, ${k.enabled ? 0 : 1})">
            <i class="fas fa-${k.enabled ? 'toggle-on' : 'toggle-off'}"></i></button>`}
        <button class="btn btn-sm" title="Sửa hạn mức / quyền" onclick="apiKeyOpenEdit(${k.id})">
          <i class="fas fa-pen"></i></button>
        ${dead ? '' : `<button class="btn btn-danger btn-sm" title="Thu hồi khoá" onclick="apiKeyRevoke(${k.id})">
          <i class="fas fa-ban"></i></button>`}
        ${k.request_count ? '' : `<button class="btn btn-danger btn-sm" title="Xoá (chưa từng dùng)"
          onclick="apiKeyDelete(${k.id})"><i class="fas fa-trash"></i></button>`}
      </td>
    </tr>`;
  }).join('');
}

function fillApiLogKeyFilter() {
  const sel = document.getElementById('apiLogKey');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Mọi khoá</option>' + _apiKeys.map(k =>
    `<option value="${k.id}">#${k.id} — ${esc(k.name)}${k.user_count ? ` (${k.user_count} tài khoản)` : ''}</option>`).join('');
  sel.value = cur;
}

// ========================
// API — form tạo / sửa khoá (modal trong Document, không dùng prompt())
// ========================
let _apiEditId = null;

function apiModalHtml() {
  return `<div class="cf-overlay" id="apiKeyModal" style="display:none">
    <div class="cf-box" role="dialog" aria-modal="true" aria-labelledby="apiKeyModalTitle">
      <div class="cf-hd">
        <span class="cf-ico"><i class="fas fa-key"></i></span>
        <span id="apiKeyModalTitle">Tạo khoá API</span>
        <button class="cf-x" type="button" onclick="apiKeyCloseModal()" aria-label="Đóng">
          <i class="fas fa-xmark"></i></button>
      </div>
      <div class="cf-body">
        <div class="form-group">
          <label>Tên khoá <span style="color:#e05252">*</span></label>
          <input type="text" id="apiKeyName" placeholder="VD: App bán hàng — server" maxlength="100">
        </div>
        <div class="form-group">
          <label>Bắt buộc đăng nhập</label>
          <label class="toggle-row">
            <span class="toggle-text">
              Yêu cầu gửi kèm JWT khi tra cứu
              <div class="hint" style="margin-top:2px">
                Khoá chỉ mở cổng kết nối — điểm trừ vào tài khoản mà ứng dụng đăng nhập.
                Tắt chỉ khi khoá dùng cho endpoint công khai (<code>/health</code>).
              </div>
            </span>
            <span class="toggle-switch">
              <input type="checkbox" id="apiKeyRequireUser" checked>
              <span class="toggle-track"></span>
            </span>
          </label>
        </div>
        <div class="form-group">
          <label>Quyền</label>
          <label class="toggle-row" style="margin-bottom:6px">
            <span class="toggle-text"><code>lookup</code> — tra cứu cell</span>
            <span class="toggle-switch">
              <input type="checkbox" id="apiKeyScopeLookup" checked>
              <span class="toggle-track"></span>
            </span>
          </label>
          <label class="toggle-row">
            <span class="toggle-text"><code>account</code> — xem thông tin tài khoản</span>
            <span class="toggle-switch">
              <input type="checkbox" id="apiKeyScopeAccount" checked>
              <span class="toggle-track"></span>
            </span>
          </label>
        </div>
        <div class="form-group">
          <label>Hạn mức mỗi phút</label>
          <input type="number" id="apiKeyPerMin" min="1" value="60">
        </div>
        <div class="form-group">
          <label>Hạn mức mỗi ngày</label>
          <input type="number" id="apiKeyPerDay" min="1" value="5000">
        </div>
        <div class="form-group">
          <label>Ngày hết hạn (để trống = không hết hạn)</label>
          <input type="date" id="apiKeyExpires">
        </div>
      </div>
      <div class="cf-ft">
        <button class="btn" type="button" onclick="apiKeyCloseModal()">Huỷ</button>
        <button class="btn btn-primary" type="button" id="apiKeySaveBtn" onclick="apiKeySave()">
          <i class="fas fa-check"></i> Tạo khoá
        </button>
      </div>
    </div>
  </div>`;
}

function apiKeyEnsureModal() {
  if (document.getElementById('apiKeyModal')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = apiModalHtml();
  document.body.appendChild(wrap.firstElementChild);
}

function apiKeyCloseModal() {
  const m = document.getElementById('apiKeyModal');
  if (m) m.style.display = 'none';
  _apiEditId = null;
}

function apiKeyOpenCreate() {
  apiKeyEnsureModal();
  _apiEditId = null;
  document.getElementById('apiKeyModalTitle').textContent = 'Tạo khoá API';
  document.getElementById('apiKeySaveBtn').innerHTML = '<i class="fas fa-check"></i> Tạo khoá';
  document.getElementById('apiKeyName').value = '';
  document.getElementById('apiKeyScopeLookup').checked = true;
  document.getElementById('apiKeyScopeAccount').checked = true;
  document.getElementById('apiKeyRequireUser').checked = true;
  document.getElementById('apiKeyPerMin').value = 60;
  document.getElementById('apiKeyPerDay').value = 5000;
  document.getElementById('apiKeyExpires').value = '';
  document.getElementById('apiKeyModal').style.display = 'flex';
  document.getElementById('apiKeyName').focus();
}

function apiKeyOpenEdit(id) {
  const k = _apiKeys.find(x => Number(x.id) === Number(id));
  if (!k) return;
  apiKeyEnsureModal();
  _apiEditId = Number(id);
  document.getElementById('apiKeyModalTitle').textContent = 'Sửa khoá #' + k.id;
  document.getElementById('apiKeySaveBtn').innerHTML = '<i class="fas fa-check"></i> Lưu thay đổi';
  document.getElementById('apiKeyName').value = k.name || '';
  document.getElementById('apiKeyScopeLookup').checked = (k.scopes || []).includes('lookup');
  document.getElementById('apiKeyScopeAccount').checked = (k.scopes || []).includes('account');
  document.getElementById('apiKeyRequireUser').checked = k.require_user !== false;
  document.getElementById('apiKeyPerMin').value = k.rate_limit_per_min || 60;
  document.getElementById('apiKeyPerDay').value = k.rate_limit_per_day || 5000;
  document.getElementById('apiKeyExpires').value = k.expires_at ? String(k.expires_at).slice(0, 10) : '';
  document.getElementById('apiKeyModal').style.display = 'flex';
}

async function apiKeySave() {
  const name = (document.getElementById('apiKeyName').value || '').trim();
  if (!name) return showToast('Nhập tên khoá', 'error');
  const scopes = [];
  if (document.getElementById('apiKeyScopeLookup').checked) scopes.push('lookup');
  if (document.getElementById('apiKeyScopeAccount').checked) scopes.push('account');
  if (!scopes.length) return showToast('Chọn ít nhất 1 quyền', 'error');
  const perMin = Number(document.getElementById('apiKeyPerMin').value) || 60;
  const perDay = Number(document.getElementById('apiKeyPerDay').value) || 5000;
  const exp = document.getElementById('apiKeyExpires').value;
  const requireUser = document.getElementById('apiKeyRequireUser').checked;

  const payload = {
    name, scopes, rate_limit_per_min: perMin, rate_limit_per_day: perDay,
    expires_at: exp || null, require_user: requireUser
  };
  const editing = _apiEditId != null;

  const btn = document.getElementById('apiKeySaveBtn');
  btn.disabled = true;
  try {
    const res = await Auth.fetch(editing ? `/api/admin/api/keys/${_apiEditId}` : '/api/admin/api/keys', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lưu thất bại');
    apiKeyCloseModal();
    loadApiKeys();
    // Tạo mới → hiện khoá thô 1 lần duy nhất.
    if (!editing && data.raw) apiShowNewKey(data.raw, data.key);
    else showToast('Đã lưu thay đổi', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

// Hiện khoá thô đúng 1 lần, kèm nút copy. Không có cách nào xem lại sau đó.
function apiShowNewKey(raw, key) {
  let el = document.getElementById('apiNewKeyModal');
  if (el) el.remove();
  const wrap = document.createElement('div');
  wrap.innerHTML = `<div class="cf-overlay" id="apiNewKeyModal" style="display:flex">
    <div class="cf-box" role="dialog" aria-modal="true">
      <div class="cf-hd">
        <span class="cf-ico"><i class="fas fa-key"></i></span>
        <span>Khoá API mới — copy ngay</span>
        <button class="cf-x" type="button" onclick="document.getElementById('apiNewKeyModal').remove()" aria-label="Đóng">
          <i class="fas fa-xmark"></i></button>
      </div>
      <div class="cf-body">
        <div class="cf-warn" style="margin-bottom:10px">
          <i class="fas fa-triangle-exclamation"></i>
          Khoá chỉ hiện <b>đúng 1 lần</b>. Server chỉ lưu bản băm nên không thể xem lại —
          nếu làm mất, hãy thu hồi và tạo khoá mới.
        </div>
        <div class="hint" style="margin-bottom:6px">Tên: <b>${esc(key.name)}</b>${key.require_user === false
          ? ' · <span style="color:#e0b048">không bắt buộc đăng nhập</span>'
          : ' · bắt buộc gửi kèm JWT khi tra cứu'}</div>
        <textarea id="apiNewKeyValue" readonly rows="3"
          style="width:100%;box-sizing:border-box;font-family:monospace;font-size:12px;padding:10px;border-radius:8px;resize:vertical">${esc(raw)}</textarea>
      </div>
      <div class="cf-ft">
        <button class="btn" type="button" onclick="document.getElementById('apiNewKeyModal').remove()">Đóng</button>
        <button class="btn btn-primary" type="button" onclick="apiCopyNewKey()">
          <i class="fas fa-copy"></i> Copy khoá
        </button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(wrap.firstElementChild);
  setTimeout(() => {
    const ta = document.getElementById('apiNewKeyValue');
    if (ta) { ta.focus(); ta.select(); }
  }, 50);
}

function apiCopyNewKey() {
  const ta = document.getElementById('apiNewKeyValue');
  if (!ta) return;
  ta.select();
  const done = () => showToast('Đã copy khoá API', 'success');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(ta.value).then(done).catch(() => {
      try { document.execCommand('copy'); done(); } catch (e) { showToast('Không copy được', 'error'); }
    });
  } else {
    try { document.execCommand('copy'); done(); } catch (e) { showToast('Không copy được', 'error'); }
  }
}

async function apiKeyToggle(id, enabled) {
  try {
    const res = await Auth.fetch(`/api/admin/api/keys/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !!enabled })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Không đổi được trạng thái');
    showToast(enabled ? 'Đã bật khoá' : 'Đã tắt khoá', 'success');
    loadApiKeys();
  } catch (e) { showToast(e.message, 'error'); }
}

async function apiKeyRevoke(id) {
  const ok = await adminConfirm({
    title: 'Thu hồi khoá API #' + id,
    message: 'Khoá này sẽ ngừng hoạt động ngay lập tức.',
    warnings: ['Thu hồi là VĨNH VIỄN — không thể bật lại, phải tạo khoá mới.'],
    notes: ['Ứng dụng đang dùng khoá này sẽ nhận lỗi 401 (KEY_REVOKED).'],
    okText: 'Thu hồi khoá'
  });
  if (!ok) return;
  try {
    const res = await Auth.fetch(`/api/admin/api/keys/${id}/revoke`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Thu hồi thất bại');
    showToast('Đã thu hồi khoá', 'success');
    loadApiKeys();
  } catch (e) { showToast(e.message, 'error'); }
}

async function apiKeyDelete(id) {
  const ok = await adminConfirm({
    title: 'Xoá khoá API #' + id,
    message: 'Khoá này chưa từng được dùng nên có thể xoá hẳn.',
    warnings: ['Xoá là vĩnh viễn.'],
    okText: 'Xoá khoá'
  });
  if (!ok) return;
  try {
    const res = await Auth.fetch(`/api/admin/api/keys/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Xoá thất bại');
    showToast('Đã xoá khoá', 'success');
    loadApiKeys();
  } catch (e) { showToast(e.message, 'error'); }
}

// ========================
// API — nhật ký
// ========================
async function loadApiLogs() {
  const body = document.getElementById('apiLogTableBody');
  if (!body) return;
  body.innerHTML = '<tr><td colspan="11" class="loading"><i class="fas fa-spinner fa-spin"></i> Đang tải…</td></tr>';
  const st = document.getElementById('apiLogStatus');
  const kf = document.getElementById('apiLogKey');
  const qs = new URLSearchParams();
  if (st && st.value) qs.set('status', st.value);
  if (kf && kf.value) qs.set('key_id', kf.value);
  qs.set('limit', '200');
  try {
    const res = await Auth.fetch('/api/admin/api/logs?' + qs.toString());
    const logs = await res.json();
    if (!res.ok) throw new Error(logs.error || 'Không tải được nhật ký');
    if (!logs.length) {
      body.innerHTML = '<tr><td colspan="11" class="muted-text">Chưa có request nào.</td></tr>';
      return;
    }
    body.innerHTML = logs.map(l => {
      const bad = Number(l.status) >= 400;
      const keyTxt = l.key_prefix ? `<code>${esc(l.key_prefix)}…</code>` : '<span class="muted-text">JWT</span>';
      return `<tr>
        <td style="white-space:nowrap">${esc(l.created_at || '')}</td>
        <td>${keyTxt}<br><span class="muted-text">${esc(l.key_name || '')}</span></td>
        <td>${esc(l.username || '—')}</td>
        <td>${esc(l.method || '')}</td>
        <td><code>${esc(l.path || '')}</code></td>
        <td><span class="badge ${bad ? 'badge-pending' : 'badge-active'}">${esc(String(l.status || ''))}</span></td>
        <td style="text-align:right">${l.duration_ms != null ? esc(String(l.duration_ms)) : '—'}</td>
        <td style="text-align:right">${Number(l.cells) || 0}</td>
        <td style="text-align:right">${Number(l.charged) || 0}</td>
        <td style="white-space:nowrap">${esc(l.ip || '')}</td>
        <td class="muted-text" style="max-width:240px;overflow:hidden;text-overflow:ellipsis">${esc(l.error || '')}</td>
      </tr>`;
    }).join('');
  } catch (e) {
    body.innerHTML = `<tr><td colspan="11" class="muted-text">Lỗi: ${esc(e.message)}</td></tr>`;
  }
}

function apiCopyCurl() {
  const base = location.origin;
  const sample = _apiKeys.length ? (_apiKeys[0].key_prefix + '…') : 'sk_live_xxxxxxxx';
  const txt = `# 1) Kiểm tra kết nối\ncurl ${base}/api/v1/health\n\n`
    + `# 2) Đăng nhập để lấy JWT (điểm trừ vào tài khoản này)\n`
    + `curl ${base}/api/v1/login \\\n  -H "Content-Type: application/json" \\\n  -d '{"username":"user01","password":"matkhau"}'\n\n`
    + `# 3) Thông tin tài khoản — cần cả khoá (cổng) lẫn JWT (tài khoản)\n`
    + `curl ${base}/api/v1/me \\\n  -H "X-API-Key: ${sample}" \\\n  -H "Authorization: Bearer $TOKEN"\n\n`
    + `# 4) Tra cứu cell — cần cả khoá lẫn JWT\n`
    + `curl "${base}/api/v1/cells/resolve?mcc=452&mnc=01&lac=9000&cellid=123456" \\\n  -H "X-API-Key: ${sample}" \\\n  -H "Authorization: Bearer $TOKEN"`;
  const done = () => showToast('Đã copy ví dụ cURL', 'success');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(done).catch(() => showToast('Không copy được', 'error'));
  } else { showToast('Trình duyệt không hỗ trợ copy', 'error'); }
}

// ========================
// Settings
// ========================
// Mỗi lần loadSettings tăng seq; response cũ (mạng chậm) không được phép ghi đè
// form mới hơn — tránh cảnh vừa lưu xong lại bị response cũ làm GA trông như
// "không lưu được".
let _settingsLoadSeq = 0;

function loadSettings() {
  const seq = ++_settingsLoadSeq;
  Auth.fetch('/api/settings?t=' + Date.now()).then(r => r.json()).then(s => {
    if (seq !== _settingsLoadSeq) return;
    const mo = document.getElementById('setMaxOnline');
    const rt = document.getElementById('setRetention');
    const gm = document.getElementById('setGoogleMax');
    if (mo) mo.value = s.max_online_resolve != null ? s.max_online_resolve : '';
    if (rt) rt.value = s.lookup_history_retention_days != null ? s.lookup_history_retention_days : '';
    if (gm) gm.value = s.max_google_per_batch != null ? s.max_google_per_batch : '';
    const ce = document.getElementById('setCreditEnabled');
    const cc = document.getElementById('setCreditCost');
    const cb = document.getElementById('setCreditSignupBonus');
    const cn = document.getElementById('setCreditAllowNegative');
    if (ce) ce.checked = String(s.credit_enabled) === '1';
    if (cc) cc.value = s.credit_cost_per_lookup != null ? s.credit_cost_per_lookup : '';
    if (cb) cb.value = s.credit_signup_bonus != null ? s.credit_signup_bonus : '';
    if (cn) cn.checked = String(s.credit_allow_negative) === '1';

    // payOS: secret nhận về bản che (••••1234). Ô input để TRỐNG — placeholder
    // hiển thị bản che để admin biết đã cấu hình, gõ đè thì mới đổi.
    const pe = document.getElementById('setPayosEnabled');
    const pt = document.getElementById('setPayosTestMode');
    const pc = document.getElementById('setPayosClientId');
    const pak = document.getElementById('setPayosApiKey');
    const pck = document.getElementById('setPayosChecksumKey');
    const pbu = document.getElementById('setPayosBaseUrl');
    const pwu = document.getElementById('setPayosWebhookUrl');
    const pbase = document.getElementById('setPublicBaseUrl');
    const vpc = document.getElementById('setVndPerCredit');
    const tmin = document.getElementById('setTopupMin');
    const tmax = document.getElementById('setTopupMax');
    if (pe) pe.checked = String(s.payos_enabled) === '1';
    if (pt) pt.checked = String(s.payos_test_mode) === '1';
    payIsTestMode = String(s.payos_test_mode) === '1';
    if (pc) pc.value = s.payos_client_id || '';
    if (pak) { pak.value = ''; pak.placeholder = s.payos_api_key_set ? s.payos_api_key : 'Chưa cấu hình'; }
    if (pck) { pck.value = ''; pck.placeholder = s.payos_checksum_key_set ? s.payos_checksum_key : 'Chưa cấu hình'; }
    if (pbu) pbu.value = s.payos_base_url || '';
    if (pwu) pwu.value = s.payos_webhook_url || '';
    if (pbase) pbase.value = s.public_base_url || '';
    if (vpc) vpc.value = s.topup_vnd_per_credit ?? '';
    if (tmin) tmin.value = s.topup_min_vnd ?? '';
    if (tmax) tmax.value = s.topup_max_vnd ?? '';

    // SMTP — gửi email kích hoạt/quên mật khẩu. smtp_pass là secret → bản che, ô trống = giữ nguyên.
    const se = document.getElementById('setSmtpEnabled');
    const sh = document.getElementById('setSmtpHost');
    const sp = document.getElementById('setSmtpPort');
    const ss = document.getElementById('setSmtpSecure');
    const su = document.getElementById('setSmtpUser');
    const spw = document.getElementById('setSmtpPass');
    const sf = document.getElementById('setSmtpFrom');
    const sfn = document.getElementById('setSmtpFromName');
    const sst = document.getElementById('setSmtpStatus');
    if (se) se.checked = String(s.smtp_enabled) === '1';
    if (sh) sh.value = s.smtp_host || '';
    if (sp) sp.value = s.smtp_port ?? '';
    if (ss) ss.checked = String(s.smtp_secure) === '1';
    if (su) su.value = s.smtp_user || '';
    if (spw) { spw.value = ''; spw.placeholder = s.smtp_pass_set ? s.smtp_pass : 'Chưa cấu hình'; }
    if (sf) sf.value = s.smtp_from || '';
    if (sfn) sfn.value = s.smtp_from_name || '';
    if (sst) {
      sst.textContent = String(s.smtp_enabled) === '1'
        ? 'SMTP đang BẬT — email kích hoạt/quên mật khẩu sẽ được gửi thật.'
        : 'SMTP đang TẮT — mã kích hoạt được ghi ra console server và admin copy link ở cột thao tác.';
    }
    syncSmtpTlsHint();
    applyGaSettingsToForm(s);
  }).catch(e => {
    if (seq !== _settingsLoadSeq) return;
    showToast('Không tải được cấu hình: ' + e.message, 'error');
  });
}

/** Đổ settings GA vào form (tách khỏi loadSettings để saveGaSettings dùng lại). */
function applyGaSettingsToForm(s) {
  const gaEn = document.getElementById('setGaEnabled');
  const gaMid = document.getElementById('setGaMeasurementId');
  const gaPid = document.getElementById('setGaPropertyId');
  const gaSa = document.getElementById('setGaServiceAccount');
  const gaHint = document.getElementById('setGaServiceAccountHint');
  if (gaEn) gaEn.checked = String(s.ga_enabled) === '1';
  if (gaMid) gaMid.value = s.ga_measurement_id || '';
  if (gaPid) gaPid.value = s.ga_property_id || '';
  if (gaSa) {
    gaSa.value = '';
    gaSa.placeholder = s.ga_service_account_json_set
      ? 'Đã cấu hình Service Account — dán JSON mới để thay đổi'
      : 'Dán toàn bộ nội dung file JSON của service account…';
  }
  if (gaHint) {
    gaHint.textContent = s.ga_service_account_json_set
      ? 'Service Account đã được cấu hình. Để trống để giữ nguyên.'
      : 'Chưa có Service Account — website vẫn ghi nhận traffic nếu có Measurement ID, nhưng chưa đọc được báo cáo.';
  }
  const gaEmailRow = document.getElementById('gaAccountEmailRow');
  const gaEmailInput = document.getElementById('gaAccountEmail');
  if (gaEmailRow && gaEmailInput) {
    const email = s.ga_service_account_email || '';
    gaEmailRow.style.display = email ? '' : 'none';
    gaEmailInput.value = email;
  }
  renderGaSettingsStatus(s);

  // Website bật/đóng + thông báo bảo trì (tab Website).
  const so = document.getElementById('setSiteOpen');
  const sm = document.getElementById('setSiteClosedMessage');
  const sstx = document.getElementById('setSiteStatus');
  if (so) { so.checked = String(s.site_open) !== '0'; so.dataset.siteLoaded = '1'; so.dataset.wasOpen = so.checked ? '1' : '0'; }
  if (sm) { sm.value = s.site_closed_message || ''; sm.dataset.siteLoaded = '1'; }
  if (sstx) {
    const closed = String(s.site_open) === '0';
    sstx.textContent = closed
      ? 'Website đang ĐÓNG — người dùng chỉ thấy trang thông báo bảo trì.'
      : 'Website đang MỞ — truy cập bình thường.';
    sstx.style.color = closed ? '#e04444' : '';
  }
}

/** Dòng trạng thái ngắn trong tab Google Analytics (không gọi mạng). */
function renderGaSettingsStatus(s) {
  const el = document.getElementById('setGaStatus');
  if (!el) return;
  const enabled = String(s.ga_enabled) === '1';
  const tracking = !!s.ga_measurement_id;
  const reporting = !!(s.ga_property_id && s.ga_service_account_json_set
    && s.ga_service_account_json_valid !== false);
  if (!enabled) {
    el.textContent = 'Google Analytics đang TẮT.';
    el.style.color = '';
  } else if (tracking && reporting) {
    el.textContent = 'Đang bật: tracking + báo cáo đã cấu hình.';
    el.style.color = '#45c07d';
  } else if (tracking) {
    el.textContent = 'Đang bật tracking; chưa đủ cấu hình để đọc báo cáo (cần Property ID + Service Account JSON).';
    el.style.color = '#e0ab4a';
  } else if (reporting) {
    el.textContent = 'Đã đủ cấu hình báo cáo nhưng chưa có Measurement ID — website chưa ghi nhận traffic.';
    el.style.color = '#e0ab4a';
  } else {
    el.textContent = 'Chưa đủ cấu hình. Nhập Measurement ID hoặc Property ID + Service Account JSON.';
    el.style.color = '#e0ab4a';
  }
}

/** Thu thập field Google Analytics từ form (secret chỉ gửi khi admin gõ mới). */
function collectAnalyticsSettings(settings) {
  const get = id => document.getElementById(id);
  const en = get('setGaEnabled');
  const mid = get('setGaMeasurementId');
  const pid = get('setGaPropertyId');
  const sa = get('setGaServiceAccount');
  if (en) settings.ga_enabled = en.checked ? '1' : '0';
  // Gửi cả chuỗi rỗng: admin có ý định XOÁ Measurement/Property.
  if (mid) settings.ga_measurement_id = mid.value.trim();
  if (pid) settings.ga_property_id = pid.value.trim();
  if (sa) {
    const raw = sa.value.trim();
    if (raw && !raw.startsWith('••••')) settings.ga_service_account_json = raw;
  }
}

async function testGaConnection() {
  const btn = document.getElementById('gaTestBtn');
  const status = document.getElementById('setGaStatus');
  if (btn) btn.disabled = true;
  if (status) { status.textContent = 'Đang kiểm tra kết nối…'; status.style.color = ''; }
  try {
    const payload = {
      measurement_id: (document.getElementById('setGaMeasurementId') || {}).value || '',
      property_id: (document.getElementById('setGaPropertyId') || {}).value || ''
    };
    const sa = document.getElementById('setGaServiceAccount');
    if (sa && sa.value.trim() && !sa.value.trim().startsWith('••••')) {
      payload.service_account_json = sa.value.trim();
    }
    const res = await Auth.fetch('/api/admin/analytics/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const d = await res.json().catch(() => ({}));
    if (status) {
      const tracking = d.tracking && d.tracking.ok;
      const reporting = d.reporting && d.reporting.ok;
      const sample = d.reporting && d.reporting.sample;
      status.innerHTML = [
        `Tracking: <b>${tracking ? 'OK' : 'chưa đúng'}</b>`,
        `Báo cáo: <b>${reporting ? 'OK' : 'chưa đọc được'}</b>`,
        sample ? `7 ngày: ${fmtNum(sample.active_users_7d)} người / ${fmtNum(sample.sessions_7d)} phiên` : '',
        d.reporting && d.reporting.account_email ? `Service account: <b>${escAttr(d.reporting.account_email)}</b>` : '',
        d.error && d.error.message ? `Lỗi: ${escAttr(d.error.message)}` : ''
      ].filter(Boolean).join(' · ');
      status.style.color = d.ok ? '#45c07d' : '#ff7b7b';
    }
    showToast(d.ok ? 'Kết nối Google Analytics OK' : 'Chưa kết nối được GA — xem chi tiết trong tab', d.ok ? 'success' : 'error');
  } catch (e) {
    if (status) { status.textContent = 'Lỗi: ' + e.message; status.style.color = '#ff7b7b'; }
    showToast(e.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function copyGaEmail() {
  const input = document.getElementById('gaAccountEmail');
  const text = input ? input.value.trim() : '';
  if (!text) return showToast('Chưa có email service account', 'error');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => showToast('Đã copy email service account', 'success'))
      .catch(() => window.prompt('Copy email service account:', text));
  } else {
    window.prompt('Copy email service account:', text);
  }
}

/**
 * Kiểm tra nhanh dữ liệu GA ngay trên form — trả {error} để hiển thị tại chỗ,
 * không phụ thuộc việc bấm nút Lưu chung của cả trang Cấu hình.
 */
function validateGaInputs() {
  const get = id => document.getElementById(id);
  const enabled = !!(get('setGaEnabled') && get('setGaEnabled').checked);
  const mid = String((get('setGaMeasurementId') || {}).value || '').trim().toUpperCase();
  const pid = String((get('setGaPropertyId') || {}).value || '').trim().replace(/^properties\//i, '');
  const rawSa = String((get('setGaServiceAccount') || {}).value || '').trim();
  const hasNewJson = !!rawSa && !rawSa.startsWith('••••');
  const storedJson = !!String((get('gaAccountEmail') || {}).value || '').trim();

  if (mid && !/^G-[A-Z0-9]{6,20}$/.test(mid)) {
    return { error: 'Measurement ID phải có dạng G-XXXXXXXXXX (chỉ chữ/số, không dấu cách).' };
  }
  if (pid && !/^\d{4,20}$/.test(pid)) {
    return { error: 'Property ID phải là dãy số, ví dụ 123456789 (có thể dán cả properties/123456789).' };
  }
  if (hasNewJson) {
    try {
      const obj = JSON.parse(rawSa);
      if (!obj || typeof obj !== 'object' || !obj.client_email || !obj.private_key) {
        return { error: 'Service Account JSON thiếu client_email hoặc private_key. Hãy dán nguyên file JSON tải từ Google Cloud.' };
      }
    } catch (e) {
      return { error: 'Service Account JSON không hợp lệ (không parse được). Hãy dán nguyên nội dung file .json.' };
    }
  }
  if (enabled) {
    const hasReporting = !!pid && (hasNewJson || storedJson);
    if (!mid && !hasReporting) {
      return { error: 'Để bật GA cần Measurement ID, hoặc đủ Property ID + Service Account JSON.' };
    }
  }
  return { error: null };
}

/**
 * Lưu RIÊNG phần Google Analytics — không gửi kèm các setting khác, nên một field
 * khác trong form Cấu hình bị lỗi cũng không thể chặn việc lưu GA.
 */
async function saveGaSettings() {
  const status = document.getElementById('setGaStatus');
  const btn = document.getElementById('gaSaveBtn');
  const validation = validateGaInputs();
  if (validation.error) {
    if (status) { status.textContent = validation.error; status.style.color = '#ff7b7b'; }
    showToast(validation.error, 'error');
    return;
  }

  const settings = {};
  collectAnalyticsSettings(settings);
  if (btn) btn.disabled = true;
  if (status) { status.textContent = 'Đang lưu Google Analytics…'; status.style.color = ''; }
  try {
    const res = await Auth.fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings })
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.success) throw new Error(d.error || 'Lỗi lưu cấu hình Google Analytics');
    if (d.settings) applyGaSettingsToForm(d.settings);
    showToast('Đã lưu Google Analytics', 'success');
  } catch (e) {
    if (status) { status.textContent = 'Lỗi lưu GA: ' + e.message; status.style.color = '#ff7b7b'; }
    showToast(e.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/**
 * Nhận diện nhà cung cấp SMTP (bản gọn phía client, khớp mailer.detectProvider).
 * Chỉ để HIỂN THỊ gợi ý cho admin — không tự đổi giá trị form.
 */
function smtpProviderInfo(host) {
  const h = String(host || '').trim().toLowerCase();
  const gen = { name: 'SMTP tùy chỉnh', userHint: 'tài khoản SMTP', passHint: 'mật khẩu ứng dụng do nhà cung cấp cấp' };
  if (!h) return gen;
  if (/(^|\.)gmail\.com$/.test(h) || /googlemail\.com$/.test(h)) {
    return { name: 'Gmail', userHint: 'địa chỉ Gmail đầy đủ', passHint: 'App Password 16 ký tự (bật 2FA)' };
  }
  const zoho = /(?:^|\.)(smtp|smtppro)\.zoho\.(com|eu|in|jp|ca|com\.au)$/.exec(h);
  if (zoho) {
    const paid = zoho[1] === 'smtppro';
    const dc = { com: 'US', eu: 'EU', in: 'Ấn Độ', jp: 'Nhật', ca: 'Canada', 'com.au': 'Úc' }[zoho[2]] || zoho[2];
    return { name: `Zoho Mail (${paid ? 'Paid Org' : 'Free Org'}, DC ${dc})`,
      userHint: `địa chỉ email đầy đủ đúng DC ${dc}`,
      passHint: 'App Password (accounts.zoho.com → Security)',
      warn: paid
        ? `Đang dùng smtppro.zoho.${zoho[2]} — máy chủ này CHỈ hoạt động với gói Zoho Mail TRẢ PHÍ. Gói Free Organization phải đổi sang smtp.zoho.${zoho[2]}, nếu không sẽ bị "554 5.7.8 Access Restricted".`
        : '' };
  }
  if (/(^|\.)zoho\.(com|eu|in|jp|ca|com\.au)$/.test(h)) {
    return { name: 'Zoho Mail', userHint: 'địa chỉ Zoho đầy đủ', passHint: 'App Password (accounts.zoho.com → Security)' };
  }
  if (/outlook\.com$|office365\.com$|hotmail\.com$|live\.com$/.test(h)) {
    return { name: 'Outlook / Microsoft 365', userHint: 'địa chỉ email đầy đủ', passHint: 'mật khẩu ứng dụng nếu bật MFA' };
  }
  if (/(^|\.)yahoo\.com$/.test(h)) {
    return { name: 'Yahoo Mail', userHint: 'địa chỉ Yahoo đầy đủ', passHint: 'App Password 16 ký tự' };
  }
  if (/smtp-relay\.brevo\.com$|smtp-relay\.sendinblue\.com$/.test(h)) {
    return { name: 'Brevo', userHint: 'email đăng nhập Brevo', passHint: 'SMTP Key' };
  }
  if (/smtp\.resend\.com$/.test(h)) return { name: 'Resend', userHint: 'resend', passHint: 'API Key (re_...)' };
  if (/smtp\.mailgun\.org$/.test(h)) return { name: 'Mailgun', userHint: 'postmaster@<domain>', passHint: 'SMTP password' };
  if (/smtp\.sendgrid\.net$/.test(h)) return { name: 'SendGrid', userHint: 'apikey', passHint: 'API Key (SG....)' };
  if (/email-smtp\.[a-z0-9-]+\.amazonaws\.com$/.test(h)) {
    return { name: 'Amazon SES', userHint: 'SMTP Credential', passHint: 'SMTP Password do SES cấp' };
  }
  if (/mail\.gmx\.(com|net)$/.test(h)) return { name: 'GMX', userHint: 'địa chỉ GMX đầy đủ', passHint: 'mật khẩu GMX' };
  return gen;
}

/**
 * Cảnh báo sớm khi (port, secure) mâu thuẫn — nguyên nhân của lỗi TLS
 * "wrong version number" khi gửi mail thử. Server cũng tự sửa (mailer.normalizeTls)
 * nhưng báo ở đây để admin biết mà đặt đúng. Đồng thời hiện gợi ý theo nhà cung
 * cấp (Zoho/Brevo/Resend…) để cấu hình đúng ngay từ đầu.
 */
function syncSmtpTlsHint() {
  const el = document.getElementById('setSmtpTlsHint');
  const pEl = document.getElementById('setSmtpProviderHint');
  const hostEl = document.getElementById('setSmtpHost');
  const portEl = document.getElementById('setSmtpPort');
  const secEl = document.getElementById('setSmtpSecure');

  if (pEl) {
    const info = smtpProviderInfo(hostEl && hostEl.value);
    const hasHost = !!(hostEl && hostEl.value.trim());
    pEl.textContent = hasHost
      ? `Nhận diện: ${info.name}. Tài khoản: ${info.userHint}. Mật khẩu: ${info.passHint}.` + (info.warn ? ` ⚠ ${info.warn}` : '')
      : '';
    pEl.style.color = info.warn ? '#e0ab4a' : '#8aa0b8';
  }

  if (!el) return;
  const port = parseInt(portEl && portEl.value, 10) || 0;
  const secure = !!(secEl && secEl.checked);
  let msg = '', color = '';
  if (port === 465 && !secure) {
    msg = '⚠ Cổng 465 cần "TLS ngay" — hãy tick ô trên (hoặc đổi cổng 587).';
    color = '#e0ab4a';
  } else if (port && port !== 465 && secure) {
    msg = `⚠ Cổng ${port} dùng STARTTLS, KHÔNG bật "TLS ngay" — hãy bỏ tick (hoặc đổi cổng 465).`;
    color = '#e0ab4a';
  } else if (port === 465) {
    msg = '✓ Cổng 465 + TLS ngay (implicit TLS).';
    color = '#45c07d';
  } else if (port) {
    msg = `✓ Cổng ${port} + STARTTLS (tự nâng cấp sau khi kết nối).`;
    color = '#45c07d';
  }
  el.textContent = msg;
  el.style.color = color;
}

function saveSettings() {
  const maxOnline = document.getElementById('setMaxOnline').value.trim();
  const retention = document.getElementById('setRetention').value.trim();
  const creditEnabled = document.getElementById('setCreditEnabled');
  const creditCost = document.getElementById('setCreditCost').value.trim();
  const creditBonus = document.getElementById('setCreditSignupBonus').value.trim();
  const creditNeg = document.getElementById('setCreditAllowNegative');

  // Ô số bỏ trống = giữ nguyên giá trị cũ, KHÔNG gửi (server coi chuỗi rỗng là
  // không đổi). Gửi chuỗi rỗng trước đây làm server trả 400 → cả form không lưu
  // và checkbox credit_enabled trông như "không lưu được".
  const settings = {
    max_online_resolve: maxOnline,
    lookup_history_retention_days: retention,
    credit_enabled: creditEnabled && creditEnabled.checked ? '1' : '0',
    credit_allow_negative: creditNeg && creditNeg.checked ? '1' : '0'
  };
  // Bật/đóng website: CHỈ gửi khi loadSettings đã nạp trạng thái thật. Trước khi
  // nạp xong, checkbox mặc định có thể chưa đúng — gửi '0' sẽ ĐÓNG website ngoài
  // ý muốn (từng gặp khi bấm Lưu ngay sau khi trang vừa tải/đang restart).
  // Message gửi CẢ KHI RỖNG (rỗng = dùng thông báo mặc định, không phải "giữ nguyên").
  const siteOpen = document.getElementById('setSiteOpen');
  const siteMsg = document.getElementById('setSiteClosedMessage');
  // Đóng website ảnh hưởng toàn bộ người dùng → xác nhận trước khi lưu.
  if (siteOpen && siteOpen.dataset.siteLoaded === '1'
    && siteOpen.dataset.wasOpen === '1' && !siteOpen.checked) {
    if (!window.confirm('Đóng website? Toàn bộ người dùng sẽ thấy trang bảo trì cho tới khi bạn mở lại.')) {
      return;
    }
  }
  if (siteOpen && siteOpen.dataset.siteLoaded === '1') {
    settings.site_open = siteOpen.checked ? '1' : '0';
  }
  if (siteMsg && siteMsg.dataset.siteLoaded === '1') {
    settings.site_closed_message = siteMsg.value.trim();
  }
  const googleMax = document.getElementById('setGoogleMax') ? document.getElementById('setGoogleMax').value.trim() : '';
  if (googleMax !== '') settings.max_google_per_batch = googleMax;
  if (creditCost !== '') settings.credit_cost_per_lookup = creditCost;
  if (creditBonus !== '') settings.credit_signup_bonus = creditBonus;
  collectPayosSettings(settings);
  collectAnalyticsSettings(settings);
  // Ô trống = "giữ nguyên" cho các setting cũ; riêng ga_* admin có thể chủ động XOÁ
  // Measurement/Property nên vẫn gửi chuỗi rỗng để server ghi đè. site_closed_message
  // cũng vậy: rỗng = quay về thông báo bảo trì mặc định.
  Object.keys(settings).forEach(k => {
    if (settings[k] === '' && !String(k).startsWith('ga_') && k !== 'site_closed_message') delete settings[k];
  });

  Auth.fetch('/api/settings', {
    method: 'PUT',
    // BẮT BUỘC: thiếu Content-Type thì express.json() không parse body →
    // server nhận req.body = {} → ghi 0 key nhưng vẫn trả 200 → form "không
    // lưu được" (toggle tự bật lại về giá trị cũ sau khi reload).
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings })
  }).then(async r => {
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Lỗi lưu cấu hình');
    if (d.settings) {
      document.getElementById('setMaxOnline').value = d.settings.max_online_resolve ?? '';
      document.getElementById('setRetention').value = d.settings.lookup_history_retention_days ?? '';
      if (creditEnabled) creditEnabled.checked = String(d.settings.credit_enabled) === '1';
      document.getElementById('setCreditCost').value = d.settings.credit_cost_per_lookup ?? '';
      document.getElementById('setCreditSignupBonus').value = d.settings.credit_signup_bonus ?? '';
      if (creditNeg) creditNeg.checked = String(d.settings.credit_allow_negative) === '1';
    }
    const on = String(d.settings && d.settings.credit_enabled) === '1';
    // Nạp lại toàn bộ form từ giá trị server đã chuẩn hoá (gồm cả payOS: secret
    // quay về bản che), tránh UI lệch trạng thái thật trong DB sau khi lưu.
    loadSettings();
    showToast('Đã lưu cấu hình — tính điểm tra cứu: ' + (on ? 'BẬT' : 'TẮT'), 'success');
  }).catch(e => { showToast(e.message, 'error'); loadSettings(); });
}

// ========================
// Bật/đóng website (bảo trì)
// ========================
/** Cập nhật banner Dashboard theo trạng thái website hiện tại. */
function refreshSiteBanner() {
  const banner = document.getElementById('dashSiteBanner');
  if (!banner) return;
  Auth.fetch('/api/site/status').then(r => r.json()).then(s => {
    const closed = !!s.closed;
    banner.style.display = closed ? '' : 'none';
    const msg = document.getElementById('dashSiteBannerMsg');
    if (msg) {
      msg.textContent = closed
        ? (s.message || 'Website đang đóng để bảo trì. Người dùng chỉ thấy trang thông báo bảo trì.')
        : '';
    }
  }).catch(() => { banner.style.display = 'none'; });
}

/** Mở Cấu hình → tab Website (bật/tắt + thông báo bảo trì). */
function openSiteSettings() {
  switchSection('settings');
  switchSettingsTab('site');
}

/** Mở lại website ngay từ banner Dashboard. */
function quickReopenSite() {
  Auth.fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings: { site_open: '1' } })
  }).then(async r => {
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Không mở lại được website');
    showToast('Đã mở lại website', 'success');
    refreshSiteBanner();
    loadSettings();
  }).catch(e => showToast(e.message, 'error'));
}

// Thu thập field payOS từ form vào object settings. Tách riêng để saveSettings
// gọn và không lệch cấu trúc khi thêm field mới.
// Secret: chỉ gửi khi admin gõ nội dung — ô trống = giữ nguyên (server cũng bỏ
// qua bản che ••••). Toggle luôn gửi để bật/tắt được.
function collectPayosSettings(settings) {
  const get = id => document.getElementById(id);
  const pe = get('setPayosEnabled'), pt = get('setPayosTestMode');
  const pc = get('setPayosClientId'), pak = get('setPayosApiKey'), pck = get('setPayosChecksumKey');
  const pbu = get('setPayosBaseUrl'), pwu = get('setPayosWebhookUrl'), pbase = get('setPublicBaseUrl');
  const vpc = get('setVndPerCredit'), tmin = get('setTopupMin'), tmax = get('setTopupMax');

  if (pe) settings.payos_enabled = pe.checked ? '1' : '0';
  if (pt) settings.payos_test_mode = pt.checked ? '1' : '0';
  if (pc) settings.payos_client_id = pc.value.trim();
  if (pbu) settings.payos_base_url = pbu.value.trim();
  if (pwu) settings.payos_webhook_url = pwu.value.trim();
  if (pbase) settings.public_base_url = pbase.value.trim();
  const pushIfSet = (el, key) => { if (el && el.value.trim() !== '') settings[key] = el.value.trim(); };
  pushIfSet(pak, 'payos_api_key');
  pushIfSet(pck, 'payos_checksum_key');
  pushIfSet(vpc, 'topup_vnd_per_credit');
  pushIfSet(tmin, 'topup_min_vnd');
  pushIfSet(tmax, 'topup_max_vnd');

  // SMTP: toggle + field chuỗi luôn gửi; port gửi khi có; pass chỉ gửi khi admin gõ.
  const sen = get('setSmtpEnabled'), sh = get('setSmtpHost'), sp2 = get('setSmtpPort');
  const ssc = get('setSmtpSecure'), su = get('setSmtpUser'), spw = get('setSmtpPass');
  const sf = get('setSmtpFrom'), sfn = get('setSmtpFromName');
  if (sen) settings.smtp_enabled = sen.checked ? '1' : '0';
  if (ssc) settings.smtp_secure = ssc.checked ? '1' : '0';
  if (sh) settings.smtp_host = sh.value.trim();
  if (su) settings.smtp_user = su.value.trim();
  if (sf) settings.smtp_from = sf.value.trim();
  if (sfn) settings.smtp_from_name = sfn.value.trim();
  pushIfSet(sp2, 'smtp_port');
  pushIfSet(spw, 'smtp_pass');
}

// Gửi email thử để admin kiểm tra cấu hình SMTP (server đọc config trực tiếp).
function sendSmtpTest() {
  const el = document.getElementById('smtpTestTo');
  const to = el ? el.value.trim() : '';
  if (!to) { showToast('Nhập email nhận thử trước', 'error'); return; }
  Auth.fetch('/api/admin/smtp/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to })
  }).then(async r => {
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Gửi thử thất bại');
    showToast('Đã gửi email thử tới ' + to, 'success');
  }).catch(e => showToast(e.message, 'error'));
}

// ========================
// Nạp điểm (payOS)
// ========================
let payPg = 1, payTotalPages = 1, payIsTestMode = false;
const PAY_STATUS_LABELS = {
  PENDING: 'Chờ thanh toán', PAID: 'Đã thanh toán', CANCELLED: 'Đã huỷ',
  EXPIRED: 'Hết hạn', UNDERPAID: 'Trả thiếu', FAILED: 'Thất bại'
};

function fmtVnd(n) {
  return Number(n || 0).toLocaleString('vi-VN') + 'đ';
}
function fmtNum(n) {
  const v = Number(n || 0);
  return Number.isInteger(v) ? v.toLocaleString('vi-VN') : v.toFixed(2);
}
function escAttr(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function loadPayments() {
  loadPayStats();
  loadPackages();
  loadPayOrders(1);
  loadPayosStatus();
}

async function loadPayStats() {
  try {
    const r = await Auth.fetch('/api/admin/payments/stats?days=30');
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Lỗi thống kê');
    const t = d.topup || {}, u = d.usage || {}, sys = d.system || {};
    document.getElementById('payRevenue').textContent = fmtVnd(t.revenue_vnd);
    document.getElementById('payCreditsGranted').textContent = fmtNum(t.credits_granted);
    document.getElementById('payPaidOrders').textContent = fmtNum(t.paid_orders);
    document.getElementById('payPendingOrders').textContent = fmtNum(t.pending_orders);
    document.getElementById('payConversion').textContent = fmtNum(t.conversion_rate) + '%';
    document.getElementById('payCreditsUsed').textContent = fmtNum(u.credits_used);
    document.getElementById('payLookups').textContent = fmtNum(u.lookups);
    document.getElementById('payRemaining').textContent = fmtNum(sys.credits_remaining);

    const daily = d.revenue_daily || [];
    const dailyEl = document.getElementById('payDaily');
    if (!daily.length) { dailyEl.classList.remove('loading'); dailyEl.innerHTML = '<span class="muted-text">Chưa có doanh thu trong 30 ngày qua.</span>'; }
    else {
      const max = Math.max.apply(null, daily.map(x => Number(x.vnd) || 0)) || 1;
      dailyEl.classList.remove('loading');
      dailyEl.innerHTML = daily.map(x => {
        const pct = Math.round(((Number(x.vnd) || 0) / max) * 100);
        return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:12px">
          <span class="muted-text" style="width:86px;flex:none">${escAttr(x.day)}</span>
          <span style="flex:1;background:var(--bg-page,#f1f3f9);border-radius:4px;height:14px;overflow:hidden">
            <span style="display:block;height:100%;width:${pct}%;background:#3b82f6"></span>
          </span>
          <span style="width:110px;text-align:right;flex:none">${fmtVnd(x.vnd)}</span>
          <span class="muted-text" style="width:70px;text-align:right;flex:none">${fmtNum(x.orders)} đơn</span>
        </div>`;
      }).join('');
    }

    const topTopup = d.top_topup_users || [], topUsage = d.top_usage_users || [];
    const topEl = document.getElementById('payTop');
    topEl.classList.remove('loading');
    const renderTop = (rows, valueKey, label) => rows.length
      ? rows.map((r, i) => `<tr><td>${i + 1}</td><td>${escAttr(r.username || ('#' + r.user_id))}</td><td>${fmtNum(r[valueKey])} ${label}</td><td>${fmtNum(r.orders || r.lookups)}</td></tr>`).join('')
      : `<tr><td colspan="4" class="muted-text">Chưa có dữ liệu.</td></tr>`;
    topEl.innerHTML = `
      <div style="display:flex;gap:20px;flex-wrap:wrap">
        <div style="flex:1;min-width:260px">
          <b style="font-size:13px">Nạp nhiều nhất</b>
          <table class="table-sm" style="width:100%;margin-top:6px"><thead><tr><th>#</th><th>User</th><th>Điểm nạp</th><th>Đơn</th></tr></thead>
          <tbody>${renderTop(topTopup, 'credits', 'điểm')}</tbody></table>
        </div>
        <div style="flex:1;min-width:260px">
          <b style="font-size:13px">Dùng nhiều nhất</b>
          <table class="table-sm" style="width:100%;margin-top:6px"><thead><tr><th>#</th><th>User</th><th>Điểm dùng</th><th>Lượt</th></tr></thead>
          <tbody>${renderTop(topUsage, 'credits_used', 'điểm')}</tbody></table>
        </div>
      </div>`;
  } catch (e) {
    document.getElementById('payDaily').innerHTML = '<span class="muted-text">Lỗi: ' + escAttr(e.message) + '</span>';
  }
}

async function loadPayosStatus() {
  try {
    const r = await Auth.fetch('/api/admin/payos/webhook-url');
    const d = await r.json();
    const el = document.getElementById('setPayosWebhookHint');
    if (el) el.innerHTML = d.webhook_url ? `URL webhook hiện tại: <b>${escAttr(d.webhook_url)}</b>` : 'Chưa xác định được URL webhook.';
  } catch (e) { /* không chặn UI */ }
}

// ========================
// Gói nạp (admin CRUD)
// ========================
async function loadPackages() {
  const el = document.getElementById('pkgList');
  try {
    const r = await Auth.fetch('/api/admin/topup/packages');
    const rows = await r.json();
    if (!r.ok) throw new Error(rows.error || 'Lỗi tải gói nạp');
    el.classList.remove('loading');
    window.__pkgs = rows;
    if (!rows.length) { el.innerHTML = '<span class="muted-text">Chưa có gói nạp nào.</span>'; return; }
    el.innerHTML = `<div style="overflow-x:auto"><table class="table-sm" style="width:100%">
      <thead><tr><th>Nhãn</th><th>Số tiền</th><th>Điểm</th><th>Thứ tự</th><th>Trạng thái</th><th>Đơn đã dùng</th><th></th></tr></thead>
      <tbody>${rows.map(p => `<tr>
        <td>${escAttr(p.label || '(không nhãn)')}</td>
        <td>${fmtVnd(p.amount_vnd)}</td>
        <td>${fmtNum(p.credits)}</td>
        <td>${fmtNum(p.sort_order)}</td>
        <td><span class="badge ${p.active ? 'badge-active' : 'badge-admin'}">${p.active ? 'Đang bật' : 'Đã tắt'}</span></td>
        <td>${fmtNum(p.order_count)}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-sm" onclick="pkgOpenEdit(${p.id})" title="Sửa"><i class="fas fa-pen"></i></button>
          <button class="btn btn-sm" onclick="pkgToggle(${p.id}, ${p.active ? 0 : 1})" title="${p.active ? 'Tắt' : 'Bật'}"><i class="fas fa-power-off"></i></button>
          <button class="btn btn-sm btn-danger" onclick="pkgDelete(${p.id})" title="Xoá"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`).join('')}</tbody></table></div>`;
  } catch (e) { el.classList.remove('loading'); el.innerHTML = '<span class="muted-text">Lỗi: ' + escAttr(e.message) + '</span>'; }
}

function pkgPromptForm(pkg) {
  const label = prompt('Nhãn gói nạp (vd: Gói 50.000đ):', pkg ? (pkg.label || '') : '');
  if (label === null) return null;
  const amount = prompt('Số tiền (VND):', pkg ? String(pkg.amount_vnd) : '50000');
  if (amount === null) return null;
  const creditsStr = prompt('Số điểm nhận được:', pkg ? String(pkg.credits) : '50');
  if (creditsStr === null) return null;
  const sort = prompt('Thứ tự hiển thị (số nhỏ hiện trước):', pkg ? String(pkg.sort_order) : '10');
  if (sort === null) return null;
  return { label, amount_vnd: amount, credits: creditsStr, sort_order: sort, active: pkg ? pkg.active : 1 };
}

function pkgOpenCreate() {
  const body = pkgPromptForm(null);
  if (!body) return;
  Auth.fetch('/api/admin/topup/packages', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }).then(async r => {
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Lỗi thêm gói');
    showToast('Đã thêm gói nạp', 'success');
    loadPackages();
  }).catch(e => showToast(e.message, 'error'));
}

function pkgOpenEdit(id) {
  const pkg = (window.__pkgs || []).find(p => p.id === id);
  if (!pkg) return;
  const body = pkgPromptForm(pkg);
  if (!body) return;
  Auth.fetch('/api/admin/topup/packages/' + id, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }).then(async r => {
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Lỗi sửa gói');
    showToast('Đã cập nhật gói nạp', 'success');
    loadPackages();
  }).catch(e => showToast(e.message, 'error'));
}

function pkgToggle(id, active) {
  const pkg = (window.__pkgs || []).find(p => p.id === id);
  if (!pkg) return;
  Auth.fetch('/api/admin/topup/packages/' + id, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      label: pkg.label, amount_vnd: pkg.amount_vnd, credits: pkg.credits,
      sort_order: pkg.sort_order, active
    })
  }).then(async r => {
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Lỗi đổi trạng thái');
    showToast(active ? 'Đã bật gói nạp' : 'Đã tắt gói nạp', 'success');
    loadPackages();
  }).catch(e => showToast(e.message, 'error'));
}

function pkgDelete(id) {
  if (!confirm('Xoá gói nạp này? Gói đã có đơn sẽ chỉ bị tắt thay vì xoá hẳn.')) return;
  Auth.fetch('/api/admin/topup/packages/' + id, { method: 'DELETE' })
    .then(async r => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Lỗi xoá gói');
      showToast(d.soft ? 'Gói đã có đơn → chuyển sang trạng thái tắt' : 'Đã xoá gói nạp', 'success');
      loadPackages();
    }).catch(e => showToast(e.message, 'error'));
}

// ========================
// Đơn nạp (admin)
// ========================
const PAY_PAGE_SIZE = 50;

async function loadPayOrders(page) {
  page = Math.max(1, parseInt(page, 10) || 1);
  payPg = page;
  const loading = document.getElementById('payLoading');
  const table = document.getElementById('payTable');
  const empty = document.getElementById('payEmpty');
  loading.hidden = false;
  try {
    const p = new URLSearchParams();
    p.set('limit', PAY_PAGE_SIZE);
    p.set('offset', (page - 1) * PAY_PAGE_SIZE);
    const st = document.getElementById('payStatus').value;
    const q = document.getElementById('payQ').value.trim();
    const from = document.getElementById('payFrom').value;
    const to = document.getElementById('payTo').value;
    if (st) p.set('status', st);
    if (q) p.set('q', q);
    if (from) p.set('from', from);
    if (to) p.set('to', to + ' 23:59:59');

    const r = await Auth.fetch('/api/admin/payments?' + p.toString());
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Lỗi tải đơn nạp');
    const rows = d.data || [];
    payTotalPages = d.totalPages || 1;

    loading.hidden = true;
    if (!rows.length) { table.hidden = true; empty.hidden = false; document.getElementById('payPagerActions').hidden = true; return; }
    table.hidden = false; empty.hidden = true;

    document.getElementById('payBody').innerHTML = rows.map(o => {
      const pill = o.status === 'PAID' ? 'badge-active' : (o.status === 'PENDING' ? 'badge-pending' : 'badge-admin');
      const actions = [];
      if (o.status === 'PENDING') {
        actions.push(`<button class="btn btn-sm" onclick="paySync(${o.order_code})" title="Đồng bộ từ payOS"><i class="fas fa-rotate"></i></button>`);
        actions.push(`<button class="btn btn-sm btn-danger" onclick="payCancel(${o.order_code})" title="Huỷ đơn"><i class="fas fa-ban"></i></button>`);
        if (payIsTestMode) actions.push(`<button class="btn btn-sm btn-primary" onclick="payMockPaid(${o.order_code})" title="Giả lập đã trả tiền (test mode)"><i class="fas fa-flask"></i></button>`);
      }
      return `<tr>
        <td style="font-family:monospace">${o.order_code}</td>
        <td>${escAttr(o.username || ('#' + o.user_id))}</td>
        <td>${fmtVnd(o.amount_vnd)}</td>
        <td>${fmtNum(o.credits)}</td>
        <td><span class="badge ${pill}">${PAY_STATUS_LABELS[o.status] || o.status}</span></td>
        <td class="muted-text" style="white-space:nowrap">${fmtAdminDate(o.created_at)}</td>
        <td class="muted-text" style="white-space:nowrap">${o.paid_at ? fmtAdminDate(o.paid_at) : '—'}</td>
        <td style="white-space:nowrap">${actions.join(' ')}</td>
      </tr>`;
    }).join('');

    document.getElementById('payPagerActions').hidden = false;
    document.getElementById('payPrev').disabled = page <= 1;
    document.getElementById('payNext').disabled = page >= payTotalPages;
    document.getElementById('payPageInfo').textContent = `Trang ${page}/${payTotalPages} · ${d.total} đơn`;
  } catch (e) {
    loading.hidden = true;
    empty.hidden = false;
    empty.textContent = 'Lỗi: ' + e.message;
  }
}

/** SQLite CURRENT_TIMESTAMP là UTC → hiển thị theo giờ máy. */
function fmtAdminDate(s) {
  if (!s) return '—';
  const d = new Date(String(s).replace(' ', 'T') + 'Z');
  if (isNaN(d)) return s;
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function paySync(code) {
  Auth.fetch(`/api/admin/payments/${code}/sync`, { method: 'POST' })
    .then(async r => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Đồng bộ thất bại');
      showToast(`Đồng bộ xong — trạng thái: ${PAY_STATUS_LABELS[d.status] || d.status}`, 'success');
      loadPayments();
    }).catch(e => showToast(e.message, 'error'));
}

function payCancel(code) {
  const reason = prompt('Lý do huỷ đơn #' + code + ':', 'Admin huỷ');
  if (reason === null) return;
  Auth.fetch(`/api/admin/payments/${code}/cancel`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason })
  }).then(async r => {
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Huỷ thất bại');
    showToast('Đã huỷ đơn nạp', 'success');
    loadPayments();
  }).catch(e => showToast(e.message, 'error'));
}

function payMockPaid(code) {
  if (!confirm('Giả lập đơn #' + code + ' đã được thanh toán và cộng điểm? (chỉ dùng ở chế độ test)')) return;
  Auth.fetch(`/api/admin/payments/${code}/mock-paid`, { method: 'POST' })
    .then(async r => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Giả lập thất bại');
      showToast('Đã giả lập thanh toán — đơn chuyển sang PAID', 'success');
      loadPayments();
    }).catch(e => showToast(e.message, 'error'));
}

// ========================
// payOS — kiểm tra & đăng ký webhook
// ========================
function turnupCheckWebhook() {
  Auth.fetch('/api/admin/payos/webhook-url')
    .then(r => r.json())
    .then(d => {
      const el = document.getElementById('setPayosStatus');
      el.innerHTML = d.error
        ? 'Lỗi: ' + escAttr(d.error)
        : `Webhook URL: <b>${escAttr(d.webhook_url || '(chưa xác định)')}</b><br>Base URL: ${escAttr(d.base_url || '(chưa xác định)')}`;
    }).catch(e => showToast(e.message, 'error'));
}

function turnupConfirmWebhook() {
  Auth.fetch('/api/admin/payos/confirm-webhook', { method: 'POST' })
    .then(async r => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Đăng ký webhook thất bại');
      document.getElementById('setPayosStatus').innerHTML = `Đã đăng ký webhook: <b>${escAttr(d.webhook_url)}</b>`;
      showToast('Đăng ký webhook thành công', 'success');
    }).catch(e => showToast(e.message, 'error'));
}

function turnupTestConnection() {
  Auth.fetch('/api/admin/payos/test', { method: 'POST' })
    .then(async r => {
      const d = await r.json().catch(() => ({}));
      const el = document.getElementById('setPayosStatus');
      const ok = !!d.ok;
      el.innerHTML = `${ok ? 'Kết nối OK' : 'Kết nối thất bại'} · base URL: <b>${escAttr(d.base_url || '')}</b>`
        + `${d.test_mode ? ' · chế độ test' : ''}${d.message ? ' · ' + escAttr(d.message) : ''}${d.error ? ' · ' + escAttr(d.error) : ''}`;
      showToast(ok ? 'Kết nối payOS OK' : ('Kết nối payOS thất bại' + (d.error ? ': ' + d.error : '')), ok ? 'success' : 'error');
    }).catch(e => showToast(e.message, 'error'));
}

// ========================
// Dashboard tổng quan — local + Google Analytics
// ========================
const DASH_DAYS = [7, 14, 28, 90];
let _dashChartJs = null;
const _dashCharts = { traffic: null, local: null };

function dashSavedDays() {
  const v = parseInt(localStorage.getItem('admin_dash_days'), 10);
  return DASH_DAYS.includes(v) ? v : 28;
}

/** Nạp Chart.js theo nhu cầu (không chặn dashboard nếu CDN lỗi). */
function ensureChartJs() {
  if (window.Chart) return Promise.resolve(window.Chart);
  if (_dashChartJs) return _dashChartJs;
  _dashChartJs = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js';
    s.async = true;
    const timer = setTimeout(() => reject(new Error('Chart.js timeout')), 6000);
    s.onload = () => { clearTimeout(timer); resolve(window.Chart); };
    s.onerror = () => { clearTimeout(timer); reject(new Error('Chart.js load failed')); };
    document.head.appendChild(s);
  }).catch((e) => { _dashChartJs = null; throw e; });
  return _dashChartJs;
}

function destroyDashCharts(which) {
  const keys = which ? [which] : Object.keys(_dashCharts);
  keys.forEach(k => {
    if (_dashCharts[k]) { try { _dashCharts[k].destroy(); } catch (e) {} _dashCharts[k] = null; }
  });
}

function chartTheme() {
  const cs = getComputedStyle(document.documentElement);
  return {
    text: cs.getPropertyValue('--text-muted').trim() || '#888899',
    grid: cs.getPropertyValue('--border-color').trim() || 'rgba(0,0,0,0.1)'
  };
}

function chartOptions(extra) {
  const t = chartTheme();
  return Object.assign({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: t.text, boxWidth: 10, usePointStyle: true, font: { size: 11 } } },
      tooltip: { backgroundColor: 'rgba(20,20,40,0.92)', padding: 10, cornerRadius: 8 }
    },
    scales: {
      x: { ticks: { color: t.text, maxTicksLimit: 8, font: { size: 10 } }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color: t.text, font: { size: 10 }, precision: 0 }, grid: { color: t.grid } }
    }
  }, extra || {});
}

function fmtCompact(n) {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1e6) return (v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + 'M';
  if (Math.abs(v) >= 1e4) return (v / 1e3).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + 'K';
  return fmtNum(v);
}

function fmtDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  return m + ':' + String(s % 60).padStart(2, '0');
}

function fmtPct(n) {
  return (Number(n || 0) * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + '%';
}

function fmtRate(n) {
  return (Number(n || 0) * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + '%';
}

function fmtDateTime(v) {
  if (!v) return '—';
  let d;
  if (v instanceof Date) d = v;
  else {
    const s = String(v);
    // SQLite CURRENT_TIMESTAMP là UTC nhưng không kèm 'Z' → thêm vào trước khi parse.
    const iso = /Z|[+-]\d\d:\d\d$/.test(s) ? s : s.replace(' ', 'T') + 'Z';
    d = new Date(iso);
  }
  if (!Number.isFinite(d.getTime())) return String(v).replace('T', ' ').slice(0, 16);
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function deltaClass(pct, invert) {
  if (pct == null || !Number.isFinite(pct)) return 'flat';
  if (pct === 0) return 'flat';
  const positive = pct > 0;
  const good = invert ? !positive : positive;
  return good ? 'up' : 'down';
}

function applyDelta(id, current, previous, invert) {
  const el = document.getElementById(id);
  if (!el) return;
  const cur = Number(current) || 0;
  const prev = previous == null ? null : Number(previous);
  let pct = null;
  if (prev != null && prev !== 0) pct = Math.round(((cur - prev) / prev) * 1000) / 10;
  else if (prev === 0) pct = cur > 0 ? null : 0;
  if (prev === 0 && cur > 0) {
    el.className = 'kpi-delta ' + (invert ? 'down' : 'up');
    el.textContent = 'mới';
    return;
  }
  if (pct == null) {
    el.className = 'kpi-delta flat';
    el.textContent = '—';
    return;
  }
  el.className = 'kpi-delta ' + deltaClass(pct, invert);
  el.textContent = (pct > 0 ? '+' : '') + pct.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + '%';
}

function applyRateDelta(id, current, previous, invert) {
  const el = document.getElementById(id);
  if (!el) return;
  if (previous == null) { el.className = 'kpi-delta flat'; el.textContent = '—'; return; }
  const diff = Math.round(((Number(current) || 0) - (Number(previous) || 0)) * 1000) / 10;
  el.className = 'kpi-delta ' + deltaClass(diff, invert);
  el.textContent = (diff > 0 ? '+' : '') + diff.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' điểm %';
}

function renderBreakdownList(el, items, opts) {
  if (!el) return;
  const o = opts || {};
  if (!items || !items.length) {
    el.classList.remove('loading');
    el.innerHTML = `<div class="breakdown-empty">${esc(o.empty || 'Chưa có dữ liệu')}</div>`;
    return;
  }
  const max = Math.max.apply(null, items.map(it => Math.abs(Number(it.value) || 0))) || 1;
  el.classList.remove('loading');
  el.innerHTML = `<div class="breakdown-list">${items.map(it => {
    const pct = Math.max(2, Math.round((Math.abs(Number(it.value) || 0) / max) * 100));
    return `<div class="breakdown-row">
      <span class="br-label" title="${escAttr(it.label)}">${esc(it.label)}</span>
      <span class="br-val">${esc(it.display != null ? it.display : fmtNum(it.value))}${o.unit ? ' ' + esc(o.unit) : ''}</span>
      <span class="breakdown-bar"><span style="width:${pct}%"></span></span>
    </div>`;
  }).join('')}</div>`;
}

const DONUT_COLORS = ['#4444cc', '#3d7ce0', '#2f9e5f', '#f0a020', '#e0619b', '#8b5cf6'];

function renderDonut(el, items) {
  if (!el) return;
  const list = (items || []).filter(it => (Number(it.value) || 0) > 0).slice(0, 6);
  if (!list.length) {
    el.classList.remove('loading');
    el.innerHTML = '<div class="breakdown-empty">Chưa có dữ liệu</div>';
    return;
  }
  const total = list.reduce((sum, it) => sum + (Number(it.value) || 0), 0) || 1;
  let acc = 0;
  const stops = list.map((it, i) => {
    const from = (acc / total) * 360;
    acc += Number(it.value) || 0;
    const to = (acc / total) * 360;
    return `${DONUT_COLORS[i % DONUT_COLORS.length]} ${from}deg ${to}deg`;
  }).join(', ');
  el.classList.remove('loading');
  el.innerHTML = `<div class="donut-wrap">
    <div class="donut" style="background:conic-gradient(${stops})"></div>
    <div class="donut-legend">${list.map((it, i) => `<div><span class="dot" style="background:${DONUT_COLORS[i % DONUT_COLORS.length]}"></span>${esc(it.label)} <b>${fmtCompact(it.value)}</b></div>`).join('')}</div>
  </div>`;
}

async function dashFetchJson(url) {
  const res = await Auth.fetch(url);
  let data = null;
  try { data = await res.json(); } catch (e) { data = { error: 'Phản hồi không phải JSON' }; }
  return { ok: res.ok, data };
}

async function loadDashboard(opts = {}) {
  const sel = document.getElementById('dashRange');
  if (!sel) return;
  const days = DASH_DAYS.includes(parseInt(sel.value, 10)) ? parseInt(sel.value, 10) : dashSavedDays();
  sel.value = String(days);
  try { localStorage.setItem('admin_dash_days', String(days)); } catch (e) {}

  setText('dashUpdated', 'Đang tải…');
  setText('dashLocalRange', `${days} ngày gần nhất`);
  setText('dashTrafficRange', `${days} ngày gần nhất`);
  const refresh = opts && opts.refresh ? '&refresh=1' : '';

  const [localRes, gaRes] = await Promise.allSettled([
    dashFetchJson(`/api/admin/dashboard?days=${days}${refresh}`),
    dashFetchJson(`/api/admin/analytics?days=${days}${refresh}`)
  ]);

  if (localRes.status === 'fulfilled') renderLocalDashboard(localRes.value);
  else renderLocalDashboard({ ok: false, data: { error: 'Không tải được số liệu website' } });

  if (gaRes.status === 'fulfilled') renderGaDashboard(gaRes.value);
  else renderGaDashboard({ ok: false, data: { error: 'Không tải được Google Analytics' } });

  setText('dashUpdated', 'Cập nhật ' + new Date().toLocaleTimeString('vi-VN'));
}

function renderLocalDashboard(res) {
  const d = res.data || {};
  if (!res.ok || d.error) {
    ['kpiUsers', 'kpiCells', 'kpiLookups', 'kpiRevenue', 'kpiCredits', 'kpiApi'].forEach(id => setText(id, '—'));
    ['kpiUsersSub', 'kpiCellsSub', 'kpiLookupsSub', 'kpiRevenueSub', 'kpiCreditsSub', 'kpiApiSub']
      .forEach(id => setText(id, d.error || 'Không tải được số liệu'));
    return;
  }
  const u = d.users || {}, l = d.lookups || {}, c = d.credits || {}, r = d.revenue || {}, a = d.api || {};

  setText('kpiUsers', fmtCompact(u.total));
  setText('kpiUsersSub', `${fmtCompact(u.new_in_window)} mới trong ${d.window_days} ngày · ${fmtCompact(u.active)} đang hoạt động`);
  applyDelta('kpiUsersDelta', u.new_in_window, u.new_previous);

  setText('kpiCells', fmtCompact(d.cells && d.cells.total));
  setText('kpiCellsSub', `+${fmtCompact(d.cells && d.cells.added_in_window)} thêm trong kỳ`);
  const cellsDelta = document.getElementById('kpiCellsDelta');
  if (cellsDelta) { cellsDelta.className = 'kpi-delta flat'; cellsDelta.textContent = 'tổng ' + fmtCompact(d.cells && d.cells.total); }

  setText('kpiLookups', fmtCompact(l.in_window));
  setText('kpiLookupsSub', `Tổng ${fmtCompact(l.total)} · hôm nay ${fmtCompact(l.today)} · tìm thấy ${fmtPct((l.found_rate || 0) / 100)}`);
  applyDelta('kpiLookupsDelta', l.in_window, l.previous);

  setText('kpiRevenue', fmtVnd(r.paid_vnd));
  setText('kpiRevenueSub', `${fmtNum(r.paid_orders)} đơn đã trả · ${fmtNum(r.pending_orders)} đang chờ`);
  applyDelta('kpiRevenueDelta', r.paid_vnd, r.previous_vnd);

  setText('kpiCredits', fmtNum(c.used_in_window));
  setText('kpiCreditsSub', `Còn lại ${fmtNum(c.remaining_total)} điểm`);
  applyDelta('kpiCreditsDelta', c.used_in_window, c.used_previous);

  setText('kpiApi', fmtNum(a.requests_24h));
  setText('kpiApiSub', `${fmtNum(a.errors_24h)} lỗi 24h · ${fmtNum(a.keys_active)}/${fmtNum(a.keys_total)} key hoạt động`);
  const apiDelta = document.getElementById('kpiApiDelta');
  if (apiDelta) {
    const errs = Number(a.errors_24h) || 0;
    apiDelta.className = 'kpi-delta ' + (errs > 0 ? 'down' : 'up');
    apiDelta.textContent = errs > 0 ? errs + ' lỗi' : 'ổn định';
  }

  renderBreakdownList(document.getElementById('dashTopUsers'),
    (l.top_users || []).map(x => ({ label: x.username, value: x.count, display: fmtNum(x.count) })),
    { unit: 'lượt', empty: 'Chưa có lượt tra cứu trong khoảng này' });

  renderDashboardActivity(d);
  renderDashboardHealth(d);
  renderLocalChart(d).catch(() => {});
}

async function renderLocalChart(d) {
  const canvas = document.getElementById('dashLocalChart');
  const empty = document.getElementById('dashLocalEmpty');
  if (!canvas || !empty) return;
  const series = (d.lookups && d.lookups.series) || [];
  const userSeries = (d.users && d.users.series) || [];
  const hasData = series.some(x => Number(x.count) > 0) || userSeries.some(x => Number(x.count) > 0);
  if (!hasData) {
    destroyDashCharts('local');
    canvas.style.display = 'none';
    empty.style.display = '';
    return;
  }
  let Chart;
  try { Chart = await ensureChartJs(); } catch (e) {
    destroyDashCharts('local');
    canvas.style.display = 'none';
    empty.style.display = '';
    empty.innerHTML = '<i class="fas fa-triangle-exclamation"></i>Không tải được thư viện biểu đồ — số liệu vẫn hiển thị ở trên.';
    return;
  }
  canvas.style.display = '';
  empty.style.display = 'none';
  const labels = series.map(x => x.date.slice(5).replace('-', '/'));
  const t = chartTheme();
  destroyDashCharts('local');
  _dashCharts.local = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Lượt tra cứu', data: series.map(x => x.count), backgroundColor: 'rgba(240,160,32,0.55)', borderRadius: 4, maxBarThickness: 18 },
        { label: 'User mới', data: userSeries.map(x => x.count), type: 'line', borderColor: '#3d7ce0', backgroundColor: 'rgba(61,124,224,0.12)', tension: 0.35, fill: true, pointRadius: 0, borderWidth: 2, yAxisID: 'y1' }
      ]
    },
    options: chartOptions({
      scales: {
        x: { ticks: { color: t.text, maxTicksLimit: 8, font: { size: 10 } }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: t.text, font: { size: 10 }, precision: 0 }, grid: { color: t.grid } },
        y1: { beginAtZero: true, position: 'right', grid: { display: false }, ticks: { color: t.text, font: { size: 10 }, precision: 0 } }
      }
    })
  });
}

function clearGaKpis() {
  ['gaRealtime', 'gaUsers', 'gaSessions', 'gaViews', 'gaEngagement', 'gaDuration', 'gaBounce'].forEach(id => setText(id, '—'));
  ['gaRealtimeDelta', 'gaUsersDelta', 'gaSessionsDelta', 'gaViewsDelta', 'gaEngagementDelta', 'gaDurationDelta', 'gaBounceDelta'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.className = 'kpi-delta flat'; el.textContent = '—'; }
  });
}

function clearGaBreakdowns() {
  ['dashTopPages', 'dashChannels', 'dashDevices', 'dashCountries'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('loading');
    el.innerHTML = '<div class="breakdown-empty">Chưa có dữ liệu Google Analytics</div>';
  });
}

function renderTrafficPlaceholder(text) {
  const canvas = document.getElementById('dashTrafficChart');
  const empty = document.getElementById('dashTrafficEmpty');
  destroyDashCharts('traffic');
  if (canvas) canvas.style.display = 'none';
  if (empty) {
    empty.style.display = '';
    empty.innerHTML = `<i class="fas fa-chart-area"></i>${esc(text || 'Chưa có dữ liệu Google Analytics.')}`;
  }
}

function renderGaDashboard(res) {
  const d = res.data || {};
  const badge = document.getElementById('dashGaBadge');
  const empty = document.getElementById('dashGaEmpty');
  const error = document.getElementById('dashGaError');
  const content = document.getElementById('dashGaContent');
  if (!badge || !empty || !error || !content) return;

  const showEmpty = (reason) => {
    badge.className = 'badge badge-pending';
    const trackingOnly = !!(d.tracking && d.tracking.measurement_id_valid);
    badge.textContent = reason === 'disabled' ? 'Đang tắt' : (trackingOnly ? 'Chỉ tracking' : 'Chưa cấu hình');
    empty.style.display = '';
    content.style.display = 'none';
    error.style.display = 'none';
    clearGaKpis();
    clearGaBreakdowns();
    renderTrafficPlaceholder('Chưa có dữ liệu Google Analytics.');
  };

  if (!res.ok && !d.configured) {
    // lỗi mạng/server trước khi có config
    badge.className = 'badge badge-admin';
    badge.textContent = 'Lỗi';
    error.style.display = '';
    error.innerHTML = `<b>Không tải được Google Analytics</b>${esc(d.error && (d.error.message || d.error) || 'Lỗi không xác định')}`;
    empty.style.display = 'none';
    content.style.display = 'none';
    clearGaKpis();
    clearGaBreakdowns();
    renderTrafficPlaceholder('Không tải được dữ liệu Google Analytics.');
    return;
  }

  if (!d.configured) {
    showEmpty(d.reason);
    if (empty) {
      empty.innerHTML = `<i class="fas fa-chart-line"></i>${esc(d.message || 'Chưa kết nối Google Analytics.')}
        <div style="margin-top:12px"><button class="btn btn-primary btn-sm" onclick="openGaSettings()"><i class="fas fa-gear"></i> Cấu hình ngay</button></div>`;
    }
    return;
  }

  if (!res.ok || d.error) {
    badge.className = 'badge badge-admin';
    badge.textContent = 'Lỗi kết nối';
    error.style.display = '';
    error.innerHTML = `<b>${esc((d.error && d.error.code) || 'api_error')}</b>${esc((d.error && d.error.message) || 'Không đọc được số liệu Google Analytics')}
      ${d.error && d.error.hint ? `<div style="margin-top:4px">${esc(d.error.hint)}</div>` : ''}
      <div style="margin-top:8px"><button class="btn btn-sm" onclick="loadDashboard({refresh:true})"><i class="fas fa-rotate"></i> Thử lại</button>
      <button class="btn btn-sm" onclick="openGaSettings()"><i class="fas fa-gear"></i> Kiểm tra cấu hình</button></div>`;
    empty.style.display = 'none';
    content.style.display = 'none';
    clearGaKpis();
    clearGaBreakdowns();
    renderTrafficPlaceholder('Không tải được dữ liệu Google Analytics.');
    return;
  }

  badge.className = 'badge ' + (d.tracking && d.tracking.measurement_id_valid ? 'badge-active' : 'badge-pending');
  badge.textContent = d.tracking && d.tracking.measurement_id_valid ? 'Đang hoạt động' : 'Chỉ báo cáo (chưa tracking)';
  empty.style.display = 'none';
  error.style.display = 'none';
  content.style.display = '';

  const t = d.totals || {}, p = d.previous || {};
  setText('gaRealtime', fmtNum(d.realtime && d.realtime.active_users));
  setText('gaRealtimeSub', '30 phút gần nhất');

  setText('gaUsers', fmtCompact(t.active_users));
  setText('gaUsersSub', `Tổng ${fmtCompact(t.total_users)} · mới ${fmtCompact(t.new_users)}`);
  applyDelta('gaUsersDelta', t.active_users, p.active_users);

  setText('gaSessions', fmtCompact(t.sessions));
  setText('gaSessionsSub', `${Number(t.sessions_per_user || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} phiên/người`);
  applyDelta('gaSessionsDelta', t.sessions, p.sessions);

  setText('gaViews', fmtCompact(t.page_views));
  setText('gaViewsSub', `${fmtCompact(t.event_count)} sự kiện`);
  applyDelta('gaViewsDelta', t.page_views, p.page_views);

  setText('gaEngagement', fmtRate(t.engagement_rate));
  setText('gaEngagementSub', `${fmtCompact(t.engaged_sessions)} phiên tương tác`);
  applyRateDelta('gaEngagementDelta', t.engagement_rate, p.engagement_rate);

  setText('gaDuration', fmtDuration(t.avg_session_seconds));
  setText('gaDurationSub', 'thời lượng mỗi phiên');
  applyDelta('gaDurationDelta', t.avg_session_seconds, p.avg_session_seconds);

  setText('gaBounce', fmtRate(t.bounce_rate));
  setText('gaBounceSub', 'càng thấp càng tốt');
  applyRateDelta('gaBounceDelta', t.bounce_rate, p.bounce_rate, true);

  renderBreakdownList(document.getElementById('dashTopPages'),
    (d.top_pages || []).map(x => ({ label: x.path || '/', value: x.page_views, display: fmtNum(x.page_views) })),
    { unit: 'xem', empty: 'Chưa có trang nào được xem trong khoảng này' });

  renderBreakdownList(document.getElementById('dashChannels'),
    (d.channels || []).map(x => ({ label: x.channel || '(không rõ)', value: x.sessions, display: fmtNum(x.sessions) })),
    { unit: 'phiên', empty: 'Chưa có dữ liệu nguồn truy cập' });

  renderDonut(document.getElementById('dashDevices'),
    (d.devices || []).map(x => ({ label: x.device || '(khác)', value: x.sessions })));

  renderBreakdownList(document.getElementById('dashCountries'),
    (d.countries || []).map(x => ({ label: x.country || '(không rõ)', value: x.users, display: fmtNum(x.users) })),
    { unit: 'người', empty: 'Chưa có dữ liệu quốc gia' });

  renderTrafficChart(d.series || []).catch(() => {});
}

async function renderTrafficChart(series) {
  const canvas = document.getElementById('dashTrafficChart');
  const empty = document.getElementById('dashTrafficEmpty');
  if (!canvas || !empty) return;
  const hasData = series.some(x => Number(x.users) > 0 || Number(x.sessions) > 0 || Number(x.page_views) > 0);
  if (!hasData) {
    destroyDashCharts('traffic');
    canvas.style.display = 'none';
    empty.style.display = '';
    return;
  }
  let Chart;
  try { Chart = await ensureChartJs(); } catch (e) {
    destroyDashCharts('traffic');
    canvas.style.display = 'none';
    empty.style.display = '';
    empty.innerHTML = '<i class="fas fa-triangle-exclamation"></i>Không tải được thư viện biểu đồ — số liệu vẫn hiển thị ở trên.';
    return;
  }
  canvas.style.display = '';
  empty.style.display = 'none';
  const labels = series.map(x => x.date.slice(5).replace('-', '/'));
  const t = chartTheme();
  destroyDashCharts('traffic');
  _dashCharts.traffic = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Phiên', data: series.map(x => x.sessions), borderColor: '#4444cc', backgroundColor: 'rgba(68,68,204,0.14)', fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2 },
        { label: 'Người dùng', data: series.map(x => x.users), borderColor: '#2f9e5f', backgroundColor: 'rgba(47,158,95,0.10)', fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2 },
        { label: 'Lượt xem', data: series.map(x => x.page_views), borderColor: '#f0a020', backgroundColor: 'rgba(240,160,32,0.08)', fill: false, tension: 0.35, pointRadius: 0, borderWidth: 2, borderDash: [4, 3] }
      ]
    },
    options: chartOptions({ scales: {
      x: { ticks: { color: t.text, maxTicksLimit: 8, font: { size: 10 } }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color: t.text, font: { size: 10 }, precision: 0 }, grid: { color: t.grid } }
    } })
  });
}

function renderDashboardActivity(d) {
  const el = document.getElementById('dashActivity');
  if (!el) return;
  const items = [];
  const ts = (v) => {
    const s = String(v || '');
    if (!s) return 0;
    const t = Date.parse(s.replace(' ', 'T') + (s.includes('Z') ? '' : 'Z'));
    return Number.isFinite(t) ? t : 0;
  };
  ((d.activity && d.activity.users) || []).forEach(u => items.push({
    at: ts(u.created_at), icon: 'fa-user-plus', title: 'Đăng ký: ' + (u.username || '#' + u.id),
    meta: `${u.email || 'chưa có email'} · ${u.role || 'user'}`
  }));
  ((d.activity && d.activity.payments) || []).forEach(p => items.push({
    at: ts(p.at), icon: 'fa-receipt', title: `Nạp #${p.order_code}: ${fmtVnd(p.amount_vnd)}`,
    meta: `${p.username || '—'} · ${PAY_STATUS_LABELS[p.status] || p.status}`
  }));
  ((d.activity && d.activity.lookup_batches) || []).forEach(b => items.push({
    at: ts(b.created_at), icon: 'fa-file-arrow-up', title: 'Tra file: ' + (b.file_name || b.batch_id),
    meta: `${b.username || '—'} · ${fmtNum(b.found_count)}/${fmtNum(b.cell_count)} cell`
  }));
  items.sort((a, b) => b.at - a.at);
  if (!items.length) {
    el.classList.remove('loading');
    el.innerHTML = '<div class="empty-state">Chưa có hoạt động nào.</div>';
    return;
  }
  el.classList.remove('loading');
  el.innerHTML = `<div class="activity-list">${items.slice(0, 8).map(it => `
    <div class="activity-item">
      <span class="ai-ico"><i class="fas ${it.icon}"></i></span>
      <div class="ai-body">
        <div class="ai-title" title="${escAttr(it.title)}">${esc(it.title)}</div>
        <div class="ai-meta">${esc(it.meta)} · ${esc(fmtDateTime(new Date(it.at)))}</div>
      </div>
    </div>`).join('')}</div>`;
}

function fmtUptime(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} ngày ${h} giờ`;
  if (h > 0) return `${h} giờ ${m} phút`;
  return `${m} phút`;
}

function renderDashboardHealth(d) {
  const el = document.getElementById('dashHealth');
  if (!el) return;
  const sys = d.system || {};
  const sync = sys.last_sync;
  const cells = [
    { label: 'Phiên bản', val: sys.app_version ? 'v' + sys.app_version : '—' },
    { label: 'Thời gian chạy', val: fmtUptime(sys.uptime_seconds) },
    { label: 'RAM', val: ((Number(sys.rss_bytes) || 0) / 1048576).toFixed(1) + ' MB' },
    { label: 'Dung lượng DB', val: ((Number(sys.db_size_bytes) || 0) / 1048576).toFixed(1) + ' MB' },
    { label: 'Node.js', val: sys.node_version || '—' },
    { label: 'Đồng bộ gần nhất', val: sync ? `${sync.status || '—'} · ${fmtDateTime(sync.at)}` : 'Chưa chạy' }
  ];
  el.classList.remove('loading');
  el.innerHTML = `<div class="health-grid">${cells.map(c => `
    <div class="health-item"><div class="h-label">${esc(c.label)}</div><div class="h-val">${esc(c.val)}</div></div>`).join('')}</div>`;
}

function openGaSettings() {
  switchSection('settings');
  switchSettingsTab('ga');
}

function openGaGuide() {
  const el = document.getElementById('gaGuide');
  if (!el) return;
  el.open = true;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}


// ========================
// Sub-page navigation (Cells section) — legacy shims
// ========================
// Từ khi Cell ID Database có menu con trên sidebar, các hàm này chỉ còn là
// lối tắt (deep-link JS console / bookmarklet). Giữ lại để không vỡ code cũ.
function showSourcePage() { switchCellSub('sources'); }
function showBulkPage() { switchCellSub('local'); }
function showClfPage() { switchCellSub('local'); initClfZone(); }
function goBackToCells() { switchSection('cells'); }

// ========================
// CLF V4.1 converter (G-MoN Pro) <-> OpenCellID CSV
// ========================
let clfDirection = 'csv2clf';   // 'csv2clf' | 'clf2csv'
let clfFile = null;

const CLF_DIR_TEXT = {
  csv2clf: {
    hint: 'OpenCellID CSV (radio,mcc,net,area,cell,unit,lon,lat,range,samples,...) \u2192 CLF V4.1.',
    accept: '.csv',
    title: 'Upload file CSV nguồn (OpenCellID world database)',
    zone: 'Hỗ trợ: <strong>.csv</strong> (OpenCellID world database dump)',
    defaultLabel: 'Dùng Database_free.csv có sẵn',
    url: '/api/convert/clf/from-csv'
  },
  clf2csv: {
    hint: 'CLF V4.1 (MCCMNC;CID;LAC;TYPE;LAT;LON;POS-RAT;DESC;SYS;LABEL;AZI;HEIGHT;HBW;VBW;TILT;LOC) \u2192 OpenCellID CSV.',
    accept: '.clf,.txt,.csv',
    title: 'Upload file CLF nguồn (G-MoN Pro)',
    zone: 'Hỗ trợ: <strong>.clf</strong> (hoặc .txt chứa định dạng CLF V4.1)',
    defaultLabel: 'Làm lại từ file đã chuyển',
    url: '/api/convert/clf/to-csv'
  }
};

function setClfDirection(dir) {
  clfDirection = dir;
  const cfg = CLF_DIR_TEXT[dir];
  const btnCsv = document.getElementById('clfDirCsvToClf');
  const btnClf = document.getElementById('clfDirClfToCsv');
  if (btnCsv && btnClf) {
    btnCsv.className = 'btn' + (dir === 'csv2clf' ? ' btn-primary' : '');
    btnClf.className = 'btn' + (dir === 'clf2csv' ? ' btn-primary' : '');
  }
  const hint = document.getElementById('clfDirHint');
  if (hint) hint.textContent = cfg.hint;
  const title = document.getElementById('clfUploadTitle');
  if (title) title.textContent = cfg.title;
  const zoneHint = document.getElementById('clfZoneHint');
  if (zoneHint) zoneHint.innerHTML = cfg.zone;
  const input = document.getElementById('clfFile');
  if (input) { input.accept = cfg.accept; input.value = ''; }
  const defBtn = document.getElementById('clfDefaultBtn');
  if (defBtn) {
    const icon = defBtn.querySelector('i');
    defBtn.innerHTML = (icon ? icon.outerHTML : '') + ' ' + cfg.defaultLabel;
  }
  clfFile = null;
  updateClfSelected();
  hideClfOutput();
}

function updateClfSelected() {
  const el = document.getElementById('clfSelected');
  const btn = document.getElementById('clfConvertBtn');
  if (!el || !btn) return;
  if (clfFile) {
    el.innerHTML = 'Đã chọn: <b>' + esc(clfFile.name) + '</b> (' + (clfFile.size / 1024 / 1024).toFixed(2) + ' MB)';
    btn.disabled = false;
  } else {
    el.textContent = '';
    btn.disabled = true;
  }
}

function handleClfFile(ev) {
  const f = ev.target.files && ev.target.files[0];
  clfFile = f || null;
  updateClfSelected();
  hideClfOutput();
}

function initClfZone() {
  const zone = document.getElementById('clfZone');
  if (!zone || zone.dataset.bound) return;
  zone.dataset.bound = '1';
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) {
      clfFile = f;
      updateClfSelected();
      hideClfOutput();
    }
  });
}

function setClfProgress(pct) {
  const bar = document.getElementById('clfProgressBar');
  const fill = document.getElementById('clfProgressFill');
  if (!bar || !fill) return;
  if (pct > 0) {
    bar.style.display = 'block';
    fill.style.width = pct + '%';
    fill.textContent = pct + '%';
  } else {
    bar.style.display = 'none';
    fill.style.width = '0%';
    fill.textContent = '0%';
  }
}

function hideClfOutput() {
  const card = document.getElementById('clfOutputCard');
  if (card) card.style.display = 'none';
  const res = document.getElementById('clfResult');
  if (res) { res.className = 'upload-result'; res.textContent = ''; }
}

function resetClfForm() {
  clfFile = null;
  const input = document.getElementById('clfFile');
  if (input) input.value = '';
  updateClfSelected();
  setClfProgress(0);
  hideClfOutput();
}

function convertClf() {
  const cfg = CLF_DIR_TEXT[clfDirection];
  if (!clfFile) { showClfResult('error', 'Chưa chọn file nguồn'); return; }
  const form = new FormData();
  form.append('file', clfFile);
  runClfConvert(cfg.url, form);
}

function convertClfDefault() {
  const cfg = CLF_DIR_TEXT[clfDirection];
  if (clfDirection === 'csv2clf') {
    // No upload: the server converts uploads/Database_free.csv in place.
    runClfConvert(cfg.url, new FormData());
    return;
  }
  showClfResult('error', 'Chiều CLF → CSV cần chọn file .clf để upload');
}

function showClfResult(type, msg) {
  const el = document.getElementById('clfResult');
  if (!el) return;
  el.className = 'upload-result ' + type;
  el.textContent = msg;
}

async function runClfConvert(url, form) {
  const btn = document.getElementById('clfConvertBtn');
  const defBtn = document.getElementById('clfDefaultBtn');
  hideClfOutput();
  setClfProgress(5);
  if (btn) btn.disabled = true;
  if (defBtn) defBtn.disabled = true;

  try {
    const result = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      const token = Auth.getToken();
      if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setClfProgress(5 + Math.round((e.loaded / e.total) * 70));
      };
      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText || '{}');
          if (xhr.status >= 200 && xhr.status < 300) resolve(res);
          else reject(new Error(res.error || 'Convert failed HTTP ' + xhr.status));
        } catch (_) {
          reject(new Error('Invalid server response'));
        }
      };
      xhr.onerror = () => reject(new Error('Network error during conversion'));
      xhr.send(form);
    });

    setClfProgress(100);
    showClfResult('success', 'Chuyển đổi xong: ' + result.converted + '/' + result.total + ' dòng hợp lệ');

    const card = document.getElementById('clfOutputCard');
    if (card) card.style.display = 'block';
    const stats = document.getElementById('clfStats');
    if (stats) {
      stats.innerHTML = 'File: <b>' + esc(result.file) + '</b><br>'
        + 'Tổng: <b>' + result.total + '</b> · '
        + 'Chuyển được: <b style="color:#4ade80">' + result.converted + '</b> · '
        + 'Lỗi: <b style="color:' + (result.failed ? '#ff8800' : 'inherit') + '">' + result.failed + '</b>';
    }
    const dl = document.getElementById('clfDownloadBtn');
    if (dl) dl.onclick = () => downloadClfResult(result.download, result.file);
    const fields = document.getElementById('clfFields');
    if (fields && result.fields) fields.textContent = result.fields.join(';');
    const label = document.getElementById('clfFormatLabel');
    if (label) label.textContent = 'Định dạng đầu ra (' + (result.fields ? result.fields.length : 0) + ' trường):';
    const sample = document.getElementById('clfSample');
    if (sample) sample.textContent = (result.sample || []).join('\n') || '(trống)';
    const errs = document.getElementById('clfErrors');
    if (errs) {
      if (result.errors && result.errors.length) {
        errs.innerHTML = '<b>Chi tiết lỗi (tối đa 20):</b><br>' + result.errors.slice(0, 20).map(esc).join('<br>');
      } else {
        errs.textContent = '';
      }
    }
    showToast('Đã chuyển đổi ' + result.converted + ' cell', 'success');
  } catch (e) {
    console.error(e);
    setClfProgress(0);
    showClfResult('error', 'Lỗi: ' + e.message);
    showToast('Chuyển đổi thất bại', 'error');
  } finally {
    if (defBtn) defBtn.disabled = false;
    updateClfSelected();
  }
}

async function downloadClfResult(url, filename) {
  try {
    const res = await Auth.fetch(url);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Download failed HTTP ' + res.status);
    }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'converted';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  } catch (e) {
    showToast('Tải file thất bại: ' + e.message, 'error');
  }
}

// ========================
// CSV / GZ / ZIP Bulk Upload
// ========================
function initBulkZone() {
  const zone = document.getElementById('bulkZone');
  if (!zone) return;
  ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('dragover'); }));
  zone.addEventListener('drop', e => {
    const files = e.dataTransfer.files;
    if (files.length) handleBulkFile(null, files[0]);
  });
}

async function handleBulkFile(event, fileOverride) {
  const file = fileOverride || (event && event.target.files && event.target.files[0]);
  if (!file) return;
  const resultEl = document.getElementById('bulkResult');
  const previewEl = document.getElementById('bulkPreview');
  resultEl.className = 'upload-result';
  resultEl.textContent = '';
  previewEl.innerHTML = '';

  const name = file.name.toLowerCase();
  if (!name.endsWith('.csv') && !name.endsWith('.gz') && !name.endsWith('.zip') && !name.endsWith('.xlsx') && !name.endsWith('.xls')) {
    showResult('error', 'Unsupported format. Use .csv, .gz, .zip, .xlsx or .xls');
    return;
  }

  setProgress(5);
  previewEl.innerHTML = `<div class="muted-text" style="font-size:12px;margin-bottom:8px">Uploading <b>${esc(file.name)}</b> (${(file.size / 1024 / 1024).toFixed(1)} MB) — server-side streaming parse...</div>`;

  try {
    // Upload RAW file; server streams + incremental-inserts. No client-side
    // zip/gz decompression or row buffering → large zip files no longer blow up memory.
    const form = new FormData();
    form.append('file', file);

    // Progress via XMLHttpRequest (fetch has no upload progress).
    // Server responds only after streaming parse + all batches inserted.
    const result = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload/cells');
      const token = Auth.getToken();
      if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(5 + Math.round((e.loaded / e.total) * 70));
      };
      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText || '{}');
          if (xhr.status >= 200 && xhr.status < 300) resolve(res);
          else reject(new Error(res.error || 'Upload failed HTTP ' + xhr.status));
        } catch (parseErr) {
          reject(new Error('Invalid server response'));
        }
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(form);
    });

    setProgress(100);
    showResult('success', `Inserted ${result.inserted}, skipped ${result.skipped || 0}, failed ${result.failed} (total ${result.total})`);
  } catch (e) {
    console.error(e);
    showResult('error', 'Upload failed: ' + e.message);
    setProgress(0);
  }
}

// ========================
// Clear all cells (tạm: xóa sạch để upload bộ cellid mới)
// ========================
async function clearAllCells() {
  const btn = document.getElementById('clearAllCellsBtn');
  if (!btn) return;

  const first = confirm('Xóa TOÀN BỘ cell ID trong cơ sở dữ liệu?\n\nHành động này không thể hoàn tác. Tiếp tục?');
  if (!first) return;
  const second = prompt('Để xác nhận, gõ chính xác chữ DELETE:\n\nHành động sẽ xóa vĩnh viễn toàn bộ cell ID.');
  if (second !== 'DELETE') {
    showToast('Đã hủy. Chưa xóa gì.', 'error');
    return;
  }

  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xóa...';
  try {
    const res = await Auth.fetch('/api/admin/cells/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Xóa thất bại HTTP ' + res.status);
    showToast(`Đã xóa ${data.deleted} cell ID`);
    loadDashboard();
  } catch (e) {
    console.error(e);
    showToast('Lỗi: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

// ========================
// Users management
// ========================
function showAddUserModal() {
  document.getElementById('userModalTitle').textContent = 'Thêm người dùng';
  document.getElementById('userEditId').value = '';
  document.getElementById('userFormUsername').value = '';
  document.getElementById('userFormEmail').value = '';
  document.getElementById('userFormVerified').checked = true;
  document.getElementById('userFormPassword').value = '';
  document.getElementById('userFormRole').value = 'user';
  document.getElementById('userFormStatus').value = 'active';
  const meta = document.getElementById('userFormMeta');
  if (meta) { meta.style.display = 'none'; meta.innerHTML = ''; }
  document.getElementById('addUserModal').classList.add('show');
}

function closeUserModal() {
  document.getElementById('addUserModal').classList.remove('show');
}

/** Mở modal sửa: tải chi tiết mới nhất (đủ mọi trường) rồi mới fill form. */
async function editUser(id) {
  try {
    const res = await Auth.fetch('/api/admin/users/' + encodeURIComponent(id));
    const u = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(u.error || 'Không tải được user');
    document.getElementById('userModalTitle').textContent = 'Sửa người dùng #' + u.id;
    document.getElementById('userEditId').value = String(u.id);
    document.getElementById('userFormUsername').value = u.username || '';
    document.getElementById('userFormEmail').value = u.email || '';
    document.getElementById('userFormVerified').checked = !!Number(u.email_verified);
    document.getElementById('userFormPassword').value = '';
    document.getElementById('userFormRole').value = u.role || 'user';
    document.getElementById('userFormStatus').value = u.status || 'active';
    const meta = document.getElementById('userFormMeta');
    if (meta) {
      meta.style.display = '';
      meta.innerHTML = `ID <b>${u.id}</b> · Tạo lúc ${esc(fmtDateTime(u.created_at))} · Đồng ý điều khoản: ${esc(u.terms_accepted_at ? fmtDateTime(u.terms_accepted_at) : '—')}<br>
        Số dư: <b>${fmtNum(u.balance)}</b> điểm · Đã dùng ${fmtNum(u.used)}
        <button class="btn btn-sm btn-success" type="button" id="userMetaTopup" style="margin-left:8px"><i class="fas fa-plus"></i> Nạp điểm</button>
        <div class="hint" style="margin-top:4px">Số dư chỉ đổi qua ledger (nút Nạp điểm) để giữ khả năng đối soát.</div>`;
      const topupBtn = document.getElementById('userMetaTopup');
      if (topupBtn) topupBtn.onclick = () => openCreditModal(u.id, u.username);
    }
    document.getElementById('addUserModal').classList.add('show');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function saveUser() {
  const id = document.getElementById('userEditId').value;
  const username = document.getElementById('userFormUsername').value.trim();
  const email = document.getElementById('userFormEmail').value.trim();
  const password = document.getElementById('userFormPassword').value;
  const role = document.getElementById('userFormRole').value;
  const status = document.getElementById('userFormStatus').value;
  const verified = document.getElementById('userFormVerified').checked;

  if (!username) { showToast('Cần nhập username', 'error'); return; }
  if (!id && !password) { showToast('Người dùng mới cần mật khẩu', 'error'); return; }
  if (password && password.length < 6) { showToast('Mật khẩu phải có ít nhất 6 ký tự', 'error'); return; }

  const payload = { username, email, role, status, email_verified: verified ? 1 : 0 };
  if (password) payload.password = password;

  try {
    const res = await Auth.fetch(id ? '/api/admin/users/' + encodeURIComponent(id) : '/api/admin/users', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.error || 'Không lưu được user');
    showToast(id ? 'Đã cập nhật người dùng' : 'Đã tạo người dùng', 'success');
    document.getElementById('addUserModal').classList.remove('show');
    loadCreditUsers();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function deleteUser(id) {
  const ok = await adminConfirm({
    title: 'Xoá người dùng',
    message: 'Bạn có chắc muốn xoá user #' + id + '? Hành động này không thể hoàn tác.',
    warnings: ['Chỉ xoá được user không phải admin.'],
    okText: 'Xoá',
    danger: true
  });
  if (!ok) return;
  try {
    const res = await Auth.fetch('/api/admin/users/' + encodeURIComponent(id), { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.error || 'Không xoá được user');
    showToast('Đã xoá người dùng', 'success');
    loadCreditUsers();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ========================
// Data Sources (Nguồn Online)
// ========================
async function loadSources() {
  const body = document.getElementById('sourceTableBody');
  body.innerHTML = '<tr><td colspan="7" class="loading"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';
  const res = await Auth.fetch('/api/sources');
  const sources = await res.json();
  sources.sort((a, b) => (a.priority - b.priority) || (a.id - b.id));
  window.__sources = sources;
  body.innerHTML = sources.map((s, i) => `<tr>
    <td>${s.id}</td>
    <td>
      <button class="btn btn-sm" ${i === 0 ? 'disabled' : ''} onclick="moveSource(${s.id}, -1)" title="Lên"><i class="fas fa-arrow-up"></i></button>
      <button class="btn btn-sm" ${i === sources.length - 1 ? 'disabled' : ''} onclick="moveSource(${s.id}, 1)" title="Xuống"><i class="fas fa-arrow-down"></i></button>
    </td>
    <td>${esc(s.name)}</td><td>${s.type}</td>
    <td><span class="badge ${s.enabled ? 'badge-active' : 'badge-pending'}">${s.enabled ? 'Enabled' : 'Disabled'}</span></td>
    <td>${s.last_error
      ? `<span class="badge" style="background:rgba(255,86,86,0.18);color:#ff6b6b" title="${esc(s.last_error_at || '')}">Lỗi</span>
         <div class="hint" style="color:#ff8b8b;margin-top:4px;max-width:340px;white-space:normal">${esc(s.last_error)}</div>`
      : '<span class="hint" style="color:var(--text-faint)">—</span>'}</td>
    <td>
      <button class="btn btn-sm ${s.enabled ? '' : 'btn-success'}" onclick="toggleSource(${s.id}, ${s.enabled ? 0 : 1})" title="${s.enabled ? 'Tắt' : 'Bật'}"><i class="fas ${s.enabled ? 'fa-toggle-on' : 'fa-toggle-off'}"></i> ${s.enabled ? 'Tắt' : 'Bật'}</button>
      <button class="btn btn-sm" onclick="editSourceByIndex(${i})"><i class="fas fa-pen"></i></button>
      <button class="btn btn-danger btn-sm" onclick="deleteSource(${s.id})"><i class="fas fa-trash"></i></button>
    </td>
  </tr>`).join('');
}

// Move a source up/down by swapping it with its neighbour, then persist the new order.
async function moveSource(id, dir) {
  const list = (window.__sources || []).slice().sort((a, b) => (a.priority - b.priority) || (a.id - b.id));
  const idx = list.findIndex(s => s.id === id);
  const swapIdx = idx + dir;
  if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return;
  [list[idx], list[swapIdx]] = [list[swapIdx], list[idx]];
  const order = list.map(s => s.id);
  const res = await Auth.fetch('/api/sources/reorder', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order }) });
  const data = await res.json();
  if (data.success) { loadSources(); } else { showToast(data.error || 'Lỗi sắp xếp', 'error'); }
}

function resetSourceForm() {
  document.getElementById('sourceFormCard').style.display = 'block';
  document.getElementById('sourceFormTitle').textContent = 'Thêm nguồn';
  document.getElementById('srcName').value = '';
  document.getElementById('srcType').value = 'opencellid';
  document.getElementById('srcApiKey').value = '';
  document.getElementById('srcEnabled').value = '1';
  document.getElementById('srcName').dataset.editId = '';
  onSourceTypeChange();
}

// API key only matters for OpenCellID; t0stbrot is keyless.
function onSourceTypeChange() {
  const type = document.getElementById('srcType').value;
  const keyInput = document.getElementById('srcApiKey');
  const hint = document.getElementById('srcHint');
  if (type === 't0stbrot') {
    keyInput.value = '';
    keyInput.disabled = true;
    keyInput.placeholder = 'Không cần API key';
    hint.innerHTML = 't0stbrot.net tra cứu LTE miễn phí, không cần API key. Chỉ hỗ trợ công nghệ LTE (ECI).';
  } else if (type === 'opencellid_web') {
    keyInput.value = '';
    keyInput.disabled = true;
    keyInput.placeholder = 'Không cần API key';
    hint.innerHTML = 'Tra cứu qua giao diện web opencellid.org (endpoint nội bộ, không chính thức). '
      + 'Không cần API key nhưng giới hạn khoảng 5 request/phút mỗi IP — chỉ nên bật khi các nguồn khác thất bại.';
  } else if (type === 'combain') {
    keyInput.disabled = false;
    keyInput.placeholder = 'Combain API key';
    hint.innerHTML = 'Lấy API key tại <a href="https://portal.combain.com/api/" target="_blank" rel="noopener">portal.combain.com</a>. Combain là API tra cứu theo cell (tốn credits).';
  } else if (type === 'google') {
    keyInput.disabled = false;
    keyInput.placeholder = 'Google Maps API key';
    hint.innerHTML = 'Cần bật <b>Geolocation API</b> + billing trong Google Cloud Console, lấy key tại '
      + '<a href="https://console.cloud.google.com/google/maps-apis/credentials" target="_blank" rel="noopener">console.cloud.google.com</a>. '
      + '<b>Tốn phí theo request</b> — Google trả 1 toạ độ cho CẢ NHÓM cell miss (không phải toạ độ riêng từng trạm), '
      + 'số cell mỗi request giới hạn ở mục "Số cell tối đa mỗi request Google". Nguồn này mặc định TẮT. '
      + 'Nếu bật mà vẫn không ra dữ liệu, xem cột <b>Lỗi gần nhất</b> ở bảng trên (Google trả 403 khi dự án chưa bật billing).';
  } else {
    keyInput.disabled = false;
    keyInput.placeholder = 'OpenCellID key';
    hint.innerHTML = 'Lấy API key miễn phí tại <a href="https://opencellid.org" target="_blank" rel="noopener">opencellid.org</a>.';
  }
}

window.editSource = function(s) {
  document.getElementById('sourceFormCard').style.display = 'block';
  document.getElementById('sourceFormTitle').textContent = 'Sửa nguồn #' + s.id;
  document.getElementById('srcName').value = s.name || '';
  document.getElementById('srcType').value = s.type || 'opencellid';
  document.getElementById('srcApiKey').value = s.api_key || '';
  document.getElementById('srcEnabled').value = s.enabled ? '1' : '0';
  document.getElementById('srcName').dataset.editId = s.id;
  onSourceTypeChange();
};

// Lookup by list index — tránh nhúng JSON vào attribute onclick (JSON bị
// escAttr escape thành &quot; → SyntaxError, nút Sửa không chạy).
window.editSourceByIndex = function(index) {
  const s = (window.__sources || [])[index];
  if (s) window.editSource(s);
};

async function saveSource() {
  const id = document.getElementById('srcName').dataset.editId;
  const existing = (window.__sources || []).find(s => String(s.id) === String(id));
  const payload = {
    name: document.getElementById('srcName').value,
    type: document.getElementById('srcType').value,
    api_key: document.getElementById('srcApiKey').value,
    enabled: document.getElementById('srcEnabled').value === '1',
    priority: existing ? existing.priority : 100
  };
  if (!payload.name) { showToast('Tên nguồn bắt buộc', 'error'); return; }

  let res;
  if (id) {
    res = await Auth.fetch('/api/sources/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  } else {
    res = await Auth.fetch('/api/sources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  }
  const data = await res.json();
  showToast(data.success ? 'Đã lưu nguồn' : data.error, data.success ? 'success' : 'error');
  if (data.success) {
    resetSourceForm();
    loadSources();
  }
}

async function deleteSource(id) {
  if (!confirm('Xóa nguồn này?')) return;
  const res = await Auth.fetch('/api/sources/' + id, { method: 'DELETE' });
  const data = await res.json();
  showToast(data.success ? 'Đã xóa nguồn' : data.error, data.success ? 'success' : 'error');
  loadSources();
}

// Quick enable/disable toggle from the list.
async function toggleSource(id, enabled) {
  const src = (window.__sources || []).find(s => s.id === id) || {};
  const payload = { name: src.name || '', type: src.type || 'opencellid', api_key: src.api_key || '', enabled: !!enabled, priority: src.priority != null ? src.priority : 100 };
  const res = await Auth.fetch('/api/sources/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await res.json();
  showToast(data.success ? (enabled ? 'Đã bật nguồn' : 'Đã tắt nguồn') : data.error, data.success ? 'success' : 'error');
  loadSources();
}
// ========================
// Sync Jobs (Đồng bộ tự động OpenCellID)
// ========================
function cronText(expr) {
  const parts = String(expr || '').trim().split(/\s+/);
  if (parts.length === 5 && parts[0] === '0' && parts[2] === '*' && parts[3] === '*' && parts[4] === '*') {
    return `Hằng ngày ${parts[1].padStart(2, '0')}:00`;
  }
  return expr;
}

async function loadSyncJobs() {
  const body = document.getElementById('syncTableBody');
  if (!body) return;
  body.innerHTML = '<tr><td colspan="8" class="loading"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';
  populateSyncSourceOptions();
  const res = await Auth.fetch('/api/sync-jobs');
  const jobs = await res.json();
  window.__syncJobs = jobs;
  if (!jobs.length) {
    body.innerHTML = '<tr><td colspan="8" class="muted-text">Chưa có lịch đồng bộ.</td></tr>';
    return;
  }
  body.innerHTML = jobs.map(j => {
    const running = j.running || j.last_status === 'running';
    const statusBadge = !j.enabled ? '<span class="badge badge-pending">Tắt</span>'
      : running ? '<span class="badge badge-pending">Đang chạy…</span>'
      : j.last_status === 'ok' ? '<span class="badge badge-active">OK</span>'
      : j.last_status === 'error' ? '<span class="badge" style="background:#7a1f1f;color:#fff">Lỗi</span>'
      : '<span class="badge">Chờ</span>';
    return `<tr>
      <td>${j.id}</td>
      <td>${esc(j.source_name || ('#' + (j.source_id || '—')))}</td>
      <td title="${escAttr(j.cron_expr || '')}">${esc(cronText(j.cron_expr))}</td>
      <td>${esc(j.mcc_list || '')}</td>
      <td>${statusBadge}</td>
      <td>${j.last_run ? esc(j.last_run) : '—'}</td>
      <td>${esc(j.last_message || '—')}</td>
      <td>
        <button class="btn btn-sm btn-success" onclick="runSyncJobNow(${j.id})" ${running ? 'disabled' : ''}><i class="fas fa-play"></i> Chạy ngay</button>
        <button class="btn btn-sm" onclick="toggleSyncJob(${j.id}, ${j.enabled ? 0 : 1})" title="${j.enabled ? 'Tắt' : 'Bật'}"><i class="fas ${j.enabled ? 'fa-toggle-on' : 'fa-toggle-off'}"></i></button>
        <button class="btn btn-sm" onclick="editSyncJobById(${j.id})"><i class="fas fa-pen"></i></button>
        <button class="btn btn-danger btn-sm" onclick="deleteSyncJob(${j.id})"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`;
  }).join('');
}

function populateSyncSourceOptions() {
  const sel = document.getElementById('syncSource');
  if (!sel) return;
  const opts = (window.__sources || []).filter(s => s.type === 'opencellid');
  const cur = sel.value;
  sel.innerHTML = '<option value="">-- OpenCellID --</option>' +
    opts.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  if (cur) sel.value = cur;
}

function resetSyncForm() {
  document.getElementById('syncFormCard').style.display = 'block';
  document.getElementById('syncFormTitle').textContent = 'Thêm lịch đồng bộ';
  document.getElementById('syncCron').value = '0 3 * * *';
  document.getElementById('syncMcc').value = '452';
  document.getElementById('syncEnabled').value = '1';
  populateSyncSourceOptions();
  document.getElementById('syncSource').dataset.editId = '';
  const oc = (window.__sources || []).find(s => s.type === 'opencellid');
  if (oc) document.getElementById('syncSource').value = oc.id;
}
window.editSyncJob = function(j) {
  document.getElementById('syncFormCard').style.display = 'block';
  document.getElementById('syncFormTitle').textContent = 'Sửa lịch #' + j.id;
  populateSyncSourceOptions();
  document.getElementById('syncSource').value = j.source_id || '';
  document.getElementById('syncCron').value = j.cron_expr || '0 3 * * *';
  document.getElementById('syncMcc').value = j.mcc_list || '452';
  document.getElementById('syncEnabled').value = j.enabled ? '1' : '0';
  document.getElementById('syncSource').dataset.editId = j.id;
};

// Lookup by job id — cùng lý do như editSourceByIndex (không nhúng JSON vào HTML).
window.editSyncJobById = function(id) {
  const j = (window.__syncJobs || []).find(x => String(x.id) === String(id));
  if (j) window.editSyncJob(j);
};

async function saveSyncJob() {
  const id = document.getElementById('syncSource').dataset.editId;
  const cron_expr = document.getElementById('syncCron').value.trim();
  if (!cron_expr) { showToast('Lịch cron bắt buộc', 'error'); return; }
  const payload = {
    source_id: document.getElementById('syncSource').value || null,
    cron_expr,
    scope: 'mcc',
    mcc_list: document.getElementById('syncMcc').value.trim() || '452',
    enabled: document.getElementById('syncEnabled').value === '1'
  };
  let res;
  if (id) {
    res = await Auth.fetch('/api/sync-jobs/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  } else {
    res = await Auth.fetch('/api/sync-jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  }
  const data = await res.json();
  showToast(data.success ? 'Đã lưu lịch' : (data.error || 'Lỗi lưu lịch'), data.success ? 'success' : 'error');
  if (data.success) { resetSyncForm(); document.getElementById('syncFormCard').style.display = 'none'; loadSyncJobs(); }
}

async function runSyncJobNow(id) {
  showToast('Đang đồng bộ…', '');
  loadSyncJobs();
  const res = await Auth.fetch('/api/sync-jobs/' + id + '/run', { method: 'POST' });
  const data = await res.json();
  showToast(data.success ? 'Đồng bộ xong' : (data.error || 'Lỗi đồng bộ'), data.success ? 'success' : 'error');
  loadSyncJobs();
}

async function toggleSyncJob(id, enabled) {
  const j = (window.__syncJobs || []).find(x => x.id === id) || {};
  const payload = { source_id: j.source_id || null, cron_expr: j.cron_expr || '0 3 * * *', scope: 'mcc', mcc_list: j.mcc_list || '452', enabled: !!enabled };
  const res = await Auth.fetch('/api/sync-jobs/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await res.json();
  showToast(data.success ? (enabled ? 'Đã bật lịch' : 'Đã tắt lịch') : (data.error || 'Lỗi'), data.success ? 'success' : 'error');
  loadSyncJobs();
}

async function deleteSyncJob(id) {
  if (!confirm('Xóa lịch đồng bộ này?')) return;
  const res = await Auth.fetch('/api/sync-jobs/' + id, { method: 'DELETE' });
  const data = await res.json();
  showToast(data.success ? 'Đã xóa lịch' : (data.error || 'Lỗi'), data.success ? 'success' : 'error');
  loadSyncJobs();
}





// ========================
// Utilities
// ========================
function showResult(type, msg) {
  const el = document.getElementById('bulkResult');
  el.className = 'upload-result ' + type;
  el.textContent = msg;
}

function setProgress(pct) {
  const fill = document.getElementById('bulkProgressFill');
  const bar = document.getElementById('bulkProgressBar');
  const info = document.getElementById('bulkProgressInfo');
  if (!fill) return;
  if (pct > 0) {
    bar.style.display = 'block';
    info.style.display = 'block';
    fill.style.width = pct + '%';
    fill.textContent = pct + '%';
    info.textContent = pct >= 100 ? 'Hoàn tất' : 'Đang tải lên...';
  } else {
    bar.style.display = 'none';
    info.style.display = 'none';
    fill.style.width = '0%';
    fill.textContent = '0%';
  }
}

let toastTimer = null;
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.innerHTML = `<i class="fas ${type === 'error' ? 'fa-times-circle' : 'fa-check-circle'}" style="color:${type === 'error' ? '#ff6666' : '#66ff66'}"></i>${esc(msg)}`;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), type === 'error' ? 6000 : 3000);
}

// Use hex-escaped entities so auto-formatters/normalizers don't rewrite them
var _A = '\x26amp;';
var _Q = '\x26quot;';
var _L = '\x26lt;';
var _G = '\x26gt;';
var _AP = '\x26#39;';

function esc(str) {
  return String(str === undefined || str === null ? '' : str)
    .replace(/\x26/g, _A).replace(/"/g, _Q).replace(/</g, _L).replace(/>/g, _G);
}

function escAttr(str) {
  return esc(str).replace(/'/g, _AP);
}

// ========================
// Credits (admin)
// ========================
const CREDIT_TYPE_LABELS = {
  lookup: 'Tra cứu', signup_bonus: 'Thưởng đăng ký', admin_topup: 'Admin nạp',
  admin_adjust: 'Admin chỉnh', correction: 'Điều chỉnh', payment: 'Thanh toán', refund: 'Hoàn điểm'
};
let _creditUsers = [];

async function loadCreditUsers() {
  const body = document.getElementById('userTableBody');
  if (!body) return;
  body.innerHTML = '<tr><td colspan="9" class="loading"><i class="fas fa-spinner fa-spin"></i> Đang tải...</td></tr>';
  try {
    const res = await Auth.fetch('/api/admin/credits/users');
    const users = await res.json();
    if (!res.ok) throw new Error(users.error || 'Không tải được dữ liệu điểm');
    _creditUsers = users;
    renderUsersTable();
  } catch (e) {
    body.innerHTML = `<tr><td colspan="9" class="muted-text">Error: ${esc(e.message)}</td></tr>`;
  }
}

function renderUsersTable() {
  const body = document.getElementById('userTableBody');
  if (!body) return;
  const q = (document.getElementById('creditUserFilter')?.value || '').trim().toLowerCase();
  const roleFilter = document.getElementById('userRoleFilter')?.value || '';
  const statusFilter = document.getElementById('userStatusFilter')?.value || '';
  const list = _creditUsers.filter(u => {
    if (q && !String(u.username).toLowerCase().includes(q)) return false;
    if (roleFilter && String(u.role) !== roleFilter) return false;
    if (statusFilter && String(u.status || 'active') !== statusFilter) return false;
    return true;
  });
  if (!list.length) {
    body.innerHTML = '<tr><td colspan="9" class="muted-text">Không có user nào khớp bộ lọc</td></tr>';
    return;
  }
  body.innerHTML = list.map(u => {
    const bal = Number(u.balance) || 0;
    const used = Number(u.used) || 0;
    const fmt = n => Number.isInteger(n) ? n : n.toFixed(2);
    const status = u.status || 'active';
    const verified = Number(u.email_verified) ? true : false;
    const emailCell = u.email
      ? `${esc(u.email)} <span class="badge ${verified ? 'badge-active' : 'badge-pending'}">${verified ? 'đã xác thực' : 'chưa xác thực'}</span>`
      : '<span class="muted-text">—</span>';
    const verifyBtn = (!verified && u.email)
      ? `<button class="btn btn-sm" title="Gửi lại mã kích hoạt" onclick="resendVerification(${u.id})"><i class="fas fa-envelope"></i></button>`
        + `<button class="btn btn-sm btn-success" title="Kích hoạt tay" onclick="verifyUserNow(${u.id})"><i class="fas fa-check"></i></button>`
        + `<button class="btn btn-sm" title="Tạo link kích hoạt để copy" onclick="copyVerificationLink(${u.id})"><i class="fas fa-link"></i></button>`
      : '';
    const statusClass = status === 'active' ? 'badge-active' : (status === 'pending' ? 'badge-pending' : 'badge-admin');
    return `<tr>
      <td>${u.id}</td>
      <td>${esc(u.username)}</td>
      <td>${emailCell}</td>
      <td><span class="badge ${u.role === 'admin' ? 'badge-admin' : 'badge-user'}">${esc(u.role)}</span></td>
      <td><span class="badge ${statusClass}">${esc(status)}</span></td>
      <td style="text-align:right"><b style="color:${bal > 0 ? '#45c07d' : '#ff6b6b'}">${fmt(bal)}</b></td>
      <td style="text-align:right">${fmt(used)}</td>
      <td style="white-space:nowrap">${esc(fmtDateTime(u.created_at))}</td>
      <td style="text-align:right;white-space:nowrap">
        <button class="btn btn-sm btn-success" title="Nạp điểm" onclick="openCreditModal(${u.id}, ${escAttr(JSON.stringify(u.username))})"><i class="fas fa-plus"></i> Nạp điểm</button>
        ${verifyBtn}
        <button class="btn btn-sm" title="Sửa user" onclick="editUser(${u.id})"><i class="fas fa-pen"></i></button>
        ${u.role !== 'admin' ? `<button class="btn btn-danger btn-sm" title="Xoá user" onclick="deleteUser(${u.id})"><i class="fas fa-trash"></i></button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

// Gửi lại mã kích hoạt cho user (SMTP chưa cấu hình thì trả link để admin copy).
async function resendVerification(id) {
  try {
    const res = await Auth.fetch(`/api/admin/users/${id}/resend-verification`, { method: 'POST' });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || 'Không gửi được');
    if (d.sent) showToast('Đã gửi lại mã kích hoạt', 'success');
    else if (d.dev_link) showToast('SMTP chưa cấu hình. Link: ' + d.dev_link, 'info');
    else showToast('Đã xử lý', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

async function verifyUserNow(id) {
  try {
    const res = await Auth.fetch(`/api/admin/users/${id}/verify`, { method: 'POST' });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || 'Không kích hoạt được');
    showToast('Đã kích hoạt tài khoản', 'success');
    loadCreditUsers();
  } catch (e) { showToast(e.message, 'error'); }
}

// Tạo link kích hoạt rồi copy vào clipboard (dùng khi không gửi được email).
async function copyVerificationLink(id) {
  try {
    const res = await Auth.fetch(`/api/admin/users/${id}/verification-link`);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || 'Không tạo được link');
    const text = d.link || '';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      showToast('Đã copy link kích hoạt (mã ' + (d.code || '') + ')', 'success');
    } else {
      window.prompt('Link kích hoạt (mã ' + (d.code || '') + '):', text);
    }
  } catch (e) { showToast(e.message, 'error'); }
}

async function loadCreditTx() {
  const body = document.getElementById('creditTxBody');
  if (!body) return;
  body.innerHTML = '<tr><td colspan="6" class="loading"><i class="fas fa-spinner fa-spin"></i> Đang tải...</td></tr>';
  try {
    const type = document.getElementById('creditTxType')?.value || '';
    const uid = (document.getElementById('creditTxUser')?.value || '').trim();
    const params = new URLSearchParams({ limit: '100' });
    if (type) params.set('type', type);
    if (uid && Number.isFinite(Number(uid))) params.set('user_id', uid);
    const res = await Auth.fetch('/api/admin/credits/transactions?' + params.toString());
    const rows = await res.json();
    if (!res.ok) throw new Error(rows.error || 'Không tải được lịch sử');
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="6" class="muted-text">Chưa có giao dịch</td></tr>';
      return;
    }
    body.innerHTML = rows.map(t => {
      const v = Number(t.amount) || 0;
      const after = Number(t.balance_after) || 0;
      const fmt = n => Number.isInteger(n) ? n : n.toFixed(2);
      return `<tr>
        <td style="white-space:nowrap">${esc(t.created_at || '')}</td>
        <td>${esc(t.username || ('#' + t.user_id))}</td>
        <td>${esc(CREDIT_TYPE_LABELS[t.type] || t.type)}</td>
        <td style="text-align:right;font-weight:700;color:${v > 0 ? '#45c07d' : '#ff6b6b'}">${v > 0 ? '+' : ''}${fmt(v)}</td>
        <td style="text-align:right">${fmt(after)}</td>
        <td class="muted-text">${esc(t.note || '')}</td>
      </tr>`;
    }).join('');
  } catch (e) {
    body.innerHTML = `<tr><td colspan="6" class="muted-text">Error: ${esc(e.message)}</td></tr>`;
  }
}

// Chỉ còn 1 chế độ: NẠP THÊM. Số dư hiện có của user không sửa được từ admin panel.
window.openCreditModal = function(userId, username) {
  document.getElementById('creditUserId').value = userId;
  document.getElementById('creditUserName').value = '#' + userId + ' — ' + username;
  const amt = document.getElementById('creditAmount');
  amt.value = '';
  amt.min = '0.01';
  document.getElementById('creditAmountHint').textContent =
    'Số điểm cộng thêm vào số dư hiện tại (phải > 0). Số dư cũ không bị thay đổi.';
  document.getElementById('creditNote').value = '';
  document.getElementById('creditModal').classList.add('show');
};

window.submitCreditModal = async function() {
  const userId = document.getElementById('creditUserId').value;
  const amount = document.getElementById('creditAmount').value.trim();
  const note = document.getElementById('creditNote').value.trim();
  if (amount === '' || !Number.isFinite(Number(amount))) { showToast('Số điểm không hợp lệ', 'error'); return; }
  if (Number(amount) <= 0) { showToast('Số điểm nạp phải lớn hơn 0', 'error'); return; }

  const btn = document.getElementById('creditSubmitBtn');
  btn.disabled = true;
  try {
    const res = await Auth.fetch('/api/admin/credits/topup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: Number(userId), amount: Number(amount), note })
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Thao tác thất bại');
    showToast(`Đã nạp. Số dư mới: ${d.balance}`, 'success');
    document.getElementById('creditModal').classList.remove('show');
    loadCreditUsers();
    loadCreditTx();
  } catch (e) {
    showToast(e.message, 'error');
  }
  btn.disabled = false;
};

window.runReconcile = async function() {
  const el = document.getElementById('reconcileResult');
  const btn = document.getElementById('btnReconcile');
  btn.disabled = true;
  el.style.color = '';
  el.textContent = 'Đang kiểm tra...';
  try {
    const res = await Auth.fetch('/api/admin/credits/reconcile');
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Lỗi đối soát');
    if (d.ok) {
      el.style.color = '#45c07d';
      el.textContent = 'Khớp: số dư = tổng bút toán cho mọi user.';
    } else {
      el.style.color = '#ff6b6b';
      el.textContent = `Lệch ${d.mismatched.length} user: ` +
        d.mismatched.map(m => `#${m.id} ${m.username} (dư ${m.balance} / ledger ${m.ledger})`).join(', ');
    }
  } catch (e) {
    el.style.color = '#ff6b6b';
    el.textContent = e.message;
  }
  btn.disabled = false;
};

// ========================
// CSDL Cells (admin CRUD)
// ========================
let cdbPage_ = 1;
let cdbTotalPages_ = 1;
let cdbAuditPage_ = 1;
let cdbAuditTotalPages_ = 1;
let cdbSelected = new Set();
let cdbLastRows = [];
let cdbMetaLoaded = false;

// Thông điệp dùng chung khi /api/admin/cells/* trả 404 — gần như luôn là server
// đang chạy được khởi động TRƯỚC khi các route này được thêm vào server.js.
function cdb404Hint() {
  return 'API /api/admin/cells chưa có trên server đang chạy — cần restart server (npm run dev / node server.js)';
}

function cdbFilterQuery(extra) {
  const p = new URLSearchParams();
  const put = (k, el) => { const v = document.getElementById(el); if (v && v.value.trim()) p.set(k, v.value.trim()); };
  put('q', 'cdbQ'); put('mcc', 'cdbMcc'); put('mnc', 'cdbMnc');
  put('lac', 'cdbLac'); put('cellid', 'cdbCellid');
  put('source', 'cdbSource'); put('radio', 'cdbRadio'); put('user_id', 'cdbUser');
  put('from_date', 'cdbFrom'); put('to_date', 'cdbTo');
  if (extra) Object.keys(extra).forEach(k => p.set(k, extra[k]));
  return p;
}

function cdbSearch() { cdbPage_ = 1; cdbSelected.clear(); cdbLoad(); }

function cdbResetFilters() {
  ['cdbQ','cdbMcc','cdbMnc','cdbLac','cdbCellid','cdbFrom','cdbTo'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  ['cdbSource','cdbRadio','cdbUser'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  cdbSearch();
}

function cdbPage(delta) {
  const next = cdbPage_ + delta;
  if (next < 1 || next > cdbTotalPages_) return;
  cdbPage_ = next;
  cdbLoad();
}

async function cdbLoadMeta() {
  if (cdbMetaLoaded) return;
  try {
    const res = await Auth.fetch('/api/admin/cells/meta');
    const d = await res.json().catch(() => ({}));
    // 404 = server đang chạy chưa nạp route /api/admin/cells/* (server cũ chưa
    // restart). Báo rõ thay vì để dropdown rỗng im lặng.
    if (res.status === 404) {
      showToast(cdb404Hint(), 'error');
      return;
    }
    if (!res.ok) throw new Error(d.error || 'Lỗi tải metadata');
    const fill = (id, items, labelFn) => {
      const sel = document.getElementById(id);
      if (!sel) return;
      items.forEach(it => {
        const o = document.createElement('option');
        o.value = it.v; o.textContent = labelFn(it);
        sel.appendChild(o);
      });
    };
    fill('cdbSource', d.sources || [], s => `${s.source == null ? '(null)' : s.source} (${s.n})`);
    fill('cdbRadio', d.radios || [], r => `${r.radio || '(trống)'} (${r.n})`);
    fill('cdbUser', (d.users || []).filter(u => u.n > 0), u => `${u.username} (${u.n})`);
    cdbMetaLoaded = true;
  } catch (e) {
    // Dropdown rỗng vẫn dùng được — 404 đã được xử lý riêng phía trên.
  }
}

function cdbSourceBadge(source) {
  const s = source == null ? '' : String(source);
  if (s === 'csv') return '<span class="nav-badge" style="background:rgba(70,200,120,0.2);color:#45c07d">csv</span>';
  if (s === '') return '<span class="muted-text">—</span>';
  const cls = s.indexOf('open') === 0 ? 'background:rgba(100,150,255,0.2);color:#6699ff'
    : s === 'combain' ? 'background:rgba(255,180,70,0.2);color:#e6a700'
    : s === 'google' ? 'background:rgba(70,160,255,0.2);color:#4aa3ff'
    : 'background:rgba(180,180,180,0.2);color:#999';
  return `<span class="nav-badge" style="${cls}">${esc(s)}</span>`;
}

async function cdbLoad() {
  const body = document.getElementById('cdbBody');
  body.innerHTML = '<tr><td colspan="14" class="loading"><i class="fas fa-spinner fa-spin"></i> Đang tải...</td></tr>';
  try {
    const p = cdbFilterQuery({ page: String(cdbPage_), limit: '50' });
    const res = await Auth.fetch('/api/admin/cells/list?' + p.toString());
    const d = await res.json().catch(() => ({}));
    if (res.status === 404) throw new Error(cdb404Hint());
    if (!res.ok) throw new Error(d.error || 'Lỗi tải danh sách');
    cdbTotalPages_ = d.totalPages || 1;
    cdbLastRows = d.data || [];
    document.getElementById('cdbTotal').textContent = `(${d.total} row)`;
    document.getElementById('cdbPageInfo').textContent = `Trang ${d.page}/${d.totalPages}`;
    if (cdbLastRows.length === 0) {
      body.innerHTML = '<tr><td colspan="14" class="loading">Không có row nào khớp bộ lọc.</td></tr>';
    } else {
      body.innerHTML = cdbLastRows.map(r => `
        <tr>
          <td><input type="checkbox" data-cdbrow="${r.id}" ${cdbSelected.has(r.id) ? 'checked' : ''} onclick="cdbToggleRow(${r.id}, this.checked)"></td>
          <td>${r.id}</td><td>${esc(r.mcc)}</td><td>${esc(r.mnc)}</td><td>${esc(r.lac)}</td><td>${esc(r.cellid)}</td>
          <td>${r.lat == null ? '' : r.lat}</td><td>${r.lng == null ? '' : r.lng}</td>
          <td>${r.range == null ? '' : r.range}</td>
          <td>${esc(r.radio) || '<span class="muted-text">—</span>'}</td>
          <td>${cdbSourceBadge(r.source)}</td>
          <td>${r.user_id == null ? '<span class="muted-text">—</span>' : r.user_id}</td>
          <td class="muted-text" style="font-size:11px">${esc(r.created_at)}</td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="cdbOpenEdit(${r.id})"><i class="fas fa-pen"></i></button>
            <button class="btn btn-danger btn-sm" onclick="cdbDeleteOne(${r.id})"><i class="fas fa-trash"></i></button>
          </td>
        </tr>`).join('');
    }
    cdbSyncSelectionUI();
  } catch (e) {
    body.innerHTML = `<tr><td colspan="14" class="loading" style="color:#ff6b6b">${esc(e.message)}</td></tr>`;
  }
}

// ---- Chọn nhiều ----
function cdbToggleRow(id, checked) {
  if (checked) cdbSelected.add(id); else cdbSelected.delete(id);
  cdbSyncSelectionUI();
}

function cdbToggleAll(el) {
  const on = el.checked;
  cdbLastRows.forEach(r => { if (on) cdbSelected.add(r.id); else cdbSelected.delete(r.id); });
  document.querySelectorAll('#cdbBody input[data-cdbrow]').forEach(cb => { cb.checked = on; });
  cdbSyncSelectionUI();
}

function cdbSyncSelectionUI() {
  const n = cdbSelected.size;
  document.getElementById('cdbSelCount').textContent = String(n);
  document.getElementById('cdbBulkDeleteBtn').disabled = n === 0;
  const all = document.getElementById('cdbSelAll');
  if (all) all.checked = cdbLastRows.length > 0 && cdbLastRows.every(r => cdbSelected.has(r.id));
  const warn = document.getElementById('cdbWarn');
  if (!warn) return;
  const csvCount = cdbLastRows.filter(r => cdbSelected.has(r.id) && r.source === 'csv').length;
  warn.textContent = csvCount > 0 ? `⚠ Trong ${n} row đã chọn có ${csvCount} row source=csv (CSDL gốc) — xác nhận trước khi xóa.` : '';
}

// ---- Xóa ----
async function cdbDeleteOne(id) {
  const row = cdbLastRows.find(r => r.id === id);
  const label = row ? `${row.mcc}-${row.mnc}-${row.lac}-${row.cellid} (id=${id}, nguồn ${row.source || '—'})` : `id=${id}`;
  if (!confirm(`Xóa cell ${label}?\nHành động này ghi vào cells_audit và không thể hoàn tác từ UI.`)) return;
  try {
    const res = await Auth.fetch('/api/admin/cells/' + id, { method: 'DELETE', body: JSON.stringify({}) });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Lỗi xóa');
    showToast('Đã xóa cell id=' + id, 'success');
    cdbSelected.delete(id);
    cdbLoad(); cdbLoadAudit(cdbAuditPage_);
  } catch (e) { showToast(e.message, 'error'); }
}

async function cdbBulkDelete() {
  const ids = Array.from(cdbSelected);
  if (ids.length === 0) return;
  if (!confirm(`Xóa ${ids.length} row đã chọn?\nHành động này ghi vào cells_audit và không thể hoàn tác từ UI.`)) return;
  try {
    const res = await Auth.fetch('/api/admin/cells/bulk-delete', {
      method: 'POST', body: JSON.stringify({ ids })
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Lỗi xóa');
    showToast(`Đã xóa ${d.deleted}/${d.requested} row`, 'success');
    cdbSelected.clear();
    cdbLoad(); cdbLoadAudit(cdbAuditPage_);
  } catch (e) { showToast(e.message, 'error'); }
}

// ---- Modal sửa ----
const CDB_EDIT_FIELDS = [
  ['cdbEditMcc', 'mcc'], ['cdbEditMnc', 'mnc'], ['cdbEditLac', 'lac'], ['cdbEditCellid', 'cellid'],
  ['cdbEditLat', 'lat'], ['cdbEditLng', 'lng'], ['cdbEditRange', 'range'], ['cdbEditRadio', 'radio'],
  ['cdbEditSource', 'source'], ['cdbEditDescription', 'description'],
  ['cdbEditAddress', 'address'], ['cdbEditCity', 'city'],
];

async function cdbOpenEdit(id) {
  try {
    const res = await Auth.fetch('/api/admin/cells/' + id);
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Lỗi tải cell');
    const r = d.data;
    document.getElementById('cdbEditRowId').value = r.id;
    document.getElementById('cdbEditId').textContent = '# ' + r.id;
    CDB_EDIT_FIELDS.forEach(([el, k]) => {
      const node = document.getElementById(el);
      if (!node) return;
      node.value = r[k] == null ? '' : r[k];
    });
    const warn = document.getElementById('cdbEditWarn');
    if (r.source === 'csv') {
      warn.style.display = '';
      warn.textContent = '⚠ Row này có source=csv (CSDL gốc). Sửa cẩn thận — thay đổi được ghi vào cells_audit.';
    } else {
      warn.style.display = 'none';
      warn.textContent = '';
    }
    document.getElementById('cdbEditModal').classList.add('show');
  } catch (e) { showToast(e.message, 'error'); }
}

function cdbCloseEdit() {
  document.getElementById('cdbEditModal').classList.remove('show');
}

// Validate phía client — mirror luật server (khung VN khi mcc=452, RAT hợp lệ).
function cdbValidateEdit(payload) {
  for (const k of ['mcc', 'mnc', 'lac', 'cellid']) {
    if (!String(payload[k] == null ? '' : payload[k]).trim()) return `Trường ${k} không được để trống`;
  }
  const lat = Number(payload.lat), lng = Number(payload.lng);
  if (!isFinite(lat) || !isFinite(lng)) return 'Lat/Lng phải là số';
  if (Math.abs(lat) > 90) return 'Lat phải trong [-90, 90]';
  if (Math.abs(lng) > 180) return 'Lng phải trong [-180, 180]';
  if (String(payload.mcc).trim() === '452' && (lat < 8 || lat > 23.8 || lng < 102 || lng > 110.5)) {
    return `Toạ độ (${lat}, ${lng}) nằm ngoài khung Việt Nam (mcc 452: lat 8–23.8, lng 102–110.5)`;
  }
  const allowed = ['', 'GSM', 'UMTS', 'LTE', 'NR', 'NB-IOT', 'CDMA'];
  if (payload.radio && allowed.indexOf(String(payload.radio).toUpperCase()) === -1) {
    return `RAT không hợp lệ: ${payload.radio}`;
  }
  if (payload.range !== '' && (!isFinite(Number(payload.range)) || Number(payload.range) < 0)) {
    return 'Range phải là số >= 0';
  }
  return null;
}

async function cdbSaveEdit() {
  const id = parseInt(document.getElementById('cdbEditRowId').value, 10);
  if (!Number.isFinite(id)) return;
  const payload = {};
  CDB_EDIT_FIELDS.forEach(([el, k]) => {
    const node = document.getElementById(el);
    if (node) payload[k] = node.value.trim();
  });
  payload.note = document.getElementById('cdbEditNote').value.trim();

  const err = cdbValidateEdit(payload);
  if (err) { showToast(err, 'error'); return; }

  const btn = document.getElementById('cdbEditSaveBtn');
  btn.disabled = true;
  try {
    const res = await Auth.fetch('/api/admin/cells/' + id, {
      method: 'PUT', body: JSON.stringify(payload)
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Lỗi lưu');
    showToast('Đã lưu cell id=' + id, 'success');
    if (d.warnings && d.warnings.length) showToast(d.warnings.join(' '), 'error');
    cdbCloseEdit();
    cdbLoad(); cdbLoadAudit(cdbAuditPage_);
  } catch (e) { showToast(e.message, 'error'); }
  btn.disabled = false;
}

// ---- Lịch sử audit ----
function cdbAuditPage(delta) {
  const next = cdbAuditPage_ + delta;
  if (next < 1 || next > cdbAuditTotalPages_) return;
  cdbAuditPage_ = next;
  cdbLoadAudit();
}

async function cdbLoadAudit(page) {
  if (page) cdbAuditPage_ = page;
  const body = document.getElementById('cdbAuditBody');
  body.innerHTML = '<tr><td colspan="8" class="loading"><i class="fas fa-spinner fa-spin"></i> Đang tải...</td></tr>';
  try {
    const p = new URLSearchParams({ page: String(cdbAuditPage_), limit: '50' });
    const cid = document.getElementById('cdbAuditCellId').value.trim();
    const act = document.getElementById('cdbAuditAction').value;
    const usr = document.getElementById('cdbAuditUser').value.trim();
    if (cid) p.set('cell_id', cid);
    if (act) p.set('action', act);
    if (usr) p.set('username', usr);
    const res = await Auth.fetch('/api/admin/cells/audit?' + p.toString());
    const d = await res.json().catch(() => ({}));
    if (res.status === 404) throw new Error(cdb404Hint());
    if (!res.ok) throw new Error(d.error || 'Lỗi tải lịch sử');
    cdbAuditTotalPages_ = d.totalPages || 1;
    document.getElementById('cdbAuditPageInfo').textContent = `Trang ${d.page}/${d.totalPages} (${d.total})`;
    const rows = d.data || [];
    if (rows.length === 0) {
      body.innerHTML = '<tr><td colspan="8" class="loading">Chưa có bản ghi nào.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(a => {
      const oldV = a.old_json ? JSON.parse(a.old_json) : null;
      const newV = a.new_json ? JSON.parse(a.new_json) : null;
      let diff = '';
      if (newV) {
        const keys = Object.keys(newV).filter(k => !oldV || String(oldV[k]) !== String(newV[k]));
        diff = keys.slice(0, 4).map(k => `${k}: ${oldV ? oldV[k] : '—'} → ${newV[k]}`).join('; ');
        if (keys.length > 4) diff += ` …(+${keys.length - 4})`;
      } else if (oldV) {
        diff = `${oldV.mcc}-${oldV.mnc}-${oldV.lac}-${oldV.cellid} @ ${oldV.lat},${oldV.lng}`;
      }
      return `<tr>
        <td>${a.id}</td><td>${a.cell_id == null ? '—' : a.cell_id}</td>
        <td>${esc(a.action)}</td><td>${esc(a.username) || '—'}</td><td class="muted-text">${esc(a.ip) || '—'}</td>
        <td class="muted-text" style="font-size:11px">${esc(a.note) || '—'}</td>
        <td class="muted-text" style="font-size:11px" title="${escAttr(diff)}">${esc(diff) || '—'}</td>
        <td class="muted-text" style="font-size:11px">${esc(a.created_at)}</td>
      </tr>`;
    }).join('');
  } catch (e) {
    body.innerHTML = `<tr><td colspan="8" class="loading" style="color:#ff6b6b">${esc(e.message)}</td></tr>`;
  }
}

// ========================
// Hộp thoại xác nhận dùng chung cho trang admin
// ========================
// KHÔNG dùng `confirm()` của trình duyệt (popup mặc định của OS, không định dạng
// được, chặn JS và trông lạc tông với UI). Dialog tự dựng, trả Promise<boolean>
// giống `confirm()` để thay thế 1-1.
//   opts: { title, message, warnings:[], notes:[], okText, danger }
function adminConfirm(opts) {
  const o = opts || {};
  return new Promise((resolve) => {
    const prev = document.getElementById('adminConfirmModal');
    if (prev) prev.remove();

    const escHtml = s => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    const warnHtml = (o.warnings || []).length
      ? `<div class="cf-warn cf-danger"><i class="fas fa-triangle-exclamation"></i>
           <div>${o.warnings.map(w => `<div>${escHtml(w)}</div>`).join('')}</div></div>`
      : '';
    const noteHtml = (o.notes || []).length
      ? `<div class="cf-info"><i class="fas fa-circle-info"></i>
           <div>${o.notes.map(n => `<div>${escHtml(n)}</div>`).join('')}</div></div>`
      : '';

    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="cf-overlay" id="adminConfirmModal" style="display:flex">
      <div class="cf-box" role="alertdialog" aria-modal="true">
        <div class="cf-hd">
          <span class="cf-ico"><i class="fas fa-triangle-exclamation"></i></span>
          <span>${escHtml(o.title || 'Xác nhận')}</span>
          <button class="cf-x" type="button" data-act="cancel" aria-label="Đóng">
            <i class="fas fa-xmark"></i></button>
        </div>
        <div class="cf-body">
          ${o.message ? `<div class="cf-msg">${escHtml(o.message)}</div>` : ''}
          ${warnHtml}${noteHtml}
        </div>
        <div class="cf-ft">
          <button class="btn" type="button" data-act="cancel">Huỷ</button>
          <button class="btn ${o.danger === false ? 'btn-primary' : 'btn-danger'}" type="button" data-act="ok">
            ${escHtml(o.okText || 'Xác nhận')}
          </button>
        </div>
      </div>
    </div>`;
    const modal = wrap.firstElementChild;
    document.body.appendChild(modal);

    const finish = (val) => {
      document.removeEventListener('keydown', onKey);
      modal.remove();
      resolve(val);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    };
    document.addEventListener('keydown', onKey);
    modal.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]');
      if (act) return finish(act.dataset.act === 'ok');
      if (e.target === modal) finish(false);   // bấm nền = huỷ
    });
    const okBtn = modal.querySelector('[data-act="ok"]');
    if (okBtn) okBtn.focus();
  });
}

// ========================
// TRA CỨU IP — nguồn dữ liệu, nhật ký, cấu hình & chạy thử
// ========================
// Dữ liệu lấy từ /api/admin/ip-lookup/* (server.js). Quy ước:
//  - `window.__ipxSources` giữ danh sách mới nhất để các nút trong bảng chỉ cần
//    truyền INDEX (không nhúng JSON vào attribute onclick — JSON bị escape thành
//    &quot; sẽ làm SyntaxError, lỗi từng gặp ở bảng nguồn cell).
//  - Secret (API key) luôn là ô trống + placeholder bản che; gửi lại chuỗi rỗng
//    nghĩa là "giữ nguyên" (server bỏ qua bằng isMaskedValue).
let ipxTab_ = 'sources';

/**
 * Đọc JSON từ response, chuyển "server trả HTML" thành lỗi đọc được.
 *
 * Lý do: route chưa có trên bản server đang chạy (chưa restart sau khi cập nhật)
 * hoặc reverse proxy trả trang chủ cho /api ⇒ body là `<!DOCTYPE html>…`, và
 * `res.json()` ném "Unexpected token '<', "<!DOCTYPE "... is not valid JSON" —
 * hoàn toàn không chỉ ra được việc cần làm. Hàm này bắt đúng tình huống đó.
 */
async function readJsonHttp(res, url) {
  const ct = String(res.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) return res.json();
  const text = await res.text().catch(() => '');
  // Lấy phần chữ trong trang HTML để còn manh mối (vd "Cannot GET /api/...").
  const plain = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
  let msg = `Máy chủ trả về HTML thay vì JSON cho ${url} (HTTP ${res.status}).`;
  if (res.status === 404) {
    msg += ' Có thể máy chủ chưa được khởi động lại sau khi cập nhật mã nguồn.';
  }
  if (plain) msg += ' Nội dung: ' + plain;
  throw new Error(msg);
}

function switchIpTab(name) {
  const pane = document.getElementById('ipxtab-' + name);
  if (!pane) { console.warn('[admin] thiếu tab Tra cứu IP:', name); return; }
  ipxTab_ = name;
  document.querySelectorAll('#ipxTabs .tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.ipxtab === name);
  });
  document.querySelectorAll('#section-ipx .tab-pane').forEach(p => p.classList.remove('active'));
  pane.classList.add('active');
  if (name === 'logs') loadIpLogs();
  if (name === 'config') loadIpSettings();
}

async function loadIpStats() {
  try {
    const url = '/api/admin/ip-lookup/stats';
    const res = await Auth.fetch(url);
    const s = await readJsonHttp(res, url);
    if (!res.ok) return;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('ipxStatTotal', (s.total && s.total.requests) || 0);
    set('ipxStat24', (s.last24h && s.last24h.requests) || 0);
    set('ipxStatErr', (s.last24h && s.last24h.errors) || 0);
    set('ipxStatCache', (s.last24h && s.last24h.cache_hits) || 0);
    set('ipxStatIps', (s.total && s.total.distinct_ips) || 0);
    set('ipxStatRows', s.cached_rows || 0);
  } catch (e) { /* stats không quan trọng bằng bảng nguồn */ }
}

/** Đổ danh mục loại nguồn vào <select> (nguồn đã có vẫn cho chọn để thấy lỗi rõ). */
function fillIpTypeSelect(catalog, taken) {
  const sel = document.getElementById('ipxType');
  if (!sel) return;
  const labels = {
    dbip: 'DB-IP (có key / free)',
    dbip_free: 'DB-IP free (không key)',
    ipinfo: 'IPinfo (lite / core)',
    ipwho_is: 'ipwho.is (miễn phí)',
    ipapi_is: 'ipapi.is (miễn phí)',
    ip_api_com: 'ip-api.com (miễn phí, HTTP)',
    freeipapi: 'freeipapi.com (miễn phí)',
    iplocation_net: 'iplocation.net (miễn phí)'
  };
  sel.innerHTML = (catalog || []).map(t => {
    const used = (taken || []).includes(t);
    return `<option value="${escAttr(t)}">${esc(labels[t] || t)}${used ? ' — đã có' : ''}</option>`;
  }).join('');
}

async function loadIpSources() {
  const body = document.getElementById('ipxSourceBody');
  if (!body) return;
  body.innerHTML = '<tr><td colspan="9" class="loading"><i class="fas fa-spinner fa-spin"></i> Đang tải…</td></tr>';
  loadIpStats();
  try {
    const url = '/api/admin/ip-lookup/sources';
    const res = await Auth.fetch(url);
    const data = await readJsonHttp(res, url);
    if (!res.ok) throw new Error(data.error || 'Không tải được danh sách nguồn');
    const sources = Array.isArray(data.sources) ? data.sources : [];
    window.__ipxSources = sources;
    window.__ipxCatalog = data.catalog || [];
    window.__ipxConfig = data.config || null;
    renderIpSources();
    fillIpTypeSelect(window.__ipxCatalog, sources.map(s => s.type));
    fillIpLogSourceFilter(sources);
    fillIpSettings(data.config);
  } catch (e) {
    body.innerHTML = `<tr><td colspan="9" class="muted-text">Lỗi: ${esc(e.message)}</td></tr>`;
  }
}

function renderIpSources() {
  const body = document.getElementById('ipxSourceBody');
  if (!body) return;
  const sources = window.__ipxSources || [];
  if (!sources.length) {
    body.innerHTML = '<tr><td colspan="9" class="muted-text">Chưa có nguồn nào — chọn loại ở form bên dưới rồi bấm “Lưu nguồn”.</td></tr>';
    return;
  }
  body.innerHTML = sources.map((s, i) => `<tr>
    <td>
      <button class="btn btn-sm" ${i === 0 ? 'disabled' : ''} onclick="moveIpSource(${i}, -1)" title="Lên"><i class="fas fa-arrow-up"></i></button>
      <button class="btn btn-sm" ${i === sources.length - 1 ? 'disabled' : ''} onclick="moveIpSource(${i}, 1)" title="Xuống"><i class="fas fa-arrow-down"></i></button>
    </td>
    <td>
      <b>${esc(s.name)}</b>
      <div class="hint" style="margin:0">${esc(s.type)}${s.plan === 'core' ? ' · plan core' : ''}</div>
    </td>
    <td>${esc(s.base_url || '—')}</td>
    <td>${s.requires_key
      ? (s.api_key_set ? `<span class="badge badge-active">đã có key</span><div class="hint" style="margin:0">${esc(s.api_key_masked)}</div>` : '<span class="badge badge-pending">thiếu key</span>')
      : '<span class="hint">không cần</span>'}</td>
    <td><span class="badge ${s.enabled ? 'badge-active' : 'badge-pending'}">${s.enabled ? 'Bật' : 'Tắt'}</span></td>
    <td>${esc(s.timeout_ms)}ms</td>
    <td>${esc(s.cache_days)} ngày</td>
    <td>${s.last_error
      ? `<span class="badge" style="background:rgba(255,86,86,0.18);color:#ff6b6b" title="${escAttr(s.last_error_at || '')}">Lỗi</span>
         <div class="hint" style="color:#ff8b8b;margin:0;max-width:320px;white-space:normal">${esc(s.last_error)}</div>`
      : '<span class="hint">—</span>'}</td>
    <td style="text-align:right;white-space:nowrap">
      <button class="btn btn-sm" onclick="testIpSource(${i})" title="Gửi thử 8.8.8.8 tới nguồn này"><i class="fas fa-vial"></i></button>
      <button class="btn btn-sm ${s.enabled ? '' : 'btn-success'}" onclick="toggleIpSource(${i})" title="${s.enabled ? 'Tắt' : 'Bật'}"><i class="fas ${s.enabled ? 'fa-toggle-on' : 'fa-toggle-off'}"></i></button>
      <button class="btn btn-sm" onclick="editIpSource(${i})" title="Sửa"><i class="fas fa-pen"></i></button>
      <button class="btn btn-danger btn-sm" onclick="deleteIpSource(${i})" title="Xoá"><i class="fas fa-trash"></i></button>
    </td>
  </tr>`).join('');
}

/** Gợi ý theo loại nguồn — giúp admin biết key lấy ở đâu, giới hạn là gì. */
function onIpTypeChange() {
  const type = document.getElementById('ipxType').value;
  const hint = document.getElementById('ipxHint');
  const keyInput = document.getElementById('ipxApiKey');
  const planSel = document.getElementById('ipxPlan');
  const baseInput = document.getElementById('ipxBaseUrl');
  if (!hint) return;
  const info = {
    dbip: {
      url: 'http://api.db-ip.com/v2',
      hint: 'Lấy API key tại <a href="https://db-ip.com/account/" target="_blank" rel="noopener">db-ip.com/account</a>. '
        + 'Bản free chỉ có country/city và <b>chỉ chạy HTTP</b>. Có key thì được toạ độ, ASN, ISP.'
    },
    dbip_free: {
      url: 'http://api.db-ip.com/v2',
      hint: 'Bản free không cần key, không có toạ độ/ASN và giới hạn lượt theo IP máy chủ. '
        + 'Chỉ nên bật khi <b>chưa</b> có key DB-IP.'
    },
    ipinfo: {
      url: 'https://api.ipinfo.io',
      hint: 'Token tại <a href="https://ipinfo.io/dashboard/token" target="_blank" rel="noopener">ipinfo.io/dashboard/token</a>. '
        + 'Plan <b>lite</b> miễn phí (country + ASN). Plan <b>core</b> (trả phí) mới có city/toạ độ/timezone và cờ proxy/hosting/mobile.'
    },
    ipwho_is: {
      url: 'https://ipwho.is',
      hint: 'Miễn phí, không cần key, có city/toạ độ. Giới hạn theo IP máy chủ nên giữ cache ≥ 3 ngày.'
    },
    ipapi_is: {
      url: 'https://api.ipapi.is',
      hint: 'Miễn phí (không key) cho số lượt giới hạn mỗi ngày. Trả cờ is_bogon cho IP nội bộ — dữ liệu vẫn là của nhà mạng.'
    },
    ip_api_com: {
      url: 'http://ip-api.com',
      hint: 'Miễn phí nhưng <b>chỉ HTTPS ở bản trả phí</b>: bản free chạy HTTP và giới hạn 45 request/phút cho mỗi IP máy chủ. '
        + 'Có key trả phí thì đổi Base URL sang <code>https://pro.ip-api.com</code>.'
    },
    freeipapi: {
      url: 'https://freeipapi.com',
      hint: 'Miễn phí, không cần key. IP không hợp lệ trả toàn field null — hệ thống coi là lỗi.'
    },
    iplocation_net: {
      url: 'https://api.iplocation.net',
      hint: 'Miễn phí nhưng chỉ có country + ISP (không toạ độ). Giá trị thấp — mặc định nên để TẮT.'
    }
  }[type] || { url: '', hint: '' };
  if (baseInput && !baseInput.value) baseInput.value = info.url;
  keyInput.disabled = !['dbip', 'ipinfo'].includes(type);
  if (keyInput.disabled) { keyInput.value = ''; keyInput.placeholder = 'Không cần API key'; }
  else keyInput.placeholder = type === 'ipinfo' ? 'IPinfo token' : 'DB-IP API key (bỏ trống = free)';
  if (planSel) planSel.disabled = type !== 'ipinfo';
  hint.innerHTML = info.hint;
}

function resetIpSourceForm() {
  const title = document.getElementById('ipxFormTitle');
  if (title) title.textContent = 'Thêm nguồn';
  const nameEl = document.getElementById('ipxName');
  if (nameEl) { nameEl.value = ''; nameEl.dataset.editId = ''; }
  const typeSel = document.getElementById('ipxType');
  if (typeSel) typeSel.disabled = false;
  document.getElementById('ipxApiKey').value = '';
  document.getElementById('ipxBaseUrl').value = '';
  document.getElementById('ipxTimeout').value = '10000';
  document.getElementById('ipxCacheDays').value = '7';
  document.getElementById('ipxNotes').value = '';
  document.getElementById('ipxEnabled').value = '0';
  document.getElementById('ipxPlan').value = 'lite';
  document.getElementById('ipxTestBtn').style.display = 'none';
  document.getElementById('ipxTestResult').textContent = '';
  onIpTypeChange();
}

/** Điền form từ row theo index — KHÔNG bao giờ đổ key thật vào ô input. */
function editIpSource(index) {
  const s = (window.__ipxSources || [])[index];
  if (!s) return;
  document.getElementById('ipxFormTitle').textContent = 'Sửa nguồn: ' + s.name;
  const nameEl = document.getElementById('ipxName');
  nameEl.value = s.name || '';
  nameEl.dataset.editId = s.id;
  const typeSel = document.getElementById('ipxType');
  typeSel.value = s.type;
  typeSel.disabled = true; // đổi loại = phải xoá rồi thêm mới
  document.getElementById('ipxPlan').value = s.plan === 'core' ? 'core' : 'lite';
  document.getElementById('ipxBaseUrl').value = s.base_url || '';
  const keyInput = document.getElementById('ipxApiKey');
  keyInput.value = '';
  keyInput.placeholder = s.api_key_set ? s.api_key_masked : 'Chưa cấu hình';
  document.getElementById('ipxTimeout').value = s.timeout_ms;
  document.getElementById('ipxCacheDays').value = s.cache_days;
  document.getElementById('ipxNotes').value = s.notes || '';
  document.getElementById('ipxEnabled').value = s.enabled ? '1' : '0';
  document.getElementById('ipxTestBtn').style.display = 'inline-flex';
  document.getElementById('ipxTestBtn').dataset.type = s.type;
  document.getElementById('ipxTestResult').textContent = '';
  onIpTypeChange();
  // onIpTypeChange() xoá placeholder theo loại — đặt lại bản che của key đã lưu.
  if (s.api_key_set) keyInput.placeholder = s.api_key_masked;
  document.getElementById('ipxFormCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function saveIpSource() {
  const nameEl = document.getElementById('ipxName');
  const id = nameEl.dataset.editId;
  const payload = {
    name: nameEl.value,
    plan: document.getElementById('ipxPlan').value,
    base_url: document.getElementById('ipxBaseUrl').value,
    timeout_ms: document.getElementById('ipxTimeout').value,
    cache_days: document.getElementById('ipxCacheDays').value,
    notes: document.getElementById('ipxNotes').value,
    enabled: document.getElementById('ipxEnabled').value === '1'
  };
  const key = document.getElementById('ipxApiKey').value.trim();
  if (key) payload.api_key = key;

  let res, url;
  try {
    if (id) {
      url = '/api/admin/ip-lookup/sources/' + id;
      res = await Auth.fetch(url, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
    } else {
      const type = document.getElementById('ipxType').value;
      if (!type) { showToast('Chọn loại nguồn', 'error'); return; }
      url = '/api/admin/ip-lookup/sources';
      res = await Auth.fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type })
      });
      const created = await readJsonHttp(res, url);
      if (!res.ok) { showToast(created.error || 'Không thêm được nguồn', 'error'); return; }
      // POST chỉ tạo row với mặc định; áp tiếp các trường admin vừa nhập trong form.
      if (created.source && created.source.id) {
        url = '/api/admin/ip-lookup/sources/' + created.source.id;
        res = await Auth.fetch(url, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
      }
    }
    const data = await readJsonHttp(res, url);
    showToast(data.ok ? 'Đã lưu nguồn' : (data.error || 'Lỗi lưu nguồn'), data.ok ? 'success' : 'error');
    if (data.ok) { resetIpSourceForm(); loadIpSources(); }
  } catch (e) {
    showToast(e.message || 'Lỗi lưu nguồn', 'error');
  }
}

async function toggleIpSource(index) {
  const s = (window.__ipxSources || [])[index];
  if (!s) return;
  const url = '/api/admin/ip-lookup/sources/' + s.id;
  try {
    const res = await Auth.fetch(url, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !s.enabled })
    });
    const data = await readJsonHttp(res, url);
    showToast(data.ok ? (s.enabled ? 'Đã tắt nguồn' : 'Đã bật nguồn') : (data.error || 'Lỗi'), data.ok ? 'success' : 'error');
    loadIpSources();
  } catch (e) { showToast(e.message || 'Lỗi cập nhật nguồn', 'error'); }
}

async function deleteIpSource(index) {
  const s = (window.__ipxSources || [])[index];
  if (!s) return;
  const yes = await adminConfirm({
    title: 'Xoá nguồn tra cứu IP',
    message: `Xoá "${s.name}" khỏi danh sách? Cache của nguồn này cũng bị xoá.`,
    okText: 'Xoá', danger: true
  });
  if (!yes) return;
  const url = '/api/admin/ip-lookup/sources/' + s.id;
  try {
    const res = await Auth.fetch(url, { method: 'DELETE' });
    const data = await readJsonHttp(res, url);
    showToast(data.ok ? 'Đã xoá nguồn' : (data.error || 'Lỗi xoá'), data.ok ? 'success' : 'error');
    loadIpSources();
  } catch (e) { showToast(e.message || 'Lỗi xoá nguồn', 'error'); }
}

async function moveIpSource(index, dir) {
  const list = (window.__ipxSources || []).slice();
  const swap = index + dir;
  if (index < 0 || swap < 0 || swap >= list.length) return;
  [list[index], list[swap]] = [list[swap], list[index]];
  const url = '/api/admin/ip-lookup/sources/reorder';
  try {
    const res = await Auth.fetch(url, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: list.map(s => s.id) })
    });
    const data = await readJsonHttp(res, url);
    if (!data.ok) showToast(data.error || 'Lỗi sắp xếp', 'error');
    loadIpSources();
  } catch (e) { showToast(e.message || 'Lỗi sắp xếp', 'error'); }
}

async function testIpSource(index) {
  const s = (window.__ipxSources || [])[index];
  if (!s) return;
  showToast('Đang kiểm tra ' + s.name + '…');
  const url = '/api/admin/ip-lookup/sources/' + s.id + '/test';
  try {
    const res = await Auth.fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip: '8.8.8.8' })
    });
    const data = await readJsonHttp(res, url);
    if (data.ok) {
      const d = data.data || {};
      showToast(`${s.name}: OK — ${d.country || '?'} / ${d.asn || 'no ASN'} (${data.ms}ms)`, 'success');
    } else {
      showToast(`${s.name}: ${data.error || 'lỗi không rõ'}`, 'error');
    }
    loadIpSources();
  } catch (e) { showToast(e.message || 'Lỗi kiểm tra nguồn', 'error'); }
}

/** Nút "Kiểm tra" trong form — kiểm tra CẤU HÌNH ĐÃ LƯU của nguồn đang sửa.
 *  (Key vừa gõ nhưng chưa bấm Lưu thì chưa được thử: server chỉ đọc key trong DB.) */
async function testIpSourceForm() {
  const type = document.getElementById('ipxTestBtn').dataset.type || document.getElementById('ipxType').value;
  const out = document.getElementById('ipxTestResult');
  if (!type) return;
  out.textContent = 'Đang kiểm tra…';
  const url = '/api/admin/ip-lookup/run';
  try {
    const res = await Auth.fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip: '8.8.8.8', sources: [type], include_disabled: true, skip_cache: true })
    });
    const data = await readJsonHttp(res, url);
    if (!data.ok) { out.textContent = 'Lỗi: ' + (data.error || '?'); return; }
    const r = (data.results || []).find(x => x.source === type) || {};
    out.textContent = r.ok ? `OK — ${r.data.country || '?'} (${r.ms}ms)` : `Lỗi: ${r.error || '?'}`;
  } catch (e) {
    out.textContent = 'Lỗi: ' + (e.message || 'không kết nối được');
  }
}

function fillIpLogSourceFilter(sources) {
  const sel = document.getElementById('ipxLogSource');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Mọi nguồn</option>'
    + (sources || []).map(s => `<option value="${escAttr(s.type)}">${esc(s.name)}</option>`).join('');
  if (cur) sel.value = cur;
}

async function loadIpLogs() {
  const body = document.getElementById('ipxLogBody');
  if (!body) return;
  body.innerHTML = '<tr><td colspan="8" class="loading"><i class="fas fa-spinner fa-spin"></i> Đang tải…</td></tr>';
  const ip = (document.getElementById('ipxLogIp') || {}).value || '';
  const source = (document.getElementById('ipxLogSource') || {}).value || '';
  const qs = new URLSearchParams();
  if (ip.trim()) qs.set('ip', ip.trim());
  if (source) qs.set('source', source);
  qs.set('limit', '200');
  try {
    const url = '/api/admin/ip-lookup/logs?' + qs.toString();
    const res = await Auth.fetch(url);
    const rows = await readJsonHttp(res, url);
    if (!res.ok) throw new Error(rows.error || 'Không tải được nhật ký');
    if (!Array.isArray(rows) || !rows.length) {
      body.innerHTML = '<tr><td colspan="8" class="muted-text">Chưa có lượt tra cứu IP nào.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(r => `<tr>
      <td>${esc(fmtAdminDate(r.created_at))}</td>
      <td>${r.username ? esc(r.username) : '<span class="muted-text">khách</span>'}</td>
      <td class="mono">${esc(r.normalized || r.ip || '—')}</td>
      <td>${esc(r.source_types || '—')}</td>
      <td>${Number(r.status) >= 400
        ? `<span class="badge" style="background:rgba(255,86,86,0.18);color:#ff6b6b">${esc(r.status)}</span>`
        : `<span class="badge badge-active">${esc(r.status || 200)}</span>`}</td>
      <td>${r.duration_ms != null ? esc(r.duration_ms) + ' ms' : '—'}</td>
      <td>${esc(r.cache_hits || 0)}</td>
      <td class="mono">${esc(r.ip_address || '—')}</td>
    </tr>`).join('');
  } catch (e) {
    body.innerHTML = `<tr><td colspan="8" class="muted-text">Lỗi: ${esc(e.message)}</td></tr>`;
  }
}

/** Điền form cấu hình từ config server trả về. */
function fillIpSettings(cfg) {
  if (!cfg) return;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v == null ? '' : v; };
  const check = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };
  check('ipxPublicEnabled', cfg.public_enabled);
  check('ipxConsoleEnabled', cfg.console_enabled);
  set('ipxGuestDaily', cfg.guest_daily);
  set('ipxUserDaily', cfg.user_daily);
  set('ipxConsolePerDay', cfg.console_per_day);
  set('ipxCutoff', cfg.day_cutoff_hour);
}

async function loadIpSettings() {
  try {
    const url = '/api/admin/ip-lookup/sources';
    const res = await Auth.fetch(url);
    const data = await readJsonHttp(res, url);
    if (res.ok) {
      window.__ipxConfig = data.config;
      fillIpSettings(data.config);
    }
    // Ngưỡng lưu nhật ký nằm trong bảng settings chung.
    const rs = await Auth.fetch('/api/settings');
    const s = await readJsonHttp(rs, '/api/settings');
    if (rs.ok) {
      const el = document.getElementById('ipxRetention');
      if (el) el.value = s.ip_lookup_log_retention_days != null ? s.ip_lookup_log_retention_days : '';
    }
  } catch (e) {
    // Form giữ giá trị cũ — không chặn phần còn lại của tab.
    console.warn('[admin] loadIpSettings:', e.message);
  }
}

async function saveIpSettings() {
  const num = (id) => {
    const el = document.getElementById(id);
    return el ? el.value : '';
  };
  const payload = {
    ip_lookup_public_enabled: document.getElementById('ipxPublicEnabled').checked ? '1' : '0',
    ip_lookup_public_guest_daily: num('ipxGuestDaily'),
    ip_lookup_user_daily: num('ipxUserDaily'),
    ip_lookup_console_enabled: document.getElementById('ipxConsoleEnabled').checked ? '1' : '0',
    ip_lookup_console_per_day: num('ipxConsolePerDay'),
    ip_lookup_day_cutoff_hour: num('ipxCutoff'),
    ip_lookup_log_retention_days: num('ipxRetention')
  };
  // Ô trống = giữ nguyên (server bỏ qua chuỗi rỗng) — tránh vô tình đặt về 0.
  Object.keys(payload).forEach(k => { if (payload[k] === '') delete payload[k]; });
  const url = '/api/settings';
  try {
    const res = await Auth.fetch(url, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: payload })
    });
    const data = await readJsonHttp(res, url);
    showToast(data.success ? 'Đã lưu cấu hình tra cứu IP' : (data.error || 'Lỗi lưu cấu hình'), data.success ? 'success' : 'error');
    if (data.success) loadIpSettings();
  } catch (e) { showToast(e.message || 'Lỗi lưu cấu hình', 'error'); }
}

async function runIpLookupTest() {
  const out = document.getElementById('ipxRunOutput');
  const ip = (document.getElementById('ipxRunIp').value || '').trim();
  if (!ip) { showToast('Nhập IP cần tra', 'error'); return; }
  out.style.display = 'block';
  out.textContent = 'Đang tra…';
  const url = '/api/admin/ip-lookup/run';
  try {
    const res = await Auth.fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ip,
        include_disabled: document.getElementById('ipxRunDisabled').checked,
        skip_cache: document.getElementById('ipxRunFresh').checked
      })
    });
    const data = await readJsonHttp(res, url);
    out.textContent = JSON.stringify(data, null, 2);
    loadIpStats();
  } catch (e) {
    out.textContent = 'Lỗi: ' + (e.message || 'không kết nối được');
  }
}

// ========================
// Global exports
// ========================
// admin.html gọi các hàm này từ attribute onclick/onchange nên chúng PHẢI nằm
// trên window. Khai báo `function` trong classic script vốn đã thành thuộc tính
// window, nhưng xuất tường minh để không vỡ nếu script được bọc trong IIFE /
// module / bundler.
Object.assign(window, {
  // Navigation
  switchSection, switchCellSub, switchLocalTab, switchSettingsTab,
  // Tra cứu IP (đa nguồn)
  switchIpTab, loadIpSources, loadIpStats, loadIpLogs, loadIpSettings,
  fillIpSettings, saveIpSettings, runIpLookupTest,
  onIpTypeChange, resetIpSourceForm, editIpSource, saveIpSource,
  toggleIpSource, deleteIpSource, moveIpSource, testIpSource, testIpSourceForm,
  // API (Public API v1)
  switchApiTab, loadApiKeys, loadApiStats, loadApiLogs, apiCopyCurl,
  apiKeyOpenCreate, apiKeyOpenEdit, apiKeyCloseModal, apiKeySave,
  apiKeyToggle, apiKeyRevoke, apiKeyDelete, apiCopyNewKey,
  // Hộp thoại xác nhận
  adminConfirm,
  // Settings
  loadSettings, saveSettings, refreshSiteBanner, openSiteSettings, quickReopenSite,
  // Google Analytics
  loadDashboard, openGaSettings, openGaGuide, testGaConnection, copyGaEmail, saveGaSettings,
  // Nạp điểm payOS
  loadPayments, loadPayStats, loadPackages, loadPayOrders, loadPayosStatus,
  pkgOpenCreate, pkgOpenEdit, pkgToggle, pkgDelete,
  paySync, payCancel, payMockPaid,
  turnupCheckWebhook, turnupConfirmWebhook, turnupTestConnection,
  // Cells sub-pages + CLF converter
  showSourcePage, showBulkPage, goBackToCells, showClfPage,
  setClfDirection, handleClfFile, convertClf, convertClfDefault, resetClfForm,
  // Bulk upload / clear
  handleBulkFile, clearAllCells,
  // Users
  showAddUserModal, closeUserModal, editUser, saveUser, deleteUser, loadCreditUsers, renderUsersTable,
  // Data sources
  loadSources, moveSource, resetSourceForm, onSourceTypeChange,
  saveSource, deleteSource, toggleSource,
  // Sync jobs
  loadSyncJobs, resetSyncForm, saveSyncJob,
  runSyncJobNow, toggleSyncJob, deleteSyncJob,
  // Utilities
  showResult, setProgress, showToast,
  // CSDL Cells (admin CRUD)
  cdbSearch, cdbResetFilters, cdbPage,
  cdbToggleRow, cdbToggleAll, cdbBulkDelete,
  cdbOpenEdit, cdbCloseEdit, cdbSaveEdit, cdbAuditPage
});

// Đổi theme khi đang mở Dashboard → vẽ lại biểu đồ để màu chữ/lưới khớp theme.
(function hookDashboardTheme() {
  const orig = window.toggleTheme;
  if (typeof orig !== 'function') return;
  window.toggleTheme = function () {
    const r = orig.apply(this, arguments);
    if (activeSection === 'dashboard') {
      setTimeout(() => loadDashboard(), 60);
    }
    return r;
  };
})();
