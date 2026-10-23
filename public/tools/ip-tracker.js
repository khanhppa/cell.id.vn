// Bẫy địa chỉ IP — frontend (public/tools/ip-tracker.js)
//
// Ghi chú kiến trúc:
// - File này TỰ chứa bộ i18n của trang (không dựa vào i18n của auth.js), vì
//   auth.js chỉ dịch navbar. `window.toggleLang` được ghi đè sau khi auth.js nạp
//   để đổi ngôn ngữ cho cả navbar lẫn nội dung trang.
// - Mọi chuỗi do server trả về (tên bẫy, UA, header, referer…) đều đi qua `esc()`
//   trước khi vào innerHTML: đây là dữ liệu NGƯỜI LẠ gửi lên, phải coi là không tin được.
// - Không dùng onclick nội tuyến: dữ liệu chứa dấu ' sẽ làm gãy thuộc tính. Dùng
//   `data-*` + uỷ quyền sự kiện.

// ============================================================
// i18n (VI / EN)
// ============================================================
const I18N = {
  vi: {
    'ipt.title': 'Bẫy địa chỉ IP - Cell.id.vn',
    'ipt.h1': 'Bẫy địa chỉ IP',
    'ipt.subtitle': 'Tạo link bẫy: khi ai đó bấm vào link hoặc xem ảnh, hệ thống ghi lại IP, vị trí, thiết bị, trình duyệt và thông tin request.',
    'ipt.tabUrl': 'Link chuyển hướng',
    'ipt.tabImage': 'Ảnh (Image)',
    'ipt.urlTitle': 'Tạo bẫy link',
    'ipt.urlDesc': 'Người mở link sẽ được chuyển đến URL bạn nhập sau ~0,4 giây; trong lúc đó trình duyệt của họ gửi kèm thông tin thiết bị, màn hình, múi giờ và IP công khai.',
    'ipt.name': 'Tên (ghi nhớ)',
    'ipt.namePh': 'VD: Link VNExpress test',
    'ipt.urlRedirect': 'URL chuyển hướng (nơi người xem được đưa đến)',
    'ipt.ogSummary': '⚙ Tuỳ chỉnh OG (Open Graph) — nội dung hiện khi share Facebook, Zalo, Telegram…',
    'ipt.ogTitle': 'OG Title (tiêu đề khi share)',
    'ipt.ogTitlePh': 'VD: Bài viết mới - Tin tức 24h',
    'ipt.ogDesc': 'OG Description (mô tả)',
    'ipt.ogDescPh': 'VD: Cập nhật tin tức nhanh chóng và chính xác',
    'ipt.ogImage': 'OG Image (ảnh đại diện khi share)',
    'ipt.ogImagePh': 'https://example.com/image.jpg',
    'ipt.ogModeLink': '🔗 Dán link ảnh',
    'ipt.ogModeUpload': '⬆ Tải ảnh lên',
    'ipt.ogModeNone': '🚫 Không dùng',
    'ipt.ogDropHint': 'Bấm để chọn ảnh, hoặc kéo thả ảnh vào đây',
    'ipt.ogUploadHint': 'Ảnh sẽ được tự cắt về 1200×630 và lưu trên máy chủ.',
    'ipt.previewOg': 'Xem trước ảnh OG',
    'ipt.createUrlBtn': 'Tạo bẫy link',
    'ipt.trackingLinkLabel': 'Link bẫy (gửi link này cho người cần theo dõi):',
    'ipt.copy': 'Copy',
    'ipt.shareLink': 'Link kiểm tra (công khai)',
    'ipt.imgTitle': 'Tạo bẫy ảnh',
    'ipt.imgDesc': 'Tải ảnh bất kỳ. Khi ai đó mở link ảnh, ảnh hiển thị bình thường nhưng mọi lượt xem đều được ghi lại (IP, vị trí, thiết bị, header).',
    'ipt.imgNamePh': 'VD: Ảnh test',
    'ipt.chooseImage': 'Chọn ảnh',
    'ipt.dropImage': 'Bấm hoặc kéo thả ảnh vào đây (PNG / JPG / WEBP / GIF)',
    'ipt.createImgBtn': 'Tạo bẫy ảnh',
    'ipt.downloadImg': 'Tải ảnh đã nhúng pixel',
    'ipt.listTitle': 'Danh sách bẫy đã tạo',
    'ipt.colName': 'Tên',
    'ipt.colType': 'Loại',
    'ipt.colClicks': 'Lượt',
    'ipt.colVisitors': 'Thiết bị',
    'ipt.colLastClick': 'Lượt gần nhất',
    'ipt.colActions': 'Thao tác',
    'ipt.colLink': 'Copy link bẫy',
    'ipt.shareTitle': 'Link kiểm tra — trạng thái',
    'ipt.shareDesc': 'Link này công khai (không cần đăng nhập), dùng để cho người khác xem đã có lượt truy cập hay chưa.',
    'ipt.shareUrl': 'URL kiểm tra:',
    'ipt.status': 'Trạng thái',
    'ipt.clickCount': 'Số lượt',
    'common.loading': 'Đang tải...',
    'common.checking': 'Đang kiểm tra...',
    'lst.empty': 'Chưa có bẫy nào. Tạo một cái ở trên!',
    'lst.untitled': '(không tên)',
    'lst.viewResults': 'Xem kết quả',
    'lst.delete': 'Xoá',
    'lst.waiting': 'Đang tạo...',
    'lst.noImg': 'Chưa chọn ảnh!',
    'lst.copyDone': '✅ Đã copy',
    'lst.err': 'Lỗi: ',
    'lst.sessionExpired': 'Phiên đăng nhập đã hết hạn, đang chuyển về trang đăng nhập...',
    'lst.tooBig': 'Ảnh quá lớn (tối đa 25 MB).',
    'lst.notImage': 'File đã chọn không phải ảnh.',
    'results.title': '📊 Kết quả bẫy',
    'results.type': 'Loại',
    'results.typeUrl': '🔗 Link chuyển hướng',
    'results.typeImg': '🖼 Ảnh',
    'results.totalVisits': 'Tổng lượt',
    'results.uniqueIps': 'IP khác nhau',
    'results.uniqueVisitors': 'Thiết bị khác nhau',
    'results.countries': 'Quốc gia',
    'results.token': 'Token',
    'results.created': 'Ngày tạo',
    'results.noClicks': 'Chưa có lượt truy cập nào.',
    'results.details': 'Chi tiết',
    'results.exportCsv': '⬇ Xuất CSV',
    'results.ip': 'IP',
    'results.wan': 'IP công khai',
    'results.location': 'Vị trí',
    'results.isp': 'Nhà mạng',
    'results.device': 'Thiết bị',
    'results.screen': 'Màn hình',
    'results.timezone': 'Múi giờ',
    'results.locale': 'Ngôn ngữ',
    'results.referer': 'Nguồn vào (referer)',
    'results.headers': 'Header request',
    'results.queryParams': 'Query params',
    'results.none': '(không có)',
    'ev.click': 'Bấm link',
    'ev.view': 'Xem ảnh',
    'ev.download': 'Tải ảnh',
    'share.checked': 'Đã có lượt truy cập',
    'share.notChecked': 'Chưa có lượt nào',
    'share.lastClick': ' (lần cuối: ',
    'del.confirm': 'Xoá bẫy này? Toàn bộ lượt truy cập cũng bị xoá.'
  },
  en: {
    'ipt.title': 'IP Address Trap - Cell.id.vn',
    'ipt.h1': 'IP Address Trap',
    'ipt.subtitle': 'Create a trap link: when someone clicks it or views the image, the system records their IP, location, device, browser and request headers.',
    'ipt.tabUrl': 'Redirect link',
    'ipt.tabImage': 'Image',
    'ipt.urlTitle': 'Create a link trap',
    'ipt.urlDesc': 'Visitors are redirected to your URL after ~0.4s, while their browser reports device, screen, timezone and public IP.',
    'ipt.name': 'Name (label)',
    'ipt.namePh': 'e.g. VNExpress test link',
    'ipt.urlRedirect': 'Redirect URL (where the visitor is sent)',
    'ipt.ogSummary': '⚙ Open Graph settings — what Facebook, Zalo, Telegram show when shared',
    'ipt.ogTitle': 'OG Title',
    'ipt.ogTitlePh': 'e.g. New article - 24h News',
    'ipt.ogDesc': 'OG Description',
    'ipt.ogDescPh': 'e.g. Latest news, fast and accurate',
    'ipt.ogImage': 'OG Image (cover shown when shared)',
    'ipt.ogImagePh': 'https://example.com/image.jpg',
    'ipt.ogModeLink': '🔗 Paste image URL',
    'ipt.ogModeUpload': '⬆ Upload image',
    'ipt.ogModeNone': '🚫 None',
    'ipt.ogDropHint': 'Click to choose an image, or drag & drop it here',
    'ipt.ogUploadHint': 'The image is cropped to 1200×630 and stored on the server.',
    'ipt.previewOg': 'Preview OG image',
    'ipt.createUrlBtn': 'Create link trap',
    'ipt.trackingLinkLabel': 'Trap link (send this to the target):',
    'ipt.copy': 'Copy',
    'ipt.shareLink': 'Status link (public)',
    'ipt.imgTitle': 'Create an image trap',
    'ipt.imgDesc': 'Upload any image. It displays normally, but every view is recorded (IP, location, device, headers).',
    'ipt.imgNamePh': 'e.g. Test image',
    'ipt.chooseImage': 'Choose image',
    'ipt.dropImage': 'Click or drag & drop an image (PNG / JPG / WEBP / GIF)',
    'ipt.createImgBtn': 'Create image trap',
    'ipt.downloadImg': 'Download image (pixel embedded)',
    'ipt.listTitle': 'Created traps',
    'ipt.colName': 'Name',
    'ipt.colType': 'Type',
    'ipt.colClicks': 'Visits',
    'ipt.colVisitors': 'Devices',
    'ipt.colLastClick': 'Last visit',
    'ipt.colActions': 'Actions',
    'ipt.colLink': 'Copy trap link',
    'ipt.shareTitle': 'Status link',
    'ipt.shareDesc': 'This link is public (no login required) — share it so others can see whether a visit happened.',
    'ipt.shareUrl': 'Status URL:',
    'ipt.status': 'Status',
    'ipt.clickCount': 'Visits',
    'common.loading': 'Loading...',
    'common.checking': 'Checking...',
    'lst.empty': 'No traps yet. Create one above!',
    'lst.untitled': '(untitled)',
    'lst.viewResults': 'View results',
    'lst.delete': 'Delete',
    'lst.waiting': 'Creating...',
    'lst.noImg': 'Please choose an image!',
    'lst.copyDone': '✅ Copied',
    'lst.err': 'Error: ',
    'lst.sessionExpired': 'Session expired, redirecting to login...',
    'lst.tooBig': 'Image too large (max 25 MB).',
    'lst.notImage': 'The selected file is not an image.',
    'results.title': '📊 Trap results',
    'results.type': 'Type',
    'results.typeUrl': '🔗 Redirect link',
    'results.typeImg': '🖼 Image',
    'results.totalVisits': 'Total visits',
    'results.uniqueIps': 'Unique IPs',
    'results.uniqueVisitors': 'Unique devices',
    'results.countries': 'Countries',
    'results.token': 'Token',
    'results.created': 'Created',
    'results.noClicks': 'Nobody has visited this trap yet.',
    'results.details': 'Details',
    'results.exportCsv': '⬇ Export CSV',
    'results.ip': 'IP',
    'results.wan': 'Public IP',
    'results.location': 'Location',
    'results.isp': 'ISP',
    'results.device': 'Device',
    'results.screen': 'Screen',
    'results.timezone': 'Timezone',
    'results.locale': 'Language',
    'results.referer': 'Referer',
    'results.headers': 'Request headers',
    'results.queryParams': 'Query params',
    'results.none': '(none)',
    'ev.click': 'Link click',
    'ev.view': 'Image view',
    'ev.download': 'Download',
    'share.checked': 'Visited',
    'share.notChecked': 'Not visited yet',
    'share.lastClick': ' (last: ',
    'del.confirm': 'Delete this trap? All visits will be removed too.'
  }
};

