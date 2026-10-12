/**
 * Guest trial — cho phép người CHƯA đăng nhập tra cứu thử đúng 1 lượt với
 * dữ liệu nội bộ, sau đó chặn + mời đăng ký tài khoản.
 *
 * Nguyên tắc:
 *  1. Guest không có token → định danh bằng 3 lớp (Phương án A):
 *       a) cookie `ct_guest` do SERVER phát, ký HMAC, HttpOnly — JS client
 *          không đọc/sửa/xoá được, nên "xoá localStorage" vô hiệu.
 *       b) fingerprint sha256(ip + ua + clientId + ipPrefix + uaFamily + acceptLang)
 *          — đổi 1 tín hiệu là đổi khoá.
 *       c) KHOÁ KÉP `guest_net_key = sha256(ipPrefix + uaFamily)`: ghi kèm mỗi
 *          lượt; khi tra trạng thái thì khớp `guest_key` HOẶC `guest_net_key`.
 *          → Sang tab ẩn danh (mất cookie) hay đổi User-Agent vẫn dính khoá cũ.
 *  2. Server là nguồn sự thật: client không bao giờ gửi số lượt đã dùng.
 *  3. Bất kỳ lần bấm Tra cứu nào (kể cả không ra kết quả) đều tốn 1 lượt —
 *     chặn việc dò quét CSDL qua nhiều lần miss.
 *  4. Cửa sổ 30 ngày: hết hạn thì khách được thử lại — tránh IP dùng chung
 *     (NAT công ty, quán net, CGNAT 4G) bị khoá vĩnh viễn.
 *
 * Đánh đổi có chủ đích: nhiều người chung 1 IP + cùng họ trình duyệt sẽ chia
 * nhau số lượt thử. Nới bằng settings.guest_trial_max khi cần.
 */
const crypto = require('crypto');
const db = require('./database');

/** Số lượt miễn phí mặc định cho mỗi guest. Admin override qua settings.guest_trial_max. */
const TRIAL_MAX_DEFAULT = 1;

/** Giới hạn cứng — tránh admin set nhầm giá trị lớn vô tình mở toang CSDL. */
const TRIAL_MAX_CAP = 50;

/** Tên cookie định danh guest (server phát, ký HMAC). */
const COOKIE_NAME = 'ct_guest';

/** Cookie sống 30 ngày — khớp cửa sổ trial. */
const COOKIE_MAX_AGE_DAYS = 30;

/** Cửa sổ tính lượt: bản ghi cũ hơn bị coi là hết hạn. */
const WINDOW_DAYS = 30;

/**
 * Secret ký cookie. Ưu tiên env `GUEST_SECRET` (nên set ở prod); không có thì
 * sinh 1 lần trong RAM lúc start — đủ để client không tự chế cookie, nhưng
 * cookie cũ sẽ vô hiệu sau mỗi lần restart server.
 */
const GUEST_SECRET = process.env.GUEST_SECRET || crypto.randomBytes(32).toString('hex');

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ changes: this.changes });
    });
  });
}

/** IP thô của request: ưu tiên header proxy, fallback socket. */
function clientIp(req) {
  if (!req) return '';
  const fwd = req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip']);
  if (fwd) return String(fwd).split(',')[0].trim();
  return (req.ip || (req.socket && req.socket.remoteAddress) || '').replace(/^::ffff:/, '');
}

/**
 * Tiền tố mạng của IP — IPv4 che 8 bit cuối (/24), IPv6 che 64 bit cuối (/64).
 * Dùng để nhận ra cùng một đường mạng kể cả khi IP động đổi số cuối.
 */
function ipPrefix(ip) {
  const s = String(ip || '').trim();
  if (!s) return '';
  if (s.includes(':')) {
    const parts = s.split(':');
    return parts.slice(0, 4).join(':');
  }
  const parts = s.split('.');
  if (parts.length === 4) return parts.slice(0, 3).join('.');
  return s;
}

