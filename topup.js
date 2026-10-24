/**
 * Top-up domain logic — gói nạp + đơn thanh toán payOS.
 *
 * Tách khỏi server.js để route chỉ còn validate HTTP + gọi hàm.
 * KHÔNG cộng điểm ở đây: `creditOrder()` chỉ gọi credits.topUp() và cập nhật
 * trạng thái đơn. Idempotent 2 lớp:
 *   1. `payment_orders.status === 'PAID'` → không xử lý lại.
 *   2. Unique index idx_credit_tx_idem trên (user_id, type, ref) → chặn ghi
 *      trùng ledger kể cả khi 2 request vượt qua được lớp 1 (race).
 */
const db = require('./database');
const credits = require('./credits');
const { EventEmitter } = require('events');

const STATUSES = Object.freeze({
  PENDING: 'PENDING',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  UNDERPAID: 'UNDERPAID',
  FAILED: 'FAILED'
});

// ============================================================================
// Event bus trạng thái đơn — nguồn cho long-poll "cập nhật tức thời".
//
// Vì sao cần: webhook payOS tới là biết khách đã trả tiền NGAY, nhưng client chỉ
// đang hỏi lại mỗi 4–20 giây → khách thấy "chờ thanh toán" thêm chục giây dù điểm
// đã cộng. Bus này phát 1 sự kiện ngay sau khi UPDATE trạng thái; route
// GET /api/credits/topup/:code/wait đang giữ kết nối sẽ trả về tức thì.
//
// Một tiến trình Node duy nhất (app không chạy multi-instance — xem deploy/README)
// nên bus trong RAM là đủ. Sự kiện chỉ chứa { id, status }, KHÔNG chứa dữ liệu
// nhạy cảm; người chờ tự đọc lại đơn của mình qua DB (đã kiểm tra quyền).
// ============================================================================
const events = new EventEmitter();
events.setMaxListeners(0); // mỗi tab đang chờ = 1 listener; không giới hạn cứng

