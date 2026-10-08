/* Cell Tracker Admin Panel */
// CSV upload: RAW file streamed to server (supports .csv/.gz/.zip/.xlsx).
// Nguồn Online: manage OpenCellID/custom data sources + fetch.

document.addEventListener('DOMContentLoaded', async () => {
  Auth.requireAuth().then(ok => {
    if (!ok) return;
    Auth.initNavbar();
    window.loadTheme();
    loadDashboard();
    loadUsers();
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
  if (name === 'users') loadUsers();
  if (name === 'settings') loadSettings();
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
  }).catch(e => showToast('Không tải được cấu hình: ' + e.message, 'error'));
}

function saveSettings() {
  const maxOnline = document.getElementById('setMaxOnline').value.trim();
  const retention = document.getElementById('setRetention').value.trim();
  Auth.fetch('/api/settings', {
    method: 'PUT',
    body: JSON.stringify({ settings: { max_online_resolve: maxOnline, lookup_history_retention_days: retention } })
  }).then(async r => {
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Lỗi lưu cấu hình');
    showToast('Đã lưu cấu hình', '');
    if (d.settings) {
      document.getElementById('setMaxOnline').value = d.settings.max_online_resolve ?? '';
      document.getElementById('setRetention').value = d.settings.lookup_history_retention_days ?? '';
    }
  }).catch(e => showToast(e.message, 'error'));
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
async function loadUsers() {
  const body = document.getElementById('userTableBody');
  body.innerHTML = '<tr><td colspan="6" class="loading"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';
  try {
    const res = await Auth.fetch('/api/users');
    const users = await res.json();
    body.innerHTML = users.map(u => `<tr>
      <td>${u.id}</td><td>${esc(u.username)}</td><td><span class="badge ${u.role === 'admin' ? 'badge-admin' : 'badge-user'}">${u.role}</span></td>
      <td><span class="badge ${u.status === 'active' ? 'badge-active' : 'badge-pending'}">${esc(u.status || 'active')}</span></td>
      <td>${u.created_at}</td>
      <td>
        <button class="btn btn-sm" onclick="editUser(${u.id}, '${escAttr(u.username)}', '${u.role}', '${u.status || 'active'}')"><i class="fas fa-pen"></i></button>
        ${u.role !== 'admin' ? `<button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})"><i class="fas fa-trash"></i></button>` : ''}
      </td>
    </tr>`).join('');
  } catch (e) {
    body.innerHTML = `<tr><td colspan="6" class="muted-text">Error: ${esc(e.message)}</td></tr>`;
  }
}

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
    loadUsers();
  }
}

async function deleteUser(id) {
  if (!confirm('Delete this user?')) return;
  const res = await Auth.fetch('/api/users/' + id, { method: 'DELETE' });
  const data = await res.json();
  showToast(data.success ? 'User deleted' : data.error, data.success ? 'success' : 'error');
  loadUsers();
}

// ========================
// Data Sources (Nguồn Online)
// ========================
async function loadSources() {
  const body = document.getElementById('sourceTableBody');
  body.innerHTML = '<tr><td colspan="6" class="loading"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';
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
      <button class="btn btn-sm" onclick='editSource(${escAttr(JSON.stringify(s))})'><i class="fas fa-pen"></i></button>
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
        <button class="btn btn-sm" onclick='editSyncJob(${escAttr(JSON.stringify(j))})'><i class="fas fa-pen"></i></button>
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