/**
 * Số liệu tổng quan website cho Dashboard admin (KHÔNG phải Google Analytics).
 *
 * Một endpoint gom tất cả chỉ số local để dashboard chỉ gọi 1 lần thay vì 5-6
 * request rời. Kết quả cache ngắn (30s) vì đây là dữ liệu vận hành, không phải
 * giao dịch — admin bấm "Làm mới" sẽ bỏ cache.
 */
const fs = require('fs');
const path = require('path');
const db = require('./database');
const version = require('./version');
const apiKeys = require('./api-keys');

const CACHE_TTL_MS = 30000;
const cache = new Map();

function all(sql, params = []) {
  return new Promise((resolve) => {
    db.all(sql, params, (err, rows) => resolve(err ? [] : (rows || [])));
  });
}

function get(sql, params = []) {
  return new Promise((resolve) => {
    db.get(sql, params, (err, row) => resolve(err ? null : (row || null)));
  });
}

function num(v) { return Number(v) || 0; }

function clampDays(value) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return 28;
  return Math.min(Math.max(n, 1), 365);
}

function pad2(n) { return n < 10 ? '0' + n : String(n); }

/** Các ngày (UTC) trong cửa sổ `days` ngày, TÍNH CẢ HÔM NAY (số liệu local thời gian thực). */
function dateKeys(days) {
  const out = [];
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (let i = days - 1; i >= 0; i--) {
    out.push(new Date(todayUtc - i * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

function fillSeries(rows, days, fieldMap) {
  const map = new Map();
  for (const row of rows || []) {
    const key = String(row.day || '').slice(0, 10);
    if (key) map.set(key, row);
  }
  return dateKeys(days).map((date) => {
    const row = map.get(date) || {};
    const out = { date };
    for (const [field, source] of Object.entries(fieldMap)) out[field] = num(row[source]);
    return out;
  });
}

function dbSizeBytes() {
  try {
    const p = db.dbPath || process.env.DB_PATH || path.join(path.dirname(__dirname), 'database.sqlite');
    return fs.statSync(p).size;
  } catch (e) {
    return 0;
  }
}

async function collect({ days }) {
  const since = `-${days} days`;
  const prevSince = `-${days * 2} days`;

  const [
    usersRow, usersSeries, cellsRow, cellsAddedRow,
    lookupsRow, lookupsSeries, lookupsPrevRow, topUsers,
    creditsRow, creditsPrevRow, creditsSeries,
    revenueRow, revenuePrevRow, pendingRow, revenueSeries,
    apiStats, trackersRow, visitsRow, visits24Row,
    lastSync, recentUsers, recentPayments, recentBatches
  ] = await Promise.all([
    get(`SELECT COUNT(*) AS total,
                SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS admins,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN status = 'disabled' THEN 1 ELSE 0 END) AS disabled,
                SUM(CASE WHEN email_verified = 1 THEN 1 ELSE 0 END) AS verified,
                SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END) AS new_today,
                SUM(CASE WHEN created_at >= datetime('now', ?) THEN 1 ELSE 0 END) AS new_in_window,
                SUM(CASE WHEN created_at >= datetime('now', ?) AND created_at < datetime('now', ?) THEN 1 ELSE 0 END) AS new_previous
         FROM users`, [since, prevSince, since]),
    all(`SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS count
         FROM users WHERE created_at >= datetime('now', ?) GROUP BY day`, [since]),
    get(`SELECT COUNT(*) AS total FROM cells`),
    get(`SELECT COUNT(*) AS added FROM cells WHERE created_at >= datetime('now', ?)`, [since]),
    get(`SELECT COUNT(*) AS total,
                SUM(CASE WHEN created_at >= datetime('now', ?) THEN 1 ELSE 0 END) AS in_window,
                SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END) AS today,
                SUM(CASE WHEN created_at >= datetime('now', ?) AND found = 1 THEN 1 ELSE 0 END) AS found_in_window,
                COUNT(DISTINCT CASE WHEN created_at >= datetime('now', ?) THEN user_id END) AS distinct_users
         FROM lookup_history`, [since, since, since]),
    all(`SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS count
         FROM lookup_history WHERE created_at >= datetime('now', ?) GROUP BY day`, [since]),
    get(`SELECT COUNT(*) AS total FROM lookup_history
         WHERE created_at >= datetime('now', ?) AND created_at < datetime('now', ?)`, [prevSince, since]),
    all(`SELECT h.user_id AS id, COALESCE(u.username, '#' || h.user_id) AS username, COUNT(*) AS count
         FROM lookup_history h LEFT JOIN users u ON u.id = h.user_id
         WHERE h.created_at >= datetime('now', ?) AND h.user_id IS NOT NULL
         GROUP BY h.user_id ORDER BY count DESC LIMIT 5`, [since]),
    get(`SELECT COALESCE(SUM(credit_balance), 0) AS remaining FROM users`),
    get(`SELECT COALESCE(SUM(-amount), 0) AS used FROM credit_transactions
         WHERE type = 'lookup' AND created_at >= datetime('now', ?) AND created_at < datetime('now', ?)`, [prevSince, since]),
    all(`SELECT substr(created_at, 1, 10) AS day, COALESCE(SUM(-amount), 0) AS credits
         FROM credit_transactions
         WHERE type = 'lookup' AND created_at >= datetime('now', ?) GROUP BY day`, [since]),
    get(`SELECT COALESCE(SUM(amount_vnd), 0) AS paid_vnd, COUNT(*) AS paid_orders
         FROM payment_orders WHERE status = 'PAID' AND COALESCE(paid_at, created_at) >= datetime('now', ?)`, [since]),
    get(`SELECT COALESCE(SUM(amount_vnd), 0) AS paid_vnd, COUNT(*) AS paid_orders
         FROM payment_orders WHERE status = 'PAID'
           AND COALESCE(paid_at, created_at) >= datetime('now', ?)
           AND COALESCE(paid_at, created_at) < datetime('now', ?)`, [prevSince, since]),
    get(`SELECT COUNT(*) AS c FROM payment_orders WHERE status = 'PENDING'`),
    all(`SELECT substr(COALESCE(paid_at, created_at), 1, 10) AS day,
                COUNT(*) AS orders, COALESCE(SUM(amount_vnd), 0) AS vnd
         FROM payment_orders
         WHERE status = 'PAID' AND COALESCE(paid_at, created_at) >= datetime('now', ?)
         GROUP BY day`, [since]),
    apiKeys.stats().catch(() => ({ keys: {}, last24h: {} })),
    get(`SELECT COUNT(*) AS c FROM ip_tracker`),
    get(`SELECT COUNT(*) AS c FROM ip_tracker_logs`),
    get(`SELECT COUNT(*) AS c FROM ip_tracker_logs WHERE timestamp >= datetime('now', '-1 day')`),
    get(`SELECT last_run, last_status, last_message FROM sync_jobs
         ORDER BY COALESCE(last_run, created_at) DESC LIMIT 1`),
    all(`SELECT id, username, email, role, status, created_at FROM users ORDER BY id DESC LIMIT 5`),
    all(`SELECT o.order_code, o.amount_vnd, o.credits, o.status,
                COALESCE(o.paid_at, o.created_at) AS at, u.username
         FROM payment_orders o LEFT JOIN users u ON u.id = o.user_id
         ORDER BY o.id DESC LIMIT 5`),
    all(`SELECT b.batch_id, b.file_name, b.cell_count, b.found_count, b.created_at, u.username
         FROM lookup_batches b LEFT JOIN users u ON u.id = b.user_id
         ORDER BY b.created_at DESC LIMIT 5`)
  ]);

  const lookupsInWindow = num(lookupsRow && lookupsRow.in_window);
  const foundInWindow = num(lookupsRow && lookupsRow.found_in_window);

  return {
    generated_at: new Date().toISOString(),
    window_days: days,
    users: {
      total: num(usersRow && usersRow.total),
      admins: num(usersRow && usersRow.admins),
      active: num(usersRow && usersRow.active),
      pending: num(usersRow && usersRow.pending),
      disabled: num(usersRow && usersRow.disabled),
      verified: num(usersRow && usersRow.verified),
      new_today: num(usersRow && usersRow.new_today),
      new_in_window: num(usersRow && usersRow.new_in_window),
      new_previous: num(usersRow && usersRow.new_previous),
      series: fillSeries(usersSeries, days, { count: 'count' })
    },
    cells: {
      total: num(cellsRow && cellsRow.total),
      added_in_window: num(cellsAddedRow && cellsAddedRow.added)
    },
    lookups: {
      total: num(lookupsRow && lookupsRow.total),
      in_window: lookupsInWindow,
      today: num(lookupsRow && lookupsRow.today),
      found_in_window: foundInWindow,
      found_rate: lookupsInWindow > 0 ? Math.round((foundInWindow / lookupsInWindow) * 1000) / 10 : 0,
      distinct_users: num(lookupsRow && lookupsRow.distinct_users),
      previous: num(lookupsPrevRow && lookupsPrevRow.total),
      series: fillSeries(lookupsSeries, days, { count: 'count' }),
      top_users: (topUsers || []).map(r => ({ id: r.id, username: r.username, count: num(r.count) }))
    },
    credits: {
      remaining_total: Math.round(num(creditsRow && creditsRow.remaining) * 100) / 100,
      used_in_window: Math.round(num(creditsRow && creditsRow.used) * 100) / 100,
      used_previous: Math.round(num(creditsPrevRow && creditsPrevRow.used) * 100) / 100,
      series: fillSeries(creditsSeries, days, { credits: 'credits' })
    },
    revenue: {
      paid_vnd: num(revenueRow && revenueRow.paid_vnd),
      paid_orders: num(revenueRow && revenueRow.paid_orders),
      previous_vnd: num(revenuePrevRow && revenuePrevRow.paid_vnd),
      pending_orders: num(pendingRow && pendingRow.c),
      series: fillSeries(revenueSeries, days, { vnd: 'vnd', orders: 'orders' })
    },
    api: {
      keys_total: num(apiStats.keys && apiStats.keys.total),
      keys_active: num(apiStats.keys && apiStats.keys.active),
      requests_24h: num(apiStats.last24h && apiStats.last24h.requests),
      errors_24h: num(apiStats.last24h && apiStats.last24h.errors)
    },
    ip: {
      trackers: num(trackersRow && trackersRow.c),
      visits_total: num(visitsRow && visitsRow.c),
      visits_24h: num(visits24Row && visits24Row.c)
    },
    system: {
      uptime_seconds: Math.round(process.uptime()),
      rss_bytes: process.memoryUsage().rss,
      db_size_bytes: dbSizeBytes(),
      node_version: process.version,
      app_version: (() => {
        try { return version.getInfo().version; } catch (e) { return null; }
      })(),
      last_sync: lastSync ? {
        at: lastSync.last_run || null,
        status: lastSync.last_status || null,
        message: lastSync.last_message || null
      } : null
    },
    activity: {
      users: recentUsers || [],
      payments: recentPayments || [],
      lookup_batches: recentBatches || []
    }
  };
}

/**
 * @param {{days?:number, refresh?:boolean}} opts
 */
async function getOverview(opts = {}) {
  const days = clampDays(opts.days);
  const key = String(days);
  if (!opts.refresh && cache.has(key)) {
    const hit = cache.get(key);
    if (Date.now() - hit.at < CACHE_TTL_MS) return { ...hit.value, cached: true };
  }
  const value = await collect({ days });
  value.cached = false;
  cache.set(key, { at: Date.now(), value });
  return value;
}

function resetCache() { cache.clear(); }

module.exports = {
  getOverview,
  resetCache,
  clampDays,
  dateKeys,
  fillSeries,
  CACHE_TTL_MS
};