/** Phát sự kiện đổi trạng thái 1 đơn (gọi sau khi UPDATE đã commit). */
function emitOrderChange(id, status) {
  try { events.emit('order', { id: Number(id), status }); } catch (e) { /* listener lỗi không được làm hỏng luồng tiền */ }
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

/** Ref dùng cho ledger — cố định theo orderCode để chống cộng trùng. */
function ledgerRef(orderCode) {
  return `payos:${orderCode}`;
}

// ============================================================================
// Gói nạp
// ============================================================================
/** Gói đang bật (cho trang user). */
function listActivePackages() {
  return all(`SELECT id, label, amount_vnd, credits, sort_order
              FROM topup_packages WHERE active = 1
              ORDER BY sort_order ASC, amount_vnd ASC`);
}

/** Toàn bộ gói (cho admin, kèm số đơn đã dùng gói). */
function listAllPackages() {
  return all(`SELECT p.*,
                     (SELECT COUNT(*) FROM payment_orders o WHERE o.package_id = p.id) AS order_count
              FROM topup_packages p
              ORDER BY p.sort_order ASC, p.amount_vnd ASC`);
}

function getPackage(id) {
  return get('SELECT * FROM topup_packages WHERE id = ?', [id]);
}

async function createPackage({ label, amount_vnd, credits: creditAmount, sort_order, active }) {
  const r = await run(`INSERT INTO topup_packages (label, amount_vnd, credits, sort_order, active)
                       VALUES (?, ?, ?, ?, ?)`,
    [label || null, amount_vnd, creditAmount, sort_order || 0, active === undefined ? 1 : (active ? 1 : 0)]);
  return getPackage(r.lastID);
}

async function updatePackage(id, { label, amount_vnd, credits: creditAmount, sort_order, active }) {
  const r = await run(`UPDATE topup_packages SET label = ?, amount_vnd = ?, credits = ?, sort_order = ?, active = ?
                       WHERE id = ?`,
    [label || null, amount_vnd, creditAmount, sort_order || 0, active ? 1 : 0, id]);
  return r.changes ? getPackage(id) : null;
}

/**
 * Xoá gói. Có đơn tham chiếu → soft delete (active=0) để không mồ côi lịch sử;
 * chưa có đơn nào → hard delete.
 */
async function deletePackage(id) {
  const used = await get('SELECT COUNT(*) AS c FROM payment_orders WHERE package_id = ?', [id]);
  if (used && used.c > 0) {
    await run('UPDATE topup_packages SET active = 0 WHERE id = ?', [id]);
    return { soft: true, orders: used.c };
  }
  await run('DELETE FROM topup_packages WHERE id = ?', [id]);
  return { soft: false };
}

// ============================================================================
// Đơn thanh toán
// ============================================================================
/**
 * Sinh order_code duy nhất. payOS yêu cầu số nguyên dương; dùng timestamp rút
 * gọn (giây) * 1000 + 3 chữ số ngẫu nhiên — vừa khó trùng, vừa không quá dài.
 */
async function nextOrderCode() {
  for (let i = 0; i < 20; i++) {
    const ts = Math.floor(Date.now() / 1000) % 1000000000; // 9 chữ số
    const code = ts * 1000 + Math.floor(Math.random() * 1000);
    const clash = await get('SELECT id FROM payment_orders WHERE order_code = ?', [code]);
    if (!clash) return code;
  }
  // Fallback cực hiếm: cộng dồn từ max hiện có.
  const row = await get('SELECT COALESCE(MAX(order_code), 100000) + 1 AS next FROM payment_orders');
  return row ? row.next : Date.now();
}

async function createOrder({ orderCode, userId, packageId, amountVnd, creditsAmount, description, clientIp, userAgent }) {
  const r = await run(`INSERT INTO payment_orders
      (order_code, user_id, package_id, amount_vnd, credits, status, description, client_ip, user_agent)
      VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`,
    [orderCode, userId, packageId || null, amountVnd, creditsAmount, description || null, clientIp || null, userAgent || null]);
  return getOrderById(r.lastID);
}

function getOrderById(id) {
  return get('SELECT * FROM payment_orders WHERE id = ?', [id]);
}

function getOrderByCode(orderCode) {
  return get('SELECT * FROM payment_orders WHERE order_code = ?', [orderCode]);
}

async function setOrderLink(id, { paymentLinkId, checkoutUrl, qrCode, expiresAt }) {
  await run(`UPDATE payment_orders SET payment_link_id = ?, checkout_url = ?, qr_code = ?, expires_at = COALESCE(?, expires_at) WHERE id = ?`,
    [paymentLinkId || null, checkoutUrl || null, qrCode || null, expiresAt || null, id]);
}

/**
 * Hạn thanh toán của đơn. Ưu tiên expires_at payOS trả về; nếu thiếu thì suy ra
 * created_at + 15 phút (mặc định của payOS). Trả ISO string hoặc null.
 */
const DEFAULT_ORDER_TTL_MS = 15 * 60 * 1000;
function getOrderExpiry(order) {
  if (!order) return null;
  if (order.expires_at) return normSqlDate(order.expires_at);
  if (!order.created_at) return null;
  // SQLite CURRENT_TIMESTAMP là UTC, không có hậu tố 'Z'.
  const created = new Date(normSqlDate(order.created_at)).getTime();
  if (!Number.isFinite(created)) return null;
  return new Date(created + DEFAULT_ORDER_TTL_MS).toISOString();
}

/** Chuẩn hoá datetime SQLite ('YYYY-MM-DD HH:MM:SS' UTC) → ISO có 'Z'. */
function normSqlDate(s) {
  if (!s) return null;
  const str = String(s);
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(str)) return str;
  return str.replace(' ', 'T') + 'Z';
}

/**
 * Đánh dấu EXPIRED các đơn PENDING quá hạn (chưa thanh toán). Gọi khi user xem
 * đơn để trạng thái không "treo" mãi khi không có webhook.
 */
async function expireStaleOrders(userId) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const r = await run(`UPDATE payment_orders
                       SET status = 'EXPIRED'
                       WHERE user_id = ? AND status = 'PENDING'
                         AND COALESCE(expires_at, datetime(created_at, '+15 minutes')) < ?`,
    [userId, now]);
  if (r.changes) events.emit('bulk');   // có đơn vừa hết hạn → client đang chờ tự đọc lại
  return r.changes || 0;
}

/**
 * Đánh dấu EXPIRED cho MỌI đơn PENDING quá hạn (không chỉ của 1 user).
 *
 * Chạy theo cron: nếu chỉ dựa vào `expireStaleOrders(userId)` khi user mở trang
 * thì đơn của người không quay lại sẽ treo PENDING vĩnh viễn, làm sai thống kê
 * ("đơn chờ" tăng mãi) và khiến đối soát payOS khó đọc.
 */
