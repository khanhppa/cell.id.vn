// IP Tracker Frontend Logic

// ============================================
// i18n (EN / VI) - standalone for this page
// ============================================
const I18N = {
  vi: {
    'ipt.title': 'IP Tracker - Công cụ học tập',
    'ipt.subtitle': 'Tạo tracking link để kiểm tra thông tin request (IP, User-Agent, Headers)',
    'ipt.tabUrl': 'URL Redirect',
    'ipt.tabImage': 'Ảnh (Image)',
    'ipt.urlTitle': 'Tạo tracking link URL',
    'ipt.urlDesc': 'Khi victim click link, họ sẽ được redirect đến URL bạn nhập, và thông tin request được log lại.',
    'ipt.name': 'Tên (ghi nhớ)',
    'ipt.namePh': 'VD: Link VNExpress test',
    'ipt.urlRedirect': 'URL redirect (nơi victim được chuyển hướng đến)',
    'ipt.ogSummary': '⚙ Tùy chỉnh OG (Open Graph) — social preview',
    'ipt.ogTitle': 'OG Title (tiêu đề hiển thị khi share Facebook, Telegram...)',
    'ipt.ogTitlePh': 'VD: Bài viết mới - Tin tức 24h',
    'ipt.ogDesc': 'OG Description (mô tả)',
    'ipt.ogDescPh': 'VD: Cập nhật tin tức nhanh chóng và chính xác',
    'ipt.ogImage': 'OG Image URL (ảnh đại diện — để trống dùng ảnh mặc định)',
    'ipt.ogImagePh': 'https://example.com/image.jpg',
    'ipt.createUrlBtn': 'Tạo tracking link',
    'ipt.trackingLinkLabel': 'Tracking link (gửi link này cho victim):',
    'ipt.copy': 'Copy',
    'ipt.shareLink': 'Share link (public check)',
    'ipt.imgTitle': 'Tạo tracking link ảnh',
    'ipt.imgDesc': 'Upload ảnh bất kỳ. Khi victim mở link, ảnh hiển thị bình thường và thông tin request được log lại. Bạn cũng có thể tải ảnh đã nhúng tracking pixel.',
    'ipt.imgNamePh': 'VD: Ảnh test',
    'ipt.chooseImage': 'Chọn ảnh',
    'ipt.dropImage': 'Click hoặc kéo thả ảnh vào đây (PNG/JPG)',
    'ipt.createImgBtn': 'Tạo tracking link',
    'ipt.downloadImg': 'Download ảnh (đã nhúng pixel)',
    'ipt.listTitle': 'Danh sách tracking link đã tạo',
    'ipt.colName': 'Tên',
    'ipt.colType': 'Loại',
    'ipt.colClicks': 'Click',
    'ipt.colLastClick': 'Click gần nhất',
    'ipt.colActions': 'Thao tác',
    'ipt.shareTitle': 'Share Link — Kiểm tra trạng thái',
    'ipt.shareDesc': 'Link này public (không cần đăng nhập), dùng để gửi cho người khác biết victim đã click vào link hay chưa.',
    'ipt.shareUrl': 'URL share:',
    'ipt.status': 'Trạng thái',
    'ipt.clickCount': 'Số lần click',
    'common.loading': 'Đang tải...',
    'common.checking': 'Đang kiểm tra...',
    'lst.empty': 'Chưa có tracking link nào. Tạo một cái ở trên!',
    'lst.untitled': '(không tên)',
    'lst.viewResults': 'Xem kết quả',
    'lst.delete': 'Xóa',
    'lst.waiting': 'Đang tạo...',
    'lst.noImg': 'Chưa chọn ảnh!',
    'lst.copyDone': '✅ Copied!',
    'lst.err': 'Lỗi: ',
    'lst.createBtn': 'Tạo tracking link',
    'results.title': '📊 Kết quả tracking: ',
    'results.type': 'Loại',
    'results.typeUrl': '🔗 URL Redirect',
    'results.typeImg': '🖼 Image',
    'results.totalClicks': 'Tổng số click',
    'results.token': 'Token',
    'results.created': 'Ngày tạo',
    'results.noClicks': 'Chưa có ai click vào link này.',
    'results.colTime': 'Thời gian',
    'results.colLan': 'IP (LAN)',
    'results.colWan': 'IP (WAN)',
    'results.colUa': 'User-Agent',
    'results.colHeaders': 'Headers',
    'share.checked': 'Đã click',
    'share.notChecked': 'Chưa click',
    'share.lastClick': ' (lần cuối: ',
    'del.confirm': 'Xóa tracking link này? Toàn bộ logs cũng bị xóa.'
  },
  en: {
    'ipt.title': 'IP Tracker - Learning tool',
    'ipt.subtitle': 'Create tracking links to inspect request info (IP, User-Agent, Headers)',
    'ipt.tabUrl': 'URL Redirect',
    'ipt.tabImage': 'Image',
    'ipt.urlTitle': 'Create URL tracking link',
    'ipt.urlDesc': 'When a victim clicks the link, they are redirected to the URL you set, and the request info is logged.',
    'ipt.name': 'Name (label)',
    'ipt.namePh': 'e.g. VNExpress test link',
    'ipt.urlRedirect': 'Redirect URL (where the victim is redirected)',
    'ipt.ogSummary': '⚙ Customize OG (Open Graph) — social preview',
    'ipt.ogTitle': 'OG Title (title shown when sharing on Facebook, Telegram...)',
    'ipt.ogTitlePh': 'e.g. New article - 24h News',
    'ipt.ogDesc': 'OG Description (description)',
    'ipt.ogDescPh': 'e.g. Latest news, fast and accurate',
    'ipt.ogImage': 'OG Image URL (cover image — leave empty for default)',
    'ipt.ogImagePh': 'https://example.com/image.jpg',
    'ipt.createUrlBtn': 'Create tracking link',
    'ipt.trackingLinkLabel': 'Tracking link (send this to the victim):',
    'ipt.copy': 'Copy',
    'ipt.shareLink': 'Share link (public check)',
    'ipt.imgTitle': 'Create image tracking link',
    'ipt.imgDesc': 'Upload any image. When a victim opens the link, the image shows normally and request info is logged. You can also download the image with the tracking pixel embedded.',
    'ipt.imgNamePh': 'e.g. Test image',
    'ipt.chooseImage': 'Choose image',
    'ipt.dropImage': 'Click or drag & drop image here (PNG/JPG)',
    'ipt.createImgBtn': 'Create tracking link',
    'ipt.downloadImg': 'Download image (pixel embedded)',
    'ipt.listTitle': 'Created tracking links',
    'ipt.colName': 'Name',
    'ipt.colType': 'Type',
    'ipt.colClicks': 'Clicks',
    'ipt.colLastClick': 'Last click',
    'ipt.colActions': 'Actions',
    'ipt.shareTitle': 'Share Link — Check status',
    'ipt.shareDesc': 'This link is public (no login required), use it to tell others whether the victim clicked the link.',
    'ipt.shareUrl': 'Share URL:',
    'ipt.status': 'Status',
    'ipt.clickCount': 'Click count',
    'common.loading': 'Loading...',
    'common.checking': 'Checking...',
    'lst.empty': 'No tracking links yet. Create one above!',
    'lst.untitled': '(untitled)',
    'lst.viewResults': 'View results',
    'lst.delete': 'Delete',
    'lst.waiting': 'Creating...',
    'lst.noImg': 'Please choose an image!',
    'lst.copyDone': '✅ Copied!',
    'lst.err': 'Error: ',
    'lst.createBtn': 'Create tracking link',
    'results.title': '📊 Tracking results: ',
    'results.type': 'Type',
    'results.typeUrl': '🔗 URL Redirect',
    'results.typeImg': '🖼 Image',
    'results.totalClicks': 'Total clicks',
    'results.token': 'Token',
    'results.created': 'Created',
    'results.noClicks': 'Nobody has clicked this link yet.',
    'results.colTime': 'Time',
    'results.colLan': 'IP (LAN)',
    'results.colWan': 'IP (WAN)',
    'results.colUa': 'User-Agent',
    'results.colHeaders': 'Headers',
    'share.checked': 'Clicked',
    'share.notChecked': 'Not clicked',
    'share.lastClick': ' (last: ',
    'del.confirm': 'Delete this tracking link? All logs will be removed too.'
  }
};

