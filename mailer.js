/**
 * mailer — gửi email giao dịch (kích hoạt tài khoản, đặt lại mật khẩu).
 *
 * Nguyên tắc:
 *  1. KHÔNG throw ra ngoài. Mọi hàm trả `{ ok, ... }` / `{ ok:false, reason }`
 *     theo convention của credits.js / payos.js → route không phải try/catch
 *     từng nhánh. Gửi mail thất bại KHÔNG được làm hỏng luồng đăng ký.
 *  2. Chưa cấu hình SMTP (`smtp_enabled != 1` hoặc thiếu host/from) → trả
 *     `{ ok: false, reason: 'not_configured', preview: true }` và ghi link
 *     xác nhận ra console của server. Nhờ vậy dev chạy local vẫn test được
 *     toàn bộ luồng kích hoạt mà không cần tài khoản SMTP.
 *  3. Config đọc từ bảng settings MỖI LẦN GỌI (giống payos.js) → admin đổi
 *     credential là có hiệu lực ngay, không cần restart. Transport được cache
 *     theo "dấu vân tay" config để không tạo connection pool mới mỗi request.
 */
const db = require('./database');

// Cache transport: key = fingerprint config, value = nodemailer transporter.
let cachedTransport = null;
let cachedKey = '';
// Chỉ log cảnh báo TLS một lần cho mỗi nội dung để không spam console.
let lastTlsWarning = '';
// Tương tự cho cảnh báo "provider ghi đè địa chỉ From".
let lastFromWarning = '';
let lastHostWarning = '';

/**
 * Nhận diện nhà cung cấp SMTP từ hostname. CHỈ dùng để sinh gợi ý (UI + log +
 * thông điệp lỗi) — KHÔNG thay đổi luồng gửi. Nhờ vậy cấu hình vẫn generic:
 * bất kỳ máy chủ SMTP nào cũng chạy, còn host đã biết thì được nhắc đúng chỗ.
 *
 * `fromOverride: true` = dịch vụ TỰ THAY header From thành tài khoản đã xác thực
 * (chỉ Gmail/Yahoo làm vậy với tài khoản tiêu dùng). Zoho/Brevo/Mailgun/Resend/
 * SES gửi đúng `smtp_from` miễn domain đã verify → không cảnh báo.
 *
 * @returns {{name:string, ssl:number, starttls:number, fromOverride:boolean,
 *            userHint:string, passHint:string}}
 */