async function expireAllStaleOrders() {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const r = await run(`UPDATE payment_orders
                       SET status = 'EXPIRED'
                       WHERE status = 'PENDING'
                         AND COALESCE(expires_at, datetime(created_at, '+15 minutes')) < ?`,
    [now]);
  if (r.changes) events.emit('bulk');   // dọn hàng loạt → đánh thức mọi client đang chờ
  return r.changes || 0;
}

/** Đếm đơn theo trạng thái + mốc thanh toán gần nhất (dùng cho trang chẩn đoán admin). */
async function getStatusCounts() {
  const [rows, last] = await Promise.all([
    all(`SELECT status, COUNT(*) AS c FROM payment_orders GROUP BY status`, []),
    get(`SELECT MAX(paid_at) AS last_paid_at,
                MAX(CASE WHEN raw_webhook IS NOT NULL THEN COALESCE(paid_at, created_at) END) AS last_webhook_at
         FROM payment_orders`, [])
  ]);
  const counts = {};
  for (const r of rows || []) counts[r.status] = Number(r.c) || 0;
  return {
    counts,
    last_paid_at: (last && last.last_paid_at) || null,
    last_webhook_at: (last && last.last_webhook_at) || null
  };
}

async function updateOrderStatus(id, status, { transactionRef, rawWebhook, paidAt, amountPaid } = {}) {
  await run(`UPDATE payment_orders
             SET status = ?, transaction_ref = COALESCE(?, transaction_ref),
                 raw_webhook = COALESCE(?, raw_webhook),
                 paid_at = COALESCE(?, paid_at),
                 amount_paid = COALESCE(?, amount_paid)
             WHERE id = ?`,
    [status, transactionRef || null, rawWebhook || null, paidAt || null,
      Number.isFinite(Number(amountPaid)) && amountPaid !== null && amountPaid !== undefined ? Math.round(Number(amountPaid)) : null,
      id]);
  // Đánh thức mọi client đang long-poll đơn này → cập nhật NGAY, không chờ nhịp poll.
  emitOrderChange(id, status);
}

/** Mốc thời gian UTC đúng định dạng DATETIME của SQLite ('YYYY-MM-DD HH:MM:SS'). */
function sqlNow() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * Cộng điểm cho 1 đơn và đánh dấu PAID — idempotent.
 *
 * Quy tắc tiền bạc (quan trọng cho production):
 *  1. Đơn đã PAID → không cộng lại.
 *  2. `paidAmount` (payOS báo) NHỎ HƠN giá trị đơn → KHÔNG cộng điểm, đánh dấu
 *     UNDERPAID để admin đối soát tay. Trước đây cộng đủ điểm của gói dù khách
 *     chuyển thiếu → thất thoát tiền thật.
 *  3. `allowLate` = payOS ĐÃ xác nhận thanh toán (webhook chữ ký hợp lệ / đối soát
 *     API). Khi đó đơn đã bị đánh EXPIRED/CANCELLED phía mình vẫn phải cộng điểm,
 *     nếu không khách mất tiền mà không có điểm. Chỉ đường đã xác thực mới được
 *     bật cờ này — client không bao giờ tự đặt được.
 *  4. Hai request song song (webhook vs /sync) cùng cộng: unique index ledger chặn
 *     bút toán thứ 2 → bắt DUPLICATE_TX và coi như đã cộng, vẫn đánh dấu PAID.
 *
 * @returns {{ok:boolean, reason?:string, credits?:number, balance?:number,
 *            already?:boolean, expected?:number, paid?:number, userId?:number}}
 */
