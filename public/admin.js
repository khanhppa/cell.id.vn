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

  if (name === 'dashboard') loadDashboard();
  if (name === 'users') { loadCreditUsers(); loadCreditTx(); }
  if (name === 'settings') loadSettings();
  if (name === 'payments') loadPayments();

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
  }).catch(e => showToast('Không tải được cấu hình: ' + e.message, 'error'));
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
  if (creditCost !== '') settings.credit_cost_per_lookup = creditCost;
  if (creditBonus !== '') settings.credit_signup_bonus = creditBonus;
  collectPayosSettings(settings);
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
    // Nạp lại toàn bộ form từ giá trị server đã chuẩn hoá (gồm cả payOS: secret
    // quay về bản che), tránh UI lệch trạng thái thật trong DB sau khi lưu.
    loadSettings();
    showToast('Đã lưu cấu hình — tính điểm tra cứu: ' + (on ? 'BẬT' : 'TẮT'), 'success');
  }).catch(e => { showToast(e.message, 'error'); loadSettings(); });
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
  const list = q ? _creditUsers.filter(u => String(u.username).toLowerCase().includes(q)) : _creditUsers;
  if (!list.length) {
    body.innerHTML = '<tr><td colspan="9" class="muted-text">Không có user nào</td></tr>';
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
    return `<tr>
      <td>${u.id}</td>
      <td>${esc(u.username)}</td>
      <td>${emailCell}</td>
      <td><span class="badge ${u.role === 'admin' ? 'badge-admin' : 'badge-user'}">${esc(u.role)}</span></td>
      <td><span class="badge ${status === 'active' ? 'badge-active' : 'badge-pending'}">${esc(status)}</span></td>
      <td style="text-align:right"><b style="color:${bal > 0 ? '#45c07d' : '#ff6b6b'}">${fmt(bal)}</b></td>
      <td style="text-align:right">${fmt(used)}</td>
      <td style="white-space:nowrap">${esc(u.created_at || '')}</td>
      <td style="text-align:right;white-space:nowrap">
        <button class="btn btn-sm btn-success" title="Nạp điểm" onclick="openCreditModal(${u.id}, '${escAttr(u.username)}')"><i class="fas fa-plus"></i> Nạp điểm</button>
        ${verifyBtn}
        <button class="btn btn-sm" title="Sửa user" onclick="editUser(${u.id}, '${escAttr(u.username)}', '${escAttr(u.role)}', '${escAttr(status)}')"><i class="fas fa-pen"></i></button>
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
  switchSection, switchCellSub, switchLocalTab, switchSettingsTab,
  // Settings
  loadSettings, saveSettings,
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

