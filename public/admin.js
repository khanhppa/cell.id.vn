/* Cell.id.vn Admin Panel */
// CSV upload: RAW file streamed to server (supports .csv/.gz/.zip/.xlsx).
// Nguồn Online: manage OpenCellID/custom data sources + fetch.

document.addEventListener('DOMContentLoaded', async () => {
  Auth.requireAuth().then(ok => {
    if (!ok) return;
    Auth.initNavbar();
    window.loadTheme();
    loadDashboard();
    initBulkZone();
  });
});

// ========================
// Navigation / Sections
// ========================
let activeSection = 'cells';

function switchSection(name) {
  activeSection = name;
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  document.getElementById('section-' + name).classList.add('active');
  document.querySelector(`.sidebar-item[data-section="${name}"]`).classList.add('active');

  if (name === 'dashboard') loadDashboard();
  if (name === 'users') { loadCreditUsers(); loadCreditTx(); }
  if (name === 'settings') loadSettings();
  if (name === 'cells') { cdbLoadMeta(); cdbSearch(); cdbLoadAudit(1); }
}

// ========================
// Settings
// ========================
function loadSettings() {
  Auth.fetch('/api/settings').then(r => r.json()).then(s => {
    const mo = document.getElementById('setMaxOnline');
    const rt = document.getElementById('setRetention');
    if (mo) mo.value = s.max_online_resolve != null ? s.max_online_resolve : '';
    if (rt) rt.value = s.lookup_history_retention_days != null ? s.lookup_history_retention_days : '';
    const ce = document.getElementById('setCreditEnabled');
    const cc = document.getElementById('setCreditCost');
    const cb = document.getElementById('setCreditSignupBonus');
    const cn = document.getElementById('setCreditAllowNegative');
    if (ce) ce.checked = String(s.credit_enabled) === '1';
    if (cc) cc.value = s.credit_cost_per_lookup != null ? s.credit_cost_per_lookup : '';
    if (cb) cb.value = s.credit_signup_bonus != null ? s.credit_signup_bonus : '';
    if (cn) cn.checked = String(s.credit_allow_negative) === '1';
  }).catch(e => showToast('Không tải được cấu hình: ' + e.message, 'error'));
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
  if (creditCost !== '') settings.credit_cost_per_lookup = creditCost;
  if (creditBonus !== '') settings.credit_signup_bonus = creditBonus;
  Object.keys(settings).forEach(k => { if (settings[k] === '') delete settings[k]; });

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
    showToast('Đã lưu cấu hình — tính điểm tra cứu: ' + (on ? 'BẬT' : 'TẮT'), 'success');
  }).catch(e => { showToast(e.message, 'error'); loadSettings(); });
}

function loadDashboard() {
  Auth.fetch('/api/admin/stats').then(r => r.json()).then(stats => {
    document.getElementById('statUsers').textContent = stats.users || 0;
    document.getElementById('statCells').textContent = stats.cells || 0;
    document.getElementById('statRecords').textContent = (stats.history || 0) + (stats.ipTrackerLogs || 0);
    document.getElementById('statPending').textContent = stats.uploads || 0;
  }).catch(() => {});

  Auth.fetch('/api/users').then(r => r.json()).then(users => {
    const el = document.getElementById('dashActivity');
    if (!users || !users.length) { el.innerHTML = '<div class="muted-text">No users yet</div>'; return; }
    el.innerHTML = `<table><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Created</th></tr></thead><tbody>${users.slice(0, 10).map(u => `<tr><td>${esc(u.username)}</td><td>${u.role}</td><td>${esc(u.status || 'active')}</td><td>${u.created_at}</td></tr>`).join('')}</tbody></table>`;
  }).catch(() => {});
}

// ========================
// Sub-page navigation (Cells section)
// ========================
function showSourcePage() {
  activeSection = 'sources';
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('sub-sources').classList.add('active');
  loadSources();
  loadSyncJobs();
}

function showBulkPage() {
  activeSection = 'bulk';
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('sub-bulk').classList.add('active');
}

function goBackToCells() {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('section-cells').classList.add('active');
  document.querySelector('.sidebar-item[data-section="cells"]').classList.add('active');
}

function showClfPage() {
  activeSection = 'clf';
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('sub-clf').classList.add('active');
  initClfZone();
}

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
  document.getElementById('userModalTitle').textContent = 'Add User';
  document.getElementById('userFormUsername').value = '';
  document.getElementById('userFormPassword').value = '';
  document.getElementById('userFormRole').value = 'user';
  document.getElementById('userFormStatus').value = 'active';
  document.getElementById('userFormUsername').dataset.editId = '';
  document.getElementById('addUserModal').classList.add('show');
}