let currentLang = (typeof localStorage !== 'undefined' && localStorage.getItem('lang')) || 'vi';
if (currentLang !== 'vi' && currentLang !== 'en') currentLang = 'vi';

function t(key) {
  return (I18N[currentLang] && I18N[currentLang][key]) || I18N.vi[key] || key;
}

// ============================================================
// Tiện ích
// ============================================================
const HTML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape cho mọi giá trị đưa vào innerHTML/attribute. */
function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => HTML_ESC[c]);
}

function fmtDate(v) {
  if (!v) return '-';
  // SQLite trả 'YYYY-MM-DD HH:MM:SS' theo UTC, không có 'Z' → Safari hiểu sai.
  const d = new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v) ? v.replace(' ', 'T') + 'Z' : v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleString(currentLang === 'vi' ? 'vi-VN' : 'en-US');
}

function fmtBytes(n) {
  const v = Number(n) || 0;
  if (v < 1024) return v + ' B';
  if (v < 1024 * 1024) return (v / 1024).toFixed(1) + ' KB';
  return (v / (1024 * 1024)).toFixed(2) + ' MB';
}

const DEVICE_ICON = { mobile: '📱', tablet: '📲', desktop: '💻', bot: '🤖', tv: '📺', unknown: '❔' };

// ============================================================
// i18n áp dụng lên DOM
// ============================================================
function applyI18n() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
  });
  document.title = t('ipt.title');
  syncButtonText();
}

