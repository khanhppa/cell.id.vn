/**
 * Credit system core — xem database.js phần "Credit system" để biết schema.
 *
 * Nguyên tắc bất di bất dịch:
 *  1. Mọi thay đổi số dư đi qua đúng 1 transaction SQLite (BEGIN IMMEDIATE).
 *  2. Điều kiện "đủ điểm" nằm TRONG câu UPDATE (`WHERE credit_balance >= ?`),
 *     KHÔNG đọc-rồi-ghi ở tầng JS → không có cửa sổ race giữa 2 request.
 *  3. Ledger append-only. Mỗi bút toán ghi kèm `balance_after` → tự đối soát.
 *  4. Client KHÔNG bao giờ gửi số điểm; server tự tính từ input cell.
 */
const db = require('./database');

// Giới hạn cứng phía server — chặn script bug đẩy số dư lên vô cực.
const MAX_ABS_AMOUNT = 1e7;
const DECIMALS = 4;
const POW = Math.pow(10, DECIMALS);

// Các loại bút toán hợp lệ. Thêm loại mới PHẢI cập nhật danh sách này.
const TX_TYPES = Object.freeze({
  LOOKUP: 'lookup',                 // trừ điểm do tra cứu thành công
  SIGNUP_BONUS: 'signup_bonus',     // điểm tặng khi tạo tài khoản
  ADMIN_TOPUP: 'admin_topup',       // admin nạp điểm
  ADMIN_ADJUST: 'admin_adjust',     // admin chỉnh tay (có thể âm)
  CORRECTION: 'correction',         // bút toán đảo / sửa sai
  PAYMENT: 'payment',               // nạp qua cổng thanh toán (giai đoạn sau)
  REFUND: 'refund',                 // hoàn điểm
  TEST_TOPUP: 'test_topup'          // CHỈ dùng trong test — cấp điểm không tốn bút toán nguồn
});

/** Làm tròn + validate số điểm. Trả null nếu không hợp lệ. */
function normalizeAmount(value) {
  const n = typeof value === 'string' ? Number(value.trim()) : Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * POW) / POW;
  if (Math.abs(rounded) > MAX_ABS_AMOUNT) return null;
  return rounded;
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

/**
 * Mutex cho transaction: sqlite3 `db.serialize()` KHÔNG giữ lock qua `await`,
 * nên 2 request đồng thời có thể cùng phát `BEGIN IMMEDIATE` → lỗi
 * "cannot start a transaction within a transaction". Hàng đợi này đảm bảo chỉ
 * 1 transaction chạy tại một thời điểm trong tiến trình.
 */
let txChain = Promise.resolve();

/** Chạy `fn` trong 1 transaction IMMEDIATE, tuần tự hoá toàn bộ transaction. */
function withTransaction(fn) {
  const run = () => new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN IMMEDIATE', async (beginErr) => {
        if (beginErr) return reject(beginErr);
        try {
          const result = await fn();
          db.run('COMMIT', (commitErr) => (commitErr ? reject(commitErr) : resolve(result)));
        } catch (e) {
          db.run('ROLLBACK', () => reject(e));
        }
      });
    });
  });
  // Nối vào chuỗi: dù transaction trước thành công hay lỗi, transaction sau vẫn chạy.
  const next = txChain.then(run, run);
  txChain = next.catch(() => {});
  return next;
}

// ============================================================================
// Settings (đọc lại từ bảng settings mỗi lần — admin đổi là có hiệu lực ngay)
// ============================================================================
function getSetting(key, dflt) {
  return new Promise((resolve) => {
    db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
      resolve(err || !row || row.value === null || row.value === undefined ? dflt : row.value);
    });
  });
}

async function isEnabled() {
  return (await getSetting('credit_enabled', '0')) === '1';
}

async function getCost() {
  const n = normalizeAmount(await getSetting('credit_cost_per_lookup', '1'));
  return n !== null && n > 0 ? n : 0;
}

async function getSignupBonus() {
  const n = normalizeAmount(await getSetting('credit_signup_bonus', '5'));
  return n !== null && n > 0 ? n : 0;
}

async function allowsNegative() {
  return (await getSetting('credit_allow_negative', '0')) === '1';
}

