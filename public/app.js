// ============================================
// i18n - Internationalization (EN / VI)
// ============================================
const I18N = {
  en: {
    'app.title': 'Cell.id.vn',
    'nav.logout': 'Logout',
    'sidebar.title': 'Workspace',
    'tab.cells': 'Cell Lookup',
    'tab.callLogs': 'Call Logs',
    'tab.lookupHistory': 'Lookup History',
    'cells.lookupTitle': 'Cell ID Lookup',
    'cells.lookup': 'Lookup',
    'cells.search': 'Search Cells',
    'cells.typeToSearch': 'Type to search...',
    'cells.enbId': 'eNB ID',
    'cells.sector': 'Sector',
    'cells.eci': 'ECI (Long)',
    'cells.cellIdShort': 'Cell ID (Short)',
    'subscribers.from': 'From',
    'subscribers.to': 'To',
    'subscribers.applyFilter': 'Apply Filters',
    'subscribers.noData': 'No subscriber data loaded',
    'cells.clearAll': 'Clear All Cells',
    'upload.records': 'records',
    'legend.title': 'Legend',
    'legend.towerRange': 'Cell Tower (with range)',
    'legend.towerNoRange': 'Cell Tower (no range)',
    'legend.callIn': 'Call In',
    'legend.callOut': 'Call Out',
    'legend.smsIn': 'SMS In',
    'legend.smsOut': 'SMS Out',
    'legend.annotations': 'Draw Annotations',
    'legend.towerHint': 'Tower colour = network technology (RAT). Click a tower for details.',
    'legend.radio': 'Network technology',
    'legend.radioUnknown': 'Unknown',
    'filter.all': 'All',
    'filter.callIn': 'Call In',
    'filter.callOut': 'Call Out',
    'filter.smsIn': 'SMS In',
    'filter.smsOut': 'SMS Out',
    'toast.loading': 'Loading...',
    'toast.success': 'Success!',
    'toast.error': 'Error',
    'play.viewHistory': 'View Movement History',
    'play.exitHistory': 'Exit Movement History',
    'play.stop': 'Stop',
    'play.resume': 'Resume',
    'map.streets': 'Streets',
    'map.satellite': 'Satellite',
    'map.dark': 'Dark',
    'map.terrain': 'Terrain',
    'hist.title': 'Lookup History',
    'hist.allModes': 'All',
    'hist.modeSingle': 'Single',
    'hist.modeBatch': 'Batch',
    'hist.filterDate': 'Filter by date',
    'hist.clearDate': 'Clear date filter',
    'hist.deleteSelected': 'Delete Selected',
    'hist.deleteAll': 'Delete All',
    'hist.loading': 'Loading...',
    'hist.empty': 'No lookup history',
    'hist.time': 'Time',
    'hist.mode': 'Mode',
    'hist.cell': 'Cell',
    'hist.result': 'Result',
    'hist.source': 'Source',
    'hist.notFound': 'Not found',
    'hist.found': 'Found',
    'hist.selectAll': 'Select all',
    'hist.deleteEntry': 'Delete',
    'hist.confirmDeleteAll': 'Delete ALL lookup history? This cannot be undone.',
    'hist.confirmDeleteSelected': 'Delete selected entries?',
    'hist.deleted': 'Deleted',
    'hist.needAuth': 'Please sign in to view lookup history.',
    'hist.openOnMap': 'Show on map',
    'hist.summary': 'Summary',
    'hist.cells': 'cells',
    'hist.foundCells': 'resolved',
    'hist.notFoundCells': 'no coords',
    'hist.expand': 'Expand cells',
    'hist.collapse': 'Collapse',
    'hist.range': 'Range',
    'hist.coords': 'Coords',
    'hist.batchOf': 'Batch',
    'hist.uploadBatch': 'Uploaded file',
    'hist.batchEmpty': 'No cells recorded for this batch.',
    'hist.showAll': 'Show all cells on map',
    'hist.srcLocal': 'Source: local DB',
    'hist.srcOnline': 'Source: online API',
    'hist.radio': 'Network',
  },
  vi: {
    'app.title': 'Cell.id.vn',
    'nav.logout': 'Đăng Xuất',
    'sidebar.title': 'Công Cụ',
    'tab.subscribers': 'Thuê Bao',
    'tab.cells': 'Tra cứu',
    'tab.callLogs': 'Xem rút list',
    'tab.lookupHistory': 'Lịch sử tra cứu',
    'subscribers.select': 'Số Điện Thoại',
    'subscribers.selectPlaceholder': '-- Chọn số --',
    'subscribers.showOnMap': 'Hiển Thị Bản Đồ',
    'subscribers.actionFilter': 'Lọc Hành Động',
    'subscribers.from': 'Từ',
    'subscribers.to': 'Đến',
    'subscribers.applyFilter': 'Áp Dụng Lọc',
    'subscribers.noData': 'Chưa có dữ liệu thuê bao',
    'cells.lookupTitle': 'Tra Cứu Cell ID',
    'cells.lookup': 'Tra Cứu',
    'cells.search': 'Tìm Kiếm Cell',
    'cells.typeToSearch': 'Gõ để tìm kiếm...',
    'cells.enbId': 'eNB ID',
    'cells.sector': 'Sector',
    'cells.eci': 'ECI (Long)',
    'cells.cellIdShort': 'Cell ID (Short)',
    'cells.clearAll': 'Xóa Tất Cả Cell',
    'upload.records': 'bản ghi',
    'legend.title': 'Chú Thích',
    'legend.towerRange': 'Trạm (có bán kính)',
    'legend.towerNoRange': 'Trạm (ko bán kính)',
    'legend.callIn': 'Gọi Đến',
    'legend.callOut': 'Gọi Đi',
    'legend.smsIn': 'Tin Nhắn Đến',
    'legend.smsOut': 'Tin Nhắn Đi',
    'legend.annotations': 'Chú Thích Bản Đồ',
    'legend.towerHint': 'Màu trạm = công nghệ mạng (RAT). Bấm vào trạm để xem chi tiết.',
    'legend.radio': 'Công nghệ mạng',
    'legend.radioUnknown': 'Không xác định',
    'filter.all': 'Tất Cả',
    'filter.callIn': 'Gọi Đến',
    'filter.callOut': 'Gọi Đi',
    'filter.smsIn': 'SMS Đến',
    'filter.smsOut': 'SMS Đi',
    'toast.loading': 'Đang tải...',
    'toast.success': 'Thành công!',
    'toast.error': 'Lỗi',
    'play.viewHistory': 'Xem lịch sử di chuyển',
    'play.exitHistory': 'Thoát xem lịch sử',
    'play.stop': 'Dừng lại',
    'play.resume': 'Tiếp tục phát',
    'map.streets': 'Đường phố',
    'map.satellite': 'Vệ tinh',
    'map.dark': 'Tối',
    'map.terrain': 'Địa hình',
    'hist.title': 'Lịch sử tra cứu',
    'hist.allModes': 'Tất cả',
    'hist.modeSingle': 'Đơn lẻ',
    'hist.modeBatch': 'Hàng loạt',
    'hist.filterDate': 'Lọc theo ngày',
    'hist.clearDate': 'Bỏ lọc ngày',
    'hist.deleteSelected': 'Xóa đã chọn',
    'hist.deleteAll': 'Xóa tất cả',
    'hist.loading': 'Đang tải...',
    'hist.empty': 'Chưa có lịch sử tra cứu',
    'hist.time': 'Thời gian',
    'hist.mode': 'Chế độ',
    'hist.cell': 'Cell',
    'hist.result': 'Kết quả',
    'hist.source': 'Nguồn',
    'hist.notFound': 'Không tìm thấy',
    'hist.found': 'Tìm thấy',
    'hist.selectAll': 'Chọn tất cả',
    'hist.deleteEntry': 'Xóa',
    'hist.confirmDeleteAll': 'Xóa TẤT CẢ lịch sử tra cứu? Không thể hoàn tác.',
    'hist.confirmDeleteSelected': 'Xóa các mục đã chọn?',
    'hist.deleted': 'Đã xóa',
    'hist.needAuth': 'Vui lòng đăng nhập để xem lịch sử tra cứu.',
    'hist.openOnMap': 'Hiện trên bản đồ',
    'hist.summary': 'Tổng quan',
    'hist.cells': 'cell',
    'hist.foundCells': 'tra được',
    'hist.notFoundCells': 'không có toạ độ',
    'hist.expand': 'Mở rộng danh sách cell',
    'hist.collapse': 'Thu gọn',
    'hist.range': 'Bán kính',
    'hist.coords': 'Toạ độ',
    'hist.batchOf': 'Lần tra hàng loạt',
    'hist.uploadBatch': 'File đã tải lên',
    'hist.batchEmpty': 'Không có cell nào được ghi cho lần tra này.',
    'hist.showAll': 'Hiện toàn bộ cell trên bản đồ',
    'hist.srcLocal': 'Nguồn: dữ liệu local',
    'hist.srcOnline': 'Nguồn: API online',
    'hist.radio': 'Công nghệ mạng',
  }
};

let currentLang = localStorage.getItem('lang') || 'vi';

function t(key) {
  return I18N[currentLang]?.[key] || I18N.en[key] || key;
}

// ============================================
// Cell ID helpers: eNB ID (short) <-> ECI (long)
// ECI = (eNB ID << 8) | sector ; eNB = ECI >> 8 ; sector = ECI & 0xFF
// ============================================
const ECI_MAX = 0xFFFFFFF;
const SHORT_THRESHOLD = 0x100000; // 2^20 = max eNB ID + 1
function enbToEci(enbId, sector) {
  const enb = parseInt(enbId, 10);
  const sec = parseInt(sector, 10) || 0;
  if (isNaN(enb)) return NaN;
  return enb * 256 + (sec & 0xFF);
}
function eciToEnb(eci) {
  const n = parseInt(eci, 10);
  if (isNaN(n)) return { enbId: NaN, sector: NaN };
  return { enbId: Math.floor(n / 256), sector: n & 0xFF };
}
function classifyCellId(value) {
  const n = parseInt(value, 10);
  if (isNaN(n)) return 'short';
  return n > SHORT_THRESHOLD && n <= ECI_MAX ? 'long' : 'short';
}
function parseCellId(value, sectorHint) {
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 0) return null;
  const kind = classifyCellId(n);
  if (kind === 'long') {
    const { enbId, sector } = eciToEnb(n);
    return { input: n, kind, isShort: false, enbId, sector, eci: n };
  }
  const sec = (sectorHint !== undefined && sectorHint !== null && sectorHint !== '')
    ? (parseInt(sectorHint, 10) || 0) : 0;
  return { input: n, kind, isShort: true, enbId: n, sector: sec, eci: enbToEci(n, sec) };
}
// Format a cell id (short eNB or long ECI) for tooltips: shows eNB + sector + ECI.
function formatCellId(cellid, enbHint, sectorHint) {
  const p = parseCellId(cellid, sectorHint);
  if (!p) return `CellID: ${cellid}`;
  const enb = enbHint || p.enbId;
  const sec = (sectorHint !== undefined && sectorHint !== null && sectorHint !== '') ? sectorHint : p.sector;
  return `${t('cells.enbId')}: ${enb} · ${t('cells.sector')}: ${sec} · ${t('cells.eci')}: ${p.eci}`;
}