/** Nhãn nút tạo: HTML bọc trong <span data-i18n>, nên chỉ sửa span, không ghi đè button. */
function syncButtonText() {
  const map = { 'btn-create-url': 'ipt.createUrlBtn', 'btn-create-img': 'ipt.createImgBtn' };
  Object.keys(map).forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const span = btn.querySelector('[data-i18n]');
    if (span) {
      span.setAttribute('data-i18n', map[id]);
      span.textContent = t(map[id]);
    } else if (!btn.disabled) {
      btn.textContent = t(map[id]);
    }
  });
}

// Ghi đè toggleLang của auth.js: đổi navbar + nội dung trang.
window.toggleLang = function () {
  currentLang = currentLang === 'en' ? 'vi' : 'en';
  try { localStorage.setItem('lang', currentLang); } catch (_) { /* chế độ riêng tư */ }
  if (typeof Auth !== 'undefined' && Auth.initNavbar) Auth.initNavbar();
  if (typeof window.loadTheme === 'function') window.loadTheme();
  applyI18n();
  if (authToken) loadTrackerList();
};

// ============================================================
// Auth + API
// ============================================================
const API_BASE = window.location.origin;
let authToken = '';
let currentUserId = null;
let trackerRows = [];
let currentTrackerId = null;

function authGuard() {
  try {
    if (typeof Auth === 'undefined' || !Auth) return false;
    authToken = Auth.getToken() || '';
    const user = Auth.getUser();
    if (!authToken || !user) { Auth.goLogin(); return false; }
    currentUserId = user.id;
    return true;
  } catch (err) {
    console.error('Bẫy địa chỉ IP: khởi tạo đăng nhập lỗi', err);
    return false;
  }
}

/** Gọi API JSON. 401 → dọn phiên và về trang chủ (không hiện bảng trống khó hiểu). */
async function api(url, options) {
  const opts = options || {};
  const headers = { 'Authorization': 'Bearer ' + authToken };
  const isForm = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  if (opts.body && !isForm) headers['Content-Type'] = 'application/json';
  if (opts.headers) Object.assign(headers, opts.headers);

  const res = await fetch(API_BASE + url, Object.assign({}, opts, { headers }));
  if (res.status === 401) {
    try { if (Auth.clearSession) Auth.clearSession(); if (Auth.goLogin) Auth.goLogin(); } catch (_) {}
    throw new Error(t('lst.sessionExpired'));
  }
  const ct = res.headers.get('content-type') || '';
  const isJson = ct.indexOf('application/json') !== -1;
  if (!res.ok) {
    // Không phải JSON (proxy trả HTML 404/403) → đừng ném lỗi parse khó hiểu.
    const body = isJson ? await res.json().catch(() => ({})) : {};
    throw new Error(body.error || ('HTTP ' + res.status));
  }
  return isJson ? res.json() : res.text();
}