function detectProvider(host) {
  const h = String(host || '').trim().toLowerCase();
  const generic = {
    name: 'SMTP tùy chỉnh', ssl: 465, starttls: 587, fromOverride: false,
    userHint: 'tài khoản SMTP', passHint: 'mật khẩu ứng dụng do nhà cung cấp cấp'
  };
  if (!h) return generic;
  if (/(^|\.)gmail\.com$/.test(h) || /googlemail\.com$/.test(h)) {
    return { name: 'Gmail', ssl: 465, starttls: 587, fromOverride: true,
      userHint: 'địa chỉ Gmail đầy đủ', passHint: 'App Password 16 ký tự (phải bật 2FA)' };
  }
  // Zoho: host KHÁC nhau theo loại tài khoản và DataCenter — dùng lẫn là nguồn
  // của "554 5.7.8 Access Restricted".
  //   Free Org / personal            → smtp.zoho.<tld>      (KHÔNG có tiền tố "pro")
  //   Paid Org (domain riêng)        → smtppro.zoho.<tld>
  //   DC: .com = US, .eu = EU, .in = Ấn Độ, .jp = Nhật, .com.au = Úc, .ca = Canada
  const zoho = /(?:^|\.)(smtp|smtppro)\.zoho\.(com|eu|in|jp|ca|com\.au)$/.exec(h);
  if (zoho) {
    const paid = zoho[1] === 'smtppro';
    const dc = { com: 'US', eu: 'EU', in: 'Ấn Độ', jp: 'Nhật', ca: 'Canada', 'com.au': 'Úc' }[zoho[2]] || zoho[2];
    return { name: `Zoho Mail (${paid ? 'Paid Org' : 'Free Org'}, DC ${dc})`,
      ssl: 465, starttls: 587, fromOverride: false,
      userHint: `địa chỉ email đầy đủ đúng DC ${dc}`,
      passHint: 'App Password (accounts.zoho.com → Security)',
      // Chỉ "smtppro.*" mới gắn với gói trả phí; không suy được gói của admin từ
      // host nên chỉ nhắc ĐIỀU KIỆN, không khẳng định sai.
      warn: paid
        ? `Đang dùng smtppro.zoho.${zoho[2]} — máy chủ này CHỈ hoạt động với gói Zoho Mail TRẢ PHÍ. Gói Free Organization phải đổi sang smtp.zoho.${zoho[2]}, nếu không sẽ bị "554 5.7.8 Access Restricted".`
        : null };
  }
  if (/(^|\.)zoho\.(com|eu|in|jp|ca|com\.au)$/.test(h)) {
    return { name: 'Zoho Mail', ssl: 465, starttls: 587, fromOverride: false,
      userHint: 'địa chỉ Zoho đầy đủ', passHint: 'App Password (accounts.zoho.com → Security)' };
  }
  if (/outlook\.com$|office365\.com$|hotmail\.com$|live\.com$/.test(h)) {
    return { name: 'Outlook / Microsoft 365', ssl: 465, starttls: 587, fromOverride: false,
      userHint: 'địa chỉ email đầy đủ', passHint: 'mật khẩu ứng dụng nếu bật MFA' };
  }
  if (/(^|\.)yahoo\.com$/.test(h)) {
    return { name: 'Yahoo Mail', ssl: 465, starttls: 587, fromOverride: true,
      userHint: 'địa chỉ Yahoo đầy đủ', passHint: 'App Password 16 ký tự' };
  }
  if (/smtp-relay\.brevo\.com$|smtp-relay\.sendinblue\.com$/.test(h)) {
    return { name: 'Brevo', ssl: 465, starttls: 587, fromOverride: false,
      userHint: 'email đăng nhập Brevo', passHint: 'SMTP Key (Brevo → SMTP & API)' };
  }
  if (/smtp\.resend\.com$/.test(h)) {
    return { name: 'Resend', ssl: 465, starttls: 587, fromOverride: false,
      userHint: 'resend', passHint: 'API Key (bắt đầu bằng re_)' };
  }
  if (/smtp\.mailgun\.org$/.test(h)) {
    return { name: 'Mailgun', ssl: 465, starttls: 587, fromOverride: false,
      userHint: 'postmaster@<domain-của-bạn>', passHint: 'SMTP password của domain' };
  }
  if (/smtp\.sendgrid\.net$/.test(h)) {
    return { name: 'SendGrid', ssl: 465, starttls: 587, fromOverride: false,
      userHint: 'apikey', passHint: 'API Key (bắt đầu bằng SG.)' };
  }
  if (/email-smtp\.[a-z0-9-]+\.amazonaws\.com$/.test(h)) {
    return { name: 'Amazon SES', ssl: 465, starttls: 587, fromOverride: false,
      userHint: 'SMTP Credential do SES cấp', passHint: 'SMTP Password do SES cấp' };
  }
  if (/mail\.gmx\.(com|net)$/.test(h)) {
    return { name: 'GMX', ssl: 465, starttls: 587, fromOverride: false,
      userHint: 'địa chỉ GMX đầy đủ', passHint: 'mật khẩu đăng nhập GMX' };
  }
  return generic;
}

/**
 * Provider có tự ghi đè header From thành tài khoản xác thực không. Trả chuỗi
 * cảnh báo (đã dựng sẵn) hoặc null. Ghi log đúng 1 lần cho mỗi cặp giá trị.
 */