// Định dạng ngày giờ dd/mm/yyyy HH:MM
function fmtDateTime(ts) {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return String(ts || '');
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Copy tọa độ "lat, lon" vào clipboard
function copyCoords(lat, lon) {
  const text = `${lat}, ${lon}`;
  const done = () => showToast('Đã copy tọa độ: ' + text, 'success');
  const fail = () => showToast('Không copy được tọa độ', 'error');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(fail);
  } else {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta); done();
    } catch (e) { fail(); }
  }
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.title = t('app.title');
  const lt = document.getElementById('langToggle');
  if (lt) lt.textContent = currentLang === 'vi' ? 'VI' : 'EN';
}

function toggleLang() {
  currentLang = currentLang === 'en' ? 'vi' : 'en';
  localStorage.setItem('lang', currentLang);
  applyI18n();
}

// ============================================
// Theme
// ============================================
function toggleTheme() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  document.documentElement.setAttribute('data-theme', isLight ? 'dark' : 'light');
  localStorage.setItem('theme', isLight ? 'dark' : 'light');
  document.getElementById('themeToggle').innerHTML = isLight ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
}

function loadTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  document.getElementById('themeToggle').innerHTML = saved === 'light' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}

// ============================================
// Toast
// ============================================
function showToast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.borderColor = type === 'error' ? 'var(--bg-btn-danger)' : type === 'success' ? 'var(--bg-btn-success)' : 'var(--border-color)';
  el.classList.add('show');
  el.style.display = 'block';
  setTimeout(() => { el.classList.remove('show'); el.style.display = 'none'; }, 3000);
}

// ============================================
// Auth check
// ============================================
async function initAuth() {
  const ok = await Auth.requireAuth();
  if (ok) {
    Auth.initNavbar();
  }
}
initAuth();

// ============================================
// Modal helpers
// ============================================
function openModal(id) {
  document.getElementById(id).classList.add('show');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('show');
}

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', function(e) {
    if (e.target === this) {
      this.classList.remove('show');
    }
  });
});

// ============================================
// Change password
// ============================================
function showChangePassword() {
  document.getElementById('pwdCurrent').value = '';
  document.getElementById('pwdNew').value = '';
  document.getElementById('pwdConfirm').value = '';
  openModal('changePwdModal');
  document.getElementById('userDropdown').classList.remove('show');
  userDropdownOpen = false;
}

async function changePassword() {
  const current = document.getElementById('pwdCurrent').value;
  const newPwd = document.getElementById('pwdNew').value;
  const confirm = document.getElementById('pwdConfirm').value;

  if (!current || !newPwd) { showToast('Vui lòng nhập đầy đủ', 'error'); return; }
  if (newPwd !== confirm) { showToast('Mật khẩu mới không khớp', 'error'); return; }
  if (newPwd.length < 4) { showToast('Mật khẩu phải >= 4 ký tự', 'error'); return; }

  try {
    const result = await apiRequest('PUT', '/api/auth/password', { currentPassword: current, newPassword: newPwd });
    showToast('Đổi mật khẩu thành công', 'success');
    closeModal('changePwdModal');
  } catch (e) {
    showToast('Lỗi: ' + e.message, 'error');
  }
}

// ============================================
// My data
// ============================================
function showMyData() {
  openModal('myDataModal');
  document.getElementById('userDropdown').classList.remove('show');
  userDropdownOpen = false;
  document.getElementById('myDataContent').innerHTML = '<span style="color:var(--text-muted)">Nhấn nút trên để xem dữ liệu</span>';
}

async function loadMyUploads() {
  const el = document.getElementById('myDataContent');
  el.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tải...';
  try {
    const data = await apiRequest('GET', '/api/records/my');
    if (!data || data.length === 0) {
      el.innerHTML = '<span style="color:var(--text-muted)">Không có dữ liệu</span>';
      return;
    }
    let html = '<table class="my-data-table"><thead><tr><th>#</th><th>Số</th><th>Loại</th><th>Thời gian</th><th>CellID</th></tr></thead><tbody>';
    data.forEach((r, i) => {
      const ts = new Date(r.timestamp).toLocaleString('vi-VN');
      html += `<tr><td>${i+1}</td><td>${r.phone_number}</td><td>${r.action_type}</td><td>${ts}</td><td>${r.mcc}-${r.mnc}-${r.lac}-${r.cellid}</td></tr>`;
    });
    html += `</tbody></table><div style="margin-top:6px;color:var(--text-muted);font-size:11px">Tổng: ${data.length} bản ghi</div>`;
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = '<span style="color:var(--bg-btn-danger)">Lỗi: ' + e.message + '</span>';
  }
}

async function loadMyCells() {
  const el = document.getElementById('myDataContent');
  el.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tải...';
  try {
    const data = await apiRequest('GET', '/api/cells?limit=200');
    if (!data || data.length === 0) {
      el.innerHTML = '<span style="color:var(--text-muted)">Không có dữ liệu cell</span>';
      return;
    }
    let html = '<table class="my-data-table"><thead><tr><th>#</th><th>MCC</th><th>MNC</th><th>LAC</th><th>CellID</th><th>Lat</th><th>Lon</th><th>Range</th></tr></thead><tbody>';
    data.forEach((c, i) => {
      html += `<tr><td>${i+1}</td><td>${c.mcc}</td><td>${c.mnc}</td><td>${c.lac}</td><td>${c.cellid}</td><td>${c.lat}</td><td>${c.lon}</td><td>${c.range}m</td></tr>`;
    });
    html += `</tbody></table><div style="margin-top:6px;color:var(--text-muted);font-size:11px">Tổng: ${data.length} cell</div>`;
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = '<span style="color:var(--bg-btn-danger)">Lỗi: ' + e.message + '</span>';
  }
}

// ============================================
// Map
// ============================================
const map = L.map('map', {
  center: [21.0285, 105.8542],
  zoom: 12,
  zoomControl: false
});

// Base layers (free, no API key required)
const googleStreetsLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
  attribution: 'Google',
  maxZoom: 20
});
const satelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
  attribution: 'Google',
  maxZoom: 20
});
const terrainLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
  maxZoom: 17
});

googleStreetsLayer.addTo(map);

// Layer control
const baseMaps = {
  'Đường phố': googleStreetsLayer,
  'Vệ tinh': satelliteLayer,
  'Địa hình': terrainLayer
};

const layerControl = L.control.layers(baseMaps, null, { position: 'topright' }).addTo(map);

// Zoom control to right
L.control.zoom({ position: 'topright' }).addTo(map);

// ============================================
// My Location
// ============================================
let locationControl = null;
let locationMarker = null;

try {
  if (typeof L.control.locate !== 'undefined') {
    locationControl = L.control.locate({
      position: 'topright',
      drawCircle: true,
      follow: false,
      setView: true,
      keepCurrentZoomLevel: false,
      markerStyle: {
        weight: 1,
        opacity: 0.8,
        fillOpacity: 0.15
      },
      circleStyle: {
        weight: 1,
        opacity: 0.5,
        fillOpacity: 0.05
      },
      strings: {
        title: 'Vị trí của tôi',
        metersUnit: 'm',
        feetUnit: 'ft',
        popup: 'Vị trí của bạn',
        outsideMapBoundsMsg: 'Ngoài phạm vi bản đồ'
      },
      locateOptions: {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    }).addTo(map);
  }
} catch (e) {
  console.warn('Location control not available:', e);
}

// Fallback: manual locate button if plugin not loaded
if (!locationControl) {
  const LocateBtn = L.Control.extend({
    onAdd: function(map) {
      const btn = L.DomUtil.create('button', 'leaflet-bar leaflet-control leaflet-control-custom');
      btn.innerHTML = '<i class="fas fa-location-arrow"></i>';
      btn.style.width = '34px';
      btn.style.height = '34px';
      btn.style.background = 'var(--bg-surface)';
      btn.style.color = 'var(--text-secondary)';
      btn.style.border = '1px solid var(--border-color)';
      btn.style.borderRadius = '4px';
      btn.style.cursor = 'pointer';
      btn.style.fontSize = '16px';
      btn.style.display = 'flex';
      btn.style.alignItems = 'center';
      btn.style.justifyContent = 'center';
      btn.title = 'Vị trí của tôi';
      btn.onclick = function() {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(function(pos) {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            map.setView([lat, lng], 15);
            if (locationMarker) map.removeLayer(locationMarker);
            locationMarker = L.circleMarker([lat, lng], {
              radius: 8,
              fillColor: '#4444cc',
              color: '#fff',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.8
            }).addTo(map).bindPopup('Vị trí của bạn');
          }, function(err) {
            showToast('Không thể xác định vị trí: ' + err.message, 'error');
          }, { enableHighAccuracy: true, timeout: 10000 });
        } else {
          showToast('Trình duyệt không hỗ trợ định vị', 'error');
        }
      };
      return btn;
    }
  });
  new LocateBtn({ position: 'topright' }).addTo(map);
}

// ============================================
// Leaflet.draw
// ============================================
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

const drawControl = new L.Control.Draw({
  position: 'topright',
  edit: { featureGroup: drawnItems },
  draw: { polyline: false, polygon: true, rectangle: true, circle: false, circlemarker: false, marker: true }
});
map.addControl(drawControl);

// ============================================
// Đo khoảng cách — tích hợp vào toolbar leaflet-draw
// ============================================
const measureState = {
  active: false,
  pts: [],
  line: null,
  vertices: [],
  tooltip: null
};

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function measureTotalKm(pts) {
  let km = 0;
  for (let i = 1; i < pts.length; i++) km += haversineKm(pts[i - 1], pts[i]);
  return km;
}

function fmtDistance(km) {
  return km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(2) + ' km';
}

function makeVertexIcon() {
  return L.divIcon({ className: '', html: '<div class="measure-vertex"></div>', iconSize: [12, 12], iconAnchor: [6, 6] });
}

function clearMeasureDrawing(keepLine) {
  measureState.vertices.forEach((m) => map.removeLayer(m));
  measureState.vertices = [];
  if (measureState.tooltip) { map.removeLayer(measureState.tooltip); measureState.tooltip = null; }
  if (measureState.line && !keepLine) { map.removeLayer(measureState.line); measureState.line = null; }
}