async function creditOrder(orderCode, { transactionRef, rawWebhook, paidAmount, allowLate = false } = {}) {
  const order = await getOrderByCode(orderCode);
  if (!order) return { ok: false, reason: 'order_not_found' };
  if (order.status === STATUSES.PAID) {
    return { ok: true, already: true, credits: order.credits, userId: order.user_id };
  }

  const paid = Number(paidAmount);
  const hasPaid = Number.isFinite(paid) && paid > 0;
  const expected = Number(order.amount_vnd);

  // Trạng thái được phép cộng. payOS xác nhận ĐÃ THU TIỀN là chân lý cuối cùng:
  // đơn bị đánh EXPIRED/CANCELLED/FAILED phía mình (lệch giờ, webhook lỗi tạm thời,
  // user trả muộn) vẫn phải cộng điểm, nếu không khách mất tiền mà không có điểm.
  // UNDERPAID cũng cho phép: nếu payOS sau đó báo đã thu ĐỦ thì cộng bình thường.
  const allowed = new Set([STATUSES.PENDING]);
  if (allowLate) {
    allowed.add(STATUSES.EXPIRED);
    allowed.add(STATUSES.CANCELLED);
    allowed.add(STATUSES.UNDERPAID);
    allowed.add(STATUSES.FAILED);
  }
  if (!allowed.has(order.status)) {
    return { ok: false, reason: `status_${String(order.status).toLowerCase()}` };
  }

  // Trả thiếu → không cộng điểm, đánh dấu để admin xử lý.
  if (hasPaid && paid < expected) {
    await updateOrderStatus(order.id, STATUSES.UNDERPAID, {
      transactionRef, rawWebhook, amountPaid: paid
    });
    return { ok: false, reason: 'underpaid', expected, paid, userId: order.user_id };
  }

  let r;
  try {
    r = await credits.topUp(order.user_id, order.credits, {
      type: credits.TX_TYPES.PAYMENT,
      ref: ledgerRef(orderCode),
      note: `Nạp điểm payOS #${orderCode} (${order.amount_vnd}đ)`
    });
  } catch (e) {
    if (e && e.message === 'DUPLICATE_TX') {
      // Request song song đã ghi bút toán cho đơn này → chỉ còn thiếu cập nhật trạng thái.
      await updateOrderStatus(order.id, STATUSES.PAID, {
        transactionRef, rawWebhook,
        amountPaid: hasPaid ? paid : expected,
        paidAt: sqlNow()
      });
      return { ok: true, already: true, credits: order.credits, userId: order.user_id };
    }
    return { ok: false, reason: 'ledger_error', message: e && e.message };
  }
  if (!r.ok) return { ok: false, reason: r.reason };

  await updateOrderStatus(order.id, STATUSES.PAID, {
    transactionRef, rawWebhook,
    amountPaid: hasPaid ? paid : expected,
    paidAt: sqlNow()
  });
  return { ok: true, credits: order.credits, balance: r.balance, userId: order.user_id };
}

/** Đơn gần đây của 1 user (trang nạp điểm). */
function listUserOrders(userId, { limit = 20 } = {}) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  return all(`SELECT id, order_code, amount_vnd, credits, status, checkout_url, qr_code, paid_at, created_at, expires_at
              FROM payment_orders WHERE user_id = ?
              ORDER BY id DESC LIMIT ?`, [userId, lim]);
}

/** Danh sách đơn cho admin, có filter + phân trang. */
async function listOrders({ status = null, userId = null, from = null, to = null, q = null, limit = 50, offset = 0 } = {}) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const off = Math.max(parseInt(offset, 10) || 0, 0);
  const where = [];
  const params = [];
  if (status) { where.push('o.status = ?'); params.push(status); }
  if (userId) { where.push('o.user_id = ?'); params.push(userId); }
  if (from) { where.push('o.created_at >= ?'); params.push(from); }
  if (to) { where.push('o.created_at <= ?'); params.push(to); }
  if (q) { where.push('(CAST(o.order_code AS TEXT) LIKE ? OR u.username LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const [rows, countRow] = await Promise.all([
    all(`SELECT o.*, u.username FROM payment_orders o
         LEFT JOIN users u ON u.id = o.user_id
         ${whereSql} ORDER BY o.id DESC LIMIT ? OFFSET ?`, [...params, lim, off]),
    get(`SELECT COUNT(*) AS total FROM payment_orders o
         LEFT JOIN users u ON u.id = o.user_id ${whereSql}`, params)
  ]);
  return { data: rows, total: countRow ? countRow.total : 0, limit: lim, offset: off };
}

/**
 * Thống kê nạp tiền + sử dụng điểm.
 *
 * Chỉ số tổng hợp từ 2 nguồn: `payment_orders` (tiền vào) và
 * `credit_transactions` (điểm ra/vào). Đơn PENDING quá `expireHours` được đếm
 * riêng ở `stale_pending_orders` để admin biết cần dọn.
 */
