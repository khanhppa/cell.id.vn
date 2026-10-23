/**
 * api-keys.js — Sinh / xác thực / quản lý API key cho Public API v1.
 *
 * MÔ HÌNH: KEY LÀ "CỔNG KẾT NỐI", KHÔNG PHẢI TÀI KHOẢN
 * -----------------------------------------------------
 * Key KHÔNG gắn với user nào. Key chỉ chứng minh "ứng dụng ngoài được phép kết
 * nối tới máy chủ" và chịu hạn mức riêng của nó. Danh tính người dùng — và do đó
 * điểm bị trừ — đến từ JWT mà ứng dụng lấy qua POST /api/v1/login.
 *
 * Vì vậy mặc định (`require_user = 1`) key một mình KHÔNG tra cứu được: request
 * phải gửi kèm cả key (cổng) và JWT (tài khoản). Admin có thể đặt
 * `require_user = 0` cho những key chỉ dùng endpoint công khai (health...).
 *
 * NGUYÊN TẮC BẢO MẬT
 * -------------------
 * 1. Key thô CHỈ tồn tại đúng 1 lần: lúc tạo, trả về cho admin copy. Server chỉ
 *    lưu SHA-256 (`key_hash`) → lộ file DB cũng không dựng lại được key.
 * 2. So sánh key bằng hash tra thẳng trong DB (có UNIQUE index), không so sánh
 *    chuỗi từng ký tự → không lộ thông tin qua timing.
 * 3. `key_prefix` (12 ký tự đầu) chỉ để admin nhận ra key trong danh sách.
 * 4. Kiểm tra theo thứ tự: tồn tại → chưa thu hồi → đang bật → chưa hết hạn.
 *    Không còn bước nào phụ thuộc tài khoản vì key không thuộc tài khoản nào.
 */

const crypto = require('crypto');
const db = require('./database');

// Tiền tố nhận diện. `sk_live_` = key thật; tách khỏi `sk_test_` để sau này thêm
// key sandbox mà không phải đổi parser.
const KEY_PREFIX = 'sk_live_';
// 32 byte ngẫu nhiên → 64 ký tự hex. ~256 bit, không thể dò.
const KEY_BYTES = 32;
// Độ dài phần hiển thị lưu trong DB (gồm cả tiền tố) — đủ để admin phân biệt.
const DISPLAY_LEN = 12;

const SCOPE_LOOKUP = 'lookup';
const SCOPE_ACCOUNT = 'account';
const ALL_SCOPES = [SCOPE_LOOKUP, SCOPE_ACCOUNT];

// Mặc định key PHẢI đi kèm JWT: key mở cổng, JWT xác định tài khoản bị trừ điểm.
const DEFAULT_REQUIRE_USER = 1;

const DEFAULT_RATE_PER_MIN = 60;
const DEFAULT_RATE_PER_DAY = 5000;

/** SHA-256 hex của key thô. Mọi nơi so khớp key đều phải đi qua hàm này. */
function hashKey(raw) {
  return crypto.createHash('sha256').update(String(raw), 'utf8').digest('hex');
}

/**
 * Sinh 1 key mới.
 * @returns {{raw:string, hash:string, prefix:string}} `raw` là key thô DUY NHẤT
 *          được trả về — caller phải hiển thị cho admin copy ngay, không lưu lại.
 */
function generateKey() {
  const raw = KEY_PREFIX + crypto.randomBytes(KEY_BYTES).toString('hex');
  return { raw, hash: hashKey(raw), prefix: raw.slice(0, DISPLAY_LEN) };
}

/** Chuẩn hoá danh sách scope: chỉ giữ scope hợp lệ, luôn có ít nhất 1. */
function normalizeScopes(input) {
  const list = Array.isArray(input)
    ? input
    : String(input || '').split(',').map(s => s.trim()).filter(Boolean);
  const clean = [];
  for (const s of list) {
    const k = String(s).toLowerCase();
    if (ALL_SCOPES.includes(k) && !clean.includes(k)) clean.push(k);
  }
  return clean.length ? clean.join(',') : ALL_SCOPES.join(',');
}

/** Key có scope `need` không. */
function hasScope(scopesStr, need) {
  // Chỉ 2 scope của API công khai mới tồn tại. Bất kỳ scope khác (kể cả 'admin'
  // hay '*') đều KHÔNG khớp — API công khai không bao giờ có quyền admin, dù key
  // thuộc user admin (admin dùng trang admin riêng, không qua API này).
  const want = String(need).toLowerCase();
  if (!ALL_SCOPES.includes(want)) return false;
  const list = String(scopesStr || '').split(',').map(s => s.trim().toLowerCase());
  return list.includes(want);
}