function updateMeasureDrawing() {
  const pts = measureState.pts;
  if (measureState.line) map.removeLayer(measureState.line);
  measureState.line = L.polyline(pts, { color: '#facc15', weight: 3, dashArray: '6,6', className: 'measure-line' }).addTo(map);
  if (measureState.tooltip) map.removeLayer(measureState.tooltip);
  if (pts.length >= 2) {
    const km = measureTotalKm(pts);
    measureState.tooltip = L.marker(pts[pts.length - 1], {
      icon: L.divIcon({ className: '', html: '<div class="measure-tip">' + fmtDistance(km) + '</div>' }),
      interactive: false
    }).addTo(map);
  }
}

function addMeasurePoint(latlng) {
  measureState.pts.push(latlng);
  measureState.vertices.push(L.marker(latlng, { icon: makeVertexIcon(), interactive: false }).addTo(map));
  updateMeasureDrawing();
}

function setMeasureMode(on) {
  measureState.active = on;
  const btn = document.querySelector('.leaflet-draw-measure');
  if (btn) btn.classList.toggle('active', on);
  const container = map.getContainer();
  container.style.cursor = on ? 'crosshair' : '';
  if (!on) {
    clearMeasureDrawing(false);
    measureState.pts = [];
  }
}

function commitMeasure() {
  if (measureState.pts.length < 2) { setMeasureMode(false); return; }
  const km = measureTotalKm(measureState.pts);
  const line = L.polyline(measureState.pts, { color: '#facc15', weight: 3, className: 'measure-line' });
  line.bindTooltip(fmtDistance(km), { permanent: true, direction: 'center', className: 'measure-tip' });
  drawnItems.addLayer(line);
  saveAnnotation('polyline', line.toGeoJSON(), 'Khoảng cách', km);
  clearMeasureDrawing(false);
  measureState.pts = [];
}

map.on('click', function (e) {
  if (measureState.active) addMeasurePoint(e.latlng);
});
map.on('dblclick', function (e) {
  if (!measureState.active) return;
  L.DomEvent.stop(e);
  // Double-click fires two 'click' events first → drop trailing duplicates at same spot.
  const pts = measureState.pts;
  while (pts.length >= 2) {
    const a = pts[pts.length - 1];
    const b = pts[pts.length - 2];
    if (Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lng - b.lng) < 1e-7) {
      pts.pop();
      const v = measureState.vertices.pop();
      if (v) map.removeLayer(v);
    } else break;
  }
  commitMeasure();
});
document.addEventListener('keydown', function (e) {
  if (!measureState.active) return;
  if (e.key === 'Escape') { setMeasureMode(false); }
  else if (e.key === 'Enter') { commitMeasure(); }
  else if (e.key === 'Backspace') {
    if (measureState.pts.length) {
      measureState.pts.pop();
      const v = measureState.vertices.pop();
      if (v) map.removeLayer(v);
      updateMeasureDrawing();
      e.preventDefault();
    }
  }
});

// Chèn nút đo vào toolbar của leaflet-draw (dưới nút marker)
(function injectMeasureButton() {
  const toolbar = document.querySelector('.leaflet-draw-toolbar');
  if (!toolbar) return;
  const btn = L.DomUtil.create('a', 'leaflet-draw-measure', toolbar);
  btn.href = '#';
  btn.title = 'Đo khoảng cách (click điểm, double-click để kết thúc)';
  L.DomEvent.on(btn, 'click', L.DomEvent.stop)
    .on(btn, 'click', function () { setMeasureMode(!measureState.active); });
})();

let annotationIdCounter = 0;

map.on(L.Draw.Event.CREATED, function (event) {
  drawnItems.addLayer(event.layer);
  const geojson = event.layer.toGeoJSON();
  saveAnnotation(
    event.layerType === 'marker' ? 'marker' : event.layerType === 'polygon' ? 'polygon' : 'rectangle',
    geojson,
    event.layerType
  );
});

map.on(L.Draw.Event.EDITED, function (event) {
  event.layers.eachLayer(function (layer) {
    // Update would need layer ID mapping
  });
});

// ============================================
// Sidebar
// ============================================
let sidebarExpanded = localStorage.getItem('sidebar') !== 'collapsed';

function toggleSidebar() {
  sidebarExpanded = !sidebarExpanded;
  localStorage.setItem('sidebar', sidebarExpanded ? 'expanded' : 'collapsed');
  updateSidebarState();
}

function updateSidebarState() {
  const sidebar = document.getElementById('sidebar');
  const btn = document.getElementById('sidebarToggleBtn');
  if (sidebarExpanded) {
    sidebar.classList.remove('collapsed');
    // Nút nằm sát mép phải panel (bên trong panel)
    document.documentElement.style.setProperty('--toggle-left', 'calc(var(--sidebar-width) - 40px)');
    if (btn) btn.innerHTML = '<i class="fas fa-chevron-left"></i>';
  } else {
    sidebar.classList.add('collapsed');
    document.documentElement.style.setProperty('--toggle-left', '8px');
    if (btn) btn.innerHTML = '<i class="fas fa-chevron-right"></i>';
  }
}