// ============================================================
// Copy (có fallback cho http LAN — navigator.clipboard bị chặn)
// ============================================================
function copyTextValue(text, btn) {
  const done = () => {
    if (!btn) return;
    const span = btn.querySelector('[data-i18n]');
    const target = span || btn;
    const orig = target.textContent;
    target.textContent = t('lst.copyDone');
    setTimeout(() => { target.textContent = orig; }, 1400);
  };
  const fallback = () => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done();
    } catch (_) { /* trình duyệt chặn hẳn: bỏ qua */ }
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(fallback);
  } else {
    fallback();
  }
}

// Uỷ quyền cho mọi nút copy có data-copy-target
document.addEventListener('click', (e) => {
  const btn = e.target.closest && e.target.closest('[data-copy-target]');
  if (!btn) return;
  const el = document.getElementById(btn.getAttribute('data-copy-target'));
  if (el) copyTextValue(el.textContent || '', btn);
});

// ============================================================
// Bộ chọn ảnh OG: dán URL | tải ảnh lên | không dùng
// ============================================================
const ogPickers = {};

function initOgPickers() {
  document.querySelectorAll('[data-og-picker]').forEach(wrap => {
    const key = wrap.getAttribute('data-og-picker');
    const state = {
      key,
      mode: 'link',
      urlInput: wrap.querySelector('[data-og-url]'),
      fileInput: wrap.querySelector('[data-og-file]'),
      drop: wrap.querySelector('[data-og-drop]'),
      filename: wrap.querySelector('[data-og-filename]'),
      preview: wrap.querySelector('[data-og-preview]'),
      previewImg: wrap.querySelector('[data-og-preview] img'),
      objectUrl: null
    };
    ogPickers[key] = state;

    wrap.querySelectorAll('[data-og-mode]').forEach(btn => {
      btn.addEventListener('click', () => setOgMode(key, btn.getAttribute('data-og-mode')));
    });

    if (state.drop && state.fileInput) {
      state.drop.addEventListener('click', () => state.fileInput.click());
      state.drop.addEventListener('dragover', (e) => { e.preventDefault(); state.drop.classList.add('has-file'); });
      state.drop.addEventListener('dragleave', () => state.drop.classList.remove('has-file'));
      state.drop.addEventListener('drop', (e) => {
        e.preventDefault();
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
          state.fileInput.files = e.dataTransfer.files;
          onOgFile(key);
        }
      });
      state.fileInput.addEventListener('change', () => onOgFile(key));
    }
    if (state.urlInput) {
      state.urlInput.addEventListener('input', () => {
        const v = state.urlInput.value.trim();
        if (/^https?:\/\//i.test(v)) showOgPreview(key, v);
      });
    }
  });
}

function setOgMode(key, mode) {
  const s = ogPickers[key];
  if (!s) return;
  s.mode = mode;
  const wrap = document.querySelector('[data-og-picker="' + key + '"]');
  if (!wrap) return;
  wrap.querySelectorAll('[data-og-mode]').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-og-mode') === mode);
  });
  wrap.querySelectorAll('[data-og-pane]').forEach(p => {
    p.classList.toggle('show', p.getAttribute('data-og-pane') === mode);
  });
}

function onOgFile(key) {
  const s = ogPickers[key];
  if (!s || !s.fileInput) return;
  const f = s.fileInput.files && s.fileInput.files[0];
  if (!f) return;
  if (f.size > 25 * 1024 * 1024) { alert(t('lst.tooBig')); s.fileInput.value = ''; return; }
  if (!/^image\//.test(f.type || '')) { alert(t('lst.notImage')); s.fileInput.value = ''; return; }
  if (s.filename) s.filename.textContent = '✅ ' + f.name + ' (' + fmtBytes(f.size) + ')';
  if (s.drop) s.drop.classList.add('has-file');
  if (s.objectUrl) { try { URL.revokeObjectURL(s.objectUrl); } catch (_) {} }
  s.objectUrl = URL.createObjectURL(f);
  showOgPreview(key, s.objectUrl);
}

function showOgPreview(key, src) {
  const s = ogPickers[key];
  if (!s || !s.preview || !s.previewImg) return;
  s.previewImg.src = src;
  s.preview.classList.add('show');
}

/** Giá trị OG gửi lên server: {url, file} — chỉ một trong hai có giá trị. */
function getOgPayload(key) {
  const s = ogPickers[key];
  if (!s || s.mode === 'none') return { url: '', file: null };
  if (s.mode === 'upload') {
    const f = s.fileInput && s.fileInput.files ? s.fileInput.files[0] : null;
    return { url: '', file: f || null };
  }
  return { url: s.urlInput ? s.urlInput.value.trim() : '', file: null };
}

function resetOg(key) {
  const s = ogPickers[key];
  if (!s) return;
  setOgMode(key, 'link');
  if (s.urlInput) s.urlInput.value = '';
  if (s.fileInput) s.fileInput.value = '';
  if (s.filename) s.filename.textContent = '';
  if (s.drop) s.drop.classList.remove('has-file');
  if (s.preview) s.preview.classList.remove('show');
  if (s.objectUrl) { try { URL.revokeObjectURL(s.objectUrl); } catch (_) {} s.objectUrl = null; }
}

// ============================================================
// Tạo bẫy
// ============================================================
const fileUploadArea = document.getElementById('file-upload-area');
const fileInput = document.getElementById('img-file');
const fileNameDisplay = document.getElementById('file-name-display');

function initMainImagePicker() {
  if (!fileUploadArea || !fileInput) return;
  fileUploadArea.addEventListener('click', () => fileInput.click());
  fileUploadArea.addEventListener('dragover', (e) => { e.preventDefault(); fileUploadArea.style.borderColor = 'var(--primary)'; });
  fileUploadArea.addEventListener('dragleave', () => { fileUploadArea.style.borderColor = ''; });
  fileUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    fileUploadArea.style.borderColor = '';
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      onMainFileSelect();
    }
  });
  fileInput.addEventListener('change', onMainFileSelect);
}