window.editUser = function(id, username, role, status) {
  document.getElementById('userModalTitle').textContent = 'Edit User #' + id;
  document.getElementById('userFormUsername').value = username;
  document.getElementById('userFormPassword').value = '';
  document.getElementById('userFormRole').value = role;
  document.getElementById('userFormStatus').value = status;
  document.getElementById('userFormUsername').dataset.editId = id;
  document.getElementById('addUserModal').classList.add('show');
};

async function saveUser() {
  const id = document.getElementById('userFormUsername').dataset.editId;
  const username = document.getElementById('userFormUsername').value;
  const password = document.getElementById('userFormPassword').value;
  const role = document.getElementById('userFormRole').value;
  const status = document.getElementById('userFormStatus').value;

  if (!username) { showToast('Username required', 'error'); return; }

  let res;
  if (id) {
    res = await Auth.fetch('/api/users/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, role, status, ...(password ? { password } : {}) })
    });
  } else {
    if (!password) { showToast('Password required for new user', 'error'); return; }
    res = await Auth.fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role, status })
    });
  }
  const data = await res.json();
  showToast(data.success ? 'User saved' : data.error, data.success ? 'success' : 'error');
  if (data.success) {
    document.getElementById('addUserModal').classList.remove('show');
    loadCreditUsers();
  }
}

async function deleteUser(id) {
  if (!confirm('Delete this user?')) return;
  const res = await Auth.fetch('/api/users/' + id, { method: 'DELETE' });
  const data = await res.json();
  showToast(data.success ? 'User deleted' : data.error, data.success ? 'success' : 'error');
  loadCreditUsers();
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
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
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
  body.innerHTML = '<tr><td colspan="8" class="loading"><i class="fas fa-spinner fa-spin"></i> Đang tải...</td></tr>';
  try {
    const res = await Auth.fetch('/api/admin/credits/users');
    const users = await res.json();
    if (!res.ok) throw new Error(users.error || 'Không tải được dữ liệu điểm');
    _creditUsers = users;
    renderUsersTable();
  } catch (e) {
    body.innerHTML = `<tr><td colspan="8" class="muted-text">Error: ${esc(e.message)}</td></tr>`;
  }
}

function renderUsersTable() {
  const body = document.getElementById('userTableBody');
  if (!body) return;
  const q = (document.getElementById('creditUserFilter')?.value || '').trim().toLowerCase();
  const list = q ? _creditUsers.filter(u => String(u.username).toLowerCase().includes(q)) : _creditUsers;
  if (!list.length) {
    body.innerHTML = '<tr><td colspan="8" class="muted-text">Không có user nào</td></tr>';
    return;
  }
  body.innerHTML = list.map(u => {
    const bal = Number(u.balance) || 0;
    const used = Number(u.used) || 0;
    const fmt = n => Number.isInteger(n) ? n : n.toFixed(2);
    const status = u.status || 'active';
    return `<tr>
      <td>${u.id}</td>
      <td>${esc(u.username)}</td>
      <td><span class="badge ${u.role === 'admin' ? 'badge-admin' : 'badge-user'}">${esc(u.role)}</span></td>
      <td><span class="badge ${status === 'active' ? 'badge-active' : 'badge-pending'}">${esc(status)}</span></td>
      <td style="text-align:right"><b style="color:${bal > 0 ? '#45c07d' : '#ff6b6b'}">${fmt(bal)}</b></td>
      <td style="text-align:right">${fmt(used)}</td>
      <td style="white-space:nowrap">${esc(u.created_at || '')}</td>
      <td style="text-align:right;white-space:nowrap">
        <button class="btn btn-sm btn-success" title="Nạp điểm" onclick="openCreditModal(${u.id}, '${escAttr(u.username)}')"><i class="fas fa-plus"></i> Nạp điểm</button>
        <button class="btn btn-sm" title="Sửa user" onclick="editUser(${u.id}, '${escAttr(u.username)}', '${escAttr(u.role)}', '${escAttr(status)}')"><i class="fas fa-pen"></i></button>
        ${u.role !== 'admin' ? `<button class="btn btn-danger btn-sm" title="Xoá user" onclick="deleteUser(${u.id})"><i class="fas fa-trash"></i></button>` : ''}
      </td>
    </tr>`;
  }).join('');
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
// Global exports
// ========================
// admin.html gọi các hàm này từ attribute onclick/onchange nên chúng PHẢI nằm
// trên window. Khai báo `function` trong classic script vốn đã thành thuộc tính
// window, nhưng xuất tường minh để không vỡ nếu script được bọc trong IIFE /
// module / bundler.
Object.assign(window, {
  // Navigation
  switchSection,
  // Settings
  loadSettings, saveSettings,
  // Cells sub-pages + CLF converter
  showSourcePage, showBulkPage, goBackToCells, showClfPage,
  setClfDirection, handleClfFile, convertClf, convertClfDefault, resetClfForm,
  // Bulk upload / clear
  handleBulkFile, clearAllCells,
  // Users
  showAddUserModal, saveUser, deleteUser,
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