// ============================================
// Tab switching
// ============================================
function switchTab(tabId) {
  document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.sidebar-tab[data-tab="${tabId}"]`)?.classList.add('active');
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + tabId)?.classList.add('active');
  if (tabId === 'lookuphistory') loadLookupHistory(1);
}

// ============================================
// Lookup history
// ============================================
let histState = { page: 1, totalPages: 1, rows: [], selected: new Set() };
let histBatchGroup = null;
let histBatchCache = {};
// Card batch đang mở (accordion): { rowId, btn } — chỉ 1 card mở tại một thời điểm.
let histOpenBatch = null;
// Tên file Excel của lần upload gần nhất → gắn vào metadata nhóm lịch sử.
let currentUploadFileName = '';

function histEsc(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ============================================
// RAT (Radio Access Technology) — màu + nhãn hiển thị
// ============================================
// Nhãn `label` là chữ ngắn in giữa icon marker; `full` dùng cho popup/tooltip.
const RADIO_STYLE = {
  GSM:   { color: '#e8a33d', label: '2G', full: 'GSM (2G)' },
  CDMA:  { color: '#8e6fd8', label: 'CD', full: 'CDMA' },
  UMTS:  { color: '#2fa8c9', label: '3G', full: 'UMTS (3G)' },
  LTE:   { color: '#3d7ce0', label: '4G', full: 'LTE (4G)' },
  NR:    { color: '#d64545', label: '5G', full: 'NR (5G)' },
  NBIOT: { color: '#3fae7a', label: 'NB', full: 'NB-IoT' },
  EVDO:  { color: '#b05fc4', label: 'EV', full: 'EVDO' },
  IDEN:  { color: '#7a8a99', label: 'iD', full: 'iDEN' }
};
const RADIO_ALIASES = {
  GSM: 'GSM', '2G': 'GSM',
  CDMA: 'CDMA', CDMA2000: 'CDMA',
  UMTS: 'UMTS', WCDMA: 'UMTS', '3G': 'UMTS', HSPA: 'UMTS',
  LTE: 'LTE', 'LTE-M': 'LTE', LTEM: 'LTE', '4G': 'LTE', EUTRAN: 'LTE',
  NR: 'NR', '5G': 'NR', NR5G: 'NR', '5GNR': 'NR',
  NBIOT: 'NBIOT', 'NB-IOT': 'NBIOT', NB_IOT: 'NBIOT',
  EVDO: 'EVDO', IDEN: 'IDEN'
};
const RADIO_UNKNOWN = { color: '#8892a0', label: '?', full: '' };

// Chuẩn hoá RAT về khoá trong RADIO_STYLE; '' nếu không nhận diện được.
function radioKey(radio) {
  if (radio === null || radio === undefined) return '';
  const k = String(radio).trim().toUpperCase().replace(/[\s_]/g, '');
  return RADIO_ALIASES[k] || '';
}

// Trả style { color, label, full, key } cho 1 giá trị RAT bất kỳ.
function radioStyle(radio) {
  const key = radioKey(radio);
  const st = RADIO_STYLE[key];
  return st ? { key, color: st.color, label: st.label, full: st.full } : { key: '', ...RADIO_UNKNOWN };
}

// Icon giữa marker: pin định vị tô màu RAT + chữ ngắn (2G/3G/4G/5G...) ở đầu pin.
function makeCellDivIcon(rs) {
  return L.divIcon({
    className: 'cell-marker-wrap',
    html: `<div class="cell-marker" style="--mc:${rs.color}">` +
            `<i class="fas fa-map-marker-alt"></i>` +
            `<span class="cell-marker-txt">${histEsc(rs.label)}</span>` +
          `</div>`,
    iconSize: [26, 34],
    iconAnchor: [13, 32],
    popupAnchor: [0, -30]
  });
}

// Dòng "Công nghệ mạng" cho popup (rỗng nếu không xác định được).
function radioPopupLine(radio) {
  const rs = radioStyle(radio);
  if (!rs.key) return '';
  return `<br>${t('hist.radio')}: <span style="color:${rs.color};font-weight:600">${histEsc(rs.full || rs.label)}</span>`;
}

// batch_id an toàn để nhúng vào chuỗi JS trong onclick/attribute
function histJsSafe(s) {
  return String(s === undefined || s === null ? '' : s).replace(/[^A-Za-z0-9_-]/g, '');
}

// Nguồn dữ liệu → CHỈ hiện icon (tooltip giữ tên nguồn) để tránh lặp chữ.
function histSrcIcon(source, showSource) {
  if (!showSource || !source) return '';
  const online = source !== 'local';
  const label = online ? t('hist.srcOnline') : t('hist.srcLocal');
  const icon = online ? 'fa-cloud' : 'fa-database';
  return `<i class="hist-src-i ${online ? 'online' : 'local'} fas ${icon}" title="${histEsc(label)}"></i>`;
}

async function loadLookupHistory(page) {
  const list = document.getElementById('lookupHistoryList');
  if (!list) return;
  if (!Auth.getToken()) { list.innerHTML = `<span>${histEsc(t('hist.needAuth'))}</span>`; return; }
  histState.page = page || 1;
  histState.selected = new Set();
  histBatchCache = {};
  histOpenBatch = null;
  const mode = document.getElementById('histModeFilter')?.value || '';
  const date = document.getElementById('histDate')?.value || '';
  syncHistDateClear();
  list.innerHTML = `<span>${histEsc(t('hist.loading'))}</span>`;
  try {
    const qs = `page=${histState.page}&limit=50`
      + (mode ? '&mode=' + encodeURIComponent(mode) : '')
      + (isValidIsoDate(date) ? '&date=' + encodeURIComponent(date) : '');
    const data = await apiRequest('GET', `/api/lookup-history?${qs}`);
    histState.rows = data.data || [];
    histState.totalPages = data.totalPages || 1;
    renderLookupHistory();
  } catch (e) {
    list.innerHTML = `<span style="color:var(--bg-btn-danger)">${histEsc(e.message)}</span>`;
  }
}

// Ngày ISO YYYY-MM-DD hợp lệ (dùng cả client-side trước khi gọi API).
function isValidIsoDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// Nút xoá lọc ngày chỉ hiện khi đang có ngày được chọn.
function syncHistDateClear() {
  const btn = document.getElementById('histDateClear');
  const inp = document.getElementById('histDate');
  if (!btn) return;
  btn.classList.toggle('hidden', !(inp && inp.value));
}

function onHistDateChange() {
  syncHistDateClear();
  loadLookupHistory(1);
}

function clearHistDate() {
  const inp = document.getElementById('histDate');
  if (inp) inp.value = '';
  syncHistDateClear();
  loadLookupHistory(1);
}

function renderLookupHistory() {
  const list = document.getElementById('lookupHistoryList');
  if (!list) return;
  const rows = histState.rows;
  if (!rows.length) {
    list.innerHTML = `<div class="hist-empty"><i class="fas fa-inbox"></i><br>${histEsc(t('hist.empty'))}</div>`;
    updateHistPager();
    return;
  }

  const showSource = (typeof Auth !== 'undefined' && Auth.isAdmin && Auth.isAdmin());

  list.innerHTML = rows.map(r => {
    const isBatch = r.mode === 'batch' && r.batch_id;
    const bid = isBatch ? histJsSafe(r.batch_id) : '';
    // rowKey là id của row đại diện → DUY NHẤT cho mỗi card (id DOM, state).
    const rowKey = String(r.id);
    // Mode không còn badge: thể hiện bằng màu nền + viền trái của row.
    const modeCls = r.mode === 'batch' ? ' hist-card--batch' : ' hist-card--single';
    const checked = histState.selected.has(r.id) ? ' checked' : '';
    const src = histSrcIcon(r.source, showSource);
    const cell = isBatch
      ? (r.file_name ? histEsc(r.file_name) : t('hist.uploadBatch'))
      : `${histEsc(r.mcc)}-${histEsc(r.mnc)}-${histEsc(r.lac)}-${histEsc(r.cellid)}`;

    // Dòng phụ hiển thị ngay: số cell tra / số cell tìm thấy (batch) hoặc toạ độ (single).
    const subMeta = isBatch
      ? `<div class="hist-meta">
          <span><i class="fas fa-layer-group"></i>${parseInt(r.cell_count, 10) || 0} ${histEsc(t('hist.cells'))}</span>
          <span class="ok"><i class="fas fa-map-pin"></i>${parseInt(r.found_count, 10) || 0}/${parseInt(r.cell_count, 10) || 0}</span>
        </div>`
      : '';

    const coordsTxt = (r.lat && r.lng) ? `${parseFloat(r.lat)}, ${parseFloat(r.lng)}` : '';
    const coordsMeta = coordsTxt
      ? `<span><i class="fas fa-map-pin"></i>${histEsc(coordsTxt)}</span>`
      : `<span class="miss"><i class="fas fa-map-pin"></i>${histEsc(t('hist.notFound'))}</span>`;

    // Hover metadata: chỉ thông tin KHÔNG xuất hiện ở dòng chính
    // (mode = màu nền row, nguồn = icon) để tránh trùng lặp.
    const hoverMeta = isBatch ? '' : `<div class="hist-meta">
      <span><i class="fas fa-clock"></i>${histEsc(r.created_at || '')}</span>
      ${coordsMeta}
      ${r.range ? `<span><i class="fas fa-circle-notch"></i>${parseFloat(r.range)}m</span>` : ''}
    </div>`;

    const expandBtn = isBatch
      ? `<button class="hist-expand-btn" data-row="${rowKey}" title="${histEsc(t('hist.expand'))}"
           onclick="event.stopPropagation(); histToggleBatch(${rowKey}, this)"><i class="fas fa-plus"></i></button>`
      : '';

    return `<div class="hist-row" data-id="${r.id}">
      <div class="hist-card${modeCls}${checked ? ' selected' : ''}" data-id="${r.id}">
        <div class="hist-card-check"><input type="checkbox" value="${r.id}"${checked} onchange="histToggleOne(${r.id}, this.checked)" onclick="event.stopPropagation()"></div>
        <div class="hist-card-main" onclick="histOpenOnMap(${r.id})" title="${histEsc(isBatch ? t('hist.showAll') : t('hist.openOnMap'))}">
          <div class="hist-card-top">
            <span class="hist-cell" title="${cell}">${isBatch ? '<i class="fas fa-file-lines"></i> ' : ''}${cell}</span>
            ${src}
          </div>
          ${subMeta}
          ${hoverMeta}
        </div>
        ${expandBtn}
        <button class="hist-del" title="${histEsc(t('hist.deleteEntry'))}" onclick="event.stopPropagation(); deleteLookupEntry(${r.id})"><i class="fas fa-trash"></i></button>
      </div>
      ${isBatch ? `<div class="hist-batch-panel" id="histBatch-${rowKey}" data-row="${rowKey}" data-batch="${bid}"></div>` : ''}
    </div>`;
  }).join('');
  updateHistPager();
}

// Click dòng lịch sử → hiển thị cell trên bản đồ như lúc tra mới
async function histOpenOnMap(id) {
  const r = histState.rows.find(x => x.id === id);
  if (!r) return;
  if (r.mode === 'batch' && r.batch_id) {
    // Tra cứu tổng: hiện TOÀN BỘ cell đã tra của file log đó.
    await histOpenBatchOnMap(r.batch_id);
  } else if (r.lat && r.lng) {
    showHistCellDetail(r);
  } else {
    // Không có toạ độ trong lịch sử → tra lại như tra mới.
    await lookupCell(r.mcc, r.mnc, r.lac, r.cellid);
  }
}

// Chi tiết 1 cell lịch sử (popup giống hệt tra đơn lẻ)
function showHistCellDetail(r) {
  const showSource = (typeof Auth !== 'undefined' && Auth.isAdmin && Auth.isAdmin());
  const srcType = r.source === 'local' ? 'local' : 'online';
  showCellOnMap({
    lat: r.lat, lon: r.lng, range: r.range || 500,
    color: r.source === 'local' ? '#ff4444' : '#22aa44',
    mcc: r.mcc, mnc: r.mnc, lac: r.lac, cellid: r.cellid,
    cellLine: formatCellId(r.cellid, r.sector),
    radio: r.radio,
    sourceLabel: r.source, srcType: srcType, showSource: showSource
  });
}

// Lấy (và cache) danh sách cell của 1 batch
async function histLoadBatch(batchId) {
  if (!histBatchCache[batchId]) {
    const rows = await apiRequest('GET', `/api/lookup-history/batch/${encodeURIComponent(batchId)}`);
    histBatchCache[batchId] = Array.isArray(rows) ? rows : (rows.data || []);
  }
  return histBatchCache[batchId];
}

// Vẽ toàn bộ cell của một batch lịch sử lên bản đồ
async function histOpenBatchOnMap(batchId) {
  if (histBatchGroup) { map.removeLayer(histBatchGroup); histBatchGroup = null; }
  try {
    const arr = await histLoadBatch(batchId);
    const showSource = (typeof Auth !== 'undefined' && Auth.isAdmin && Auth.isAdmin());
    const markers = [];
    arr.forEach(r => {
      if (!r.lat || !r.lng) return;
      const lat = parseFloat(r.lat), lon = parseFloat(r.lng);
      if (isNaN(lat) || isNaN(lon)) return;
      const range = parseFloat(r.range || 500);
      const srcType = r.source === 'local' ? 'local' : 'online';
      const srcLine = (showSource && r.source) ? `<br>${t('hist.source')}: <span class="hist-source ${srcType}">${histEsc(r.source)}</span>` : '';
      const rs = radioStyle(r.radio);
      const popup = `<b>${t('hist.cell')}: ${histEsc(r.mcc)}-${histEsc(r.mnc)}-${histEsc(r.lac)}</b><br>` +
        `${formatCellId(r.cellid, r.sector)}` +
        radioPopupLine(r.radio) + `<br>` +
        `${t('hist.range')}: ${r.range}m` + srcLine +
        `<br>${t('hist.result')}: ${lat}, ${lon} <i class="fas fa-copy" style="cursor:pointer" title="Copy tọa độ" onclick="copyCoords(${lat},${lon})"></i>`;
      markers.push(L.circle([lat, lon], { radius: range, color: rs.color, fillColor: rs.color, fillOpacity: 0.15, weight: 2 }).bindPopup(popup));
      markers.push(L.marker([lat, lon], { icon: makeCellDivIcon(rs) }).bindPopup(popup));
    });
    if (!markers.length) { showToast(t('hist.notFound'), 'error'); return; }
    histBatchGroup = L.featureGroup(markers).addTo(map);
    map.fitBounds(histBatchGroup.getBounds().pad(0.1));
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// Mở rộng / thu gọn danh sách cell của một batch (lazy fetch).
// rowKey = id của row đại diện (duy nhất). Accordion: mở card này thì thu card khác.
async function histToggleBatch(rowKey, btn) {
  const panel = document.getElementById('histBatch-' + rowKey);
  if (!panel) return;
  const batchId = panel.dataset.batch || '';
  if (!batchId) return;

  if (panel.classList.contains('open')) {
    if (btn) btn.innerHTML = '<i class="fas fa-plus"></i>';
    histCollapseBatch(rowKey);
    return;
  }
  // Thu panel đang mở trước (nếu là card khác).
  if (histOpenBatch && histOpenBatch.rowId !== rowKey) histCollapseBatch(histOpenBatch.rowId);
  if (btn) btn.innerHTML = '<i class="fas fa-minus"></i>';
  panel.classList.add('open');
  histOpenBatch = { rowId: rowKey, btn };
  panel.innerHTML = `<div class="hist-batch-empty"><i class="fas fa-spinner fa-spin"></i> ${histEsc(t('hist.loading'))}</div>`;

  try {
    const arr = await histLoadBatch(batchId);
    // Race guard: user đã thu card này (hoặc mở card khác) trong lúc chờ fetch.
    if (!histOpenBatch || histOpenBatch.rowId !== rowKey) return;
    if (!arr.length) {
      panel.innerHTML = `<div class="hist-batch-empty">${histEsc(t('hist.batchEmpty'))}</div>`;
      return;
    }
    const showSource = (typeof Auth !== 'undefined' && Auth.isAdmin && Auth.isAdmin());
    const found = arr.filter(x => x.lat && x.lng).length;
    const miss = arr.length - found;

    panel.innerHTML =
      `<div class="hist-batch-summary" onclick="histOpenBatchOnMap('${histJsSafe(batchId)}')" title="${histEsc(t('hist.showAll'))}">
        <i class="fas fa-list-ul"></i>
        <b>${arr.length}</b> ${histEsc(t('hist.cells'))}
        <span class="hist-batch-stat ok">${found} ${histEsc(t('hist.foundCells'))}</span>
        ${miss ? `<span class="hist-batch-stat miss">${miss} ${histEsc(t('hist.notFoundCells'))}</span>` : ''}
      </div>` +
      arr.map((c, i) => {
        const hasCoords = c.lat && c.lng;
        const stat = hasCoords
          ? '<i class="fas fa-map-pin ok"></i>'
          : '<i class="fas fa-triangle-exclamation miss"></i>';
        const src = histSrcIcon(c.source, showSource);
        return `<div class="hist-child${hasCoords ? '' : ' miss'}" data-row="${rowKey}" data-idx="${i}"
          onclick="histChildClick(${rowKey}, ${i})" title="${histEsc(hasCoords ? t('hist.openOnMap') : t('hist.notFound'))}">
          ${stat}
          <span class="hist-cell" title="${histEsc(c.mcc)}-${histEsc(c.mnc)}-${histEsc(c.lac)}-${histEsc(c.cellid)}">${histEsc(c.mcc)}-${histEsc(c.mnc)}-${histEsc(c.lac)}-${histEsc(c.cellid)}</span>
          ${src}
          <span class="hist-child-coords">${hasCoords ? `${parseFloat(c.lat)}, ${parseFloat(c.lng)}` : ''}</span>
        </div>`;
      }).join('');
  } catch (e) {
    if (!histOpenBatch || histOpenBatch.rowId !== rowKey) return;
    panel.innerHTML = `<div class="hist-batch-empty" style="color:var(--bg-btn-danger)">${histEsc(e.message)}</div>`;
  }
}

// Thu một panel batch theo rowKey + đồng bộ icon nút expand của card đó.
function histCollapseBatch(rowKey) {
  const panel = document.getElementById('histBatch-' + rowKey);
  if (panel) { panel.classList.remove('open'); panel.innerHTML = ''; }
  const btn = document.querySelector(`.hist-expand-btn[data-row="${rowKey}"]`);
  if (btn) btn.innerHTML = '<i class="fas fa-plus"></i>';
  if (histOpenBatch && histOpenBatch.rowId === rowKey) histOpenBatch = null;
}

// Click 1 cell trong danh sách con → xem chi tiết như tra đơn lẻ
function histChildClick(rowKey, idx) {
  const panel = document.getElementById('histBatch-' + rowKey);
  const batchId = panel ? (panel.dataset.batch || '') : '';
  const arr = histBatchCache[batchId] || [];
  const c = arr[idx];
  if (!c) return;
  if (!c.lat || !c.lng) { showToast(t('hist.notFound'), 'error'); return; }
  document.querySelectorAll('.hist-child.active').forEach(el => el.classList.remove('active'));
  const el = document.querySelector(`.hist-child[data-row="${rowKey}"][data-idx="${idx}"]`);
  if (el) el.classList.add('active');
  // Đóng lớp tổng của batch rồi hiện chi tiết 1 cell.
  if (histBatchGroup) { map.removeLayer(histBatchGroup); histBatchGroup = null; }
  showHistCellDetail(c);
}

function histToggleAll(checked) {
  histState.selected = new Set();
  if (checked) histState.rows.forEach(r => histState.selected.add(r.id));
  document.querySelectorAll('#lookupHistoryList input[type=checkbox][value]').forEach(cb => { cb.checked = checked; });
  document.querySelectorAll('#lookupHistoryList .hist-card').forEach(c => c.classList.toggle('selected', checked));
  const all = document.getElementById('histSelectAll');
  if (all) all.checked = checked;
}

function histToggleOne(id, checked) {
  if (checked) histState.selected.add(id); else histState.selected.delete(id);
  const card = document.querySelector(`#lookupHistoryList .hist-card[data-id="${id}"]`);
  if (card) card.classList.toggle('selected', checked);
  const all = document.getElementById('histSelectAll');
  if (all) {
    all.checked = histState.rows.length > 0 && histState.selected.size === histState.rows.length;
  }
}