/** Giới hạn hợp lệ hoá: số nguyên dương, chặn 0/âm/rác. */
function clampInt(v, dflt, min, max) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < min) return dflt;
  return Math.min(n, max);
}

// ============================================================
// Tra cứu key
// ============================================================
// Lấy row api_keys theo key thô. Trả `null` nếu không có.
// Key KHÔNG gắn user → không join users, không có khái niệm "chủ key".
function findKeyByRaw(raw) {
  if (!raw || typeof raw !== 'string') return Promise.resolve(null);
  const hash = hashKey(raw.trim());
  return new Promise((resolve) => {
    db.get('SELECT * FROM api_keys WHERE key_hash = ? LIMIT 1', [hash], (err, row) => {
      resolve(err ? null : (row || null));
    });
  });
}

/**
 * Kiểm tra 1 key đã tra được có dùng được ngay bây giờ không.
 * Không phụ thuộc tài khoản — key không thuộc tài khoản nào.
 * @returns {{ok:true} | {ok:false, status:number, error:string, reason:string}}
 */
function checkUsable(row) {
  if (!row) return { ok: false, status: 401, error: 'API key không hợp lệ', reason: 'INVALID_KEY' };
  if (row.revoked_at) return { ok: false, status: 401, error: 'API key đã bị thu hồi', reason: 'KEY_REVOKED' };
  if (!Number(row.enabled)) return { ok: false, status: 403, error: 'API key đang bị tắt', reason: 'KEY_DISABLED' };
  if (row.expires_at) {
    // SQLite CURRENT_TIMESTAMP là 'YYYY-MM-DD HH:MM:SS' (UTC). So sánh bằng Date
    // để không phụ thuộc định dạng chuỗi.
    const exp = Date.parse(String(row.expires_at).replace(' ', 'T') + (String(row.expires_at).includes('Z') ? '' : 'Z'));
    if (Number.isFinite(exp) && Date.now() > exp) {
      return { ok: false, status: 401, error: 'API key đã hết hạn', reason: 'KEY_EXPIRED' };
    }
  }
  return { ok: true };
}

/** Key có bắt buộc phải gửi kèm JWT (đăng nhập) không. Mặc định CÓ. */
function requiresUser(row) {
  // NULL (row cũ trước migration) coi như 1 — an toàn hơn là mở cổng.
  return row == null || row.require_user == null ? true : !!Number(row.require_user);
}

// ============================================================
// Rate limit trong bộ nhớ (theo api_key_id)
// ============================================================
// Cửa sổ trượt: giữ mốc thời gian các request trong 60s gần nhất (cho hạn mức
// phút) và trong 24h gần nhất (cho hạn mức ngày). Reset khi server restart —
// chấp nhận được vì đây là chống lạm dụng, không phải kế toán.
// Biến môi trường API_TEST_NO_RATELIMIT=1 tắt hẳn (dùng cho test tự động).
const NO_LIMIT = process.env.API_TEST_NO_RATELIMIT === '1';
const MINUTE_MS = 60000;
const DAY_MS = 86400000;
const hits = new Map(); // api_key_id -> number[] (mốc thời gian, tăng dần)

/**
 * Đếm và kiểm tra hạn mức. Trả về thông tin để set header X-RateLimit-*.
 * KHÔNG ghi nhận request nếu bị chặn (để client không tự khoá mình vĩnh viễn
 * bằng cách retry liên tục).
 */