let currentLang = (typeof localStorage !== 'undefined' && localStorage.getItem('lang')) || 'vi';

function t(key) {
  return I18N[currentLang]?.[key] ?? I18N.vi[key] ?? key;
}

function applyI18n() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  if (document.title) document.title = t('ipt.title');
}

// Override auth.js toggleLang to also translate page content
window.toggleLang = function() {
  currentLang = currentLang === 'en' ? 'vi' : 'en';
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('lang', currentLang);
  }
  // Re-render navbar (auth.js) with new language
  if (typeof Auth !== 'undefined' && Auth.initNavbar) {
    Auth.initNavbar();
  }
  // Keep theme button synced after navbar re-render
  if (typeof window.loadTheme === 'function') {
    window.loadTheme();
  }
  applyI18n();
  loadTrackerList();
};

// ============================================

const API_BASE = window.location.origin;
let authToken = '';
let currentUserId = null;

function getToken() {
  const t = Auth.getToken();
  if (t) authToken = t;
  return authToken;
}

function getUser() {
  const u = Auth.getUser();
  return u;
}

// Auth check
getToken();
const user = getUser();
if (!authToken || !user) {
  // Redirect to login
  window.location.href = '/login.html';
}

currentUserId = user.id;

document.addEventListener('DOMContentLoaded', () => {
  Auth.initNavbar();
  if (typeof window.loadTheme === 'function') {
    window.loadTheme();
  }
  applyI18n();
});