function updateHistPager() {
  const info = document.getElementById('histPageInfo');
  if (info) info.textContent = `${histState.page} / ${histState.totalPages}`;
  const count = document.getElementById('histCount');
  if (count) count.textContent = `${histState.rows.length} ${histEsc(t('upload.records'))}`;
  const all = document.getElementById('histSelectAll');
  if (all) all.checked = histState.rows.length > 0 && histState.selected.size === histState.rows.length;
}

function histPage(delta) {
  const next = histState.page + delta;
  if (next < 1 || next > histState.totalPages) return;
  loadLookupHistory(next);
}

async function deleteLookupEntry(id) {
  try {
    await apiRequest('DELETE', `/api/lookup-history/${id}`);
    showToast(t('hist.deleted'), 'success');
    loadLookupHistory(histState.page);
  } catch (e) { showToast(e.message, 'error'); }
}

async function deleteSelectedLookup() {
  const ids = [...histState.selected];
  if (!ids.length) return showToast(t('hist.deleteSelected'), 'error');
  if (!confirm(t('hist.confirmDeleteSelected'))) return;
  try {
    await apiRequest('POST', '/api/lookup-history/delete', { ids });
    showToast(t('hist.deleted'), 'success');
    loadLookupHistory(histState.page);
  } catch (e) { showToast(e.message, 'error'); }
}

async function deleteAllLookup() {
  if (!confirm(t('hist.confirmDeleteAll'))) return;
  try {
    await apiRequest('DELETE', '/api/lookup-history');
    showToast(t('hist.deleted'), 'success');
    loadLookupHistory(1);
  } catch (e) { showToast(e.message, 'error'); }
}

// ============================================
// Call Logs data
// ============================================
let cellMarkers = [];
let lookupCircle = null;
let lookupCenterMarker = null;

async function apiRequest(method, path, body) {
  const token = Auth.getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(path, opts);
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const body = await r.text().catch(() => '');
    const err = new Error(`Máy chủ trả về ${r.status} không phải JSON (${ct || 'không có content-type'}) cho ${path}`);
    err.code = r.status;
    err.bodySnippet = body.slice(0, 200);
    if (r.status === 401 && typeof Auth !== 'undefined' && Auth.logout) Auth.logout();
    throw err;
  }
  const data = await r.json();
  if (r.status === 402) {
    // Hết điểm — báo rõ và cập nhật badge, không ném lỗi chung chung.
    if (typeof Auth !== 'undefined' && Auth.setCreditBalance) Auth.setCreditBalance(data.balance);
    const err = new Error(data.error || 'Không đủ điểm');
    err.code = 402;
    err.balance = data.balance;
    err.required = data.required;
    throw err;
  }
  if (!r.ok) throw new Error(data.error || 'Request failed');
  if (data && data.credit && typeof Auth !== 'undefined' && Auth.setCreditBalance) {
    Auth.setCreditBalance(data.credit.balance);
  }
  return data;
}

const colorMap = { CALL_IN: '#22aa44', CALL_OUT: '#dd3333', SMS_IN: '#22aa44', SMS_OUT: '#dd3333' };
const actionLabel = { CALL_IN: 'Gọi đến', CALL_OUT: 'Gọi đi', SMS_IN: 'SMS đến', SMS_OUT: 'SMS đi' };

function getCellColor(type) {
  return colorMap[type] || '#888';
}
function plotCallLogs(records) {
  cellMarkers.forEach(m => map.removeLayer(m));
  cellMarkers = [];
  if (lookupCircle) { map.removeLayer(lookupCircle); lookupCircle = null; }
  if (lookupCenterMarker) { map.removeLayer(lookupCenterMarker); lookupCenterMarker = null; }
  if (measureState.active) setMeasureMode(false);
  drawnItems.clearLayers();

  const cellGroups = {};
  records.forEach(r => {
    const key = r.mcc + '-' + r.mnc + '-' + r.lac + '-' + r.cellid;
    if (!cellGroups[key]) cellGroups[key] = [];
    cellGroups[key].push(r);
  });

  Object.keys(cellGroups).forEach(key => {
    const group = cellGroups[key];
    const r = group[0];

    if (r.lat && r.lon) {
      const lat = parseFloat(r.lat);
      const lon = parseFloat(r.lon);
      if (isNaN(lat) || isNaN(lon)) return;
      const range = parseFloat(r.range || 0);
      const color = getCellColor(group[0].action_type);
      const radius = range > 0 ? range : 500;
      const circle = L.circle([lat, lon], {
        radius: radius,
        color: color,
        fillColor: color,
        fillOpacity: 0.15,
        weight: 2,
        opacity: 0.6
      }).addTo(map);
      const lineItems = group.map(g => {
        const ts = fmtDateTime(g.timestamp);
        return `${ts} [${actionLabel[g.action_type] || g.action_type}] ${g.partner_number || g.contact_number || ''}`;
      }).join('<br>');
      circle.bindPopup(`<b>Trạm: ${r.mcc}-${r.mnc}-${r.lac}</b><br>${formatCellId(r.cellid, r.enb_id, r.sector)}<br>Bán kính: ${range}m<br>Số bản ghi: ${group.length}<br>Tọa độ: ${lat}, ${lon} <i class="fas fa-copy" style="cursor:pointer" title="Copy tọa độ" onclick="copyCoords(${lat},${lon})"></i><br><small>${lineItems}</small>`);
      cellMarkers.push(circle);
    }
  });

  if (cellMarkers.length > 0) {
    const group = L.featureGroup(cellMarkers);
    map.fitBounds(group.getBounds().pad(0.1));
  }
}

// ============================================
// Cell lookup (local first, then OpenCellID online, save to DB)
// ============================================
// Enter trong 4 ô (MCC/MNC/LAC/CellID) → tự tra cứu khi đã nhập đủ
function cellLookupEnter(e) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const mcc = (document.getElementById('cellMcc').value || '').trim();
  const mnc = (document.getElementById('cellMnc').value || '').trim();
  const lac = (document.getElementById('cellLac').value || '').trim();
  const cellid = (document.getElementById('cellCellid').value || '').trim();
  if (mcc && mnc && lac && cellid) lookupCell();
}

// ============================================
// Hiển thị 1 cell trên bản đồ (dùng chung cho tra đơn lẻ + lịch sử)
// ============================================
// opts: { lat, lon, range, color, mcc, mnc, lac, cellid, cellLine, radio,
//         sourceLabel, srcType, showSource, description }
function showCellOnMap(opts) {
  const lat = parseFloat(opts.lat);
  const lon = parseFloat(opts.lon);
  if (!isFinite(lat) || !isFinite(lon)) return;
  const range = parseFloat(opts.range || 500) || 500;
  const rs = radioStyle(opts.radio);
  // Màu vòng: theo RAT khi biết, ngược lại giữ màu theo nguồn (đỏ = nội bộ).
  const color = rs.key ? rs.color : (opts.color || '#22aa44');
  const popupText = `<b>${t('hist.cell')}: ${histEsc(opts.mcc)}-${histEsc(opts.mnc)}-${histEsc(opts.lac)}</b><br>` +
    `${histEsc(opts.cellLine || '')}` +
    radioPopupLine(opts.radio) + '<br>' +
    (opts.showSource && opts.sourceLabel ? `${t('hist.source')}: <span class="hist-source ${opts.srcType}">${histEsc(opts.sourceLabel)}</span><br>` : '') +
    `${t('hist.range')}: ${histEsc(range)}m<br>` +
    `${t('hist.result')}: ${lat}, ${lon} <i class="fas fa-copy" style="cursor:pointer" title="Copy tọa độ" onclick="copyCoords(${lat},${lon})"></i>` +
    (opts.description ? `<br>${histEsc(opts.description)}` : '');

  if (lookupCircle) { map.removeLayer(lookupCircle); lookupCircle = null; }
  if (lookupCenterMarker) { map.removeLayer(lookupCenterMarker); lookupCenterMarker = null; }
  map.setView([lat, lon], 15);
  lookupCircle = L.circle([lat, lon], {
    radius: range, color: color, fillOpacity: 0.1, weight: 2
  }).addTo(map).bindPopup(popupText);
  lookupCenterMarker = L.marker([lat, lon], { icon: makeCellDivIcon(rs) })
    .addTo(map).bindPopup(popupText);
  lookupCenterMarker.openPopup();
}