function checkRateLimit(apiKeyId, perMin, perDay) {
  const minLimit = clampInt(perMin, DEFAULT_RATE_PER_MIN, 1, 100000);
  const dayLimit = clampInt(perDay, DEFAULT_RATE_PER_DAY, 1, 10000000);
  if (NO_LIMIT) {
    return { ok: true, limitMin: minLimit, remainingMin: minLimit, limitDay: dayLimit, remainingDay: dayLimit, retryAfter: 0 };
  }
  const now = Date.now();
  const id = Number(apiKeyId);
  const all = (hits.get(id) || []).filter(t => now - t < DAY_MS);

  const inMin = all.filter(t => now - t < MINUTE_MS);
  const inDay = all;

  if (inMin.length >= minLimit) {
    // Chờ tới khi request cũ nhất trong cửa sổ phút trôi khỏi.
    const oldest = inMin[0];
    hits.set(id, all);
    return {
      ok: false, limitMin: minLimit, remainingMin: 0, limitDay: dayLimit,
      remainingDay: Math.max(0, dayLimit - inDay.length),
      retryAfter: Math.max(1, Math.ceil((MINUTE_MS - (now - oldest)) / 1000))
    };
  }
  if (inDay.length >= dayLimit) {
    hits.set(id, all);
    return {
      ok: false, limitMin: minLimit, remainingMin: Math.max(0, minLimit - inMin.length),
      limitDay: dayLimit, remainingDay: 0,
      retryAfter: Math.max(1, Math.ceil((DAY_MS - (now - inDay[0])) / 1000))
    };
  }

  all.push(now);
  hits.set(id, all);
  return {
    ok: true, limitMin: minLimit, remainingMin: Math.max(0, minLimit - (inMin.length + 1)),
    limitDay: dayLimit, remainingDay: Math.max(0, dayLimit - all.length), retryAfter: 0
  };
}

/** Xoá bộ đếm của 1 key (dùng khi admin reset hạn mức / test). */
function resetRateLimit(apiKeyId) {
  hits.delete(Number(apiKeyId));
}

// ============================================================
// CRUD
// ============================================================
/**
 * Tạo key mới. Key KHÔNG gắn tài khoản — đây chỉ là cổng kết nối.
 * @returns {Promise<{ok:true, key:object, raw:string} | {ok:false, error:string}>}
 */