/**
 * Họ trình duyệt + hệ điều hành, BỎ số version — để nâng cấp Chrome 120→121
 * không vô tình tạo khoá mới. Heuristic thuần chuỗi, không thêm dependency.
 */
function uaFamily(ua) {
  const s = String(ua || '').toLowerCase();
  if (!s) return 'unknown';

  let browser = 'other';
  if (s.includes('edg/')) browser = 'edge';
  else if (s.includes('opr/') || s.includes('opera')) browser = 'opera';
  else if (s.includes('chrome/') || s.includes('crios/')) browser = 'chrome';
  else if (s.includes('firefox/') || s.includes('fxios/')) browser = 'firefox';
  else if (s.includes('safari/')) browser = 'safari';

  let os = 'other';
  if (s.includes('windows')) os = 'win';
  else if (s.includes('android')) os = 'android';
  else if (s.includes('iphone') || s.includes('ipad') || s.includes('ios')) os = 'ios';
  else if (s.includes('mac os') || s.includes('macintosh')) os = 'mac';
  else if (s.includes('linux')) os = 'linux';

  return `${browser}-${os}`;
}

/**
 * Khoá mạng — lớp chống incognito/đổi-UA. Không phụ thuộc cookie hay số IP
 * cuối, nên tab ẩn danh vẫn trùng khoá với phiên thường.
 */
function netKey(req) {
  const ip = clientIp(req);
  const ua = (req && req.headers && req.headers['user-agent']) || '';
  return crypto.createHash('sha256').update(`${ipPrefix(ip)}|${uaFamily(ua)}`).digest('hex');
}

/**
 * Khoá định danh guest đầy đủ (nhiều tín hiệu).
 * `clientId` là id server phát qua cookie; rỗng vẫn tạo khoá hợp lệ.
 */
function fingerprint(req, clientId = '') {
  const ip = clientIp(req);
  const ua = (req && req.headers && req.headers['user-agent']) || '';
  const lang = (req && req.headers && req.headers['accept-language']) || '';
  const accept = (req && req.headers && req.headers['accept']) || '';
  const signals = [
    ip, ua, clientId, ipPrefix(ip), uaFamily(ua),
    String(lang).split(',')[0].trim().toLowerCase(), String(accept).slice(0, 60)
  ];
  return crypto.createHash('sha256').update(signals.join('|')).digest('hex');
}

/** Id guest mới (32 byte hex). */
function newClientId() {
  return crypto.randomBytes(32).toString('hex');
}

/** Ký clientId → `raw.hmac` (16 byte đầu) để server phát hiện cookie bị sửa. */
function signClientId(raw) {
  const id = String(raw || '');
  if (!id) return '';
  const mac = crypto.createHmac('sha256', GUEST_SECRET).update(id).digest('hex').slice(0, 32);
  return `${id}.${mac}`;
}

/** Xác thực cookie đã ký: trả `raw` nếu hợp lệ, ngược lại `null`. */
function verifyClientId(signed) {
  const s = String(signed || '');
  const idx = s.lastIndexOf('.');
  if (idx <= 0) return null;
  const raw = s.slice(0, idx);
  const mac = s.slice(idx + 1);
  const expect = crypto.createHmac('sha256', GUEST_SECRET).update(raw).digest('hex').slice(0, 32);
  if (mac.length !== expect.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(mac, 'utf8'), Buffer.from(expect, 'utf8'))) return null;
  } catch (e) { return null; }
  return raw;
}

/** Request có phải HTTPS (để bật cờ `Secure` cho cookie)? */
function isSecureRequest(req) {
  if (!req) return false;
  if (process.env.NODE_ENV === 'production') return true;
  const proto = (req.headers && req.headers['x-forwarded-proto']) || '';
  return String(proto).split(',')[0].trim().toLowerCase() === 'https';
}

/** Chuỗi `Set-Cookie` cho cookie định danh guest (HttpOnly + SameSite=Lax). */
function buildCookie(req, signedValue) {
  const parts = [
    `${COOKIE_NAME}=${signedValue}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${COOKIE_MAX_AGE_DAYS * 24 * 3600}`
  ];
  if (isSecureRequest(req)) parts.push('Secure');
  return parts.join('; ');
}