/** Cấu hình công khai (không lộ dữ liệu user) — dùng cho trang login/credits. */
async function getPublicConfig() {
  const [enabled, cost, signupBonus] = await Promise.all([isEnabled(), getCost(), getSignupBonus()]);
  return { enabled, cost, signup_bonus: signupBonus };
}

// ============================================================================
// Ghi ledger + cập nhật số dư (PHẢI gọi bên trong withTransaction)
// ============================================================================
/**
 * Ghi 1 bút toán và cập nhật users.credit_balance một cách nguyên tử.
 * Điều kiện đủ điểm nằm trong UPDATE → atomic, chống double-spend.
 * @returns {{ok:boolean, balance?:number, reason?:string, duplicate?:boolean}}
 */
async function applyTx({ userId, amount, type, ref = null, note = null, adminId = null, adminIp = null, allowNegative = false }) {
  if (!Object.values(TX_TYPES).includes(type)) return { ok: false, reason: 'invalid_type' };

  const amt = normalizeAmount(amount);
  if (amt === null || amt === 0) return { ok: false, reason: 'invalid_amount' };

  const user = await get('SELECT id, credit_balance FROM users WHERE id = ?', [userId]);
  if (!user) return { ok: false, reason: 'user_not_found' };

  const current = Number(user.credit_balance) || 0;
  const next = Math.round((current + amt) * POW) / POW;

  const guard = amt < 0 && !allowNegative;
  if (guard && next < 0) return { ok: false, reason: 'insufficient', balance: current };

  const sql = guard
    ? 'UPDATE users SET credit_balance = ? WHERE id = ? AND credit_balance >= ?'
    : 'UPDATE users SET credit_balance = ? WHERE id = ?';
  const params = guard ? [next, userId, Math.abs(amt)] : [next, userId];
  const upd = await run(sql, params);
  if (upd.changes === 0) {
    const fresh = await get('SELECT credit_balance FROM users WHERE id = ?', [userId]);
    return { ok: false, reason: 'insufficient', balance: Number(fresh && fresh.credit_balance) || 0 };
  }

  try {
    await run(`INSERT INTO credit_transactions (user_id, amount, balance_after, type, ref, note, admin_id, admin_ip)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, amt, next, type, ref, note, adminId, adminIp]);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      // Bút toán đã ghi trước đó (client retry) → rollback cả UPDATE để không trừ 2 lần.
      throw new Error('DUPLICATE_TX');
    }
    throw e;
  }

  return { ok: true, balance: next };
}

// ============================================================================
// API công khai cho server.js
// ============================================================================
async function getBalance(userId) {
  const row = await get('SELECT credit_balance FROM users WHERE id = ?', [userId]);
  if (!row) return null;
  return Number(row.credit_balance) || 0;
}

/**
 * Trừ điểm cho N lần tra cứu ĐÃ CÓ KẾT QUẢ.
 * @param {number} userId
 * @param {number} count  số lần found (>=1)
 * @param {string} ref    mã chống trùng (batchId cho lô, `single:<uuid>` cho lẻ)
 * @param {string} note
 */
async function chargeLookup(userId, count, ref, note) {
  if (!await isEnabled()) return { ok: true, skipped: true, balance: await getBalance(userId) };
  const cost = await getCost();
  const n = Math.floor(Number(count));
  if (cost <= 0 || !Number.isFinite(n) || n <= 0) return { ok: true, skipped: true, balance: await getBalance(userId) };

  const allowNeg = await allowsNegative();
  try {
    return await withTransaction(() => applyTx({
      userId, amount: -(cost * n), type: TX_TYPES.LOOKUP,
      ref: ref || null, note: note || null, allowNegative: allowNeg
    }));
  } catch (e) {
    if (e.message === 'DUPLICATE_TX') {
      return { ok: true, duplicate: true, balance: await getBalance(userId) };
    }
    throw e;
  }
}

/** Cấp điểm thưởng đăng ký. Idempotent theo ref `signup:<userId>`. */
async function grantSignupBonus(userId, { adminId = null } = {}) {
  const bonus = await getSignupBonus();
  if (bonus <= 0) return { ok: true, skipped: true, balance: await getBalance(userId) };
  try {
    return await withTransaction(() => applyTx({
      userId, amount: bonus, type: TX_TYPES.SIGNUP_BONUS,
      ref: `signup:${userId}`, note: 'Điểm thưởng đăng ký tài khoản',
      adminId, allowNegative: true
    }));
  } catch (e) {
    if (e.message === 'DUPLICATE_TX') return { ok: true, duplicate: true, balance: await getBalance(userId) };
    throw e;
  }
}

/** Admin nạp điểm. `amount` phải > 0. `ref` cho phép chống trùng (payment sau này). */
async function topUp(userId, amount, { adminId = null, adminIp = null, note = null, type = TX_TYPES.ADMIN_TOPUP, ref = null } = {}) {
  const amt = normalizeAmount(amount);
  if (amt === null || amt <= 0) return { ok: false, reason: 'invalid_amount' };
  return withTransaction(() => applyTx({
    userId, amount: amt, type, ref, note, adminId, adminIp, allowNegative: true
  }));
}

/** Admin chỉnh tay (cho phép âm). Bắt buộc có note để audit. */
async function adjust(userId, amount, { adminId = null, adminIp = null, note = null, type = TX_TYPES.ADMIN_ADJUST } = {}) {
  const amt = normalizeAmount(amount);
  if (amt === null || amt === 0) return { ok: false, reason: 'invalid_amount' };
  if (!note || !String(note).trim()) return { ok: false, reason: 'note_required' };
  // Trừ tay bị chặn nếu credit_allow_negative=0; cộng tay luôn cho phép.
  const allowNeg = amt > 0 ? true : await allowsNegative();
  return withTransaction(() => applyTx({
    userId, amount: amt, type, ref: null, note, adminId, adminIp, allowNegative: allowNeg
  }));
}

/** Lịch sử giao dịch của 1 user (phân trang). */
async function listTransactions(userId, { limit = 50, offset = 0 } = {}) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const off = Math.max(parseInt(offset, 10) || 0, 0);
  return all(`SELECT id, amount, balance_after, type, ref, note, admin_id, created_at
              FROM credit_transactions WHERE user_id = ?
              ORDER BY id DESC LIMIT ? OFFSET ?`, [userId, lim, off]);
}

/** Tổng số giao dịch của 1 user — dùng cho phân trang có số trang. */
async function countTransactions(userId) {
  const row = await get('SELECT COUNT(*) AS total FROM credit_transactions WHERE user_id = ?', [userId]);
  return row ? row.total : 0;
}

/** Ledger toàn hệ thống (admin), có filter. */
async function listAllTransactions({ userId = null, type = null, limit = 100, offset = 0 } = {}) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
  const off = Math.max(parseInt(offset, 10) || 0, 0);
  const where = [];
  const params = [];
  if (userId) { where.push('t.user_id = ?'); params.push(userId); }
  if (type) { where.push('t.type = ?'); params.push(type); }
  const sql = `SELECT t.*, u.username FROM credit_transactions t
               LEFT JOIN users u ON u.id = t.user_id
               ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY t.id DESC LIMIT ? OFFSET ?`;
  params.push(lim, off);
  return all(sql, params);
}

/** Bảng user kèm số dư + tổng đã dùng (admin). */
async function listUserCredits() {
  return all(`SELECT u.id, u.username, u.role, u.status, u.created_at,
                     u.credit_balance AS balance,
                     COALESCE((SELECT SUM(-amount) FROM credit_transactions t
                               WHERE t.user_id = u.id AND t.type = 'lookup'), 0) AS used
              FROM users u ORDER BY u.id ASC`, []);
}

/** Đối soát: SUM(amount) của ledger phải khớp users.credit_balance. */
async function reconcile() {
  const rows = await all(`SELECT u.id, u.username, u.credit_balance AS balance,
                                 COALESCE((SELECT SUM(amount) FROM credit_transactions t WHERE t.user_id = u.id), 0) AS ledger
                          FROM users u`, []);
  const mismatched = rows
    .filter(r => Math.abs((Number(r.balance) || 0) - (Number(r.ledger) || 0)) > 1e-6)
    .map(r => ({ id: r.id, username: r.username, balance: r.balance, ledger: r.ledger }));
  return { ok: mismatched.length === 0, mismatched };
}

module.exports = {
  TX_TYPES,
  normalizeAmount,
  isEnabled,
  getCost,
  getSignupBonus,
  allowsNegative,
  getPublicConfig,
  getBalance,
  chargeLookup,
  grantSignupBonus,
  topUp,
  adjust,
  listTransactions,
  countTransactions,
  listAllTransactions,
  listUserCredits,
  reconcile
};