function warnFromOverride(cfg) {
  const p = detectProvider(cfg && cfg.host);
  if (!p.fromOverride) return null;
  const from = String((cfg && cfg.from) || '').trim().toLowerCase();
  const user = String((cfg && cfg.user) || '').trim().toLowerCase();
  if (!from || !user || from === user) return null;
  const msg = `${p.name} sẽ ghi đè From <${cfg.from}> thành tài khoản đã xác thực <${cfg.user}>. `
    + `Muốn giữ ${cfg.from}: thêm alias "Send mail as" trong ${p.name}, hoặc dùng relay SMTP riêng `
    + `(Zoho/Brevo/Resend/Mailgun — các dịch vụ này tôn trọng smtp_from khi domain đã verify).`;
  if (msg !== lastFromWarning) {
    lastFromWarning = msg;
    console.warn(`[mailer] ${msg}`);
  }
  return msg;
}

function getSetting(key, dflt) {
  return new Promise((resolve) => {
    db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
      resolve(err || !row || row.value === null || row.value === undefined ? dflt : row.value);
    });
  });
}

/** Đọc toàn bộ config SMTP từ settings. `pass` KHÔNG bao giờ trả ra route public. */
async function getConfig() {
  const [enabled, host, port, secure, user, pass, from, fromName, base] = await Promise.all([
    getSetting('smtp_enabled', '0'),
    getSetting('smtp_host', ''),
    getSetting('smtp_port', '587'),
    getSetting('smtp_secure', '0'),
    getSetting('smtp_user', ''),
    getSetting('smtp_pass', ''),
    getSetting('smtp_from', ''),
    getSetting('smtp_from_name', 'Cell Tracker'),
    getSetting('public_base_url', '')
  ]);
  return {
    enabled: enabled === '1',
    host: String(host || '').trim(),
    port: parseInt(port, 10) || 587,
    secure: secure === '1',
    user: String(user || '').trim(),
    // App Password / SMTP Key / API Key dán ra thường kèm khoảng trắng (Gmail
    // hiển thị "abcd efgh ijkl mnop"). Bỏ MỌI khoảng trắng trước khi dùng, nếu
    // không auth sẽ fail dù chuỗi nhìn đúng.
    pass: String(pass || '').replace(/\s+/g, ''),
    from: String(from || '').trim(),
    fromName: String(fromName || '').trim() || 'Cell Tracker',
    publicBaseUrl: String(base || '').trim().replace(/\/+$/, '')
  };
}

/** Đã bật gửi mail VÀ có đủ host + địa chỉ người gửi chưa. */
async function isConfigured() {
  const c = await getConfig();
  return c.enabled && !!(c.host && (c.from || c.user));
}

/**
 * Chuẩn hoá cặp (port, secure) — nguồn của rất nhiều lỗi TLS khó hiểu.
 *
 * Port 587/25/2525 là STARTTLS: kết nối plaintext trước, nâng cấp lên TLS sau.
 * Port 465 là implicit TLS: TLS ngay từ byte đầu tiên. Đặt `secure: true` cho
 * cổng 587 khiến nodemailer bắt tay TLS ngay, nhưng server trả về plaintext
 * banner `220 ...`; OpenSSL đọc `0x32 = '2'` như version byte của TLS record →
 * `tls_validate_record_header:wrong version number`. Ngược lại, `secure: false`
 * cho cổng 465 thì server chờ ClientHello mà client gửi EHLO → treo/timeout.
 *
 * Vì vậy suy `secure` từ port khi hai giá trị mâu thuẫn, và ghi cảnh báo để
 * admin biết cấu hình đã được tự sửa.
 * @returns {{ secure: boolean, warning: string|null }}
 */
function normalizeTls(port, secure) {
  if (port === 465 && !secure) {
    return { secure: true, warning: `smtp_port=465 cần TLS ngay (secure); đã tự bật.` };
  }
  if (port !== 465 && secure) {
    return { secure: false, warning: `smtp_port=${port} dùng STARTTLS, không phải TLS ngay (secure); đã tự tắt.` };
  }
  return { secure, warning: null };
}