async function lookupCell(mccArg, mncArg, lacArg, cellidArg) {
  const mcc = (mccArg != null && mccArg !== '') ? mccArg : document.getElementById('cellMcc').value;
  const mnc = (mncArg != null && mncArg !== '') ? mncArg : document.getElementById('cellMnc').value;
  const lac = (lacArg != null && lacArg !== '') ? lacArg : document.getElementById('cellLac').value;
  const cellid = (cellidArg != null && cellidArg !== '') ? cellidArg : document.getElementById('cellCellid').value;
  const sectorEl = document.getElementById('cellSector');
  const sector = sectorEl ? sectorEl.value : '';
  const resultEl = document.getElementById('cellLookupResult');

  if (!mcc || !mnc || !lac || !cellid) {
    resultEl.className = 'cell-lookup-result show error';
    resultEl.textContent = 'Nhập đủ MCC, MNC, LAC, CellID';
    return;
  }

  resultEl.className = 'cell-lookup-result show';
  resultEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tra cứu...';

  // Send the raw cell ID (short or long) + optional sector. The server probes
  // the raw value first, then its ECI form — so both short and long inputs work.
  try {
    const sectorParam = (sector !== '' && sector != null) ? `&sector=${encodeURIComponent(sector)}` : '';
    const result = await apiRequest('GET', `/api/cells/resolve?mcc=${mcc}&mnc=${mnc}&lac=${lac}&cellid=${encodeURIComponent(cellid)}${sectorParam}`);
    resultEl.className = 'cell-lookup-result show success';
    const d = result.data;
    const showSource = (typeof Auth !== 'undefined' && Auth.isAdmin && Auth.isAdmin());
    const SOURCE_LABELS = { local: 'CSDL nội bộ', opencellid: 'OpenCellID (online)', t0stbrot: 't0stbrot (online)', combain: 'Combain (online)' };
    const sourceLabel = SOURCE_LABELS[result.source] || (result.source || 'Không rõ');
    const srcType = result.source === 'local' ? 'local' : 'online';
    const dLat = parseFloat(d.lat);
    const dLon = parseFloat(d.lon);
    const dCell = `${d.mcc || mcc}-${d.mnc || mnc}-${d.lac || lac}-${d.cellid || cellid}`;
    const rs = radioStyle(d.radio);
    resultEl.innerHTML =
      `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">` +
        `<i class="fas fa-check-circle"></i>` +
        `<span class="hist-cell">${dCell}</span>` +
        (rs.key ? `<span class="hist-radio-badge" style="background:${rs.color}" title="${histEsc(t('hist.radio'))}">${histEsc(rs.full || rs.label)}</span>` : '') +
        (showSource ? `<span class="hist-source ${srcType}">${sourceLabel}</span>` : '') +
      `</div>` +
      `<div style="font-size:11px">${formatCellId(d.cellid || cellid, sector)}</div>` +
      `<div class="hist-coords" style="margin-top:4px">` +
        `<i class="fas fa-map-pin"></i>${dLat}, ${dLon} ` +
        `<i class="fas fa-copy" style="cursor:pointer;opacity:0.7" title="Copy tọa độ" onclick="copyCoords(${dLat},${dLon})"></i>` +
      `</div>` +
      `<div style="font-size:11px;margin-top:3px">Bán kính: <b>${d.range}m</b></div>` +
      (d.description ? `<div style="font-size:11px;margin-top:3px;color:var(--text-muted)">${d.description}</div>` : '');

    const cellLine = formatCellId(d.cellid || cellid, sector);
    const range = parseFloat(d.range || 500);
    const color = result.source === 'local' ? '#ff4444' : '#22aa44';
    showCellOnMap({
      lat: dLat, lon: dLon, range: range, color: color,
      mcc: d.mcc || mcc, mnc: d.mnc || mnc, lac: d.lac || lac, cellid: d.cellid || cellid,
      cellLine: cellLine, radio: d.radio,
      sourceLabel: sourceLabel, srcType: srcType,
      showSource: showSource, description: d.description || ''
    });
  } catch (e) {
    resultEl.className = 'cell-lookup-result show error';
    const msg = (e && e.message) ? e.message : '';
    if (e && e.code === 402) {
      // Hết điểm tra cứu — dẫn user sang trang nạp/lịch sử điểm.
      resultEl.innerHTML = '<i class="fas fa-gem"></i> ' + msg +
        ` (còn ${e.balance != null ? e.balance : 0}, cần ${e.required != null ? e.required : 1})` +
        ' — <a href="/credits.html" style="color:inherit;text-decoration:underline">Xem điểm</a>';
    } else if (msg.indexOf('Chưa cấu hình') !== -1) {
      resultEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ' + msg;
    } else {
      resultEl.innerHTML = '<i class="fas fa-times-circle"></i> Không tìm thấy cell trong CSDL nội bộ và OpenCellID.org.';
    }
  }
}

async function searchCells() {
  const input = document.getElementById('cellSearch');
  const list = document.getElementById('cellList');
  const raw = (input.value || '').trim();

  // Ô trống → lấy giá trị từ form Tra Cứu Cell ID phía trên
  if (!raw) {
    const mcc = document.getElementById('cellMcc').value;
    const mnc = document.getElementById('cellMnc').value;
    const lac = document.getElementById('cellLac').value;
    const cellid = document.getElementById('cellCellid').value;
    if (!mcc && !mnc && !lac && !cellid) {
      list.innerHTML = '<span data-i18n="cells.typeToSearch">Gõ để tìm kiếm...</span>';
      applyI18n();
      return;
    }
    await lookupCell(mcc, mnc, lac, cellid);
    list.innerHTML = `<span style="color:var(--text-faint)">Đã tra cứu ${mcc}-${mnc}-${lac}-${cellid}</span>`;
    return;
  }

  // Nhập 4 giá trị cùng dòng, phân tách bằng dấu phẩy (hoặc khoảng trắng) → tra cứu + hiển thị bản đồ
  const parts = raw.split(/[,\s]+/).filter(Boolean);
  if (parts.length === 4) {
    await lookupCell(parts[0], parts[1], parts[2], parts[3]);
    list.innerHTML = `<span style="color:var(--text-faint)">Đã tra cứu ${parts.join('-')}</span>`;
    return;
  }

  // Ít hơn 4 phần → tìm kiếm dạng danh sách theo từ khóa
  if (raw.length < 2) {
    list.innerHTML = '<span data-i18n="cells.typeToSearch">Gõ để tìm kiếm...</span>';
    applyI18n();
    return;
  }
  try {
    const resp = await apiRequest('GET', `/api/cells/search?q=${encodeURIComponent(raw)}`);
    const cells = resp.data || [];
    list.innerHTML = cells.length === 0 ? '<span style="color:var(--text-faint)">No results</span>' :
      cells.slice(0, 20).map(c => `<div onclick="lookupCell('${c.mcc}', '${c.mnc}', '${c.lac}', '${c.cellid}')" style="padding:3px 0;cursor:pointer;color:var(--text-secondary);border-bottom:1px solid var(--border-color);font-size:11px">${c.mcc}-${c.mnc}-${c.lac}-${c.cellid} <span style="color:var(--text-faint)">${c.lat}, ${c.lon}</span></div>`).join('');
  } catch (e) {
    list.innerHTML = 'Error';
  }
}

// ============================================
// Annotation save/load
// ============================================
async function saveAnnotation(type, geojson, label, distance) {
  try {
    await apiRequest('POST', '/api/annotations', { type, geojson, label: label || type, distance: distance || 0 });
  } catch (e) {
    console.error('Save annotation error:', e);
  }
}

const ANNOTATION_STYLE = { color: '#6666ff', weight: 2, opacity: 0.7, fillOpacity: 0.1 };

function annotationStyle(feature) {
  const g = feature && feature.geometry;
  if (g && (g.type === 'LineString' || g.type === 'MultiLineString')) {
    return { color: '#facc15', weight: 3, opacity: 0.9 };
  }
  return ANNOTATION_STYLE;
}

function bindAnnotationLabel(layer, a) {
  if (a.type === 'polyline' && a.distance) {
    layer.bindTooltip(fmtDistance(a.distance), { permanent: true, direction: 'center', className: 'measure-tip' });
  }
}

async function loadAnnotations() {
  try {
    const annotations = await apiRequest('GET', '/api/annotations');
    if (!annotations || annotations.length === 0) return;
    annotations.forEach(a => {
      try {
        const layer = L.geoJSON(a.geojson, { style: annotationStyle });
        layer.eachLayer(l => {
          bindAnnotationLabel(l, a);
          drawnItems.addLayer(l);
        });
      } catch (e) {}
    });
  } catch (e) {
    console.error('Load annotations error:', e);
  }
}

// ============================================
// My Call Logs (user-owned)
// ============================================
let myLogsCache = [];
let logPageIndex = 1;
const LOG_PAGE_SIZE = 20;