async function createKey({ name, scopes, rateLimitPerMin, rateLimitPerDay, expiresAt, requireUser, createdBy }) {
  const cleanName = String(name || '').trim();
  if (!cleanName) return { ok: false, error: 'Tên key không được để trống' };
  if (cleanName.length > 100) return { ok: false, error: 'Tên key tối đa 100 ký tự' };

  let exp = null;
  if (expiresAt) {
    const d = new Date(expiresAt);
    if (!Number.isFinite(d.getTime())) return { ok: false, error: 'expires_at không hợp lệ (cần ISO 8601)' };
    if (d.getTime() <= Date.now()) return { ok: false, error: 'expires_at phải ở tương lai' };
    exp = d.toISOString().replace('T', ' ').slice(0, 19);
  }

  const { raw, hash, prefix } = generateKey();
  const row = {
    name: cleanName,
    key_prefix: prefix,
    key_hash: hash,
    scopes: normalizeScopes(scopes),
    rate_limit_per_min: clampInt(rateLimitPerMin, DEFAULT_RATE_PER_MIN, 1, 100000),
    rate_limit_per_day: clampInt(rateLimitPerDay, DEFAULT_RATE_PER_DAY, 1, 10000000),
    expires_at: exp,
    require_user: requireUser === undefined || requireUser === null
      ? DEFAULT_REQUIRE_USER
      : (requireUser ? 1 : 0),
    created_by: createdBy == null ? null : Number(createdBy)
  };

  const id = await new Promise((resolve, reject) => {
    db.run(`INSERT INTO api_keys
      (name, key_prefix, key_hash, scopes, rate_limit_per_min, rate_limit_per_day, expires_at, require_user, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.name, row.key_prefix, row.key_hash, row.scopes,
        row.rate_limit_per_min, row.rate_limit_per_day, row.expires_at, row.require_user, row.created_by],
      function (err) { if (err) return reject(err); resolve(this.lastID); });
  });

  const key = await getKeyById(id);
  return { ok: true, key, raw };
}

function getKeyById(id) {
  return new Promise((resolve) => {
    db.get('SELECT * FROM api_keys WHERE id = ?', [Number(id)],
      (err, row) => resolve(err ? null : (row || null)));
  });
}

function listKeys({ userId } = {}) {
  // `userId` chỉ còn để tương thích chữ ký cũ; key không gắn user nên bỏ qua.
  return new Promise((resolve) => {
    db.all(`SELECT k.*,
                   (SELECT COUNT(*) FROM api_request_logs l WHERE l.api_key_id = k.id) AS request_count,
                   (SELECT COUNT(*) FROM api_request_logs l WHERE l.api_key_id = k.id AND l.created_at >= datetime('now','-1 day')) AS request_count_24h,
                   (SELECT COUNT(DISTINCT l.user_id) FROM api_request_logs l
                      WHERE l.api_key_id = k.id AND l.user_id IS NOT NULL) AS user_count
            FROM api_keys k
            ORDER BY k.created_at DESC, k.id DESC`, [], (err, rows) => resolve(err ? [] : (rows || [])));
  });
}

/**
 * Cập nhật key. `patch` chỉ nhận các trường cho phép — KHÔNG cho đổi key_hash,
 * và không có chuyện đổi chủ sở hữu (key không có chủ).
 */
async function updateKey(id, patch) {
  const cur = await getKeyById(id);
  if (!cur) return { ok: false, error: 'Không tìm thấy API key' };
  const sets = [];
  const params = [];
  const p = patch || {};

  if (p.name !== undefined) {
    const n = String(p.name).trim();
    if (!n) return { ok: false, error: 'Tên key không được để trống' };
    if (n.length > 100) return { ok: false, error: 'Tên key tối đa 100 ký tự' };
    sets.push('name = ?'); params.push(n);
  }
  if (p.scopes !== undefined) { sets.push('scopes = ?'); params.push(normalizeScopes(p.scopes)); }
  if (p.rate_limit_per_min !== undefined) {
    sets.push('rate_limit_per_min = ?'); params.push(clampInt(p.rate_limit_per_min, DEFAULT_RATE_PER_MIN, 1, 100000));
  }
  if (p.rate_limit_per_day !== undefined) {
    sets.push('rate_limit_per_day = ?'); params.push(clampInt(p.rate_limit_per_day, DEFAULT_RATE_PER_DAY, 1, 10000000));
  }
  if (p.expires_at !== undefined) {
    if (!p.expires_at) { sets.push('expires_at = ?'); params.push(null); }
    else {
      const d = new Date(p.expires_at);
      if (!Number.isFinite(d.getTime())) return { ok: false, error: 'expires_at không hợp lệ (cần ISO 8601)' };
      sets.push('expires_at = ?'); params.push(d.toISOString().replace('T', ' ').slice(0, 19));
    }
  }
  if (p.enabled !== undefined) {
    // Không cho bật lại key đã thu hồi vĩnh viễn.
    if (cur.revoked_at && p.enabled) {
      return { ok: false, error: 'Key đã bị thu hồi, không thể bật lại — hãy tạo key mới' };
    }
    sets.push('enabled = ?'); params.push(p.enabled ? 1 : 0);
    if (!p.enabled) resetRateLimit(id);
  }
  if (p.require_user !== undefined) {
    sets.push('require_user = ?'); params.push(p.require_user ? 1 : 0);
  }
  if (!sets.length) return { ok: true, key: cur };

  params.push(Number(id));
  await new Promise((resolve, reject) => {
    db.run(`UPDATE api_keys SET ${sets.join(', ')} WHERE id = ?`, params, (err) => err ? reject(err) : resolve());
  });
  return { ok: true, key: await getKeyById(id) };
}

/** Thu hồi vĩnh viễn (không xoá row để giữ log đối chiếu). */
async function revokeKey(id) {
  const cur = await getKeyById(id);
  if (!cur) return { ok: false, error: 'Không tìm thấy API key' };
  if (cur.revoked_at) return { ok: true, key: cur };
  await new Promise((resolve, reject) => {
    db.run(`UPDATE api_keys SET revoked_at = CURRENT_TIMESTAMP, enabled = 0 WHERE id = ?`,
      [Number(id)], (err) => err ? reject(err) : resolve());
  });
  resetRateLimit(id);
  return { ok: true, key: await getKeyById(id) };
}

/** Xoá hẳn — chỉ dùng khi key chưa từng được dùng (không có log). */
async function deleteKey(id) {
  const used = await new Promise(r => db.get('SELECT COUNT(*) AS c FROM api_request_logs WHERE api_key_id = ?',
    [Number(id)], (e, row) => r(e ? 1 : (row ? Number(row.c) : 0))));
  if (used > 0) return { ok: false, error: 'Key đã có lịch sử gọi — hãy Thu hồi thay vì xoá (giữ log đối chiếu)' };
  await new Promise((resolve, reject) => {
    db.run('DELETE FROM api_keys WHERE id = ?', [Number(id)], (err) => err ? reject(err) : resolve());
  });
  resetRateLimit(id);
  return { ok: true };
}

// ============================================================
// Log request
// ============================================================
/**
 * Ghi 1 dòng log. Bất đồng bộ, nuốt lỗi — log hỏng không được làm hỏng API.
 */
function logRequest({ apiKeyId, userId, method, path, status, durationMs, cells, charged, ip, userAgent, error }) {
  try {
    db.run(`INSERT INTO api_request_logs
      (api_key_id, user_id, method, path, status, duration_ms, cells, charged, ip, user_agent, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [apiKeyId == null ? null : Number(apiKeyId), userId == null ? null : Number(userId),
        method || null, path || null, status == null ? null : Number(status),
        durationMs == null ? null : Math.round(Number(durationMs)),
        cells == null ? 0 : Number(cells), charged == null ? 0 : Number(charged),
        ip || null, userAgent ? String(userAgent).slice(0, 300) : null,
        error ? String(error).slice(0, 500) : null],
      () => {});
  } catch (e) { /* bỏ qua */ }
}

/** Đánh dấu vừa dùng key (fire-and-forget). */
function touchKey(id) {
  try { db.run('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?', [Number(id)], () => {}); }
  catch (e) { /* bỏ qua */ }
}

/** Danh sách log gần đây, lọc theo key/status nếu cần. */
function listLogs({ apiKeyId, limit, status } = {}) {
  const lim = clampInt(limit, 200, 1, 2000);
  const where = [];
  const params = [];
  if (apiKeyId != null && apiKeyId !== '') { where.push('l.api_key_id = ?'); params.push(Number(apiKeyId)); }
  if (status != null && status !== '') {
    if (String(status) === 'error') where.push('l.status >= 400');
    else { where.push('l.status = ?'); params.push(Number(status)); }
  }
  params.push(lim);
  return new Promise((resolve) => {
    db.all(`SELECT l.*, k.name AS key_name, k.key_prefix AS key_prefix, u.username AS username
            FROM api_request_logs l
            LEFT JOIN api_keys k ON k.id = l.api_key_id
            LEFT JOIN users u ON u.id = l.user_id
            ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
            ORDER BY l.id DESC LIMIT ?`, params, (err, rows) => resolve(err ? [] : (rows || [])));
  });
}

/** Thống kê tổng quan cho tab admin. */
function stats() {
  const one = (sql, params = []) => new Promise(r => db.get(sql, params, (e, row) => r(e ? {} : (row || {}))));
  return Promise.all([
    one(`SELECT COUNT(*) AS total,
                SUM(CASE WHEN revoked_at IS NOT NULL THEN 1 ELSE 0 END) AS revoked,
                SUM(CASE WHEN revoked_at IS NULL AND enabled = 1 THEN 1 ELSE 0 END) AS active
         FROM api_keys`),
    one(`SELECT COUNT(*) AS requests_24h,
                SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) AS errors_24h,
                SUM(COALESCE(cells,0)) AS cells_24h,
                SUM(COALESCE(charged,0)) AS charged_24h
         FROM api_request_logs WHERE created_at >= datetime('now','-1 day')`)
  ]).then(([keys, logs]) => ({
    keys: {
      total: Number(keys.total) || 0,
      active: Number(keys.active) || 0,
      revoked: Number(keys.revoked) || 0
    },
    last24h: {
      requests: Number(logs.requests_24h) || 0,
      errors: Number(logs.errors_24h) || 0,
      cells: Number(logs.cells_24h) || 0,
      charged: Number(logs.charged_24h) || 0
    }
  }));
}

/** Dọn log cũ hơn N ngày (gọi từ cron trong server.js). */
function pruneLogs(days) {
  const d = clampInt(days, 30, 1, 3650);
  return new Promise((resolve) => {
    db.run(`DELETE FROM api_request_logs WHERE created_at < datetime('now', ?)`,
      [`-${d} days`], function (err) { resolve(err ? 0 : (this.changes || 0)); });
  });
}

module.exports = {
  KEY_PREFIX, ALL_SCOPES, SCOPE_LOOKUP, SCOPE_ACCOUNT,
  DEFAULT_RATE_PER_MIN, DEFAULT_RATE_PER_DAY, DEFAULT_REQUIRE_USER,
  hashKey, generateKey, normalizeScopes, hasScope, clampInt, requiresUser,
  findKeyByRaw, checkUsable,
  checkRateLimit, resetRateLimit,
  createKey, getKeyById, listKeys, updateKey, revokeKey, deleteKey,
  logRequest, touchKey, listLogs, stats, pruneLogs
};