function getTransport(cfg) {
  const tls = normalizeTls(cfg.port, cfg.secure);
  if (tls.warning && tls.warning !== lastTlsWarning) {
    lastTlsWarning = tls.warning;
    console.warn(`[mailer] ${tls.warning}`);
  }
  // Cảnh báo host sai loại tài khoản (vd Zoho Free Org dùng host "pro" của gói
  // trả phí) — chạy ở đây vì vấn đề thuộc về cấu hình máy chủ, không phải From.
  const prov = detectProvider(cfg.host);
  if (prov.warn && prov.warn !== lastHostWarning) {
    lastHostWarning = prov.warn;
    console.warn(`[mailer] ${prov.warn}`);
  }
  const key = [cfg.host, cfg.port, tls.secure, cfg.user, cfg.pass].join('|');
  if (cachedTransport && cachedKey === key) return cachedTransport;
  const nodemailer = require('nodemailer');
  cachedTransport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: tls.secure,
    // Nhiều relay/AWS SES trả chứng chỉ *.provider.com; bật SNI giúp tránh
    // ALTNAME_MISMATCH. Giữ mặc định của Node nếu host đã là FQDN.
    tls: { servername: cfg.host },
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined
  });
  cachedKey = key;
  return cachedTransport;
}

/**
 * URL công khai của site, dùng để dựng link kích hoạt/đặt lại mật khẩu.
 * Thứ tự ưu tiên: public_base_url → host của request (local tự nhận
 * http://localhost:3000 mà không cần cấu hình gì).
 */
async function resolveBaseUrl(req) {
  const c = await getConfig();
  if (c.publicBaseUrl) return c.publicBaseUrl;
  if (req && req.get) {
    const host = req.get('host');
    if (host) return `${req.protocol || 'http'}://${host}`;
  }
  return '';
}

/**
 * Dịch lỗi SMTP thô thành gợi ý sửa được cho admin. Giữ nguyên thông điệp gốc
 * ở cuối để vẫn tra cứu được. `cfg` (tùy chọn) để chèn gợi ý riêng của từng
 * nhà cung cấp (Gmail App Password, Brevo SMTP Key, Resend API Key…).
 */