async function getStats({ days = 30, expireHours = 24, topUsers = 10 } = {}) {
  const d = Math.min(Math.max(parseInt(days, 10) || 30, 1), 365);
  const top = Math.min(Math.max(parseInt(topUsers, 10) || 10, 1), 100);
  const expire = Math.max(parseInt(expireHours, 10) || 24, 1);
  const since = `-${d} days`;

  const [
    totalsRow, statusRows, revenueDaily, revenueMonthly, topTopup,
    usageRow, usageDaily, topUsage, systemRow, pendingRow
  ] = await Promise.all([
    get(`SELECT
           COALESCE(SUM(CASE WHEN status = 'PAID' THEN amount_vnd ELSE 0 END), 0) AS revenue_vnd,
           COALESCE(SUM(CASE WHEN status = 'PAID' THEN credits ELSE 0 END), 0) AS credits_granted,
           COALESCE(SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END), 0) AS paid_orders,
           COALESCE(SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END), 0) AS pending_orders,
           COALESCE(SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END), 0) AS cancelled_orders,
           COALESCE(SUM(CASE WHEN status = 'EXPIRED' THEN 1 ELSE 0 END), 0) AS expired_orders,
           COALESCE(SUM(CASE WHEN status = 'UNDERPAID' THEN 1 ELSE 0 END), 0) AS underpaid_orders,
           COALESCE(SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END), 0) AS failed_orders,
           COUNT(*) AS total_orders,
           COALESCE(AVG(CASE WHEN status = 'PAID' THEN amount_vnd END), 0) AS avg_paid_vnd
         FROM payment_orders`, []),

    all(`SELECT status, COUNT(*) AS c, COALESCE(SUM(amount_vnd), 0) AS vnd
         FROM payment_orders GROUP BY status ORDER BY c DESC`, []),

    all(`SELECT substr(COALESCE(paid_at, created_at), 1, 10) AS day,
                COUNT(*) AS orders, COALESCE(SUM(amount_vnd), 0) AS vnd,
                COALESCE(SUM(credits), 0) AS credits
         FROM payment_orders
         WHERE status = 'PAID' AND COALESCE(paid_at, created_at) >= datetime('now', ?)
         GROUP BY day ORDER BY day ASC`, [since]),

    all(`SELECT substr(COALESCE(paid_at, created_at), 1, 7) AS month,
                COUNT(*) AS orders, COALESCE(SUM(amount_vnd), 0) AS vnd,
                COALESCE(SUM(credits), 0) AS credits
         FROM payment_orders
         WHERE status = 'PAID'
         GROUP BY month ORDER BY month DESC LIMIT 12`, []),

    all(`SELECT o.user_id, u.username,
                COUNT(*) AS orders, COALESCE(SUM(o.amount_vnd), 0) AS vnd,
                COALESCE(SUM(o.credits), 0) AS credits
         FROM payment_orders o LEFT JOIN users u ON u.id = o.user_id
         WHERE o.status = 'PAID'
         GROUP BY o.user_id ORDER BY vnd DESC LIMIT ?`, [top]),

    get(`SELECT
           COALESCE(SUM(CASE WHEN type = 'lookup' THEN -amount ELSE 0 END), 0) AS credits_used,
           COALESCE(SUM(CASE WHEN type = 'lookup' THEN 1 ELSE 0 END), 0) AS lookups,
           COUNT(DISTINCT CASE WHEN type = 'lookup' THEN user_id END) AS users_used,
           COALESCE(SUM(CASE WHEN type = 'signup_bonus' THEN amount ELSE 0 END), 0) AS signup_bonus,
           COALESCE(SUM(CASE WHEN type = 'admin_topup' THEN amount ELSE 0 END), 0) AS admin_topup,
           COALESCE(SUM(CASE WHEN type = 'admin_adjust' THEN amount ELSE 0 END), 0) AS admin_adjust,
           COALESCE(SUM(CASE WHEN type = 'refund' THEN amount ELSE 0 END), 0) AS refunded
         FROM credit_transactions`, []),

    all(`SELECT substr(created_at, 1, 10) AS day,
                COUNT(*) AS lookups, COALESCE(SUM(-amount), 0) AS credits_used,
                COUNT(DISTINCT user_id) AS users
         FROM credit_transactions
         WHERE type = 'lookup' AND created_at >= datetime('now', ?)
         GROUP BY day ORDER BY day ASC`, [since]),

    all(`SELECT t.user_id, u.username,
                COUNT(*) AS lookups, COALESCE(SUM(-t.amount), 0) AS credits_used
         FROM credit_transactions t LEFT JOIN users u ON u.id = t.user_id
         WHERE t.type = 'lookup'
         GROUP BY t.user_id ORDER BY credits_used DESC LIMIT ?`, [top]),

    get(`SELECT
           COALESCE(SUM(credit_balance), 0) AS credits_remaining,
           COUNT(*) AS users,
           COALESCE(SUM(CASE WHEN credit_balance > 0 THEN 1 ELSE 0 END), 0) AS users_with_balance
         FROM users`, []),

    get(`SELECT COUNT(*) AS c FROM payment_orders
         WHERE status = 'PENDING' AND created_at < datetime('now', ?)`, [`-${expire} hours`])
  ]);

  return buildStatsView({ totalsRow, statusRows, revenueDaily, revenueMonthly, topTopup, usageRow, usageDaily, topUsage, systemRow, pendingRow, d });
}