// ===== TABS =====
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    document.getElementById('tab-' + btn.dataset.tab).style.display = 'block';
  });
});

// ===== FILE UPLOAD =====
const fileUploadArea = document.getElementById('file-upload-area');
const fileInput = document.getElementById('img-file');
const fileNameDisplay = document.getElementById('file-name-display');

if (fileUploadArea) {
  fileUploadArea.addEventListener('click', () => fileInput.click());
  fileUploadArea.addEventListener('dragover', (e) => { e.preventDefault(); fileUploadArea.style.borderColor = '#2563eb'; });
  fileUploadArea.addEventListener('dragleave', () => { fileUploadArea.style.borderColor = ''; });
  fileUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    fileUploadArea.style.borderColor = '';
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      handleFileSelect();
    }
  });
  fileInput.addEventListener('change', handleFileSelect);
}

function handleFileSelect() {
  if (fileInput.files.length) {
    const f = fileInput.files[0];
    fileNameDisplay.textContent = '✅ ' + f.name + ' (' + (f.size / 1024).toFixed(1) + ' KB)';
    fileUploadArea.classList.add('has-file');
  }
}

// ===== COPY =====
window.copyText = function(elementId) {
  const el = document.getElementById(elementId);
  const text = el.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = el.parentElement.querySelector('.copy-btn');
    const orig = btn.textContent;
    btn.textContent = t('lst.copyDone');
    setTimeout(() => btn.textContent = orig, 1500);
  });
}