function explainSmtpError(msg, cfg) {
  const m = String(msg || '');
  const p = cfg ? detectProvider(cfg.host) : null;
  const byProvider = p && p.passHint ? ` ${p.name}: dùng ${p.passHint}.` : '';
  if (/wrong version number|tls_validate_record_header/i.test(m)) {
    return 'Sai kiểu mã hoá TLS: cổng 465 dùng "TLS ngay" (secure), cổng 587/25 dùng STARTTLS (secure TẮT). '
      + 'Kiểm tra lại smtp_port và smtp_secure.';
  }
  if (/wrong tag|bad record mac|decryption failed/i.test(m)) {
    return 'Dữ liệu TLS hỏng — thường do proxy/firewall can thiệp hoặc sai cổng. Thử lại cổng 587 (secure TẮT) hoặc 465 (secure BẬT).';
  }
  if (/self.signed|unable to verify the first certificate|altname|CERT_/i.test(m)) {
    return 'Không xác thực được chứng chỉ SMTP. Kiểm tra tên miền smtp_host đúng chưa, hoặc máy chủ dùng chứng chỉ nội bộ.';
  }
  // LƯU Ý: KHÔNG khớp "5.7.8" trần — lỗi 535 của Gmail cũng chứa "535-5.7.8",
  // sẽ bị nhánh này bắt trước và chẩn đoán sai. Chỉ khớp mã 554 hoặc chữ đặc trưng.
  if (/554|Access Restricted|not permitted to relay|Relay access denied|Relaying disallowed/i.test(m)) {
    const zohoHint = p && /Zoho/.test(p.name)
      ? ' Với Zoho: host phải khớp LOẠI TÀI KHOẢN — gói Free Organization dùng smtp.zoho.com, gói TRẢ PHÍ (domain riêng) dùng smtppro.zoho.com. Dùng lẫn host là nguyên nhân phổ biến nhất.'
      : '';
    return 'Máy chủ SMTP TỪ CHỐI quyền gửi (access restricted) — tài khoản/địa chỉ gửi không được phép relay qua máy chủ này. '
      + 'Kiểm tra: (a) gói dịch vụ còn hạn và có bật SMTP; (b) đã bật SMTP/IMAP/POP trong bảng điều khiển admin; '
      + '(c) đúng DataCenter/máy chủ theo loại tài khoản; (d) không bị giới hạn theo IP; '
      + '(e) smtp_user phải là địa chỉ/alias hợp lệ đã xác thực.' + zohoHint;
  }
  if (/535|Username and Password not accepted|Invalid login|authentication failed|EAUTH|ECredentials/i.test(m)) {
    return 'Sai tài khoản/mật khẩu SMTP — nhiều dịch vụ KHÔNG nhận mật khẩu đăng nhập thường, phải dùng '
      + '"mật khẩu ứng dụng" riêng (Gmail/Zoho/Yahoo: App Password; Brevo: SMTP Key; Resend/SendGrid: API Key '
      + 'với user đặc biệt).' + byProvider;
  }
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(m)) {
    return 'Không phân giải được smtp_host. Kiểm tra lại tên máy chủ SMTP.';
  }
  if (/ECONNREFUSED|ETIMEDOUT|timeout/i.test(m)) {
    return 'Không kết nối được tới máy chủ SMTP (bị chặn cổng / sai cổng / firewall).';
  }
  if (/Sender address rejected|550|553|not allowed to send/i.test(m)) {
    return `Bị từ chối địa chỉ gửi (smtp_from). Nhiều dịch vụ yêu cầu VERIFY tên miền/địa chỉ gửi trước khi cho gửi${p ? ` (${p.name})` : ''}. Kiểm tra SPF/DKIM và xác minh sender trong bảng điều khiển nhà cung cấp.`;
  }
  return null;
}

/**
 * Gửi 1 email HTML. Không throw.
 * @returns {Promise<{ok:true, messageId:string}|{ok:false, reason:string, message?:string, preview?:boolean}>}
 */
async function sendMail({ to, subject, html, text }) {
  const cfg = await getConfig();
  if (!cfg.enabled || !cfg.host || !(cfg.from || cfg.user)) {
    console.log(`[mailer] SMTP chưa cấu hình — bỏ qua email tới ${to} | ${subject}`);
    if (text) console.log(text);
    return { ok: false, reason: 'not_configured', preview: true };
  }
  if (!to) return { ok: false, reason: 'no_recipient', message: 'Thiếu địa chỉ người nhận' };
  warnFromOverride(cfg);
  try {
    const transport = getTransport(cfg);
    const info = await transport.sendMail({
      from: cfg.fromName ? `"${cfg.fromName}" <${cfg.from || cfg.user}>` : (cfg.from || cfg.user),
      to,
      subject,
      text: text || undefined,
      html: html || undefined
    });
    return { ok: true, messageId: info && info.messageId };
  } catch (e) {
    console.error('[mailer] gửi mail lỗi:', e.message);
    const hint = explainSmtpError(e.message, cfg);
    return { ok: false, reason: 'smtp_error', message: hint ? `${hint} (Chi tiết: ${e.message})` : e.message };
  }
}

/** Gửi email thử để admin kiểm tra cấu hình. */
async function sendTestMail(to) {
  return sendMail({
    to,
    subject: '[Cell Tracker] Email thử cấu hình SMTP',
    text: 'Nếu bạn đọc được email này, cấu hình SMTP của Cell Tracker đã hoạt động.',
    html: '<p>Nếu bạn đọc được email này, cấu hình SMTP của <b>Cell Tracker</b> đã hoạt động.</p>'
  });
}