/** Ghép các query rời thành 1 object thống kê cho client. */
function buildStatsView({ totalsRow, statusRows, revenueDaily, revenueMonthly, topTopup, usageRow, usageDaily, topUsage, systemRow, pendingRow, d }) {
  const creditsGranted = Number(totalsRow.credits_granted) || 0;
  const creditsUsed = Number(usageRow.credits_used) || 0;
  const totalOrders = Number(totalsRow.total_orders) || 0;
  const paidOrders = Number(totalsRow.paid_orders) || 0;
  const adminAdjust = Number(usageRow.admin_adjust) || 0;
  const lookups = Number(usageRow.lookups) || 0;
  const grantedTotal = creditsGranted + adminAdjust;

  return {
    generated_at: new Date().toISOString(),
    window_days: d,
    topup: {
      revenue_vnd: Number(totalsRow.revenue_vnd) || 0,
      credits_granted: creditsGranted,
      avg_paid_vnd: Math.round((Number(totalsRow.avg_paid_vnd) || 0) * 100) / 100,
      total_orders: totalOrders,
      paid_orders: paidOrders,
      pending_orders: Number(totalsRow.pending_orders) || 0,
      cancelled_orders: Number(totalsRow.cancelled_orders) || 0,
      expired_orders: Number(totalsRow.expired_orders) || 0,
      underpaid_orders: Number(totalsRow.underpaid_orders) || 0,
      failed_orders: Number(totalsRow.failed_orders) || 0,
      stale_pending_orders: pendingRow ? Number(pendingRow.c) || 0 : 0,
      // Tỉ lệ đơn đã trả tiền trên tổng đơn tạo ra.
      conversion_rate: totalOrders > 0 ? Math.round((paidOrders / totalOrders) * 10000) / 100 : 0
    },
    by_status: (statusRows || []).map(r => ({ status: r.status, orders: r.c, amount_vnd: r.vnd })),
    revenue_daily: revenueDaily || [],
    revenue_monthly: revenueMonthly || [],
    top_topup_users: topTopup || [],
    usage: {
      credits_used: creditsUsed,
      lookups,
      users_used: Number(usageRow.users_used) || 0,
      signup_bonus: Number(usageRow.signup_bonus) || 0,
      admin_topup: Number(usageRow.admin_topup) || 0,
      admin_adjust: adminAdjust,
      refunded: Number(usageRow.refunded) || 0,
      avg_per_lookup: lookups > 0 ? Math.round((creditsUsed / lookups) * 10000) / 10000 : 0
    },
    usage_daily: usageDaily || [],
    top_usage_users: topUsage || [],
    system: {
      credits_remaining: Number(systemRow.credits_remaining) || 0,
      credits_used: creditsUsed,
      credits_granted: creditsGranted,
      credits_admin_adjust: adminAdjust,
      users: Number(systemRow.users) || 0,
      users_with_balance: Number(systemRow.users_with_balance) || 0,
      // Tỉ lệ điểm đã tiêu trên tổng điểm từng được cấp (nạp + admin cấp thêm).
      usage_ratio: grantedTotal > 0 ? Math.round((creditsUsed / grantedTotal) * 10000) / 100 : 0
    }
  };
}

module.exports = {
  STATUSES,
  events,
  ledgerRef,
  listActivePackages,
  listAllPackages,
  getPackage,
  createPackage,
  updatePackage,
  deletePackage,
  nextOrderCode,
  createOrder,
  getOrderById,
  getOrderByCode,
  setOrderLink,
  updateOrderStatus,
  creditOrder,
  listUserOrders,
  getOrderExpiry,
  expireStaleOrders,
  expireAllStaleOrders,
  getStatusCounts,
  DEFAULT_ORDER_TTL_MS,
  listOrders,
  getStats
};
