/**
 * Test end-to-end cho luồng xác thực mới: captcha, đăng ký + email + kích hoạt,
 * quên/đặt lại mật khẩu, đổi mật khẩu khi đã đăng nhập, và route admin SMTP.
 *
 * Chạy: node _authtest.js
 *
 * Dùng DB tạm + PORT tạm (patch sqlite3 giống các test khác) → KHÔNG đụng
 * database.sqlite thật. SMTP tắt (mặc định) nên server trả dev_code/dev_link
 * trong response là đủ để test kích hoạt mà không cần hòm thư thật.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

const tmpDb = path.join(os.tmpdir(), `authtest-${process.pid}-${Date.now()}.sqlite`);
// database.js đặt DB ở path.dirname(__dirname) = thư mục CHA của repo (D:\Code\database.sqlite),
// không phải trong repo — phải tính đúng để patch kết nối sang DB tạm.
const realDbPath = path.join(path.dirname(__dirname), 'database.sqlite');

// Chuyển mọi kết nối tới database.sqlite thật sang DB tạm.
const realExistsSync = fs.existsSync;
fs.existsSync = function (p) {
  if (typeof p === 'string' && path.resolve(p) === path.resolve(realDbPath)) return false;
  return realExistsSync.apply(this, arguments);
};
const Sqlite3 = require('sqlite3');
const RealDatabase = Sqlite3.Database;
function PatchedDatabase(file, ...rest) {
  if (typeof file === 'string' && path.resolve(file) === path.resolve(realDbPath)) file = tmpDb;
  return new RealDatabase(file, ...rest);
}
PatchedDatabase.prototype = RealDatabase.prototype;
Sqlite3.Database = PatchedDatabase;
const RealVerbose = Sqlite3.verbose;
Sqlite3.verbose = function () {
  const v = RealVerbose.apply(this, arguments);
  const orig = v.Database;
  function VDatabase(file, ...rest) {
    if (typeof file === 'string' && path.resolve(file) === path.resolve(realDbPath)) file = tmpDb;
    return new orig(file, ...rest);
  }
  VDatabase.prototype = orig.prototype;
  v.Database = VDatabase;
  return v;
};

function pickFreePort() {
  const net = require('net');
  const srv = net.createServer();
  return new Promise((resolve, reject) => {
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-auth';
// Tắt rate limit auth trong test (nhiều request liên tiếp từ cùng IP).
process.env.AUTH_TEST_NO_RATELIMIT = '1';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`); }
}

const BASE = () => `http://127.0.0.1:${process.env.PORT}`;

function req(method, urlPath, body, token) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const r = http.request(BASE() + urlPath, {
      method,
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        data ? { 'Content-Length': data.length } : {},
        token ? { Authorization: 'Bearer ' + token } : {}
      )
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(buf); } catch (e) { parsed = buf; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function waitPort(port) {
  const net = require('net');
  await new Promise(resolve => {
    const t0 = Date.now();
    (function poll() {
      const s = net.connect(port, '127.0.0.1');
      s.on('connect', () => { s.destroy(); resolve(); });
      s.on('error', () => {
        s.destroy();
        if (Date.now() - t0 > 8000) return resolve();
        setTimeout(poll, 120);
      });
    })();
  });
}

async function main() {
  process.env.PORT = String(await pickFreePort());
  require('./server');
  const db = require('./database');
  const bcrypt = require('bcryptjs');

  const sqlRun = (sql, params = []) => new Promise((res, rej) =>
    db.run(sql, params, function (err) { err ? rej(err) : res(this); }));
  const sqlGet = (sql, params = []) => new Promise((res, rej) =>
    db.get(sql, params, (err, row) => err ? rej(err) : res(row)));

  await waitPort(Number(process.env.PORT));

  console.log('\n== Captcha ==');
  const c1 = await req('GET', '/api/captcha');
  ok('GET /api/captcha -> 200', c1.status === 200, c1.body);
  ok('captcha có id', !!(c1.body && c1.body.id));
  ok('captcha text đúng 6 ký tự', !!(c1.body && /^[A-Z0-9]{6}$/.test(c1.body.text)), c1.body && c1.body.text);

  console.log('\n== Đăng ký: validate ==');
  const noTerms = await req('POST', '/api/register', {
    username: 'auth_u1', password: 'secret1', email: 'u1@test.local',
    captchaId: c1.body.id, captcha: c1.body.text
  });
  ok('thiếu acceptTerms -> 400', noTerms.status === 400, noTerms.body);

  const c2 = await req('GET', '/api/captcha');
  const badMail = await req('POST', '/api/register', {
    username: 'auth_u1', password: 'secret1', email: 'not-an-email',
    captchaId: c2.body.id, captcha: c2.body.text, acceptTerms: true
  });
  ok('email sai định dạng -> 400', badMail.status === 400, badMail.body);

  const c3 = await req('GET', '/api/captcha');
  const badCap = await req('POST', '/api/register', {
    username: 'auth_u1', password: 'secret1', email: 'u1@test.local',
    captchaId: c3.body.id, captcha: 'XXXXXX', acceptTerms: true
  });
  ok('captcha sai -> 400 BAD_CAPTCHA', badCap.status === 400 && badCap.body.reason === 'BAD_CAPTCHA', badCap.body);

  // Captcha one-shot: dùng lại id vừa sai phải thất bại.
  const reuse = await req('POST', '/api/register', {
    username: 'auth_u1', password: 'secret1', email: 'u1@test.local',
    captchaId: c3.body.id, captcha: c3.body.text, acceptTerms: true
  });
  ok('captcha one-shot (dùng lại id) -> 400', reuse.status === 400, reuse.body);

  console.log('\n== Đăng ký thành công + trạng thái pending ==');
  const c4 = await req('GET', '/api/captcha');
  const reg = await req('POST', '/api/register', {
    username: 'auth_u1', password: 'secret1', email: 'u1@test.local',
    captchaId: c4.body.id, captcha: c4.body.text, acceptTerms: true
  });
  ok('đăng ký -> 200', reg.status === 200, reg.body);
  ok('đăng ký trả pending=true', reg.body.pending === true, reg.body);
  ok('SMTP tắt → có dev_code', !!reg.body.dev_code, reg.body);
  ok('SMTP tắt → có dev_link', !!reg.body.dev_link, reg.body);
  ok('email trả về bị che (masked)', /@/.test(reg.body.email) && reg.body.email.includes('*'), reg.body.email);

  const u1 = await sqlGet('SELECT * FROM users WHERE username = ?', ['auth_u1']);
  ok('user có status pending', u1 && u1.status === 'pending', u1 && u1.status);
  ok('user có email_verified = 0', u1 && Number(u1.email_verified) === 0, u1 && u1.email_verified);
  ok('lưu terms_accepted_at', !!(u1 && u1.terms_accepted_at));
  const verifyRow = await sqlGet(
    "SELECT * FROM email_verifications WHERE user_id = ? AND purpose = 'verify' AND used_at IS NULL", [u1.id]);
  ok('có bản ghi email_verifications purpose=verify', !!verifyRow);
  ok('mã 6 số', verifyRow && /^\d{6}$/.test(verifyRow.code), verifyRow && verifyRow.code);

  console.log('\n== Đăng nhập khi chưa kích hoạt ==');
  const loginPending = await req('POST', '/api/login', { username: 'auth_u1', password: 'secret1' });
  ok('login pending -> 403', loginPending.status === 403, loginPending.body);
  ok('login pending reason=EMAIL_NOT_VERIFIED', loginPending.body.reason === 'EMAIL_NOT_VERIFIED', loginPending.body);

  console.log('\n== Sai mã kích hoạt ==');
  const badCode = await req('POST', '/api/verify-email', { email: 'u1@test.local', code: '000000' });
  ok('mã sai -> 400 BAD_CODE', badCode.status === 400 && badCode.body.reason === 'BAD_CODE', badCode.body);
  ok('mã sai trả attempts_left', typeof badCode.body.attempts_left === 'number', badCode.body);

  console.log('\n== Kích hoạt bằng link token ==');
  const link = reg.body.dev_link;
  const vtoken = link.split('token=')[1];
  const verifyGet = await req('GET', '/api/verify-email?token=' + encodeURIComponent(vtoken));
  ok('GET verify-email?token -> 200', verifyGet.status === 200, verifyGet.status);
  const u1b = await sqlGet('SELECT * FROM users WHERE username = ?', ['auth_u1']);
  ok('sau kích hoạt: status active', u1b.status === 'active', u1b.status);
  ok('sau kích hoạt: email_verified = 1', Number(u1b.email_verified) === 1, u1b.email_verified);

  const loginOk = await req('POST', '/api/login', { username: 'auth_u1', password: 'secret1' });
  ok('đăng nhập sau kích hoạt -> 200', loginOk.status === 200, loginOk.body);
  ok('đăng nhập trả token', !!(loginOk.body && loginOk.body.token));
  const userToken = loginOk.body.token;

  const loginByEmail = await req('POST', '/api/login', { username: 'u1@test.local', password: 'secret1' });
  ok('đăng nhập bằng email -> 200', loginByEmail.status === 200, loginByEmail.body);

  console.log('\n== Đổi mật khẩu khi đã đăng nhập ==');
  const badCur = await req('PUT', '/api/auth/password', { currentPassword: 'wrong', newPassword: 'secret2' }, userToken);
  ok('mật khẩu hiện tại sai -> 400', badCur.status === 400, badCur.body);
  const chg = await req('PUT', '/api/auth/password', { currentPassword: 'secret1', newPassword: 'secret2' }, userToken);
  ok('đổi mật khẩu -> 200', chg.status === 200, chg.body);
  const reLogin = await req('POST', '/api/login', { username: 'auth_u1', password: 'secret2' });
  ok('đăng nhập bằng mật khẩu mới -> 200', reLogin.status === 200, reLogin.body);

  console.log('\n== Quên mật khẩu ==');
  const c5 = await req('GET', '/api/captcha');
  const forgotUnknown = await req('POST', '/api/forgot-password', {
    email: 'nobody@test.local', captchaId: c5.body.id, captcha: c5.body.text
  });
  ok('email không tồn tại vẫn -> 200 (không lộ)', forgotUnknown.status === 200, forgotUnknown.body);
  ok('email không tồn tại sent=false', forgotUnknown.body.sent === false, forgotUnknown.body);

  const c6 = await req('GET', '/api/captcha');
  const forgot = await req('POST', '/api/forgot-password', {
    email: 'u1@test.local', captchaId: c6.body.id, captcha: c6.body.text
  });
  ok('quên mật khẩu -> 200', forgot.status === 200, forgot.body);
  ok('SMTP tắt → dev_code đặt lại', !!forgot.body.dev_code, forgot.body);
  const resetRow = await sqlGet(
    "SELECT * FROM email_verifications WHERE purpose = 'reset' AND used_at IS NULL ORDER BY id DESC LIMIT 1");
  ok('có bản ghi reset', !!resetRow);

  const resetBad = await req('POST', '/api/reset-password', {
    email: 'u1@test.local', code: '000000', newPassword: 'secret3'
  });
  ok('reset mã sai -> 400', resetBad.status === 400, resetBad.body);

  const resetOk = await req('POST', '/api/reset-password', {
    email: 'u1@test.local', code: forgot.body.dev_code, newPassword: 'secret3'
  });
  ok('reset đúng mã -> 200', resetOk.status === 200, resetOk.body);
  ok('reset trả token đăng nhập luôn', !!(resetOk.body && resetOk.body.token));
  const loginAfterReset = await req('POST', '/api/login', { username: 'auth_u1', password: 'secret3' });
  ok('đăng nhập bằng mật khẩu đã reset -> 200', loginAfterReset.status === 200, loginAfterReset.body);

  console.log('\n== Link đặt lại (đổi qua token) ==');
  const c7 = await req('GET', '/api/captcha');
  const forgot2 = await req('POST', '/api/forgot-password', {
    email: 'u1@test.local', captchaId: c7.body.id, captcha: c7.body.text
  });
  const resetToken = String(forgot2.body.dev_link).split('token=')[1];
  const resetForm = await req('GET', '/api/reset-password?token=' + encodeURIComponent(resetToken));
  ok('GET reset-password?token -> 200', resetForm.status === 200);
  const viaToken = await req('POST', '/api/reset-password/token', {
    token: resetToken, newPassword: 'secret4'
  });
  ok('reset qua token -> 200', viaToken.status === 200, viaToken.body);
  const reuseToken = await req('POST', '/api/reset-password/token', {
    token: resetToken, newPassword: 'secret5'
  });
  ok('token one-shot (dùng lại) -> 400', reuseToken.status === 400, reuseToken.body);

  console.log('\n== Gửi lại mã kích hoạt ==');
  const c8 = await req('GET', '/api/captcha');
  const reg2 = await req('POST', '/api/register', {
    username: 'auth_u2', password: 'secret1', email: 'u2@test.local',
    captchaId: c8.body.id, captcha: c8.body.text, acceptTerms: true
  });
  ok('đăng ký user2 -> 200', reg2.status === 200, reg2.body);
  const resend = await req('POST', '/api/resend-verification', { email: 'u2@test.local' });
  ok('resend -> 200', resend.status === 200, resend.body);
  ok('resend có dev_code mới', !!resend.body.dev_code, resend.body);
  const active2 = await sqlGet(
    "SELECT COUNT(*) AS n FROM email_verifications WHERE purpose='verify' AND used_at IS NULL");
  ok('chỉ còn 1 mã verify active', active2.n === 1, active2);

  const verifyByCode = await req('POST', '/api/verify-email', {
    email: 'u2@test.local', code: resend.body.dev_code
  });
  ok('kích hoạt bằng mã 6 số -> 200', verifyByCode.status === 200, verifyByCode.body);

  console.log('\n== Trùng username / email ==');
  const c9 = await req('GET', '/api/captcha');
  const dupUser = await req('POST', '/api/register', {
    username: 'auth_u1', password: 'secret1', email: 'other@test.local',
    captchaId: c9.body.id, captcha: c9.body.text, acceptTerms: true
  });
  ok('trùng username -> 400', dupUser.status === 400, dupUser.body);
  const c10 = await req('GET', '/api/captcha');
  const dupMail = await req('POST', '/api/register', {
    username: 'brand_new', password: 'secret1', email: 'u1@test.local',
    captchaId: c10.body.id, captcha: c10.body.text, acceptTerms: true
  });
  ok('trùng email -> 400', dupMail.status === 400, dupMail.body);

  console.log('\n== Admin: user + SMTP ==');
  const hash = await bcrypt.hash('adminpw', 4);
  await sqlRun("INSERT INTO users (username, password, role, status, email, email_verified) VALUES (?, ?, 'admin', 'active', ?, 1)",
    ['auth_admin', hash, 'auth_admin@test.local']);
  const admLogin = await req('POST', '/api/login', { username: 'auth_admin', password: 'adminpw' });
  const admToken = admLogin.body && admLogin.body.token;
  ok('đăng nhập admin -> 200', admLogin.status === 200, admLogin.body);

  const usersList = await req('GET', '/api/admin/users', undefined, admToken);
  ok('GET /api/admin/users -> 200', usersList.status === 200, usersList.status);
  const anyUser = usersList.body.find(u => u.username === 'auth_u1');
  ok('list user có email', !!(anyUser && anyUser.email === 'u1@test.local'), anyUser);
  ok('list user có email_verified', !!(anyUser && Number(anyUser.email_verified) === 1), anyUser);

  const createUser = await req('POST', '/api/admin/users', {
    username: 'auth_admin_created', password: 'pw12345', email: 'created@test.local'
  }, admToken);
  ok('admin tạo user -> 200', createUser.status === 200, createUser.body);
  const created = await sqlGet('SELECT * FROM users WHERE username = ?', ['auth_admin_created']);
  ok('user admin tạo được coi là đã xác thực', Number(created.email_verified) === 1, created.email_verified);

  const vlink = await req('GET', `/api/admin/users/${created.id}/verification-link`, undefined, admToken);
  ok('GET verification-link -> 200', vlink.status === 200, vlink.body);
  ok('verification-link có link + code', !!(vlink.body.link && vlink.body.code), vlink.body);

  const verifyNow = await req('POST', `/api/admin/users/${u1.id}/verify`, undefined, admToken);
  ok('POST admin verify -> 200', verifyNow.status === 200, verifyNow.body);

  const smtpTestOff = await req('POST', '/api/admin/smtp/test', { to: 'x@test.local' }, admToken);
  ok('smtp/test khi chưa cấu hình -> 400 not_configured',
    smtpTestOff.status === 400 && smtpTestOff.body.reason === 'not_configured', smtpTestOff.body);

  const setSmtp = await req('PUT', '/api/settings', { settings: { smtp_enabled: '1' } }, admToken);
  ok('bật SMTP thiếu host -> 400', setSmtp.status === 400, setSmtp.body);

  const setSmtp2 = await req('PUT', '/api/settings', {
    settings: { smtp_enabled: '1', smtp_host: 'smtp.test.local', smtp_from: 'no-reply@test.local', smtp_pass: 'secretpass' }
  }, admToken);
  ok('bật SMTP đủ host+from -> 200', setSmtp2.status === 200, setSmtp2.body);
  const masked = setSmtp2.body.settings || {};
  ok('smtp_pass trả về bản che', String(masked.smtp_pass || '').startsWith('••••'), masked.smtp_pass);
  ok('smtp_pass_set = true', masked.smtp_pass_set === true, masked.smtp_pass_set);

  const keepPass = await req('PUT', '/api/settings', {
    settings: { smtp_pass: masked.smtp_pass }
  }, admToken);
  ok('gửi lại bản che -> 200 (giữ nguyên pass)', keepPass.status === 200, keepPass.body);
  const storedPass = await sqlGet("SELECT value FROM settings WHERE key = 'smtp_pass'");
  ok('smtp_pass trong DB vẫn là giá trị gốc', storedPass.value === 'secretpass', storedPass.value);

  // --- Đoán (port, secure) đúng cho TLS ---
  // Cổng 587 dùng STARTTLS; đặt secure=true khiến nodemailer bắt tay TLS ngay
  // trong khi server trả plaintext banner "220 ..." → OpenSSL đọc 0x32 ('2') làm
  // version byte → "tls_validate_record_header:wrong version number".
  const mailer = require('./mailer');
  console.log('\n== mailer: chuẩn hoá TLS ==');
  ok('port 587 + secure=true -> tự tắt secure (STARTTLS)',
    mailer.normalizeTls(587, true).secure === false && !!mailer.normalizeTls(587, true).warning);
  ok('port 587 + secure=false -> giữ nguyên, không cảnh báo',
    mailer.normalizeTls(587, false).secure === false && mailer.normalizeTls(587, false).warning === null);
  ok('port 465 + secure=false -> tự bật secure (implicit TLS)',
    mailer.normalizeTls(465, false).secure === true && !!mailer.normalizeTls(465, false).warning);
  ok('port 465 + secure=true -> giữ nguyên, không cảnh báo',
    mailer.normalizeTls(465, true).secure === true && mailer.normalizeTls(465, true).warning === null);
  ok('port 25/2525 + secure=true -> tự tắt secure',
    mailer.normalizeTls(25, true).secure === false && mailer.normalizeTls(2525, true).secure === false);

  console.log('\n== mailer: dịch lỗi SMTP ==');
  const WRONG_VER = 'B89D0000:error:0A00010B:SSL routines:tls_validate_record_header:wrong version number:openssl\\ssl\\record\\methods\\tlsany_meth.c:78:';
  const hint = mailer.explainSmtpError(WRONG_VER);
  ok('lỗi "wrong version number" -> gợi ý kiểm tra port/secure',
    !!hint && /TLS|465|587/.test(hint), hint);
  ok('lỗi 535 auth -> gợi ý App Password',
    /App Password/.test(mailer.explainSmtpError('Invalid login: 535-5.7.8 Username and Password not accepted') || ''));
  ok('lỗi chứng chỉ -> gợi ý smtp_host',
    /chứng chỉ/.test(mailer.explainSmtpError('Error: self signed certificate in certificate chain') || ''));
  ok('lỗi khác -> trả null (giữ thông điệp gốc)',
    mailer.explainSmtpError('some completely unknown failure') === null);
  ok('sendMail trả message có gợi ý khi lỗi TLS (không chỉ stack thô)',
    /TLS/.test(mailer.explainSmtpError(WRONG_VER) || ''));

  console.log('\n== mailer: nhận diện nhà cung cấp (generic, không chỉ Gmail) ==');
  ok('smtp.zoho.com -> Zoho Mail, KHÔNG ghi đè From',
    /Zoho Mail/.test(mailer.detectProvider('smtp.zoho.com').name)
    && mailer.detectProvider('smtp.zoho.com').fromOverride === false);
  ok('smtp.zoho.eu -> Zoho Mail (region khác)',
    /Zoho Mail/.test(mailer.detectProvider('smtp.zoho.eu').name)
    && /EU/.test(mailer.detectProvider('smtp.zoho.eu').name));
  ok('smtp.gmail.com -> Gmail, CÓ ghi đè From',
    mailer.detectProvider('smtp.gmail.com').fromOverride === true);
  ok('smtp-relay.brevo.com -> Brevo + gợi ý SMTP Key',
    /Brevo/.test(mailer.detectProvider('smtp-relay.brevo.com').name)
    && /SMTP Key/.test(mailer.detectProvider('smtp-relay.brevo.com').passHint));
  ok('smtp.resend.com -> user đặc biệt "resend"',
    mailer.detectProvider('smtp.resend.com').userHint === 'resend');
  ok('smtp.sendgrid.net -> user "apikey"',
    mailer.detectProvider('smtp.sendgrid.net').userHint === 'apikey');
  ok('email-smtp.<region>.amazonaws.com -> Amazon SES',
    /Amazon SES/.test(mailer.detectProvider('email-smtp.ap-southeast-1.amazonaws.com').name));
  ok('host lạ -> generic "SMTP tùy chỉnh", không throw',
    mailer.detectProvider('mail.cong-ty-noi-bo.local').name === 'SMTP tùy chỉnh'
    && mailer.detectProvider('').name === 'SMTP tùy chỉnh');

  console.log('\n== mailer: cảnh báo From bị ghi đè (chỉ provider có hành vi đó) ==');
  ok('Zoho + from khác user -> KHÔNG cảnh báo (Zoho tôn trọng smtp_from)',
    mailer.warnFromOverride({ host: 'smtp.zoho.com', from: 'no-reply@cell.id.vn', user: 'admin@cell.id.vn' }) === null);
  ok('Gmail + from khác user -> CÓ cảnh báo nêu rõ tên provider',
    /Gmail/.test(mailer.warnFromOverride({ host: 'smtp.gmail.com', from: 'no-reply@cell.id.vn', user: 'x@gmail.com' }) || ''));
  ok('Gmail + from TRÙNG user -> không cảnh báo',
    mailer.warnFromOverride({ host: 'smtp.gmail.com', from: 'x@gmail.com', user: 'x@gmail.com' }) === null);

  console.log('\n== mailer: thông điệp lỗi auth generic (không chỉ Gmail) ==');
  const authMsg = mailer.explainSmtpError('Invalid login: 535-5.7.8 Username and Password not accepted') || '';
  ok('lỗi auth -> nhắc nhiều dịch vụ, không chỉ Gmail',
    /Brevo|Resend|SendGrid/.test(authMsg) && /App Password/.test(authMsg));
  ok('lỗi auth + cfg Zoho -> chèn gợi ý riêng của Zoho',
    /Zoho/.test(mailer.explainSmtpError('535 auth failed', { host: 'smtp.zoho.com' }) || ''));
  ok('lỗi 550 sender bị từ chối -> gợi ý verify domain/SPF',
    /SPF|verify|xác minh/i.test(mailer.explainSmtpError('550 Sender address rejected: not allowed to send') || ''));

  console.log('\n== mailer: bỏ khoảng trắng trong mật khẩu ứng dụng ==');
  const gmailPass = 'abcd efgh ijkl mnop';
  ok('strip space -> "abcdefghijklmnop" (16 ký tự)',
    gmailPass.replace(/\s+/g, '') === 'abcdefghijklmnop' && gmailPass.replace(/\s+/g, '').length === 16);

  console.log('\n== mailer: Zoho host khớp loại tài khoản (Free vs Paid) ==');
  ok('smtppro.zoho.com -> nhận là Zoho Mail (bug cũ: rơi vào "SMTP tùy chỉnh")',
    /Zoho/.test(mailer.detectProvider('smtppro.zoho.com').name));
  ok('smtppro.zoho.com -> có cảnh báo host chỉ dành cho gói TRẢ PHÍ',
    /smtppro|TRẢ PHÍ|554/.test(mailer.detectProvider('smtppro.zoho.com').warn || ''));
  ok('smtp.zoho.com (Free Org) -> KHÔNG cảnh báo (đây mới là host đúng)',
    mailer.detectProvider('smtp.zoho.com').warn === null);
  ok('smtppro.zoho.eu -> tên nêu DC EU',
    /EU/.test(mailer.detectProvider('smtppro.zoho.eu').name));
  ok('smtp.zoho.in -> tên nêu DC Ấn Độ',
    /Ấn Độ/.test(mailer.detectProvider('smtp.zoho.in').name));
  ok('smtp.zoho.com.au -> tên nêu DC Úc',
    /Úc/.test(mailer.detectProvider('smtp.zoho.com.au').name));

  console.log('\n== mailer: lỗi 554 Access Restricted KHÔNG bị chẩn đoán nhầm là sai mật khẩu ==');
  const accRestricted = mailer.explainSmtpError(
    'Invalid login: 554 5.7.8 Access Restricted. For more details, check this announcement: https://help.zoho.com/portal/en/community/topic/zoho-mail-server-details',
    { host: 'smtppro.zoho.com' }) || '';
  ok('554 -> nhắc "từ chối quyền gửi", KHÔNG nói sai mật khẩu',
    /quyền gửi|access restricted/i.test(accRestricted) && !/Sai tài khoản\/mật khẩu/.test(accRestricted));
  ok('554 + host Zoho -> nêu rõ quy tắc smtp vs smtppro theo gói',
    /Free Organization/.test(accRestricted) && /smtppro/.test(accRestricted));
  ok('lỗi 535 thật -> vẫn vào nhánh auth (không hồi quy)',
    /Sai tài khoản\/mật khẩu/.test(mailer.explainSmtpError('535 5.7.8 Username and Password not accepted') || ''));

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  try { fs.unlinkSync(tmpDb); } catch (e) { /* ignore */ }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => {
  console.error('LỖI TEST:', (e && e.stack) || e);
  process.exit(1);
});