async function uploadCallLogExcel(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  // Nhớ tên file để ghi vào metadata nhóm lịch sử tra cứu hàng loạt.
  currentUploadFileName = file.name || '';

  const prog = document.getElementById('callLogUploadProgress');
  const status = document.getElementById('callLogUploadStatus');
  const fill = document.getElementById('callLogUploadProgressFill');
  const result = document.getElementById('callLogUploadResult');
  prog.classList.add('show');
  status.textContent = 'Đang tải ' + file.name + '...';
  fill.style.width = '5%';
  result.className = 'cell-lookup-result';
  result.style.display = 'none';

  try {
    const fd = new FormData();
    fd.append('file', file);
    const network = document.getElementById('networkSelect')?.value || 'auto';
    fd.append('network', network);
    const token = Auth.getToken();
    const r = await fetch('/api/call-logs/upload', {
      method: 'POST',
      headers: token ? { 'Authorization': 'Bearer ' + token } : {},
      body: fd
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Upload failed');
    fill.style.width = '100%';
    status.textContent = 'Hoàn tất';
    const errors = (data.errorsDetail || []).slice(0, 3).map(e => `<div style="font-size:10px;color:#ee6666">${e}</div>`).join('');
    result.className = 'cell-lookup-result show ' + (data.inserted > 0 ? 'success' : 'error');
    result.innerHTML = `<i class="fas fa-check-circle"></i> Mạng: <strong>${data.network || '?'}</strong> — Tổng: <strong>${data.total || 0}</strong>, Chèn: <strong>${data.inserted || 0}</strong>, Lỗi: <strong>${data.errors || 0}</strong>${errors}`;
    if (data.network && document.getElementById('networkSelect')) {
      const sel = document.getElementById('networkSelect');
      const v = data.network.toLowerCase();
      if ([...sel.options].some(o => o.value === v)) sel.value = v;
    }
    showToast(`Upload ${data.network}: ${data.inserted || 0} bản ghi`, data.inserted > 0 ? 'success' : 'error');
    await loadCallLogs();
  } catch (e) {
    result.className = 'cell-lookup-result show error';
    result.innerHTML = `<i class="fas fa-times-circle"></i> Lỗi: ${e.message}`;
    showToast('Upload thất bại: ' + e.message, 'error');
    status.textContent = 'Lỗi';
  }
  setTimeout(() => prog.classList.remove('show'), 3000);
}

async function loadCallLogs() {
  try {
    const resp = await apiRequest('GET', '/api/call-logs?page=1&limit=500');
    const rows = Array.isArray(resp) ? resp : (resp.data || []);
    myLogsCache = rows;
    logPageIndex = 1;
    document.getElementById('logSearchInput').value = '';
    renderCallLogs();
    // Auto-resolve unmatched cells via OpenCellID batch
    await resolveUnmatchedCells();
  } catch (e) {
    document.getElementById('logRecordList').innerHTML = '<div style="color:var(--text-faint)">Lỗi tải nhật ký</div>';
  }
}

// Canonical cell key: collapse short-cellid / ECI aliases (e.g. 662091 & 169495296)
// so client dedup matches server memo. Mirrors canonicalCellKey on the server.
function canonicalClientKey(c) {
  const raw = String(c.cellid == null ? '' : c.cellid);
  let cid = raw;
  try {
    if (typeof parseCellId === 'function') {
      const p = parseCellId(raw);
      if (p && p.isShort && p.eci != null && String(p.eci) !== raw) cid = String(p.eci);
    }
  } catch (e) { /* keep raw */ }
  return `${c.mcc}-${c.mnc}-${c.lac}-${cid}`;
}

async function resolveUnmatchedCells() {
  // Find unique cells with null lat/lon (dedup by canonical key).
  const seen = new Set();
  const unresolved = [];
  for (const r of myLogsCache) {
    if (r.lat && r.lon) continue;
    if (!r.mcc || !r.lac || !r.cellid) continue;
    const key = canonicalClientKey(r);
    if (seen.has(key)) continue;
    seen.add(key);
    unresolved.push({ mcc: r.mcc, mnc: r.mnc, lac: r.lac, cellid: r.cellid, sector: r.sector });
  }
  if (unresolved.length === 0) return;

  // Two-phase server resolve: local-first, then a budget-limited online pass.
  // When the server reports pending work, re-request with the still-unresolved
  // cells (bounded retries as a safety net against very large files).
  const resolvedMap = {};
  const MAX_ROUNDS = 5;
  let batch = unresolved;
  // Một uploadId dùng chung cho MỌI vòng → các vòng resolve gộp về 1 nhóm lịch sử.
  const uploadId = 'up' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  try {
    for (let round = 0; round < MAX_ROUNDS && batch.length > 0; round++) {
      const resp = await apiRequest('POST', '/api/cells/resolve-batch',
        { cells: batch, uploadId, fileName: currentUploadFileName });
      if (!resp.results) break;
      const stillPending = [];
      for (const r of resp.results) {
        if (r.lat && r.lon) {
          resolvedMap[r.key] = r;
          resolvedMap[canonicalClientKey({ mcc: r.key.split('-')[0], mnc: r.key.split('-')[1], lac: r.key.split('-')[2], cellid: r.key.split('-').slice(3).join('-') })] = r;
        } else {
          stillPending.push(r.key);
        }
      }
      if (!resp.pending || stillPending.length === 0) break;
      // Re-map pending keys back to cell objects for the next round.
      const pendingSet = new Set(stillPending);
      batch = batch.filter(c => pendingSet.has(`${c.mcc}-${c.mnc}-${c.lac}-${c.cellid}`));
    }

    if (Object.keys(resolvedMap).length === 0) return;
    // Update myLogsCache with resolved data (match by raw or canonical key).
    for (const row of myLogsCache) {
      if (row.lat && row.lon) continue;
      const key = `${row.mcc}-${row.mnc}-${row.lac}-${row.cellid}`;
      const resolved = resolvedMap[key] || resolvedMap[canonicalClientKey(row)];
      if (resolved) {
        row.lat = resolved.lat;
        row.lon = resolved.lon;
        row.cell_range = resolved.range;
        row._resolvedOnline = true;
      }
    }
    // Re-render with newly resolved data
    renderCallLogs();
  } catch (e) {
    // Silent fail — cells stay unresolved, icon will show
  }
}

function applyCallLogFilters() {
  logPageIndex = 1;
  renderCallLogs();
}

function searchCallLogs() {
  logPageIndex = 1;
  renderCallLogs();
}

function logPage(dir) {
  const filtered = getFilteredLogs();
  const totalPages = Math.max(1, Math.ceil(filtered.length / LOG_PAGE_SIZE));
  logPageIndex = Math.min(Math.max(1, logPageIndex + dir), totalPages);
  renderCallLogs();
}

function getFilteredLogs() {
  const actionFilter = document.getElementById('actionFilter').value;
  const dateFrom = document.getElementById('dateFrom').value;
  const dateTo = document.getElementById('dateTo').value;
  const q = (document.getElementById('logSearchInput').value || '').trim().toLowerCase();

  let rows = myLogsCache;
  if (actionFilter !== 'all') rows = rows.filter(l => l.action_type === actionFilter);
  if (dateFrom) rows = rows.filter(l => l.timestamp >= dateFrom);
  if (dateTo) rows = rows.filter(l => l.timestamp <= dateTo);
  if (q) {
    rows = rows.filter(l => {
      const hay = [l.network, l.phone_number, l.action_type, l.contact_number, l.timestamp, l.cellid, l.cell_address]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }
  return rows;
}

function renderCallLogs() {
  const list = document.getElementById('logRecordList');
  const filtered = getFilteredLogs();
  const totalPages = Math.max(1, Math.ceil(filtered.length / LOG_PAGE_SIZE));
  if (logPageIndex > totalPages) logPageIndex = totalPages;
  const start = (logPageIndex - 1) * LOG_PAGE_SIZE;
  const page = filtered.slice(start, start + LOG_PAGE_SIZE);

  // Đang xem lịch sử di chuyển thì thoát khi bộ lọc/dữ liệu thay đổi
  if (playMode !== 'idle') stopPlay();

  plotCallLogs(filtered);
  updatePlayBtn();

  if (filtered.length === 0) {
    list.innerHTML = '<div style="color:var(--text-faint);text-align:center;padding:14px">Chưa có nhật ký. Tải lên Excel ở trên.</div>';
    document.getElementById('logPrevBtn').disabled = true;
    document.getElementById('logNextBtn').disabled = true;
    document.getElementById('logPageInfo').textContent = '0 bản ghi';
    return;
  }

  document.getElementById('logPrevBtn').disabled = logPageIndex <= 1;
  document.getElementById('logNextBtn').disabled = logPageIndex >= totalPages;
  document.getElementById('logPageInfo').textContent = `${filtered.length} bản ghi — trang ${logPageIndex}/${totalPages}`;

  list.innerHTML = page.map(l => {
    const hasCoords = l.lat && l.lon;
    const showSource = (typeof Auth !== 'undefined' && Auth.isAdmin && Auth.isAdmin());
    const cellIcon = l.cellid ? (hasCoords
      ? (showSource
        ? (l._resolvedOnline ? '<i class="fas fa-globe" style="color:#22aa44;margin-right:2px" title="Tra online"></i>' : '<i class="fas fa-map-marker-alt" style="color:#3366ff;margin-right:2px" title="CSDL nội bộ"></i>')
        : '<i class="fas fa-map-marker-alt" style="color:#3366ff;margin-right:2px"></i>')
      : '<i class="fas fa-triangle-exclamation" style="color:#ff8800;margin-right:2px" title="Không tra cứu được"></i>') : '';
    return `<div style="padding:5px 6px;border:1px solid var(--border-color);border-radius:6px;margin-bottom:5px;background:var(--bg-surface2);display:flex;justify-content:space-between;align-items:center">
    <div>
      <div><span style="color:var(--text-primary);font-weight:600">${l.phone_number || '-'}</span>
        <span style="color:var(--text-faint)">(${l.network || '-'})</span>
        <span class="badge" style="font-size:9px;background:${l.action_type==='CALL_IN'?'#3366ff':l.action_type==='CALL_OUT'?'#ff4444':l.action_type==='SMS_IN'?'#22aa44':'#ff8800'};color:#fff;padding:1px 5px;border-radius:3px;margin-left:4px">${l.action_type || ''}</span></div>
      <div style="font-size:10px;color:var(--text-muted)">${l.timestamp || ''}${l.duration ? ' • ' + l.duration + 's' : ''}${l.cellid ? ' • ' + cellIcon + l.mcc + '-' + l.mnc + '-' + l.lac + '-' + l.cellid : ''}</div>
      <div style="font-size:10px;color:var(--text-faint)">${l.cell_address || ''} ${l.contact_number ? '• đối tác: ' + l.contact_number : ''}</div>
    </div>
    <button class="btn btn-sm btn-danger" onclick="deleteCallLog(${l.id})"><i class="fas fa-trash"></i></button>
  </div>`;
  }).join('');
}

async function deleteCallLog(id) {
  if (!confirm('Xóa bản ghi nhật ký này?')) return;
  try {
    await apiRequest('DELETE', '/api/call-logs/' + id);
    showToast('Đã xóa', 'success');
    loadCallLogs();
  } catch (e) {
    showToast('Lỗi: ' + e.message, 'error');
  }
}

let playTimer = null;
let playPoints = [];
let playIndex = 0;
let playLine = null;
let playActiveMarker = null;
let playMode = 'idle'; // 'idle' | 'playing' | 'manual'
const PLAY_DELAY = 1200;
const ONE_HOUR_MS = 3600000;
const TL_PX_PER_MS = 0.0005;   // 0.5 px/giây khi tổng thời gian > 1 giờ
let timelineWidth = 0;
let tlZoom = 1; // hệ số zoom thanh timeline
const timelineIcon = { CALL_IN: 'fa-phone', CALL_OUT: 'fa-phone', SMS_IN: 'fa-envelope', SMS_OUT: 'fa-envelope' };

function showPlayNav(show) {
  const nav = document.getElementById('playNav');
  if (nav) nav.style.display = show ? 'flex' : 'none';
}

function setPlayBtnLabel(key) {
  const el = document.getElementById('playBtnLabel');
  if (el) el.textContent = t(key);
}

function setPlayToggleLabel(key) {
  const el = document.getElementById('playToggleLabel');
  if (el) el.textContent = t(key);
  const icon = document.querySelector('#playToggleBtn i');
  if (icon) icon.className = key === 'play.resume' ? 'fas fa-play' : 'fas fa-stop';
}

function playCallLogs() {
  // Đang xem lịch sử → thoát hẳn
  if (playMode !== 'idle') { stopPlay(); return; }

  playPoints = getFilteredLogs()
    .filter(r => r.lat && r.lon)
    .map(r => ({ ...r, lat: parseFloat(r.lat), lon: parseFloat(r.lon) }))
    .filter(p => !isNaN(p.lat) && !isNaN(p.lon))
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  if (playPoints.length === 0) {
    showToast('Không có bản ghi có tọa độ để play', 'error');
    return;
  }

  playIndex = 0;

  const pts = playPoints.map(p => [p.lat, p.lon]);
  playLine = L.polyline(pts, { color: '#ffaa00', weight: 3, opacity: 0.8, dashArray: '6,6' }).addTo(map);

  map.flyTo([playPoints[0].lat, playPoints[0].lon], 14);
  showPlayPoint(playPoints[0]);

  showPlayNav(true);
  setPlayBtnLabel('play.exitHistory');
  const btn = document.getElementById('playBtn');
  if (btn) btn.style.background = 'var(--bg-btn-danger)';

  buildTimeline(playPoints);
  showTimeline(true);
  startPlayTimer();
  updateTimelineActive();
}

function startPlayTimer() {
  if (playTimer) { clearInterval(playTimer); playTimer = null; }
  playMode = 'playing';
  setPlayToggleLabel('play.stop');
  playTimer = setInterval(() => {
    playIndex++;
    if (playIndex >= playPoints.length) { stopPlay(true); return; }
    const p = playPoints[playIndex];
    map.flyTo([p.lat, p.lon], 14);
    showPlayPoint(p);
    updateTimelineActive();
  }, PLAY_DELAY);
}

// Tiến/lùi một log — tạm dừng auto-play, chuyển nút giữa thành "Tiếp tục phát"
function playStep(dir) {
  if (playMode === 'idle') return;
  if (playTimer) { clearInterval(playTimer); playTimer = null; }
  playMode = 'manual';
  playIndex = Math.min(Math.max(0, playIndex + dir), playPoints.length - 1);
  const p = playPoints[playIndex];
  if (!p) return;
  map.flyTo([p.lat, p.lon], 14);
  showPlayPoint(p);
  setPlayToggleLabel('play.resume');
  updateTimelineActive();
}

// Nút giữa: Dừng lại (tạm dừng) <-> Tiếp tục phát (resume)
function playToggle() {
  if (playMode === 'playing') {
    if (playTimer) { clearInterval(playTimer); playTimer = null; }
    playMode = 'manual';
    setPlayToggleLabel('play.resume');
  } else if (playMode === 'manual') {
    startPlayTimer();
  }
}

function showPlayPoint(p) {
  if (playActiveMarker) map.removeLayer(playActiveMarker);
  const color = getCellColor(p.action_type);
  playActiveMarker = L.circleMarker([p.lat, p.lon], {
    radius: 10,
    color: '#fff',
    weight: 2,
    fillColor: color,
    fillOpacity: 0.9
  }).addTo(map);
  playActiveMarker.bindPopup(`<b>${fmtDateTime(p.timestamp)}</b><br>${actionLabel[p.action_type] || p.action_type} — ${p.phone_number}<br>Trạm: ${p.mcc}-${p.mnc}-${p.lac}<br>${formatCellId(p.cellid, p.enb_id, p.sector)}<br>Tọa độ: ${p.lat}, ${p.lon} <i class="fas fa-copy" style="cursor:pointer" title="Copy tọa độ" onclick="copyCoords(${p.lat},${p.lon})"></i>${p.cell_address ? '<br>' + p.cell_address : ''}`);
  playActiveMarker.openPopup();
}

function showTimeline(show) {
  const bar = document.getElementById('timelineBar');
  if (bar) bar.classList.toggle('show', !!show);
}

// Bơm các node icon + nhãn thời gian lên thanh timeline
function buildTimeline(points) {
  const track = document.getElementById('timelineTrack');
  const bar = document.getElementById('timelineBar');
  if (!track || !bar || !points.length) { showTimeline(false); return; }

  const t0 = new Date(points[0].timestamp).getTime();
  const t1 = new Date(points[points.length - 1].timestamp).getTime();
  const span = Math.max(t1 - t0, 1);

  let pxPerMs, width;
  if (span <= ONE_HOUR_MS) {
    // Ngắn (<= 1 giờ): dàn vừa khung màn hình, vẫn giữ tỉ lệ thời gian
    width = bar.clientWidth || window.innerWidth;
    pxPerMs = (width / span) * tlZoom;
  } else {
    // Dài: tỉ lệ cố định px/giây (nhân hệ số zoom), cuộn ngang
    pxPerMs = TL_PX_PER_MS * tlZoom;
    width = Math.max(span * pxPerMs, bar.clientWidth || window.innerWidth);
  }
  timelineWidth = width;

  const fmtTick = (ts) => {
    const d = new Date(ts);
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0') +
      ' ' + d.getDate().toString().padStart(2, '0') + '/' + (d.getMonth() + 1).toString().padStart(2, '0');
  };

  const typeLabel = { CALL_IN: 'Gọi đến', CALL_OUT: 'Gọi đi', SMS_IN: 'SMS đến', SMS_OUT: 'SMS đi' };

  let html = `<span class="tl-axis" style="width:${width}px"></span>`;
  html += `<span class="tl-tick" style="left:2px;transform:none">${fmtTick(points[0].timestamp)}</span>`;
  html += `<span class="tl-tick" style="left:${width - 2}px;transform:translateX(-100%)">${fmtTick(points[points.length - 1].timestamp)}</span>`;

  points.forEach((p, i) => {
    const ts = new Date(p.timestamp).getTime();
    const x = Math.round((ts - t0) * pxPerMs);
    const color = getCellColor(p.action_type);
    const icon = timelineIcon[p.action_type] || 'fa-circle';
    const direction = (p.action_type === 'CALL_IN' || p.action_type === 'SMS_IN') ? 'đến' : 'đi';
    const tip = `${fmtDateTime(p.timestamp)} — ${typeLabel[p.action_type] || p.action_type}${p.phone_number ? ' — ' + p.phone_number : ''}`;
    html += `<span class="tl-node-tick" style="left:${x}px"></span>`;
    html += `<span class="tl-node" data-idx="${i}" title="${tip}" data-dir="${direction}" onclick="timelineJump(${i})" style="left:${x}px;background:${color}"><i class="fas ${icon}"></i></span>`;
    // Nhãn thời gian ngay dưới mỗi icon
    html += `<span class="tl-tick" style="left:${x}px">${fmtTick(p.timestamp)}</span>`;
  });

  track.style.width = width + 'px';
  track.style.transform = 'translateX(0)';
  track.innerHTML = html;
}

// Zoom thanh timeline: delta > 0 = phóng to, < 0 = thu nhỏ
function zoomTimeline(delta) {
  tlZoom = Math.min(8, Math.max(0.25, tlZoom * (delta > 0 ? 1.5 : 1 / 1.5)));
  if (playPoints && playPoints.length) {
    buildTimeline(playPoints);
    updateTimelineActive();
  }
}

// Đánh dấu node hiện tại + tự cuộn timeline khi chạy tới sát mép phải
function updateTimelineActive() {
  const track = document.getElementById('timelineTrack');
  const bar = document.getElementById('timelineBar');
  if (!track || !bar || playMode === 'idle') return;

  track.querySelectorAll('.tl-node.active').forEach(n => n.classList.remove('active'));
  const node = track.querySelector(`.tl-node[data-idx="${playIndex}"]`);
  if (!node) return;
  node.classList.add('active');

  const barW = bar.clientWidth;
  const nodeX = parseFloat(node.style.left) || 0;
  const nodeCenter = nodeX;
  if (nodeCenter >= barW * 0.7) {
    // Sát mép phải → dịch timeline về đầu (đưa node hiện tại về gần mép trái) để chạy tiếp
    const offset = Math.max(0, nodeCenter - barW * 0.3);
    track.style.transform = `translateX(-${offset}px)`;
  } else if (nodeCenter < Math.abs(parseFloat((track.style.transform.match(/-?[\d.]+/) || [0])[0]))) {
    // Cuộn ngược về đầu khi điểm hiện tại nằm bên trái khung nhìn
    track.style.transform = 'translateX(0)';
  }
}

// Click icon trên timeline → nhảy tới log đó
function timelineJump(i) {
  if (playMode === 'idle') return;
  if (playTimer) { clearInterval(playTimer); playTimer = null; }
  playMode = 'manual';
  playIndex = i;
  const p = playPoints[playIndex];
  if (!p) return;
  map.flyTo([p.lat, p.lon], 14);
  showPlayPoint(p);
  setPlayToggleLabel('play.resume');
  updateTimelineActive();
}

function stopPlay(complete) {
  if (playTimer) { clearInterval(playTimer); playTimer = null; }
  if (playLine) { map.removeLayer(playLine); playLine = null; }
  if (playActiveMarker) { map.removeLayer(playActiveMarker); playActiveMarker = null; }
  playMode = 'idle';
  tlZoom = 1;
  showPlayNav(false);
  setPlayBtnLabel('play.viewHistory');
  const btn = document.getElementById('playBtn');
  if (btn) btn.style.background = '';
  setPlayToggleLabel('play.stop');
  showTimeline(false);
  if (complete) showToast('Xem lịch sử hoàn tất: ' + playPoints.length + ' điểm', 'success');
  playPoints = [];
}

// Play button visibility: show when filtered records have coordinates
function updatePlayBtn() {
  const btn = document.getElementById('playBtn');
  if (!btn) return;
  const hasCoord = getFilteredLogs().some(r => r.lat && r.lon);
  btn.style.display = hasCoord ? '' : 'none';
  if (!hasCoord) showPlayNav(false);
}

function toggleLegend() {
  document.getElementById('legendPanel').classList.toggle('show');
}

// Mở/đóng sub-section "Công nghệ mạng" trong legend
function toggleLegendRadio() {
  const sub = document.getElementById('legendRadioSub');
  if (sub) sub.classList.toggle('open');
}

// ============================================
// Init
// ============================================
loadTheme();
applyI18n();
loadCallLogs();
loadAnnotations();
updateSidebarState();