/** Số lượt tối đa — đọc từ settings mỗi lần để admin đổi là có hiệu lực ngay. */
async function getMax() {
  const row = await get('SELECT value FROM settings WHERE key = ?', ['guest_trial_max']);
  const raw = row && row.value !== null && row.value !== undefined ? row.value : null;
  if (raw === null) return TRIAL_MAX_DEFAULT;
  const n = Math.floor(Number(String(raw).trim()));
  if (!Number.isFinite(n) || n < 0) return TRIAL_MAX_DEFAULT;
  return Math.min(n, TRIAL_MAX_CAP);
}

/**
 * Bản ghi trial còn hiệu lực của 1 guest.
 * Khớp `guest_key` HOẶC `guest_net_key` → bắt được cả trường hợp khách xoá
 * cookie (tab ẩn danh) lẫn đổi User-Agent trên cùng đường mạng.
 */
function getTrial(guestKey, guestNetKey = '') {
  return get(
    `SELECT * FROM guest_trials
      WHERE (guest_key = ? OR (? <> '' AND guest_net_key = ?))
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY id LIMIT 1`,
    [guestKey, guestNetKey, guestNetKey]
  );
}

/**
 * Trạng thái lượt dùng của guest.
 * @param {string} guestKey fingerprint đầy đủ
 * @param {string} guestNetKey khoá mạng (khoá kép, xem `netKey`); rỗng = chỉ dùng guestKey
 * @returns {Promise<{used:number, remaining:number, max:number, allowed:boolean, usedAt:string|null}>}
 */
async function getStatus(guestKey, guestNetKey = '') {
  const [trial, max] = await Promise.all([getTrial(guestKey, guestNetKey), getMax()]);
  const used = trial ? 1 : 0;
  const remaining = Math.max(0, max - used);
  return { used, remaining, max, allowed: remaining > 0, usedAt: trial ? trial.used_at : null };
}

/**
 * Ghi nhận 1 lượt đã dùng. Chỉ giữ bản ghi ĐẦU TIÊN của mỗi guest
 * (`INSERT OR IGNORE`) để `used_at` và cell đã tra không bị ghi đè.
 * Ghi kèm `guest_net_key` + `expires_at` để khoá kép và cửa sổ 30 ngày hoạt động.
 */
function recordTrial(guestKey, guestNetKey, req, query = {}, found = false, clientId = '') {
  const q = query || {};
  return run(
    `INSERT OR IGNORE INTO guest_trials
       (guest_key, guest_net_key, client_id, ip, user_agent, ua_family,
        mcc, mnc, lac, cellid, sector, found, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+${WINDOW_DAYS} days'))`,
    [
      guestKey,
      guestNetKey || '',
      clientId || '',
      clientIp(req),
      (req && req.headers && req.headers['user-agent']) || '',
      uaFamily((req && req.headers && req.headers['user-agent']) || ''),
      q.mcc != null ? String(q.mcc) : null,
      q.mnc != null ? String(q.mnc) : null,
      q.lac != null ? String(q.lac) : null,
      q.cellid != null ? String(q.cellid) : null,
      q.sector != null ? String(q.sector) : null,
      found ? 1 : 0
    ]
  );
}

/** Xoá toàn bộ trial (admin/test dùng để reset). */
function reset() {
  return run('DELETE FROM guest_trials', []);
}

module.exports = {
  TRIAL_MAX_DEFAULT,
  TRIAL_MAX_CAP,
  COOKIE_NAME,
  COOKIE_MAX_AGE_DAYS,
  WINDOW_DAYS,
  clientIp,
  ipPrefix,
  uaFamily,
  netKey,
  fingerprint,
  newClientId,
  signClientId,
  verifyClientId,
  isSecureRequest,
  buildCookie,
  getMax,
  getTrial,
  getStatus,
  recordTrial,
  reset
};