// ===== API HELPERS =====
async function api(url, options = {}) {
  const headers = { 'Authorization': 'Bearer ' + authToken };
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(API_BASE + url, {
    ...options,
    headers: { ...headers, ...options.headers }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: t('lst.err') + 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  // Check if response is JSON
  const ct = res.headers.get('content-type');
  if (ct && ct.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

// ===== CREATE URL TRACKER =====
const btnCreateUrl = document.getElementById('btn-create-url');
if (btnCreateUrl) {
  btnCreateUrl.addEventListener('click', async () => {
    const name = document.getElementById('url-name').value.trim();
    const redirect = document.getElementById('url-redirect').value.trim() || 'https://www.google.com';
    const btn = document.getElementById('btn-create-url');
    btn.disabled = true;
    btn.innerHTML = '<span class="loader"></span> ' + t('lst.waiting');
    document.getElementById('result-url').classList.remove('show');

    try {
      const ogTitle = document.getElementById('url-og-title').value.trim();
      const ogDesc = document.getElementById('url-og-desc').value.trim();
      const ogImage = document.getElementById('url-og-image').value.trim();
      const result = await api('/api/tools/ip-tracker/create', {
        method: 'POST',
        body: JSON.stringify({ type: 'url', name, redirect_url: redirect, og_title: ogTitle, og_description: ogDesc, og_image: ogImage })
      });
      if (result.success) {
        document.getElementById('url-tracking-url').textContent = result.trackingUrl;
        document.getElementById('url-share-link').href = result.shareUrl;
        document.getElementById('result-url').classList.add('show');
        document.getElementById('url-name').value = '';
        document.getElementById('url-redirect').value = '';
        loadTrackerList();
      }
    } catch (err) {
      alert(t('lst.err') + err.message);
    }
    btn.disabled = false;
    btn.textContent = t('lst.createBtn');
  });
}

// ===== CREATE IMAGE TRACKER =====
const btnCreateImg = document.getElementById('btn-create-img');
if (btnCreateImg) {
  btnCreateImg.addEventListener('click', async () => {
    const name = document.getElementById('img-name').value.trim();
    if (!fileInput.files.length) { alert(t('lst.noImg')); return; }

    const btn = document.getElementById('btn-create-img');
    btn.disabled = true;
    btn.innerHTML = '<span class="loader"></span> ' + t('lst.waiting');
    document.getElementById('result-img').classList.remove('show');

    try {
      const fd = new FormData();
      fd.append('type', 'image');
      fd.append('name', name);
      fd.append('image', fileInput.files[0]);
      fd.append('og_title', document.getElementById('img-og-title').value.trim());
      fd.append('og_description', document.getElementById('img-og-desc').value.trim());
      fd.append('og_image', document.getElementById('img-og-image').value.trim());

      const result = await api('/api/tools/ip-tracker/create', {
        method: 'POST',
        body: fd
      });
      if (result.success) {
        document.getElementById('img-tracking-url').textContent = result.trackingUrl;
        document.getElementById('img-download-url').href = result.imageDownloadUrl;
        document.getElementById('img-share-link').href = result.shareUrl;
        document.getElementById('result-img').classList.add('show');
        document.getElementById('img-name').value = '';
        fileInput.value = '';
        fileUploadArea.classList.remove('has-file');
        fileNameDisplay.textContent = '';
        loadTrackerList();
      }
    } catch (err) {
      alert(t('lst.err') + err.message);
    }
    btn.disabled = false;
    btn.textContent = t('lst.createBtn');
  });
}

// ===== LOAD LIST =====
async function loadTrackerList() {
  const tbody = document.getElementById('tracker-list');
  if (!tbody) return;
  try {
    const list = await api('/api/tools/ip-tracker/list');
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">' + t('lst.empty') + '</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(item => {
      const typeBadge = item.type === 'url' ? '<span class="badge badge-url">URL</span>' : '<span class="badge badge-image">Image</span>';
      const lastClick = item.last_click ? new Date(item.last_click).toLocaleString(currentLang === 'vi' ? 'vi-VN' : 'en-US') : '-';
      return `<tr>
        <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.name}">${item.name || t('lst.untitled')}</td>
        <td>${typeBadge}</td>
        <td><strong class="col-accent1">${item.click_count}</strong></td>
        <td style="font-size: 12px; color: var(--muted);">${lastClick}</td>
        <td>
          <button class="btn-icon" onclick="copyTextFromValue('${item.trackingUrl}')" title="Copy tracking link">📋</button>
          <button class="btn-icon" onclick="viewResults(${item.id})" title="${t('lst.viewResults')}">📊</button>
          <button class="btn-icon" onclick="openShareModal(${item.id}, '${item.shareUrl}')" title="Share link">🔗</button>
          <button class="btn-icon" onclick="deleteTracker(${item.id})" title="${t('lst.delete')}" class="col-accent3">🗑</button>
        </td>
      </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty col-accent3">' + t('lst.err') + err.message + '</td></tr>';
  }
}

// Copy from value directly (not DOM element)
window.copyTextFromValue = function(text) {
  navigator.clipboard.writeText(text).then(() => {
    // Flash feedback
  });
}

// ===== VIEW RESULTS =====
let currentTrackerId = null;

window.viewResults = async function(id) {
  currentTrackerId = id;
  try {
    const data = await api('/api/tools/ip-tracker/' + id + '/results');
    showResultsModal(data);
  } catch (err) {
    alert(t('lst.err') + err.message);
  }
}

function showResultsModal(data) {
  const { tracker, logs } = data;

  let html = `<div class="modal-header">
    <h3>${t('results.title')} ${tracker.name || t('lst.untitled')}</h3>
    <button class="modal-close" onclick="closeResultsModal()">&times;</button>
  </div>
  <div class="modal-body">`;

  const locale = currentLang === 'vi' ? 'vi-VN' : 'en-US';
  // Info
  html += `<div class="info-grid">
    <div class="info-item"><div class="il">${t('results.type')}</div><div class="iv">${tracker.type === 'url' ? t('results.typeUrl') : t('results.typeImg')}</div></div>
    <div class="info-item"><div class="il">${t('results.totalClicks')}</div><div class="iv col-accent1" style="font-weight: 600;">${logs.length}</div></div>
    <div class="info-item"><div class="il">${t('results.token')}</div><div class="iv" style="font-size: 12px;">${tracker.token}</div></div>
    <div class="info-item"><div class="il">${t('results.created')}</div><div class="iv" style="font-size: 13px;">${new Date(tracker.created_at).toLocaleString(locale)}</div></div>
  </div>`;

  if (!logs.length) {
    html += `<div style="text-align: center; padding: 40px; color: var(--muted);">${t('results.noClicks')}</div>`;
  } else {
      html += `<div class="table-wrap"><table><thead><tr>
      <th>#</th><th>${t('results.colTime')}</th><th>${t('results.colLan')}</th><th>${t('results.colWan')}</th><th>${t('results.colUa')}</th><th>${t('results.colHeaders')}</th>
    </tr></thead><tbody>`;
    logs.forEach((log, i) => {
      const time = new Date(log.timestamp).toLocaleString(locale);
      const ua = log.user_agent || 'N/A';
      const uaShort = ua.length > 50 ? ua.substring(0, 50) + '...' : ua;
      const headersStr = log.headers && Object.keys(log.headers).length
        ? Object.entries(log.headers).map(([k, v]) => `<span class="col-accent1">${k}</span>: <span class="muted">${v}</span>`).join('<br>')
        : '-';

      const wanIp = log.wan_ip || '-';
      html += `<tr>
        <td>${i + 1}</td>
        <td style="font-size: 12px; white-space: nowrap;">${time}</td>
        <td><strong class="col-accent2">${log.ip}</strong></td>
        <td><strong class="col-accent1">${wanIp}</strong></td>
        <td style="font-size: 12px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${ua}">${uaShort}</td>
        <td style="font-size: 11px; max-width: 250px; word-break: break-all;">${headersStr}</td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
  }

  html += `</div>`;

  // Create/update modal
  let modal = document.getElementById('results-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'results-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = '<div class="modal" id="results-modal-inner">' + html + '</div>';
    document.body.appendChild(modal);
  } else {
    document.getElementById('results-modal-inner').innerHTML = html;
  }
  modal.classList.add('show');
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeResultsModal();
  });
}

window.closeResultsModal = function() {
  const modal = document.getElementById('results-modal');
  if (modal) modal.classList.remove('show');
  currentTrackerId = null;
}

// ===== SHARE MODAL =====
window.openShareModal = async function(id, shareUrl) {
  document.getElementById('share-url-display').textContent = shareUrl;
  document.getElementById('share-status').innerHTML = '<span class="loader"></span>&nbsp;' + t('common.checking');
  document.getElementById('share-click-count').textContent = '-';
  document.getElementById('share-modal').classList.add('show');

  try {
    const data = await api('/api/tools/ip-tracker/' + id + '/share');
    const statusHtml = data.clicked
      ? '<span class="status-dot on"></span> <span class="col-accent2">' + t('share.checked') + '</span>'
      : '<span class="status-dot off"></span> <span class="col-accent1">' + t('share.notChecked') + '</span>';
    document.getElementById('share-status').innerHTML = statusHtml;
    const lastClickStr = data.lastClick ? t('share.lastClick') + new Date(data.lastClick).toLocaleString(currentLang === 'vi' ? 'vi-VN' : 'en-US') + ')' : '';
    document.getElementById('share-click-count').textContent = data.clickCount + lastClickStr;
  } catch (err) {
    document.getElementById('share-status').innerHTML = '<span class="col-accent3">' + t('lst.err') + err.message + '</span>';
  }
}

window.closeShareModal = function() {
  const m = document.getElementById('share-modal');
  if (m) m.classList.remove('show');
}

// Close share modal on overlay click
const shareModal = document.getElementById('share-modal');
if (shareModal) {
  shareModal.addEventListener('click', (e) => {
    if (e.target === document.getElementById('share-modal')) closeShareModal();
  });
}

// ===== DELETE =====
window.deleteTracker = async function(id) {
  if (!confirm(t('del.confirm'))) return;

  try {
    await api('/api/tools/ip-tracker/' + id, { method: 'DELETE' });
    loadTrackerList();
  } catch (err) {
    alert(t('lst.err') + err.message);
  }
}

// ===== INIT =====
if (currentLang !== 'vi' && currentLang !== 'en') {
  currentLang = 'vi';
}
loadTrackerList();