function onMainFileSelect() {
  if (!fileInput.files || !fileInput.files.length) return;
  const f = fileInput.files[0];
  if (f.size > 25 * 1024 * 1024) { alert(t('lst.tooBig')); fileInput.value = ''; return; }
  if (fileNameDisplay) fileNameDisplay.textContent = '✅ ' + f.name + ' (' + fmtBytes(f.size) + ')';
  fileUploadArea.classList.add('has-file');
}

function clearMainFile() {
  if (!fileInput) return;
  fileInput.value = '';
  if (fileUploadArea) fileUploadArea.classList.remove('has-file');
  if (fileNameDisplay) fileNameDisplay.textContent = '';
}

// ---- Tab: link ----
const btnCreateUrl = document.getElementById('btn-create-url');
if (btnCreateUrl) {
  btnCreateUrl.addEventListener('click', async () => {
    const name = document.getElementById('url-name').value.trim();
    const redirect = document.getElementById('url-redirect').value.trim() || 'https://www.google.com';
    const og = getOgPayload('url');

    if (og.url && !/^https?:\/\//i.test(og.url)) { alert(t('lst.err') + 'OG Image URL phải bắt đầu bằng http:// hoặc https://'); return; }

    const btn = btnCreateUrl;
    btn.disabled = true;
    btn.innerHTML = '<span class="loader"></span> ' + esc(t('lst.waiting'));
    document.getElementById('result-url').classList.remove('show');

    const fd = new FormData();
    fd.append('type', 'url');
    fd.append('name', name);
    fd.append('redirect_url', redirect);
    fd.append('og_title', document.getElementById('url-og-title').value.trim());
    fd.append('og_description', document.getElementById('url-og-desc').value.trim());
    if (og.url) fd.append('og_image', og.url);
    if (og.file) fd.append('og_image_file', og.file);

    try {
      const result = await api('/api/tools/ip-tracker/create', { method: 'POST', body: fd });
      if (result && result.success) {
        document.getElementById('url-tracking-url').textContent = result.trackingUrl;
        document.getElementById('url-share-link').href = result.shareUrl;
        const ogLink = document.getElementById('url-og-preview-link');
        if (result.ogImageUrl) { ogLink.href = result.ogImageUrl; ogLink.style.display = ''; }
        else { ogLink.removeAttribute('href'); ogLink.style.display = 'none'; }
        document.getElementById('result-url').classList.add('show');
        document.getElementById('url-name').value = '';
        document.getElementById('url-redirect').value = '';
        document.getElementById('url-og-title').value = '';
        document.getElementById('url-og-desc').value = '';
        resetOg('url');
        loadTrackerList();
      }
    } catch (err) {
      alert(t('lst.err') + err.message);
    }

    btn.disabled = false;
    btn.innerHTML = '<span data-i18n="ipt.createUrlBtn"></span>';
    syncButtonText();
  });
}

// ---- Tab: ảnh ----
const btnCreateImg = document.getElementById('btn-create-img');
if (btnCreateImg) {
  btnCreateImg.addEventListener('click', async () => {
    if (!fileInput || !fileInput.files || !fileInput.files.length) { alert(t('lst.noImg')); return; }
    const og = getOgPayload('img');
    if (og.url && !/^https?:\/\//i.test(og.url)) { alert(t('lst.err') + 'OG Image URL phải bắt đầu bằng http:// hoặc https://'); return; }

    const btn = btnCreateImg;
    btn.disabled = true;
    btn.innerHTML = '<span class="loader"></span> ' + esc(t('lst.waiting'));
    document.getElementById('result-img').classList.remove('show');

    const fd = new FormData();
    fd.append('type', 'image');
    fd.append('name', document.getElementById('img-name').value.trim());
    fd.append('image', fileInput.files[0]);
    fd.append('og_title', document.getElementById('img-og-title').value.trim());
    fd.append('og_description', document.getElementById('img-og-desc').value.trim());
    if (og.url) fd.append('og_image', og.url);
    if (og.file) fd.append('og_image_file', og.file);

    try {
      const result = await api('/api/tools/ip-tracker/create', { method: 'POST', body: fd });
      if (result && result.success) {
        document.getElementById('img-tracking-url').textContent = result.trackingUrl;
        document.getElementById('img-download-url').href = result.imageDownloadUrl;
        document.getElementById('img-share-link').href = result.shareUrl;
        document.getElementById('result-img').classList.add('show');
        document.getElementById('img-name').value = '';
        document.getElementById('img-og-title').value = '';
        document.getElementById('img-og-desc').value = '';
        clearMainFile();
        resetOg('img');
        loadTrackerList();
      }
    } catch (err) {
      alert(t('lst.err') + err.message);
    }

    btn.disabled = false;
    btn.innerHTML = '<span data-i18n="ipt.createImgBtn"></span>';
    syncButtonText();
  });
}

// ============================================================
// Danh sách bẫy
// ============================================================
async function loadTrackerList() {
  const tbody = document.getElementById('tracker-list');
  if (!tbody) return;
  try {
    const list = await api('/api/tools/ip-tracker/list');
    const rows = Array.isArray(list) ? list : [];
    trackerRows = rows;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">' + esc(t('lst.empty')) + '</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(item => {
      const badge = item.type === 'url'
        ? '<span class="badge badge-url">URL</span>'
        : '<span class="badge badge-image">Image</span>';
      const name = esc(item.name || t('lst.untitled'));
      const id = Number(item.id);
      return '<tr>'
        + '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + name + '">' + name + '</td>'
        + '<td>' + badge + '</td>'
        + '<td><strong class="col-accent1">' + (Number(item.click_count) || 0) + '</strong></td>'
        + '<td class="muted col-devices">' + (Number(item.visitor_count) || 0) + '</td>'
        + '<td class="col-last" style="font-size:12px;color:var(--muted);">' + esc(item.last_click ? fmtDate(item.last_click) : '-') + '</td>'
        + '<td style="white-space:nowrap;">'
        + '<button type="button" class="btn-icon" data-act="copy" data-id="' + id + '" title="' + esc(t('ipt.colLink')) + '">📋</button> '
        + '<button type="button" class="btn-icon" data-act="results" data-id="' + id + '" title="' + esc(t('lst.viewResults')) + '">📊</button> '
        + '<button type="button" class="btn-icon" data-act="share" data-id="' + id + '" title="' + esc(t('ipt.shareLink')) + '">🔗</button> '
        + '<button type="button" class="btn-icon col-accent3" data-act="delete" data-id="' + id + '" title="' + esc(t('lst.delete')) + '">🗑</button>'
        + '</td></tr>';
    }).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty col-accent3">' + esc(t('lst.err') + err.message) + '</td></tr>';
  }
}