/** Khung HTML chung cho email giao dịch (bảng đơn giản, hợp Gmail/Outlook). */
function wrapHtml(title, bodyHtml) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#0f172a;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#1e293b;border-radius:12px;overflow:hidden">
    <div style="padding:18px 24px;background:#0ea5e9;color:#fff;font-size:17px;font-weight:bold">Cell Tracker</div>
    <div style="padding:24px;color:#e2e8f0;font-size:14px;line-height:1.6">
      <h2 style="margin:0 0 12px;font-size:17px;color:#f8fafc">${title}</h2>
      ${bodyHtml}
    </div>
    <div style="padding:14px 24px;background:#0f172a;color:#64748b;font-size:12px">
      Email tự động, vui lòng không trả lời.
    </div>
  </div></body></html>`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Email chứa mã 6 số + link kích hoạt tài khoản. */
function buildVerifyEmail({ username, code, link, ttlMinutes }) {
  const subject = `[Cell Tracker] Mã kích hoạt tài khoản: ${code}`;
  const text = `Xin chào ${username},\n\nMã kích hoạt tài khoản của bạn là: ${code}\n`
    + `Hoặc bấm vào link sau để kích hoạt:\n${link}\n\n`
    + `Mã/link có hiệu lực ${ttlMinutes} phút. Nếu bạn không đăng ký, hãy bỏ qua email này.`;
  const html = wrapHtml('Kích hoạt tài khoản',
    `<p>Xin chào <b>${escapeHtml(username)}</b>,</p>
     <p>Mã kích hoạt tài khoản của bạn là:</p>
     <p style="font-size:30px;letter-spacing:8px;font-weight:bold;color:#38bdf8;margin:16px 0;text-align:center">${escapeHtml(code)}</p>
     <p>Hoặc bấm nút dưới đây để kích hoạt ngay:</p>
     <p style="text-align:center;margin:20px 0">
       <a href="${escapeHtml(link)}" style="background:#0ea5e9;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;display:inline-block">Kích hoạt tài khoản</a>
     </p>
     <p style="color:#94a3b8;font-size:13px">Mã/link có hiệu lực ${ttlMinutes} phút. Nếu bạn không đăng ký, hãy bỏ qua email này.</p>`);
  return { subject, text, html };
}

/** Email chứa mã 6 số + link đặt lại mật khẩu. */
function buildResetEmail({ username, code, link, ttlMinutes }) {
  const subject = `[Cell Tracker] Mã đặt lại mật khẩu: ${code}`;
  const text = `Xin chào ${username},\n\nMã đặt lại mật khẩu của bạn là: ${code}\n`
    + `Hoặc bấm vào link sau:\n${link}\n\n`
    + `Mã/link có hiệu lực ${ttlMinutes} phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.`;
  const html = wrapHtml('Đặt lại mật khẩu',
    `<p>Xin chào <b>${escapeHtml(username)}</b>,</p>
     <p>Mã đặt lại mật khẩu của bạn là:</p>
     <p style="font-size:30px;letter-spacing:8px;font-weight:bold;color:#38bdf8;margin:16px 0;text-align:center">${escapeHtml(code)}</p>
     <p>Hoặc bấm nút dưới đây để đặt lại mật khẩu:</p>
     <p style="text-align:center;margin:20px 0">
       <a href="${escapeHtml(link)}" style="background:#0ea5e9;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;display:inline-block">Đặt lại mật khẩu</a>
     </p>
     <p style="color:#94a3b8;font-size:13px">Mã/link có hiệu lực ${ttlMinutes} phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`);
  return { subject, text, html };
}

module.exports = {
  getSetting,
  getConfig,
  isConfigured,
  resolveBaseUrl,
  sendMail,
  sendTestMail,
  buildVerifyEmail,
  buildResetEmail,
  wrapHtml,
  escapeHtml,
  normalizeTls,
  explainSmtpError,
  detectProvider,
  warnFromOverride
};