function findRow(id) {
  return trackerRows.find(r => Number(r.id) === Number(id)) || null;
}

const trackerListBody = document.getElementById('tracker-list');
if (trackerListBody) {
  trackerListBody.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('button[data-act]');
    if (!btn) return;
    const id = Number(btn.getAttribute('data-id'));
    if (!id) return;
    const row = findRow(id);
    switch (btn.getAttribute('data-act')) {
      case 'copy':
        copyTextValue(row ? row.trackingUrl : '', btn);
        break;
      case 'results':
        viewResults(id);
        break;
      case 'share':
        openShareModal(id, row ? row.shareUrl : '');
        break;
      case 'delete':
        deleteTracker(id);
        break;
    }
  });
}

// ============================================================
// Kết quả
// ============================================================
async function viewResults(id) {
  currentTrackerId = id;
  try {
    const data = await api('/api/tools/ip-tracker/' + encodeURIComponent(id) + '/results');
    showResultsModal(data);
  } catch (err) {
    alert(t('lst.err') + err.message);
  }
}

function kvRows(pairs) {
  const rows = pairs.filter(p => p && p[1] !== '' && p[1] != null);
  if (!rows.length) return '<div class="muted" style="font-size:12px;">' + esc(t('results.none')) + '</div>';
  return '<dl class="kv">' + rows.map(p => '<dt>' + esc(p[0]) + '</dt><dd>' + esc(p[1]) + '</dd>').join('') + '</dl>';
}

function locationText(log) {
  const geo = log.geo || {};
  const parts = [log.country || geo.country, log.region || geo.region, log.city || geo.city].filter(Boolean);
  return parts.length ? parts.join(', ') : '';
}

function deviceText(ua) {
  if (!ua) return '—';
  const bits = [];
  if (ua.browser && ua.browser !== 'Unknown') bits.push(ua.browser + (ua.browserVersion ? ' ' + ua.browserVersion.split('.')[0] : ''));
  if (ua.os && ua.os !== 'Unknown') bits.push(ua.os + (ua.osVersion ? ' ' + ua.osVersion : ''));
  return bits.join(' · ') || '—';
}

/** Một lượt truy cập = 1 card có thể mở rộng. */
function visitCard(log, index) {
  const ua = log.ua || {};
  const client = log.client || {};
  const geo = log.geo || {};
  const ev = log.event || 'click';
  const evLabel = t('ev.' + ev) || ev;
  const icon = DEVICE_ICON[ua.device] || DEVICE_ICON.unknown;
  const loc = locationText(log);

  const head = '<div class="visit-head">'
    + '<span class="t">#' + (index + 1) + ' · ' + esc(fmtDate(log.timestamp)) + '</span>'
    + '<span class="badge badge-ev">' + esc(evLabel) + '</span>'
    + '<span class="ip">' + esc(log.ip || '-') + '</span>'
    + (log.wan_ip && log.wan_ip !== log.ip ? '<span class="t">WAN ' + esc(log.wan_ip) + '</span>' : '')
    + (loc ? '<span class="loc">📍 ' + esc(loc) + '</span>' : '')
    + '<span class="grow"></span>'
    + '<span class="dev">' + icon + ' ' + esc(deviceText(ua)) + '</span>'
    + '<button type="button" class="btn-icon" data-act="toggle-visit">' + esc(t('results.details')) + '</button>'
    + '</div>';

  const body = '<div class="visit-body">'
    + '<h4>' + esc(t('results.device')) + '</h4>'
    + kvRows([
      ['UA', log.user_agent || ''],
      [t('results.device'), (ua.device || '') + (ua.engine ? ' · ' + ua.engine : '')],
      [t('results.screen'), [client.screen, client.viewport && ('viewport ' + client.viewport), client.dpr && ('DPR ' + client.dpr)].filter(Boolean).join(' · ')],
      [t('results.timezone'), client.timezone || ''],
      [t('results.locale'), [client.locale, client.languages].filter(Boolean).join(' · ')],
      ['CPU/RAM', [client.hardwareConcurrency && (client.hardwareConcurrency + ' luồng'), client.deviceMemory && (client.deviceMemory + ' GB')].filter(Boolean).join(' · ')],
      ['Pin', client.battery ? Math.round((client.battery.level || 0) * 100) + '%' + (client.battery.charging ? ' (đang sạc)' : '') : ''],
      ['Mạng', client.connection ? [client.connection.effectiveType, client.connection.downlink && (client.connection.downlink + ' Mb/s'), client.connection.rtt && (client.connection.rtt + ' ms')].filter(Boolean).join(' · ') : ''],
      ['Canvas ID', client.canvas || '']
    ])
    + '<h4>' + esc(t('results.location')) + '</h4>'
    + kvRows([
      [t('results.ip'), log.ip || ''],
      [t('results.wan'), log.wan_ip || ''],
      [t('results.location'), loc],
      [t('results.isp'), [geo.isp || geo.org, geo.asn && (String(geo.asn).toUpperCase().indexOf('AS') === 0 ? geo.asn : 'AS' + geo.asn)].filter(Boolean).join(' · ')],
      ['Toạ độ', geo.lat != null && geo.lon != null ? geo.lat + ', ' + geo.lon : ''],
      ['Proxy/Hosting', [geo.isProxy && 'proxy', geo.isHosting && 'hosting', geo.isMobile && 'mobile'].filter(Boolean).join(', ')],
      [t('results.referer'), log.referer || client.referer || '']
    ])
    + '<h4>' + esc(t('results.headers')) + '</h4>'
    + kvRows(Object.keys(log.headers || {}).sort().map(k => [k, log.headers[k]]))
    + (log.query_params && Object.keys(log.query_params).length
      ? '<h4>' + esc(t('results.queryParams')) + '</h4>'
      + kvRows(Object.keys(log.query_params).map(k => [k, typeof log.query_params[k] === 'object' ? JSON.stringify(log.query_params[k]) : log.query_params[k]]))
      : '')
    + '</div>';

  return '<div class="visit">' + head + body + '</div>';
}

function showResultsModal(data) {
  if (!data || !data.tracker) return;
  const tr = data.tracker;
  const logs = Array.isArray(data.logs) ? data.logs : [];
  const sum = data.summary || {};

  const chips = '<div class="chip-row">'
    + '<span class="chip">' + esc(t('results.totalVisits')) + ' <b>' + (sum.total != null ? sum.total : logs.length) + '</b></span>'
    + '<span class="chip">' + esc(t('results.uniqueIps')) + ' <b>' + (sum.uniqueIps != null ? sum.uniqueIps : '-') + '</b></span>'
    + '<span class="chip">' + esc(t('results.uniqueVisitors')) + ' <b>' + (sum.uniqueVisitors != null ? sum.uniqueVisitors : '-') + '</b></span>'
    + (sum.countries && sum.countries.length ? '<span class="chip">' + esc(t('results.countries')) + ' <b>' + esc(sum.countries.join(', ')) + '</b></span>' : '')
    + '</div>';

  const info = '<div class="info-grid">'
    + '<div class="info-item"><div class="il">' + esc(t('results.type')) + '</div><div class="iv">' + esc(tr.type === 'url' ? t('results.typeUrl') : t('results.typeImg')) + '</div></div>'
    + '<div class="info-item"><div class="il">' + esc(t('results.created')) + '</div><div class="iv" style="font-size:13px;">' + esc(fmtDate(tr.created_at)) + '</div></div>'
    + '<div class="info-item"><div class="il">' + esc(t('results.token')) + '</div><div class="iv" style="font-size:11px;">' + esc(tr.token) + '</div></div>'
    + '<div class="info-item"><div class="il">URL đích</div><div class="iv" style="font-size:11px;">' + esc(tr.redirect_url || '-') + '</div></div>'
    + '</div>';

  const listHtml = logs.length
    ? '<div class="visit-list">' + logs.map(visitCard).join('') + '</div>'
    : '<div style="text-align:center;padding:40px;color:var(--muted);">' + esc(t('results.noClicks')) + '</div>';

  const html = '<div class="modal-header">'
    + '<h3>' + esc(t('results.title')) + ' — ' + esc(tr.name || t('lst.untitled')) + '</h3>'
    + '<div style="display:flex;gap:8px;align-items:center;">'
    + (logs.length ? '<button type="button" class="btn btn-ghost" data-act="export-csv" style="font-size:12px;padding:6px 10px;">' + esc(t('results.exportCsv')) + '</button>' : '')
    + '<button type="button" class="modal-close" data-act="close-results">&times;</button>'
    + '</div></div>'
    + '<div class="modal-body">' + chips + info + listHtml + '</div>';

  let modal = document.getElementById('results-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'results-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = '<div class="modal" id="results-modal-inner"></div>';
    modal.addEventListener('click', onResultsModalClick);
    document.body.appendChild(modal);
  }
  const inner = document.getElementById('results-modal-inner');
  inner.innerHTML = html;
  inner.dataset.raw = JSON.stringify(logs);
  inner.dataset.name = tr.name || '';
  modal.classList.add('show');
}

function onResultsModalClick(e) {
  const modal = document.getElementById('results-modal');
  if (e.target === modal) { closeResultsModal(); return; }
  const act = e.target.closest && e.target.closest('[data-act]');
  if (!act) return;
  const a = act.getAttribute('data-act');
  if (a === 'close-results') { closeResultsModal(); return; }
  if (a === 'toggle-visit') {
    const card = act.closest('.visit');
    if (card) card.classList.toggle('open');
    return;
  }
  if (a === 'export-csv') exportCsv();
}

function closeResultsModal() {
  const modal = document.getElementById('results-modal');
  if (modal) modal.classList.remove('show');
  currentTrackerId = null;
}

/** Xuất CSV để mở bằng Excel (UTF-8 BOM + CRLF). */
function exportCsv() {
  const inner = document.getElementById('results-modal-inner');
  if (!inner) return;
  let logs = [];
  try { logs = JSON.parse(inner.dataset.raw || '[]'); } catch (_) { return; }
  if (!logs.length) return;

  const cols = [
    ['timestamp', l => l.timestamp],
    ['event', l => l.event || 'click'],
    ['ip', l => l.ip],
    ['wan_ip', l => l.wan_ip],
    ['country', l => l.country],
    ['region', l => l.region],
    ['city', l => l.city],
    ['isp', l => (l.geo && (l.geo.isp || l.geo.org)) || ''],
    ['lat', l => (l.geo && l.geo.lat) || ''],
    ['lon', l => (l.geo && l.geo.lon) || ''],
    ['browser', l => (l.ua && l.ua.browser) || ''],
    ['browser_version', l => (l.ua && l.ua.browserVersion) || ''],
    ['os', l => (l.ua && l.ua.os) || ''],
    ['os_version', l => (l.ua && l.ua.osVersion) || ''],
    ['device', l => (l.ua && l.ua.device) || ''],
    ['screen', l => (l.client && l.client.screen) || ''],
    ['viewport', l => (l.client && l.client.viewport) || ''],
    ['timezone', l => (l.client && l.client.timezone) || ''],
    ['locale', l => (l.client && l.client.locale) || ''],
    ['referer', l => l.referer],
    ['visitor_id', l => l.visitor_id],
    ['user_agent', l => l.user_agent]
  ];
  const cell = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
  const lines = [cols.map(c => cell(c[0])).join(',')];
  for (const l of logs) lines.push(cols.map(c => cell(c[1](l))).join(','));

  const name = (inner.dataset.name || 'trap').replace(/[^\w\-]+/g, '_').slice(0, 40) || 'trap';
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'bay-ip_' + name + '_' + stamp + '.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// ============================================================
// Modal link kiểm tra
// ============================================================
async function openShareModal(id, shareUrl) {
  const urlEl = document.getElementById('share-url-display');
  const statusEl = document.getElementById('share-status');
  const countEl = document.getElementById('share-click-count');
  const modal = document.getElementById('share-modal');
  if (!urlEl || !statusEl || !countEl || !modal) return;

  urlEl.textContent = shareUrl || '';
  statusEl.innerHTML = '<span class="loader"></span>&nbsp;' + esc(t('common.checking'));
  countEl.textContent = '-';
  modal.classList.add('show');

  try {
    const data = await api('/api/tools/ip-tracker/' + encodeURIComponent(id) + '/share');
    statusEl.innerHTML = data.clicked
      ? '<span class="status-dot on"></span> <span class="col-accent2">' + esc(t('share.checked')) + '</span>'
      : '<span class="status-dot off"></span> <span class="col-accent1">' + esc(t('share.notChecked')) + '</span>';
    countEl.textContent = String(data.clickCount || 0) + (data.lastClick ? t('share.lastClick') + fmtDate(data.lastClick) + ')' : '');
  } catch (err) {
    statusEl.innerHTML = '<span class="col-accent3">' + esc(t('lst.err') + err.message) + '</span>';
  }
}

function closeShareModal() {
  const m = document.getElementById('share-modal');
  if (m) m.classList.remove('show');
}

// ============================================================
// Xoá
// ============================================================
async function deleteTracker(id) {
  if (!confirm(t('del.confirm'))) return;
  try {
    await api('/api/tools/ip-tracker/' + encodeURIComponent(id), { method: 'DELETE' });
    loadTrackerList();
  } catch (err) {
    alert(t('lst.err') + err.message);
  }
}

// ============================================================
// Tabs + khởi tạo
// ============================================================
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(c => { c.style.display = 'none'; });
      const pane = document.getElementById('tab-' + btn.getAttribute('data-tab'));
      if (pane) pane.style.display = 'block';
    });
  });
}

function initModals() {
  const shareModal = document.getElementById('share-modal');
  if (shareModal) {
    shareModal.addEventListener('click', (e) => {
      if (e.target === shareModal) closeShareModal();
      const close = e.target.closest && e.target.closest('[data-close="share"]');
      if (close) closeShareModal();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeResultsModal();
    closeShareModal();
  });
}

const authOk = authGuard();

document.addEventListener('DOMContentLoaded', () => {
  if (typeof Auth !== 'undefined' && Auth.initNavbar) Auth.initNavbar();
  if (typeof window.loadTheme === 'function') window.loadTheme();
  initTabs();
  initMainImagePicker();
  initOgPickers();
  initModals();
  applyI18n();
});

if (authOk) loadTrackerList();
