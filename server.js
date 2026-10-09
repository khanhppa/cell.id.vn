const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const csv = require('csv-parser');
const xlsx = require('xlsx');
const axios = require('axios');
const https = require('https');
const zlib = require('zlib');
const { Readable } = require('stream');
const AdmZip = require('adm-zip');
const yauzl = require('yauzl');
const db = require('./database');
const excelParser = require('./excel-parser');
const clfConverter = require('./clf-converter');
const cellId = require('./cell-id');
const cron = require('node-cron');
const ocidSync = require('./ocid-sync');
const credits = require('./credits');

const app = express();
const port = process.env.PORT || 3000;

// Locate a cell row in the local DB for a raw cell ID.
// Probes candidates in order (raw/short first, then ECI/long) and, MNC variants
// within each, using plain equality on the (mcc, mnc, lac, cellid) unique index —
// NO CAST and NO OR, so every probe is an index seek (fast, DB untouched).
// Returns a Promise of the first row that has coordinates, or null.
function probeCellRow({ mcc, mnc, lac, cellid, sector }) {
  const idKeys = cellId.cellIdLookupKeys(cellid, sector); // e.g. ['662091','169495310']
  const mncKeys = cellId.mncVariants(mnc);                // e.g. ['01','1']
  const attempts = [];
  for (const id of idKeys) for (const m of mncKeys) attempts.push([mcc, m, lac, id]);
  return new Promise((resolve) => {
    let i = 0;
    let found = null;
    const next = () => {
      if (i >= attempts.length) return resolve(found);
      const p = attempts[i++];
      db.get('SELECT * FROM cells WHERE mcc = ? AND mnc = ? AND lac = ? AND cellid = ?', p, (err, row) => {
        if (!err && row && row.lat) { found = row; return resolve(found); }
        next();
      });
    };
    next();
  });
}

// RAT helpers (inferRadio / normalizeRadio) — dùng chung với ocid-sync.js.
const { inferRadio, normalizeRadio } = require('./radio-util');
// Geo gate — chặn toạ độ rác trước khi ghi vào bảng `cells`.
const { isPlausibleLatLng } = require('./geo-util');

// ============================================================
// Geo gate — cài đặt trong ./geo-util.js (dùng chung với ocid-sync.js).
// Lý do: cellid ngắn rất dễ trúng 1 row khác trong bảng nội bộ hoặc nguồn ngoài
// trả về ô cùng tên ở nước khác → marker sai ngoài VN. Mọi nhánh ghi `cells` phải
// đi qua isPlausibleLatLng() (mcc 452 ⇒ bắt buộc nằm trong khung VN).
// ============================================================

// Middleware
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware
const JWT_SECRET = process.env.JWT_SECRET || 'cell-tracker-secret-key-2024';

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  const token = authHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    req.user = decoded;
    next();
  });
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) { req.user = null; return next(); }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) req.user = null;
    else req.user = decoded;
    next();
  });
}

// Auth Routes
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    bcrypt.compare(password, user.password, (err, match) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!match) return res.status(401).json({ error: 'Invalid credentials' });

      const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token, user: { id: user.id, username: user.username, role: user.role, credit_balance: Number(user.credit_balance) || 0 } });
    });
  });
});

app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).json({ error: err.message });
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash], async function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username already exists' });
        return res.status(500).json({ error: err.message });
      }
      const userId = this.lastID;
      // Điểm thưởng đăng ký — ghi qua ledger (không set thẳng cột) để đối soát được.
      let balance = 0;
      try {
        const bonus = await credits.grantSignupBonus(userId);
        balance = Number(bonus.balance) || 0;
      } catch (e) { console.error('signup bonus failed:', e.message); }
      const token = jwt.sign({ id: userId, username, role: 'user' }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token, user: { id: userId, username, role: 'user', credit_balance: balance } });
    });
  });
});

app.get('/api/me', requireAuth, (req, res) => {
  db.get('SELECT id, username, role, created_at, credit_balance FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.credit_balance = Number(user.credit_balance) || 0;
    res.json(user);
  });
});

// ========================
// Credits (user)
// ========================
// Cấu hình công khai — trang login/credits dùng để hiển thị giá + bonus.
// KHÔNG trả dữ liệu user nào.
app.get('/api/credits/config', async (req, res) => {
  try { res.json(await credits.getPublicConfig()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/credits/balance', requireAuth, async (req, res) => {
  try {
    const [balance, config] = await Promise.all([credits.getBalance(req.user.id), credits.getPublicConfig()]);
    res.json({ balance, ...config });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Lịch sử giao dịch — LUÔN giới hạn theo req.user.id, không nhận user_id từ client.
// `paged=1` → trả envelope { data, total, page, limit, totalPages } để client
// phân trang có số trang. Không có `paged` → trả mảng thô như trước (tương thích).
app.get('/api/credits/transactions', requireAuth, async (req, res) => {
  try {
    if (String(req.query.paged || '') === '1') {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
      const [rows, total] = await Promise.all([
        credits.listTransactions(req.user.id, { limit, offset: (page - 1) * limit }),
        credits.countTransactions(req.user.id)
      ]);
      return res.json({
        data: rows, total, page, limit,
        totalPages: Math.max(1, Math.ceil(total / limit))
      });
    }
    const rows = await credits.listTransactions(req.user.id, {
      limit: req.query.limit, offset: req.query.offset
    });
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ========================
// Credits (admin)
// ========================
// Rate limit thô cho thao tác tiền: tối đa 60 lần / phút / admin.
const creditAdminHits = new Map();
function creditAdminRateLimit(req, res, next) {
  const key = String(req.user.id);
  const now = Date.now();
  const hits = (creditAdminHits.get(key) || []).filter(t => now - t < 60000);
  if (hits.length >= 60) return res.status(429).json({ error: 'Quá nhiều thao tác, thử lại sau' });
  hits.push(now);
  creditAdminHits.set(key, hits);
  next();
}

app.get('/api/admin/credits/users', requireAuth, requireAdmin, async (req, res) => {
  try { res.json(await credits.listUserCredits()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/credits/transactions', requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = req.query.user_id ? parseInt(req.query.user_id, 10) : null;
    if (req.query.user_id && !Number.isFinite(userId)) return res.status(400).json({ error: 'user_id không hợp lệ' });
    const rows = await credits.listAllTransactions({
      userId: userId || null, type: req.query.type || null,
      limit: req.query.limit, offset: req.query.offset
    });
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/credits/topup', requireAuth, requireAdmin, creditAdminRateLimit, async (req, res) => {
  try {
    const { user_id, amount, note } = req.body || {};
    const uid = parseInt(user_id, 10);
    if (!Number.isFinite(uid)) return res.status(400).json({ error: 'user_id không hợp lệ' });
    const r = await credits.topUp(uid, amount, {
      adminId: req.user.id, adminIp: adminIp(req), note: note || null
    });
    if (!r.ok) return res.status(400).json({ error: creditsReason(r.reason), reason: r.reason });
    res.json({ success: true, balance: r.balance });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// CHỈ cho phép NẠP THÊM điểm. Số dư hiện có của user là bất biến — không có API
// nào của admin được phép giảm/ghi đè `credit_balance`.
//
// Cố ý KHÔNG chặn ở tầng credits.adjust(): helper đó còn dùng cho bút toán
// `admin_adjust` hợp lệ khác (khởi tạo user, correction). Rào chặn đặt ở đúng
// biên HTTP mà admin gọi tới.
app.post('/api/admin/credits/adjust', requireAuth, requireAdmin, creditAdminRateLimit, async (req, res) => {
  try {
    const { user_id, amount, note } = req.body || {};
    const uid = parseInt(user_id, 10);
    if (!Number.isFinite(uid)) return res.status(400).json({ error: 'user_id không hợp lệ' });
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({
        error: 'Chỉ được nạp thêm điểm (giá trị > 0). Không thể sửa hay giảm số dư hiện có.',
        reason: 'topup_only'
      });
    }
    const r = await credits.adjust(uid, amount, {
      adminId: req.user.id, adminIp: adminIp(req), note
    });
    if (!r.ok) return res.status(400).json({ error: creditsReason(r.reason), reason: r.reason });
    res.json({ success: true, balance: r.balance });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Đối soát ledger vs số dư (admin) — dùng để kiểm tra toàn vẹn định kỳ.
app.get('/api/admin/credits/reconcile', requireAuth, requireAdmin, async (req, res) => {
  try { res.json(await credits.reconcile()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

function creditsReason(reason) {
  switch (reason) {
    case 'invalid_amount': return 'Số điểm không hợp lệ';
    case 'invalid_type': return 'Loại bút toán không hợp lệ';
    case 'user_not_found': return 'Không tìm thấy user';
    case 'insufficient': return 'Số dư không đủ để trừ';
    case 'note_required': return 'Bắt buộc nhập lý do (note)';
    default: return 'Thao tác thất bại';
  }
}

// Lookup endpoint (CSV)
app.post('/api/lookup', requireAuth, (req, res) => {
  const { mcc, mnc, lac, cellid } = req.body;
  if (!mcc || !mnc || !lac || !cellid) {
    return res.status(400).json({ error: 'mcc, mnc, lac, cellid are required' });
  }

  db.get('SELECT * FROM cells WHERE mcc = ? AND mnc = ? AND lac = ? AND cellid = ?',
    [mcc, mnc, lac, cellid], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ found: !!row, data: row || null });
  });
});

// Gate ghi kết quả nguồn ONLINE vào bảng `cells`.
//
// Ba luật (chống tái nhiễm cho lỗi tra cứu trả toạ độ sai ngoài VN):
//   1. KHÔNG bao giờ đè row source='csv' — CSV là hàng gốc tin cậy; nguồn online
//      từng ghi đè và xoá mất row CSV gốc (INSERT OR REPLACE theo unique index).
//   2. KHÔNG ghi khi row cùng khoá đã tồn tại với RAT khác `storeRadio` — dấu
//      hiệu cellid ngắn trúng nhầm ô cùng tên ở RAT khác.
//   3. Ghi thì luôn điền `user_id` (trước đây NULL 100%) và log lookup_history.
//
// Trả { written: bool, reason: string|null }. Không throw — caller vẫn trả kết
// quả cho user dù không ghi được vào DB.
function storeOnlineCell({ mcc, mnc, lac, cellid, lat, lng, range, description, source, radio, userId }) {
  return new Promise((resolve) => {
    db.get('SELECT id, source, radio FROM cells WHERE mcc = ? AND mnc = ? AND lac = ? AND cellid = ?',
      [mcc, mnc, lac, cellid], (err, existing) => {
        if (err) return resolve({ written: false, reason: 'db-error:' + err.message });
        if (existing && existing.source === 'csv') {
          console.warn(`store gate: giữ row csv ${mcc}-${mnc}-${lac}-${cellid}, không ghi từ ${source}`);
          return resolve({ written: false, reason: 'csv-protected' });
        }
        const norm = normalizeRadio(radio);
        if (existing && normalizeRadio(existing.radio) && norm && normalizeRadio(existing.radio) !== norm) {
          console.warn(`store gate: bỏ ghi ${source} ${mcc}-${mnc}-${lac}-${cellid} — RAT lệch (DB=${existing.radio}, nguồn=${norm})`);
          return resolve({ written: false, reason: 'rat-mismatch' });
        }
        db.run(`INSERT OR REPLACE INTO cells
            (mcc, mnc, lac, cellid, lat, lng, range, description, source, radio, user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [mcc, mnc, lac, cellid, lat, lng, range, description || '', source, norm, userId == null ? null : userId],
          (e) => resolve(e ? { written: false, reason: 'insert-error:' + e.message } : { written: true, reason: null }));
      });
  });
}

// Settings helpers (generic key/value; admin-configurable)
function getSetting(key, dflt) {
  return new Promise((resolve) => {
    db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
      resolve(err || !row || row.value === null || row.value === undefined ? dflt : row.value);
    });
  });
}

function setSetting(key, value) {
  return new Promise((resolve) => {
    db.run(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      [key, value == null ? '' : String(value)], () => resolve());
  });
}

// Write lookup audit rows (fire-and-forget). items: [{ mcc, mnc, lac, cellid, sector,
// lat, lng, range, source, found, radio }]. mode: 'single' | 'batch'.
// fileName: tên file Excel nguồn (chỉ dùng cho mode 'batch').
function logLookups(userId, mode, batchId, items, fileName) {
  if (!items || items.length === 0) return;
  const ph = items.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
  const flat = [];
  for (const it of items) {
    flat.push(
      userId == null ? null : userId, mode,
      it.mcc == null ? '' : String(it.mcc),
      it.mnc == null ? '' : String(it.mnc),
      it.lac == null ? '' : String(it.lac),
      it.cellid == null ? '' : String(it.cellid),
      it.sector == null ? '' : String(it.sector),
      it.lat == null ? null : it.lat,
      it.lng == null ? null : it.lng,
      it.range == null ? null : it.range,
      it.source == null ? '' : String(it.source),
      it.found ? 1 : 0,
      batchId || null,
      normalizeRadio(it.radio) || inferRadio(it.cellid, it.sector, it.radio),
    );
  }
  db.run(`INSERT INTO lookup_history
    (user_id, mode, mcc, mnc, lac, cellid, sector, lat, lng, range, source, found, batch_id, radio)
    VALUES ${ph}`, flat, () => {});

  // Metadata nhóm batch: cộng dồn để nhiều vòng resolve của CÙNG một lần upload
  // gộp về đúng 1 nhóm (uploadId dùng chung giữa các vòng).
  if (!batchId) return;
  const found = items.reduce((n, it) => n + (it.found ? 1 : 0), 0);
  db.run(`INSERT INTO lookup_batches (batch_id, user_id, file_name, mode, cell_count, found_count)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(batch_id) DO UPDATE SET
            cell_count = cell_count + excluded.cell_count,
            found_count = found_count + excluded.found_count,
            file_name = COALESCE(excluded.file_name, file_name)`,
    [batchId, userId, fileName == null ? null : String(fileName), mode, items.length, found], () => {});
}

// GET /api/lookup-history - current user's lookup history (paged, filter by mode + date)
// Một lần upload file = 1 dòng (nhóm theo batch_id), không lặp N dòng cell.
app.get('/api/lookup-history', requireAuth, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;
  const mode = (req.query.mode === 'single' || req.query.mode === 'batch') ? req.query.mode : '';
  // Lọc theo 1 ngày (giờ VN, UTC+7) — created_at lưu UTC nên cộng bù trước khi so.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : '';

  // UNION: dòng tra đơn lẻ + 1 dòng đại diện cho mỗi lần upload hàng loạt.
  const union = `
    SELECT h.id, 'single' AS mode, h.mcc, h.mnc, h.lac, h.cellid, h.sector, h.lat, h.lng,
           h.range, h.source, h.found, NULL AS batch_id, 1 AS cell_count,
           CASE WHEN h.found = 1 THEN 1 ELSE 0 END AS found_count, NULL AS file_name,
           h.radio, h.created_at, h.created_at AS sort_at
    FROM lookup_history h
    WHERE h.user_id = ? AND h.mode = 'single'
    UNION ALL
    SELECT h.id, 'batch' AS mode, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
           NULL, NULL, 0, b.batch_id, b.cell_count, b.found_count, b.file_name,
           h.radio, b.created_at, b.created_at AS sort_at
    FROM lookup_batches b
    JOIN lookup_history h ON h.id = (
      SELECT MAX(id) FROM lookup_history WHERE batch_id = b.batch_id AND user_id = b.user_id
    )
    WHERE b.user_id = ?`;

  // Điều kiện động: mode + ngày (VDN UTC+7).
  const conds = [];
  const params = [req.user.id, req.user.id];
  if (mode) { conds.push('t.mode = ?'); params.push(mode); }
  if (date) { conds.push("date(t.sort_at, '+7 hours') = date(?)"); params.push(date); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

  db.get(`SELECT COUNT(*) AS total FROM (${union}) t ${where}`, params, (err, cnt) => {
    if (err) return res.status(500).json({ error: err.message });
    db.all(`SELECT * FROM (${union}) t ${where}
            ORDER BY t.sort_at DESC, t.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset], (err2, rows) => {
      if (err2) return res.status(500).json({ error: err2.message });
      const total = cnt ? cnt.total : 0;
      res.json({ data: rows, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
    });
  });
});

// GET /api/lookup-history/batch/:batchId - all rows of one batch (owner only)
app.get('/api/lookup-history/batch/:batchId', requireAuth, (req, res) => {
  db.all('SELECT * FROM lookup_history WHERE user_id = ? AND batch_id = ? ORDER BY id ASC',
    [req.user.id, req.params.batchId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// DELETE /api/lookup-history - delete all of current user's history
app.delete('/api/lookup-history', requireAuth, (req, res) => {
  db.run('DELETE FROM lookup_history WHERE user_id = ?', [req.user.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, deleted: this.changes });
  });
});
// ========================
// Map annotations (per user)
// ========================
// GET /api/annotations - all annotations of current user (geojson parsed)
app.get('/api/annotations', requireAuth, (req, res) => {
  db.all('SELECT * FROM annotations WHERE user_id = ? ORDER BY id ASC', [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const out = (rows || []).map((r) => {
      let geojson = null;
      try { geojson = typeof r.geojson === 'string' ? JSON.parse(r.geojson) : r.geojson; } catch (e) { geojson = null; }
      return { id: r.id, type: r.type, label: r.label, geojson, distance: r.distance || 0, created_at: r.created_at };
    });
    res.json(out);
  });
});

// POST /api/annotations - save one annotation
app.post('/api/annotations', requireAuth, (req, res) => {
  const { type, geojson, label, distance } = req.body || {};
  if (!geojson || typeof geojson !== 'object') return res.status(400).json({ error: 'geojson object required' });
  const dist = Number.isFinite(parseFloat(distance)) ? parseFloat(distance) : 0;
  db.run(
    'INSERT INTO annotations (user_id, type, label, geojson, distance) VALUES (?, ?, ?, ?, ?)',
    [req.user.id, String(type || 'shape'), String(label || type || 'shape'), JSON.stringify(geojson), dist],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// DELETE /api/annotations/:id - delete one annotation (owner only)
app.delete('/api/annotations/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM annotations WHERE user_id = ? AND id = ?', [req.user.id, req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, deleted: this.changes });
  });
});



// DELETE /api/lookup-history/batch/:batchId - delete one batch (owner only)
app.delete('/api/lookup-history/batch/:batchId', requireAuth, (req, res) => {
  db.run('DELETE FROM lookup_history WHERE user_id = ? AND batch_id = ?', [req.user.id, req.params.batchId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.run('DELETE FROM lookup_batches WHERE user_id = ? AND batch_id = ?', [req.user.id, req.params.batchId], () => {});
    res.json({ success: true, deleted: this.changes });
  });
});

// POST /api/lookup-history/delete - delete selected ids (owner only)
// id của dòng hàng loạt = row đại diện → xoá cả nhóm (mọi row cùng batch_id).
app.post('/api/lookup-history/delete', requireAuth, (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
  const nums = ids.map((n) => parseInt(n, 10)).filter((n) => Number.isFinite(n));
  if (nums.length === 0) return res.status(400).json({ error: 'no valid ids' });
  const ph = nums.map(() => '?').join(', ');
  db.all(`SELECT DISTINCT batch_id FROM lookup_history
          WHERE user_id = ? AND id IN (${ph}) AND batch_id IS NOT NULL AND batch_id <> ''`,
    [req.user.id, ...nums], (err, brows) => {
      if (err) return res.status(500).json({ error: err.message });
      const batchIds = (brows || []).map((b) => b.batch_id);
      const bph = batchIds.map(() => '?').join(', ');
      const batchWhere = batchIds.length ? ` OR batch_id IN (${bph})` : '';
      db.run(`DELETE FROM lookup_history WHERE user_id = ? AND (id IN (${ph})${batchWhere})`,
        [req.user.id, ...nums, ...batchIds], function(delErr) {
          if (delErr) return res.status(500).json({ error: delErr.message });
          if (batchIds.length) {
            db.run(`DELETE FROM lookup_batches WHERE user_id = ? AND batch_id IN (${bph})`,
              [req.user.id, ...batchIds], () => {});
          }
          res.json({ success: true, deleted: this.changes });
        });
    });
});

// DELETE /api/lookup-history/:id - delete a single entry (owner only)
app.delete('/api/lookup-history/:id', requireAuth, (req, res) => {
  db.get('SELECT mode, batch_id FROM lookup_history WHERE user_id = ? AND id = ?',
    [req.user.id, req.params.id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (row && row.mode === 'batch' && row.batch_id) {
        db.run('DELETE FROM lookup_history WHERE user_id = ? AND batch_id = ?', [req.user.id, row.batch_id], function(delErr) {
          if (delErr) return res.status(500).json({ error: delErr.message });
          db.run('DELETE FROM lookup_batches WHERE user_id = ? AND batch_id = ?', [req.user.id, row.batch_id], () => {});
          res.json({ success: true, deleted: this.changes });
        });
        return;
      }
      db.run('DELETE FROM lookup_history WHERE user_id = ? AND id = ?', [req.user.id, req.params.id], function(delErr) {
        if (delErr) return res.status(500).json({ error: delErr.message });
        res.json({ success: true, deleted: this.changes });
      });
    });
});

// ========================
// Admin: User Management
// ========================
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

// IP của admin gọi request — ghi vào ledger để truy vết thao tác tiền.
function adminIp(req) {
  const fwd = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.socket?.remoteAddress || '';
}

/**
 * Cấp điểm cho user vừa tạo.
 *
 * User mới CHỈ nhận điểm thưởng đăng ký (`credit_signup_bonus`). Không nhận điểm
 * khởi tạo tuỳ ý nữa: số dư chỉ được tăng qua nút "Nạp điểm", và mọi thay đổi
 * đều có bút toán riêng trong ledger. Nhờ vậy không tồn tại đường nào ghi đè
 * số dư ngay lúc tạo tài khoản.
 * @returns {Promise<number>} số dư sau khi cấp bonus
 */
async function applyUserInitialCredit(userId, req) {
  try {
    await credits.grantSignupBonus(userId, { adminId: req.user ? req.user.id : null });
    return await credits.getBalance(userId);
  } catch (e) {
    console.error('initial credit failed:', e.message);
    return credits.getBalance(userId).catch(() => 0);
  }
}

app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
  db.all('SELECT id, username, role, status, created_at, credit_balance FROM users ORDER BY created_at DESC', (err, users) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json((users || []).map(u => ({ ...u, credit_balance: Number(u.credit_balance) || 0 })));
  });
});

app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  // Không nhận `credit` từ client: điểm của user mới chỉ đến từ bonus đăng ký.
  const { username, password, role, status } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).json({ error: err.message });
    db.run('INSERT INTO users (username, password, role, status) VALUES (?, ?, ?, ?)',
      [username, hash, role || 'user', status || 'active'], async function(err) {
      if (err) return res.status(500).json({ error: err.message });
      const userId = this.lastID;
      const balance = await applyUserInitialCredit(userId, req);
      res.json({ success: true, id: userId, credit_balance: balance });
    });
  });
});

app.put('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  const { username, password, role, status } = req.body;
  const fields = [];
  const values = [];
  if (username !== undefined) { fields.push('username = ?'); values.push(username); }
  if (role !== undefined) { fields.push('role = ?'); values.push(role); }
  if (status !== undefined) { fields.push('status = ?'); values.push(status); }
  if (fields.length === 0 && !password) return res.status(400).json({ error: 'Nothing to update' });

  const runUpdate = (hash) => {
    if (hash) { fields.push('password = ?'); values.push(hash); }
    values.push(req.params.id);
    db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values, function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, changes: this.changes });
    });
  };

  if (password) {
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) return res.status(500).json({ error: err.message });
      runUpdate(hash);
    });
  } else {
    runUpdate(null);
  }
});

app.delete('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  db.run('DELETE FROM users WHERE id = ? AND role != ?', [req.params.id, 'admin'], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, deleted: this.changes });
  });
});

// ========================
// Admin: Cell ID Database
// ========================
// GET /api/cells — cell do user hiện tại tải lên (Cells đã tải trong "Dữ liệu của tôi").
// Trả mảng phẳng (không phân trang) để khớp `loadMyCells()` ở public/app.js.
app.get('/api/cells', requireAuth, (req, res) => {
  const limit = Math.min(2000, Math.max(1, parseInt(req.query.limit) || 200));
  db.all(
    `SELECT id, mcc, mnc, lac, cellid, lat, lng, range, radio, description, source, created_at
     FROM cells WHERE user_id = ? ORDER BY id DESC LIMIT ?`,
    [req.user.id, limit],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.get('/api/cells/stats', (req, res) => {
  db.get('SELECT COUNT(*) as count FROM cells', [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ count: row.count });
  });
});

app.get('/api/cells/search', (req, res) => {
  const { q, mcc, mnc, lac, cellid } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  let where = 'WHERE 1=1';
  const params = [];
  if (q) {
    where += ' AND (cellid LIKE ? OR mcc LIKE ? OR mnc LIKE ? OR lac LIKE ? OR description LIKE ?)';
    const like = '%' + q + '%';
    params.push(like, like, like, like, like);
  }
  if (mcc) { where += ' AND mcc = ?'; params.push(mcc); }
  if (mnc) { where += ' AND mnc = ?'; params.push(mnc); }
  if (lac) { where += ' AND lac = ?'; params.push(lac); }
  if (cellid) { where += ' AND cellid = ?'; params.push(cellid); }

  db.get(`SELECT COUNT(*) as total FROM cells ${where}`, params, (err, cnt) => {
    if (err) return res.status(500).json({ error: err.message });
    const total = cnt.total;
    db.all(`SELECT id, mcc, mnc, lac, cellid, lat, lng AS lon, range, description FROM cells ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ data: rows, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
    });
  });
});

// GET /api/cells/all — tất cả cell có tọa độ (dùng cho layer bản đồ, giới hạn 20000 cell để tránh treo browser)
app.get('/api/cells/all', (req, res) => {
  const sql = 'SELECT mcc, mnc, lac, cellid, lat, lng AS lon, range, radio, description FROM cells WHERE lat IS NOT NULL AND lng IS NOT NULL ORDER BY id DESC LIMIT 20000';
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: rows, total: rows.length });
  });
});

// POST /api/admin/cells/clear — xóa toàn bộ cell ID (admin only, tạm để upload bộ cell mới)
app.post('/api/admin/cells/clear', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { confirm } = req.body || {};
  if (!confirm) return res.status(400).json({ error: 'Missing confirm = true' });
  if (confirm !== true) return res.status(400).json({ error: 'Invalid confirm' });
  db.get('SELECT COUNT(*) AS c FROM cells', [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    const total = row ? row.c : 0;
    db.run('DELETE FROM cells', [], function(delErr) {
      if (delErr) return res.status(500).json({ error: delErr.message });
      res.json({ success: true, deleted: total, message: 'Tất cả cell đã được xóa' });
    });
  });
});

// ============================================================================
// Admin: quản lý trực tiếp bảng `cells` (tra cứu, sửa, xóa) + lịch sử audit.
// Mọi thao tác GHI đều vào `cells_audit` để dựng lại được trạng thái cũ.
// ============================================================================
const CELL_EDITABLE = ['mcc', 'mnc', 'lac', 'cellid', 'lat', 'lng', 'range', 'radio', 'description', 'source', 'address', 'city'];

// Ghi 1 bản ghi audit (fire-and-forget, không chặn response).
function writeCellAudit(req, cellId, action, oldRow, newRow, note) {
  db.run(`INSERT INTO cells_audit (cell_id, action, old_json, new_json, user_id, username, ip, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [cellId, action,
      oldRow ? JSON.stringify(oldRow) : null,
      newRow ? JSON.stringify(newRow) : null,
      req.user ? req.user.id : null,
      req.user ? req.user.username : null,
      req.ip || null,
      note || null], () => {});
}

// GET /api/admin/cells/list — phân trang + lọc toàn diện
app.get('/api/admin/cells/list', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;
  const { q, mcc, mnc, lac, cellid, source, radio, user_id, from_date, to_date } = req.query;

  let where = 'WHERE 1=1';
  const params = [];
  if (q) {
    where += ' AND (cellid LIKE ? OR mcc LIKE ? OR mnc LIKE ? OR lac LIKE ? OR description LIKE ? OR address LIKE ? OR city LIKE ?)';
    const like = '%' + q + '%';
    params.push(like, like, like, like, like, like, like);
  }
  if (mcc) { where += ' AND mcc = ?'; params.push(mcc); }
  if (mnc) { where += ' AND mnc = ?'; params.push(mnc); }
  if (lac) { where += ' AND lac = ?'; params.push(lac); }
  if (cellid) { where += ' AND cellid = ?'; params.push(cellid); }
  if (source) { where += ' AND source = ?'; params.push(source); }
  if (radio) { where += ' AND radio = ?'; params.push(radio); }
  if (user_id) { where += ' AND user_id = ?'; params.push(parseInt(user_id, 10)); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(from_date || '')) { where += ' AND date(created_at) >= date(?)'; params.push(from_date); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(to_date || '')) { where += ' AND date(created_at) <= date(?)'; params.push(to_date); }

  db.get(`SELECT COUNT(*) AS total FROM cells ${where}`, params, (err, cnt) => {
    if (err) return res.status(500).json({ error: err.message });
    const total = cnt.total;
    db.all(`SELECT * FROM cells ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset], (err2, rows) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ data: rows, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
    });
  });
});

// GET /api/admin/cells/meta — giá trị distinct cho dropdown filter
app.get('/api/admin/cells/meta', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  db.all(`SELECT source, COUNT(*) AS n FROM cells GROUP BY source ORDER BY n DESC`, [], (err, sources) => {
    if (err) return res.status(500).json({ error: err.message });
    db.all(`SELECT radio, COUNT(*) AS n FROM cells GROUP BY radio ORDER BY n DESC`, [], (err2, radios) => {
      if (err2) return res.status(500).json({ error: err2.message });
      db.all(`SELECT u.id, u.username, COUNT(c.id) AS n FROM users u LEFT JOIN cells c ON c.user_id = u.id GROUP BY u.id, u.username ORDER BY n DESC`, [], (err3, users) => {
        if (err3) return res.status(500).json({ error: err3.message });
        res.json({ sources: sources || [], radios: radios || [], users: users || [] });
      });
    });
  });
});

// GET /api/admin/cells/audit — lịch sử sửa/xóa toàn cục
app.get('/api/admin/cells/audit', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;
  const { cell_id, action, username, from_date, to_date } = req.query;
  let where = 'WHERE 1=1';
  const params = [];
  if (cell_id) { where += ' AND cell_id = ?'; params.push(parseInt(cell_id, 10)); }
  if (action) { where += ' AND action = ?'; params.push(action); }
  if (username) { where += ' AND username LIKE ?'; params.push('%' + username + '%'); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(from_date || '')) { where += ' AND date(created_at) >= date(?)'; params.push(from_date); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(to_date || '')) { where += ' AND date(created_at) <= date(?)'; params.push(to_date); }
  db.get(`SELECT COUNT(*) AS total FROM cells_audit ${where}`, params, (err, cnt) => {
    if (err) return res.status(500).json({ error: err.message });
    db.all(`SELECT * FROM cells_audit ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset], (err2, rows) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ data: rows, total: cnt.total, page, limit, totalPages: Math.max(1, Math.ceil(cnt.total / limit)) });
    });
  });
});

// GET /api/admin/cells/:id — chi tiết 1 row + lịch sử audit của nó
app.get('/api/admin/cells/:id', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id không hợp lệ' });
  db.get('SELECT * FROM cells WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Không tìm thấy cell' });
    db.all('SELECT * FROM cells_audit WHERE cell_id = ? ORDER BY id DESC LIMIT 50', [id], (err2, audit) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ data: row, audit: audit || [] });
    });
  });
});

// PUT /api/admin/cells/:id — sửa toàn bộ trường, validate trước khi ghi
app.put('/api/admin/cells/:id', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id không hợp lệ' });
  const body = req.body || {};

  // Chỉ nhận các trường cho phép sửa; bỏ qua field lạ để tránh mass-assignment.
  const patch = {};
  for (const k of CELL_EDITABLE) if (Object.prototype.hasOwnProperty.call(body, k)) patch[k] = body[k];

  db.get('SELECT * FROM cells WHERE id = ?', [id], (err, oldRow) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldRow) return res.status(404).json({ error: 'Không tìm thấy cell' });

    // ---- Validate ----
    const warnings = [];
    const next = { ...oldRow, ...patch };

    for (const k of ['mcc', 'mnc', 'lac', 'cellid']) {
      if (patch[k] !== undefined) {
        const v = String(patch[k] == null ? '' : patch[k]).trim();
        if (!v) return res.status(400).json({ error: `Trường ${k} không được để trống` });
        patch[k] = v; next[k] = v;
      }
    }
    if (patch.lat !== undefined || patch.lng !== undefined) {
      const lat = Number(next.lat), lng = Number(next.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({ error: 'lat/lng phải là số hữu hạn' });
      }
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return res.status(400).json({ error: `Toạ độ ngoài phạm vi trái đất (${lat}, ${lng})` });
      }
      if (next.mcc === '452' && !isPlausibleLatLng(lat, lng, '452')) {
        return res.status(400).json({ error: `Toạ độ (${lat}, ${lng}) nằm ngoài khung Việt Nam cho mcc 452` });
      }
      if (oldRow.source === 'csv') warnings.push('Row này có source=csv (CSDL gốc) — hãy chắc chắn toạ độ mới đúng.');
      patch.lat = lat; patch.lng = lng;
    }
    if (patch.radio !== undefined) {
      const r = normalizeRadio(patch.radio);
      if (patch.radio && !r) {
        return res.status(400).json({ error: `Radio không hợp lệ: ${patch.radio}. Cho phép: GSM, UMTS, LTE, NR.` });
      }
      patch.radio = r || '';
    }
    if (patch.range !== undefined) {
      const rg = patch.range === '' || patch.range == null ? 0 : Number(patch.range);
      if (!Number.isFinite(rg) || rg < 0) return res.status(400).json({ error: 'range phải là số >= 0' });
      patch.range = rg;
    }
    applyCellUpdate(req, res, id, oldRow, patch, next, warnings, body.note);
  });
});

// Thực thi UPDATE sau khi đã validate. Nếu đổi khoá (mcc/mnc/lac/cellid), kiểm
// tra khoá mới có bị row khác chiếm không (unique index) trước khi ghi.
function applyCellUpdate(req, res, id, oldRow, patch, next, warnings, note) {
  const keyChanged = ['mcc', 'mnc', 'lac', 'cellid'].some(k => patch[k] !== undefined && String(patch[k]) !== String(oldRow[k]));

  const doUpdate = () => {
    const sets = [];
    const vals = [];
    for (const k of CELL_EDITABLE) {
      if (patch[k] !== undefined) { sets.push(`${k} = ?`); vals.push(patch[k]); }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'Không có trường nào để cập nhật' });
    vals.push(id);
    db.run(`UPDATE cells SET ${sets.join(', ')} WHERE id = ?`, vals, function (e) {
      if (e) return res.status(500).json({ error: e.message });
      const changes = this.changes;
      db.get('SELECT * FROM cells WHERE id = ?', [id], (e2, newRow) => {
        writeCellAudit(req, id, 'update', oldRow, newRow, note || null);
        res.json({ success: true, changes, data: newRow, warnings });
      });
    });
  };

  if (!keyChanged) return doUpdate();
  db.get('SELECT id, mcc, mnc, lac, cellid, lat, lng, source FROM cells WHERE mcc = ? AND mnc = ? AND lac = ? AND cellid = ? AND id <> ?',
    [next.mcc, next.mnc, next.lac, next.cellid, id], (e, conflict) => {
      if (e) return res.status(500).json({ error: e.message });
      if (conflict) return res.status(409).json({
        error: `Khoá ${next.mcc}-${next.mnc}-${next.lac}-${next.cellid} đã bị row id=${conflict.id} chiếm`,
        conflict,
      });
      doUpdate();
    });
}

// DELETE /api/admin/cells/:id — xóa 1 row
app.delete('/api/admin/cells/:id', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id không hợp lệ' });
  db.get('SELECT * FROM cells WHERE id = ?', [id], (err, oldRow) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldRow) return res.status(404).json({ error: 'Không tìm thấy cell' });
    db.run('DELETE FROM cells WHERE id = ?', [id], function (e2) {
      if (e2) return res.status(500).json({ error: e2.message });
      writeCellAudit(req, id, 'delete', oldRow, null, (req.body && req.body.note) || null);
      res.json({ success: true, deleted: this.changes, data: oldRow });
    });
  });
});

// POST /api/admin/cells/bulk-delete — xóa nhiều row, 1 bản ghi audit mỗi row
app.post('/api/admin/cells/bulk-delete', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids.map(n => parseInt(n, 10)).filter(Number.isFinite) : [];
  if (ids.length === 0) return res.status(400).json({ error: 'ids array required' });
  if (ids.length > 1000) return res.status(400).json({ error: 'Tối đa 1000 id mỗi lần' });
  const ph = ids.map(() => '?').join(',');
  db.all(`SELECT * FROM cells WHERE id IN (${ph})`, ids, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    db.run(`DELETE FROM cells WHERE id IN (${ph})`, ids, function (e2) {
      if (e2) return res.status(500).json({ error: e2.message });
      const note = (req.body && req.body.note) || null;
      for (const r of rows) writeCellAudit(req, r.id, 'bulk-delete', r, null, note);
      res.json({ success: true, deleted: this.changes, requested: ids.length });
    });
  });
});

// Cell resolve online — local first (always #1), then online sources by priority ASC
// Trừ điểm: mỗi request tra cứu RA KẾT QUẢ (local hoặc online) = `credit_cost_per_lookup`
// điểm. Miss (404) không trừ. Yêu cầu đăng nhập để quy được điểm về user.
app.get('/api/cells/resolve', requireAuth, (req, res) => {
  const { mcc, mnc, lac, cellid, sector } = req.query;
  if (!mcc || !mnc || !lac || !cellid) return res.status(400).json({ error: 'mcc, mnc, lac, cellid required' });
  const userId = req.user ? req.user.id : null;
  // ref chống trùng theo lần tra: cùng (user, cell, giây) không trừ 2 lần khi retry.
  const chargeRef = `single:${userId}:${mcc}-${mnc}-${lac}-${cellid}`;
  const logOne = (found, source, lat, lng, range, radio) => logLookups(userId, 'single', null,
    [{ mcc, mnc, lac, cellid, sector, lat, lng, range, source, found, radio }]);
  const lookupLocal = () => probeCellRow({ mcc, mnc, lac, cellid, sector });
  lookupLocal().then(async (row) => {
    if (row && row.lat) {
      logOne(true, 'local', row.lat, row.lng, row.range, row.radio);
      const charge = await credits.chargeLookup(userId, 1, chargeRef, 'Tra cứu 1 cell (CSDL nội bộ)');
      if (!charge.ok) return res.status(402).json({ error: 'Không đủ điểm', balance: charge.balance, required: await credits.getCost(), reason: charge.reason });
      return res.json({ source: 'local', credit: { balance: charge.balance, charged: charge.skipped ? 0 : 1 }, data: { ...row, lon: row.lng, radio: normalizeRadio(row.radio) || inferRadio(cellid, sector, row.radio) } });
    }

    // Build candidate cellid list — ECI form first, then raw. The local row (if
    // any) supplies the RAT so the raw short id is not mistaken for GSM.
    const candidates = cellId.cellIdCandidates(cellid, sector);

    // Online fallback — iterate enabled sources sorted by priority
    const onlineSources = await getEnabledOnlineSources();
    for (const src of onlineSources) {
      try {
        let data = null;
        if (src.type === 'opencellid') {
          const apiKey = await getOpenCellIDKey();
          if (!apiKey) continue;
          for (const candidateId of candidates) {
            try { data = await resolveOpenCellID({ mcc, mnc, lac, cellid: candidateId }, apiKey); break; }
            catch (e) { /* try next candidate */ }
          }
        } else if (src.type === 'opencellid_web') {
          data = await resolveOpenCellIDWeb({ mcc, mnc, lac, cellid, radio: row ? row.radio : '' }, sector);
        } else if (src.type === 't0stbrot') {
          data = await resolveT0stbrot({ mcc, mnc, lac, cellid, sector });
        } else if (src.type === 'combain') {
          data = await resolveCombain({ mcc, mnc, lac, cellid, sector });
        }
        if (data && data.lat != null) {
          if (!isPlausibleLatLng(data.lat, data.lon, mcc)) {
            console.warn(`geo gate: bỏ toạ độ không hợp lệ từ ${src.type} (${mcc}-${mnc}-${lac}-${cellid} → ${data.lat},${data.lon})`);
            continue;
          }
          const storeCellid = data.cellid || cellid;
          const storeRadio = normalizeRadio(data.radio) || inferRadio(cellid, sector, row ? row.radio : '');
          const store = await storeOnlineCell({
            mcc, mnc, lac, cellid: storeCellid,
            lat: data.lat, lng: data.lon, range: data.range, description: data.description,
            source: src.type, radio: storeRadio, userId,
          });
          if (!store.written && store.reason && store.reason !== 'csv-protected') {
            console.warn(`store gate: không ghi ${src.type} ${mcc}-${mnc}-${lac}-${cellid} (${store.reason})`);
          }
          data.radio = storeRadio;
          logOne(true, src.type, data.lat, data.lon, data.range, storeRadio);
          const charge = await credits.chargeLookup(userId, 1, chargeRef,
            `Tra cứu 1 cell (${ONLINE_SOURCE_DEFAULTS[src.type]?.name || src.type})`);
          if (!charge.ok) return res.status(402).json({ error: 'Không đủ điểm', balance: charge.balance, required: await credits.getCost(), reason: charge.reason });
          return res.json({ source: src.type, credit: { balance: charge.balance, charged: charge.skipped ? 0 : 1 }, data });
        }
      } catch (e) { /* fall through to next source */ }
    }
    logOne(false, null, null, null, null);
    const names = ['CSDL nội bộ', ...onlineSources.map(s => ONLINE_SOURCE_DEFAULTS[s.type]?.name || s.type)];
    res.status(404).json({ error: 'Không tìm thấy cell trong ' + names.join(', ') + '.' });
  }).catch((e) => res.status(500).json({ error: e.message }));
});

// Batch resolve for call logs — local first, then online sources by priority
app.post('/api/cells/resolve-batch', requireAuth, async (req, res) => {
  const { cells, uploadId, fileName } = req.body;
  if (!Array.isArray(cells) || cells.length === 0) return res.status(400).json({ error: 'cells array required' });

  // uploadId do client sinh 1 lần cho cả file → mọi vòng resolve của cùng 1 lần
  // upload gộp về chung 1 nhóm trong lịch sử.
  const batchId = (typeof uploadId === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(uploadId))
    ? uploadId : require('crypto').randomUUID();
  const userId = req.user ? req.user.id : null;
  const onlineSources = await getEnabledOnlineSources();
  const results = [];
  const MAX_ONLINE = parseInt(await getSetting('max_online_resolve', '50'), 10);
  const maxOnline = Number.isFinite(MAX_ONLINE) && MAX_ONLINE > 0 ? MAX_ONLINE : 0;
  let onlineCount = 0;
  let webCalls = 0;   // số cell đã tra qua nguồn opencellid_web trong lần chạy này

  // Pre-check điểm: nếu không đủ cho ngân sách online của lô này thì chặn NGAY,
  // tránh đốt quota các nguồn online rồi mới phát hiện user hết điểm.
  const creditOn = await credits.isEnabled();
  const creditCost = await credits.getCost();
  if (creditOn && creditCost > 0) {
    const bal = await credits.getBalance(userId);
    if (bal !== null && bal < creditCost) {
      return res.status(402).json({
        error: 'Không đủ điểm', balance: bal, required: creditCost,
        reason: 'insufficient'
      });
    }
  }

  // Pre-fetch keys needed for the enabled source types
  const enabledTypes = new Set(onlineSources.map(s => s.type));
  const ocidKey = enabledTypes.has('opencellid') ? await getOpenCellIDKey() : '';

  // memo: alias key -> resolved result. Prevents duplicate online requests when the
  // same physical cell appears via different aliases (raw short vs ECI).
  const memo = new Map();
  const historyItems = [];

  // Phase 1: local pass (always first, no online budget consumed).
  for (const c of cells) {
    const key = `${c.mcc}-${c.mnc}-${c.lac}-${c.cellid}`;
    const canon = canonicalCellKey(c);
    const aliases = cellAliasKeys(c);

    let reused = null;
    for (const a of aliases) { if (memo.has(a)) { reused = memo.get(a); break; } }
    if (reused !== null) {
      results.push({ key, ...reused });
      historyItems.push({ ...c, lat: reused.lat, lng: reused.lon, range: reused.range, source: reused.source, found: !!reused.lat, radio: reused.radio || inferRadio(c.cellid, c.sector, c.radio) });
      continue;
    }

    const row = await probeCellRow({ mcc: c.mcc, mnc: c.mnc, lac: c.lac, cellid: c.cellid, sector: c.sector });
    if (row && row.lat) {
      const r = { source: 'local', lat: row.lat, lon: row.lng, range: row.range, radio: normalizeRadio(row.radio), description: row.description };
      for (const a of aliases) memo.set(a, r);
      memo.set(canon, r);
      results.push({ key, ...r });
      historyItems.push({ ...c, lat: row.lat, lng: row.lng, range: row.range, source: 'local', found: true, radio: normalizeRadio(row.radio) || inferRadio(c.cellid, c.sector, c.radio) });
    } else {
      results.push({ key, source: null, lat: null, lon: null, range: null, pending: true });
      historyItems.push({ ...c, lat: null, lng: null, range: null, source: null, found: false, radio: inferRadio(c.cellid, c.sector, c.radio) });
    }
  }

  // Phase 2: online pass (budget-limited). Only cells still unresolved.
  let hasMore = false;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const r = results[i];
    if (r.source) continue; // already resolved locally
    const canon = canonicalCellKey(c);
    const aliases = cellAliasKeys(c);

    let reused = null;
    for (const a of aliases) { if (memo.has(a)) { reused = memo.get(a); break; } }
    if (reused !== null) {
      results[i] = { key: r.key, ...reused };
      historyItems[i] = { ...c, lat: reused.lat, lng: reused.lon, range: reused.range, source: reused.source, found: !!reused.lat, radio: reused.radio || inferRadio(c.cellid, c.sector, c.radio) };
      continue;
    }

    if (onlineCount >= maxOnline) { hasMore = true; continue; }

    const candidatesB = cellId.cellIdCandidates(c.cellid, c.sector);

    let saved = null;
    let savedType = null;
    let wrongGeoType = null;
    for (const src of onlineSources) {
      if (saved) break;
      try {
        let data = null;
        if (src.type === 'opencellid') {
          if (!ocidKey) continue;
          for (const lookupId of candidatesB) {
            try { data = await resolveOpenCellID({ ...c, cellid: lookupId }, ocidKey); break; }
            catch (e) { /* try next candidate */ }
          }
        } else if (src.type === 'opencellid_web') {
          if (webCalls >= OCID_WEB_MAX_PER_BATCH) continue;
          if (webCalls > 0) await sleep(OCID_WEB_THROTTLE_MS);
          webCalls++;
          data = await resolveOpenCellIDWeb({ mcc: c.mcc, mnc: c.mnc, lac: c.lac, cellid: c.cellid, radio: c.radio }, c.sector);
        } else if (src.type === 't0stbrot') {
          data = await resolveT0stbrot({ mcc: c.mcc, mnc: c.mnc, lac: c.lac, cellid: c.cellid, sector: c.sector });
        } else if (src.type === 'combain') {
          data = await resolveCombain({ mcc: c.mcc, mnc: c.mnc, lac: c.lac, cellid: c.cellid, sector: c.sector });
        }
        if (data && data.lat != null) {
          // Geo gate: nguồn trả về toạ độ ngoài khung nước của MCC → coi như miss và
          // thử nguồn kế tiếp, KHÔNG ghi toạ độ rác vào bảng nội bộ.
          if (!isPlausibleLatLng(data.lat, data.lon, c.mcc)) {
            wrongGeoType = src.type;
            console.warn(`geo gate: bỏ toạ độ không hợp lệ từ ${src.type} (${c.mcc}-${c.mnc}-${c.lac}-${c.cellid} → ${data.lat},${data.lon})`);
            data = null;
          }
        }
        if (data && data.lat != null) {
          const storeCellid = data.cellid || c.cellid;
          const storeRadio = normalizeRadio(data.radio) || inferRadio(c.cellid, c.sector, c.radio);
          await storeOnlineCell({
            mcc: c.mcc, mnc: c.mnc, lac: c.lac, cellid: storeCellid,
            lat: data.lat, lng: data.lon, range: data.range, description: data.description,
            source: src.type, radio: storeRadio, userId,
          });
          data.radio = storeRadio;
          saved = data;
          savedType = src.type;
        }
      } catch (e) { /* not found, try next source */ }
    }

    if (saved) {
      onlineCount++;
      const r2 = { source: savedType, lat: saved.lat, lon: saved.lon, range: saved.range, radio: normalizeRadio(saved.radio), description: saved.description };
      for (const a of aliases) memo.set(a, r2);
      memo.set(canon, r2);
      results[i] = { key: r.key, ...r2 };
      historyItems[i] = { ...c, lat: saved.lat, lng: saved.lon, range: saved.range, source: savedType, found: true, radio: normalizeRadio(saved.radio) || inferRadio(c.cellid, c.sector, c.radio) };
    } else {
      // Chỉ cache "miss" khi thật sự đã hỏi hết nguồn. Nếu vượt ngân sách online thì
      // để nguyên pending cho vòng resolve kế tiếp.
      if (onlineCount >= maxOnline) { hasMore = true; continue; }
      const miss = { source: null, lat: null, lon: null, range: null };
      for (const a of aliases) memo.set(a, miss);
      memo.set(canon, miss);
      results[i] = { key: r.key, source: null, lat: null, lon: null, range: null, rejected: wrongGeoType ? 'geo-out-of-bounds' : undefined };
      historyItems[i] = { ...c, lat: null, lng: null, range: null, source: null, found: false, radio: inferRadio(c.cellid, c.sector, c.radio) };
    }
  }

  for (const r of results) delete r.pending;

  logLookups(userId, 'batch', batchId, historyItems, fileName);

  // Trừ điểm theo SỐ LẦN TRA RA KẾT QUẢ (không tính miss), 1 bút toán cho cả lô.
  // `ref = batchId` → retry cùng uploadId không bị trừ 2 lần.
  const foundCount = historyItems.filter(h => h.found).length;
  let creditInfo = null;
  if (creditOn && creditCost > 0 && foundCount > 0) {
    try {
      const charge = await credits.chargeLookup(userId, foundCount, batchId,
        `Tra cứu lô ${foundCount} cell (${fileName || 'upload'})`);
      creditInfo = { balance: charge.balance, charged: charge.ok ? foundCount : 0, cost: creditCost, insufficient: !charge.ok };
    } catch (e) {
      console.error('batch charge failed:', e.message);
    }
  } else if (creditOn && creditCost > 0) {
    creditInfo = { balance: await credits.getBalance(userId), charged: 0, cost: creditCost };
  }

  res.json({ results, onlineLookups: onlineCount, batchId, hasMore, pending: hasMore, credit: creditInfo });
});

// Canonical lookup key: collapse short-cellid / ECI aliases that point to the same
// physical cell (e.g. 662091 and 169495296) so client + server dedup agree.
function canonicalCellKey(c) {
  const raw = String(c.cellid == null ? '' : c.cellid);
  let cid = raw;
  try {
    const parsed = cellId.parseCellId(raw);
    if (parsed && parsed.isShort && parsed.eci != null && String(parsed.eci) !== raw) cid = String(parsed.eci);
  } catch (e) { /* keep raw */ }
  return `${c.mcc}-${c.mnc}-${c.lac}-${cid}`;
}

// All alias keys for a cell (raw + ECI form) for memo matching.
function cellAliasKeys(c) {
  const raw = String(c.cellid == null ? '' : c.cellid);
  const keys = new Set([`${c.mcc}-${c.mnc}-${c.lac}-${raw}`]);
  try {
    const parsed = cellId.parseCellId(raw);
    if (parsed && parsed.isShort && parsed.eci != null && String(parsed.eci) !== raw) {
      keys.add(`${c.mcc}-${c.mnc}-${c.lac}-${parsed.eci}`);
    }
  } catch (e) { /* keep raw key */ }
  return [...keys];
}

function getOpenCellIDKeyFromDB() {
  return new Promise((resolve) => {
    db.get("SELECT api_key FROM data_sources WHERE type = 'opencellid' AND enabled = 1 AND api_key IS NOT NULL AND api_key != '' ORDER BY id LIMIT 1",
      (err, row) => resolve(err || !row ? '' : row.api_key));
  });
}

async function getOpenCellIDKey() {
  const dbKey = await getOpenCellIDKeyFromDB();
  if (dbKey) return dbKey;
  return OPEN_CELLID_KEY || process.env.OPENCELLID_API_KEY || '';
}

// Online lookup sources that the admin can toggle on/off. Each maps to a
// data_sources row (by type); a source runs only while its row is enabled.
// OpenCellID additionally needs a key; t0stbrot needs none.
// opencellid_web dùng endpoint web nội bộ (không key) → seed ở trạng thái TẮT.
const ONLINE_SOURCE_TYPES = ['opencellid', 'opencellid_web', 't0stbrot', 'combain'];
const ONLINE_SOURCE_DEFAULTS = {
  opencellid: { name: 'OpenCellID.org', priority: 10 },
  opencellid_web: { name: 'OpenCellID.org (web)', priority: 15 },
  t0stbrot: { name: 't0stbrot.net', priority: 20 },
  combain: { name: 'Combain.com', priority: 30 }
};
// Nguồn seed sẵn nhưng mặc định tắt (admin phải tự bật) do rate limit chặt.
const ONLINE_SOURCE_DEFAULT_DISABLED = ['opencellid_web'];

// Seed the built-in online sources once, so admins see them in the UI.
function seedOnlineSources() {
  for (const type of ONLINE_SOURCE_TYPES) {
    const def = ONLINE_SOURCE_DEFAULTS[type];
    const enabled = ONLINE_SOURCE_DEFAULT_DISABLED.includes(type) ? 0 : 1;
    db.get('SELECT id FROM data_sources WHERE type = ? LIMIT 1', [type], (err, row) => {
      if (err || row) return;
      db.run('INSERT INTO data_sources (name, type, base_url, api_key, enabled, priority) VALUES (?, ?, ?, ?, ?, ?)',
        [def.name, type, '', '', enabled, def.priority], () => {});
    });
  }
  // Backfill priority for existing rows still at default 100
  for (const type of ONLINE_SOURCE_TYPES) {
    const def = ONLINE_SOURCE_DEFAULTS[type];
    db.run('UPDATE data_sources SET priority = ? WHERE type = ? AND priority = 100', [def.priority, type], () => {});
  }
}
seedOnlineSources();

// Enabled online source types, sorted by priority ASC then id ASC.
// Returns array of { type, priority } deduplicated by type (lowest priority wins).
function getEnabledOnlineSources() {
  return new Promise((resolve) => {
    db.all('SELECT type, priority FROM data_sources WHERE enabled = 1 ORDER BY priority ASC, id ASC', [], (err, rows) => {
      if (err || !rows) return resolve(ONLINE_SOURCE_TYPES.map((t, i) => ({ type: t, priority: (i + 1) * 10 })));
      const seen = new Set();
      const out = [];
      for (const r of rows) {
        if (!ONLINE_SOURCE_TYPES.includes(r.type)) continue;
        if (seen.has(r.type)) continue;
        seen.add(r.type);
        out.push({ type: r.type, priority: r.priority });
      }
      resolve(out);
    });
  });
}

async function resolveOpenCellID({ mcc, mnc, lac, cellid }, apiKey) {
  const key = apiKey || await getOpenCellIDKey();
  if (!key) throw new Error('OpenCellID API key not configured');
  const url = `https://opencellid.org/cell/get?key=${key}&mcc=${mcc}&mnc=${mnc}&lac=${lac}&cellid=${cellid}&format=json`;
  const resp = await axios.get(url, { timeout: 15000 });
  const d = resp.data;
  if (!d || !d.lat) throw new Error('Cell not found in OpenCellID');
  return { mcc, mnc, lac, cellid, lat: d.lat, lon: d.lon, range: d.range || 1000, radio: normalizeRadio(d.radio), description: d.address || `OpenCellID ${mcc}-${mnc}` };
}

// t0stbrot.net — free LTE cell lookup (3GPP ECI -> lat/lon). No API key.
// Docs: https://docs.t0stbrot.net/cells/info — GET /api/public/cells/info/lte?mcc&mnc&cid
// The endpoint indexes by ECI (Cell ID), so try the ECI form first, then raw.
async function resolveT0stbrot({ mcc, mnc, lac, cellid, sector }) {
  const cids = cellId.cellIdCandidates(cellid, sector);
  let lastErr = null;
  for (const cid of cids) {
    try {
      const url = `https://t0stbrot.net/api/public/cells/info/lte?mcc=${encodeURIComponent(mcc)}&mnc=${encodeURIComponent(mnc)}&cid=${encodeURIComponent(cid)}`;
      const resp = await axios.get(url, { timeout: 15000, headers: { 'User-Agent': 'cell-tracker/1.0' } });
      const d = resp.data;
      if (d && d.tower && d.tower.lat) {
        const cell = d.equipment && d.equipment.cell;
        return {
          mcc, mnc, lac, cellid: cid,
          lat: parseFloat(d.tower.lat), lon: parseFloat(d.tower.lon),
          range: 1000,
          radio: 'LTE',
          description: `t0stbrot LTE ${mcc}-${mnc}${cell ? ' c' + cell : ''}`
        };
      }
      lastErr = new Error('Tower not found in t0stbrot');
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('Cell not found in t0stbrot');
}

// Resolve a Combain key: prefer an enabled Combain source in DB, fall back to env.
function getCombainKeyFromDB() {
  return new Promise((resolve) => {
    db.get("SELECT api_key FROM data_sources WHERE type = 'combain' AND enabled = 1 AND api_key IS NOT NULL AND api_key != '' ORDER BY id LIMIT 1",
      (err, row) => resolve(err || !row ? '' : row.api_key));
  });
}

async function getCombainKey() {
  const dbKey = await getCombainKeyFromDB();
  if (dbKey) return dbKey;
  return process.env.COMBAIN_API_KEY || '';
}

// Combain Location API (CPS) — per-cell lookup. Needs an API key.
// Docs: https://portal.combain.com/api/ — POST https://apiv2.combain.com?key=KEY
// Body: { radioType, cellTowers: [{ mobileCountryCode, mobileNetworkCode, locationAreaCode, cellId }] }
// Response: { location: { lat, lng }, ... }. Errors: 400 invalid key, 403 out of credits, 404 not found.
async function resolveCombain({ mcc, mnc, lac, cellid, sector }, apiKey) {
  const key = apiKey || await getCombainKey();
  if (!key) throw new Error('Combain API key chưa cấu hình');

  // RAT lấy từ sector (nếu có) — KHÔNG suy từ độ dài cell id, vì id ngắn vừa có
  // thể là GSM Cell ID vừa có thể là LTE eNB ID. Không xác định được thì để Combain
  // tự dò ('gsm' chỉ là gợi ý cuối cùng).
  const radioHint = (sector !== undefined && sector !== null && String(sector).trim() !== '') ? 'LTE' : '';
  const radioType = (radioHint || inferRadio(cellid, sector)) === 'LTE' ? 'lte' : 'gsm';
  const sendCellId = parseInt(cellId.cellIdCandidates(cellid, sector)[0], 10);

  const body = {
    radioType,
    cellTowers: [{
      mobileCountryCode: parseInt(mcc, 10),
      mobileNetworkCode: parseInt(mnc, 10),
      locationAreaCode: parseInt(lac, 10),
      cellId: sendCellId
    }]
  };

  const resp = await axios.post(`https://apiv2.combain.com?key=${encodeURIComponent(key)}`, body, {
    timeout: 15000,
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'cell-tracker/1.0' },
    validateStatus: () => true
  });
  const d = resp.data || {};
  if (d.error) {
    const code = d.error.code || resp.status;
    const msg = d.error.message || 'Combain error';
    throw new Error(code === 403 ? `Combain: hết credits (${msg})` : `Combain: ${msg}`);
  }
  const loc = d.location;
  if (!loc || loc.lat === undefined || loc.lat === null) throw new Error('Cell không tìm thấy trong Combain');
  return {
    mcc, mnc, lac, cellid,
    lat: parseFloat(loc.lat), lon: parseFloat(loc.lng),
    range: 1000,
    radio: radioType === 'lte' ? 'LTE' : 'GSM',
    description: `Combain ${radioType} ${mcc}-${mnc}`
  };
}

// ---- OpenCellID.org via web map endpoints (không cần API key) ----
// Map viewer /js/map.js gọi /ajax/searchCell.php + /ajax/getCells.php — endpoint
// nội bộ của frontend, KHÔNG chính thức, có thể đổi bất cứ lúc nào. Fail-soft:
// lỗi thì ném ra để chuỗi nguồn chuyển sang nguồn kế tiếp.
const OCID_WEB_BASE = 'https://opencellid.org';
const OCID_WEB_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
// Mã radio của form web: '' = Any, 1 GSM, 2 CDMA, 3 UMTS, 4 LTE, 5 NR, 10 NB-IoT.
const OCID_WEB_RADIO = { GSM: '1', CDMA: '2', UMTS: '3', LTE: '4', NR: '5', NBIOT: '10' };
// Rate limit tính theo IP (không theo key) → cooldown toàn cục, không retry storm.
const OCID_WEB_COOLDOWN_MS = 90000;
// Giới hạn số cell tra qua nguồn web cho mỗi lần resolve-batch (memo/budget riêng).
const OCID_WEB_MAX_PER_BATCH = 20;
const OCID_WEB_THROTTLE_MS = 1200;
let ocidWebBlockedUntil = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function resolveOpenCellIDWeb({ mcc, mnc, lac, cellid, radio }, sectorHint) {
  if (Date.now() < ocidWebBlockedUntil) throw new Error('OpenCellID web: tạm nghỉ do rate limit');

  const radioLabel = normalizeRadio(radio) || inferRadio(cellid, sectorHint, radio);
  const radioCode = OCID_WEB_RADIO[radioLabel] || '';

  // ECI trước, raw sau — endpoint LTE index theo ECI; raw (eNB ID thiếu sector)
  // gửi trước sẽ trúng cell khác hoặc miss.
  const ids = cellId.cellIdCandidates(cellid, sectorHint);

  let lastErr = null;
  for (const id of ids) {
    const qs = new URLSearchParams({ mcc: String(mcc), mnc: String(mnc), lac: String(lac), cell_id: id, radio: radioCode }).toString();
    const resp = await axios.get(`${OCID_WEB_BASE}/ajax/searchCell.php?${qs}`, {
      timeout: 15000,
      headers: {
        'User-Agent': OCID_WEB_UA,
        'Referer': OCID_WEB_BASE + '/',
        'X-Requested-With': 'XMLHttpRequest'
      },
      validateStatus: () => true
    });
    const d = resp.data;
    if (resp.status === 429 || d === 'Too many requests' || (d && d.message === 'Too many requests')) {
      ocidWebBlockedUntil = Date.now() + OCID_WEB_COOLDOWN_MS;
      throw new Error('OpenCellID web: quá nhiều request, tạm nghỉ 90s');
    }
    if (resp.status !== 200) { lastErr = new Error('OpenCellID web HTTP ' + resp.status); continue; }
    if (!d || d === false || d.lat == null || d.lon == null || !isFinite(Number(d.lat)) || !isFinite(Number(d.lon))) {
      lastErr = new Error('Cell không có trong OpenCellID web'); continue;
    }
    const lat = parseFloat(d.lat);
    const lon = parseFloat(d.lon);
    if (!isPlausibleLatLng(lat, lon, mcc)) { lastErr = new Error('OpenCellID web: toạ độ ngoài khung nước của MCC'); continue; }
    return {
      mcc, mnc, lac, cellid: id,
      lat, lon,
      range: parseInt(d.range, 10) || 1000,
      radio: radioLabel,
      description: `OpenCellID web ${mcc}-${mnc}`
    };
  }
  throw lastErr || new Error('Cell không có trong OpenCellID web');
}

// Batch fetch from OpenCellID (uses configured token)
app.post('/api/cells/fetch-batch', requireAuth, async (req, res) => {
  const { cells, token } = req.body;
  if (!Array.isArray(cells) || cells.length === 0) return res.status(400).json({ error: 'cells array required' });
  const key = token || await getOpenCellIDKey();
  let found = 0, notFound = 0, errors = 0;

  for (const c of cells) {
      try {
        const url = `https://opencellid.org/cell/get?key=${key}&mcc=${c.mcc}&mnc=${c.mnc}&lac=${c.lac}&cellid=${c.cellid}&format=json`;
        const resp = await axios.get(url, { timeout: 15000 });
        const d = resp.data;
        if (d && d.lat && isPlausibleLatLng(parseFloat(d.lat), parseFloat(d.lon), c.mcc)) {
          const r = normalizeRadio(d.radio) || inferRadio(c.cellid, c.sector, c.radio);
          db.run('UPDATE cells SET lat = ?, lng = ?, range = ?, source = ?, radio = ? WHERE mcc = ? AND mnc = ? AND lac = ? AND cellid = ?',
            [d.lat, d.lon, d.range || 1000, 'opencellid', r, c.mcc, c.mnc, c.lac, c.cellid], () => {});
          db.run('INSERT OR IGNORE INTO cells (mcc, mnc, lac, cellid, lat, lng, range, source, radio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [c.mcc, c.mnc, c.lac, c.cellid, d.lat, d.lon, d.range || 1000, 'opencellid', r], () => {});
          found++;
        } else {
          notFound++;
        }
      } catch (e) {
        errors++;
      }
  }
  res.json({ found, notFound, errors, total: cells.length });
});

// Cell ID conversion: eNB ID (short) <-> ECI (long)
app.get('/api/cells/convert', (req, res) => {
  const { value, sector } = req.query;
  if (value === undefined || value === '') return res.status(400).json({ error: 'value required' });
  const parsed = cellId.parseCellId(value, sector);
  if (!parsed) return res.status(400).json({ error: 'Invalid cell id' });
  res.json(parsed);
});

// ========================
// Cell DB Chunked Upload
// ========================
let uploadSessions = {};

app.post('/api/upload/cells/start', requireAuth, requireAdmin, (req, res) => {
  const sessionId = 's' + Date.now() + Math.random().toString(36).slice(2, 8);
  uploadSessions[sessionId] = { inserted: 0, skipped: 0, errors: 0, total: 0 };
  res.json({ sessionId });
});

app.post('/api/upload/cells/chunk', requireAuth, requireAdmin, (req, res) => {
  const { sessionId, rows } = req.body;
  const session = uploadSessions[sessionId];
  if (!session) return res.status(400).json({ error: 'Invalid session' });

  const batch = Array.isArray(rows) ? rows : [];
  session.total += batch.length;
  const errorsDetail = [];
  const valid = [];

  if (batch.length === 0) return res.json({ totalInserted: session.inserted, totalSkipped: session.skipped, totalErrors: session.errors, errorsDetail: [] });

  batch.forEach((row, idx) => {
    const mcc = String((row.mcc !== undefined) ? row.mcc : (row.MCC !== undefined ? row.MCC : '')).trim();
    const mnc = String((row.mnc !== undefined) ? row.mnc : (row.net !== undefined ? row.net : '')).replace(/[^\d]/g, '');
    const lac = String((row.lac !== undefined) ? row.lac : (row.area !== undefined ? row.area : '')).trim();
    const cellid = String(row.cellid !== undefined ? row.cellid : (row.cell !== undefined ? row.cell : '')).trim();
    const lat = parseFloat(row.lat);
    const lon = parseFloat(row.lon !== undefined ? row.lon : row.lng);
    const range = parseInt(row.range) || 1000;
    const radio = normalizeRadio(row.radio || row.Radio || row.RADIO || row.act || row.ACT) || inferRadio(cellid, row.sector || row.SECTOR, row.radio || row.act);

    if (mcc === '' || mnc === '' || lac === '' || cellid === '' || isNaN(lat) || isNaN(lon)) {
      session.errors++;
      errorsDetail.push({ row: idx + 1, error: 'Missing/invalid fields' });
      return;
    }
    valid.push([mcc, mnc, lac, cellid, lat, lon, range, 'csv', radio]);
  });

  if (valid.length === 0) {
    return res.json({ totalInserted: session.inserted, totalSkipped: session.skipped, totalErrors: session.errors, errorsDetail: errorsDetail.slice(-20) });
  }

  // INSERT OR IGNORE in sub-batches of 500 (4000 sql vars) — SQLite caps vars ~32766.
  // changes per sub-batch = actually inserted; ignored = already existed (skipped)
  const SUB = 500;
  let i = 0;
  const runNext = () => {
    const slice = valid.slice(i, i + SUB);
    i += SUB;
    if (slice.length === 0) {
      return res.json({ totalInserted: session.inserted, totalSkipped: session.skipped, totalErrors: session.errors, errorsDetail: errorsDetail.slice(-20) });
    }
    const placeholders = slice.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const flat = [];
    slice.forEach(v => flat.push(...v));
    db.run(`INSERT OR IGNORE INTO cells (mcc, mnc, lac, cellid, lat, lng, range, source, radio) VALUES ${placeholders}`, flat, function(err) {
      if (err) {
        session.errors += slice.length;
        errorsDetail.push({ row: i - slice.length, error: err.message });
      } else {
        session.inserted += this.changes;
        session.skipped += slice.length - this.changes;
      }
      runNext();
    });
  };
  runNext();
});

app.post('/api/upload/cells/finish', requireAuth, requireAdmin, (req, res) => {
  const { sessionId } = req.body;
  const session = uploadSessions[sessionId];
  if (!session) return res.status(400).json({ error: 'Invalid session' });
  delete uploadSessions[sessionId];
  res.json({ success: true, inserted: session.inserted, skipped: session.skipped, errors: session.errors, total: session.total, message: `Inserted ${session.inserted}, skipped ${session.skipped}, errors ${session.errors}` });
});

// ========================
// User: Phones & Records
// ========================
app.get('/api/phones', (req, res) => {
  db.all('SELECT DISTINCT phone_number FROM call_logs ORDER BY phone_number', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => r.phone_number));
  });
});

app.get('/api/records/:phone', (req, res) => {
  const phone = decodeURIComponent(req.params.phone);
  db.all('SELECT * FROM call_logs WHERE phone_number = ? ORDER BY timestamp DESC LIMIT 200', [phone], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({ ...r, lon: r.lng })));
  });
});

const upload = multer({ dest: 'uploads/' });

// ========================
// User: Call Logs (scoped to owner)
// ========================
app.post('/api/call-logs/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    // Read buffer once (file already on disk) and parse via excel-parser module.
    // Handles: metadata rows above header, numbered header rows, Mobifone gộp
    // "Mã địa danh", Viettel separate LAC/"Số Cell", per-network MCC/MNC.
    const buffer = fs.readFileSync(req.file.path);
    const { network, records, errors: parseErrors } = excelParser.parseWorkbook(buffer, req.file.originalname);
    const batchId = 'b' + Date.now();
    let inserted = 0;
    const errorsDetail = [].concat(parseErrors);

    const finish = (total) => {
      try { fs.unlinkSync(req.file.path); } catch(_) {}
      res.json({ network: network.name, total, inserted, errors: errorsDetail.length, errorsDetail: errorsDetail.slice(0, 20), batchId });
    };

    if (records.length === 0) return finish(0);

    // Batch insert to avoid callback nesting; 500 rows per statement.
    const BATCH = 500;
    const insertBatch = (idx) => {
      const slice = records.slice(idx, idx + BATCH);
      if (slice.length === 0) return finish(records.length);
      const placeholders = slice.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const flat = [];
      for (const r of slice) flat.push(req.user.id, r.network, r.phone_number, r.action_type, r.timestamp, r.contact_number, r.duration, r.mcc, r.mnc, r.lac, r.cellid, r.enb_id || '', r.sector || '', r.cell_address);
      db.run(
        `INSERT INTO call_logs (user_id, network, phone_number, action_type, timestamp, contact_number, duration, mcc, mnc, lac, cellid, enb_id, sector, cell_address) VALUES ${placeholders}`,
        flat,
        function(err) {
          if (err) { errorsDetail.push('Batch error: ' + err.message); inserted += 0; }
          else inserted += this.changes;
          insertBatch(idx + BATCH);
        }
      );
    };
    insertBatch(0);
  } catch (e) {
    try { fs.unlinkSync(req.file.path); } catch(_) {}
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/call-logs', requireAuth, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  const { search, network, action_type, phone } = req.query;
  let where = 'WHERE user_id = ?';
  const params = [req.user.id];
  if (search) { where += ' AND (phone_number LIKE ? OR contact_number LIKE ? OR cell_address LIKE ?)'; const l = '%' + search + '%'; params.push(l, l, l); }
  if (network) { where += ' AND network = ?'; params.push(network); }
  if (action_type) { where += ' AND action_type = ?'; params.push(action_type); }
  if (phone) { where += ' AND phone_number = ?'; params.push(phone); }

  db.get(`SELECT COUNT(*) as total FROM call_logs ${where}`, params, (err, cnt) => {
    if (err) return res.status(500).json({ error: err.message });
    // Fetch the page of logs first (indexed by user_id), then resolve coordinates
    // separately. The old single LEFT JOIN used CAST/OR which defeated the
    // (mcc,mnc,lac,cellid) index; here we build the set of candidate keys and do
    // one indexed IN query, matching in JS. DB is untouched.
    db.all(`SELECT * FROM call_logs ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      attachCellCoords(rows).then((data) => {
        res.json({ data, total: cnt.total, page, limit, totalPages: Math.max(1, Math.ceil(cnt.total / limit)) });
      }).catch((e) => res.status(500).json({ error: e.message }));
    });
  });
});

// Attach lat/lon/range to call-log rows by resolving their raw cell ID against
// the local `cells` table. Builds candidate (mcc, lac, cellid) keys per row
// (raw then ECI) with MNC variants, then does indexed lookups — no CAST/OR.
function attachCellCoords(rows) {
  return new Promise((resolve) => {
    if (!rows || rows.length === 0) return resolve(rows || []);
    const lacs = new Set();
    for (const r of rows) if (r.lac) lacs.add(String(r.lac));
    if (lacs.size === 0) { rows.forEach((r) => { r.lat = null; r.lon = null; r.cell_range = null; }); return resolve(rows); }

    // Load all cells for the LACs involved (bounded set) in one indexed query.
    const lacList = [...lacs];
    const ph = lacList.map(() => '?').join(', ');
    db.all(`SELECT mcc, mnc, lac, cellid, lat, lng, range, radio FROM cells WHERE lac IN (${ph}) AND lat IS NOT NULL`, lacList, (err, cellRows) => {
      if (err) { rows.forEach((r) => { r.lat = null; r.lon = null; r.cell_range = null; }); return resolve(rows); }
      // Index by normalized mcc|lac|cellid, ignoring MNC padding differences.
      const idx = new Map();
      for (const c of cellRows) {
        const k = `${c.mcc}|${String(c.lac)}|${String(c.cellid)}`;
        if (!idx.has(k)) idx.set(k, c);
      }
      for (const r of rows) {
        r.lat = null; r.lon = null; r.cell_range = null;
        const idKeys = cellId.cellIdLookupKeys(r.cellid, r.sector);
        for (const id of idKeys) {
          const c = idx.get(`${r.mcc}|${String(r.lac)}|${id}`);
          if (c && c.lat != null) { r.lat = c.lat; r.lon = c.lng; r.cell_range = c.range; r.radio = c.radio || ''; break; }
        }
      }
      resolve(rows);
    });
  });
}

app.delete('/api/call-logs/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM call_logs WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, deleted: this.changes });
  });
});

// Call log helpers
const OPEN_CELLID_KEY = process.env.OPENCELLID_API_KEY || '';

// Cells management (CSV / GZ / ZIP upload) — incremental batch insert, streams big
// files so they never fully buffer into memory (fixes zip >3MB memory blowup).
app.post('/api/upload/cells', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const errors = [];
  let total = 0, inserted = 0, skipped = 0, failed = 0;

  const flushBatch = (batch, cb) => {
    if (batch.length === 0) return cb();
    // INSERT OR IGNORE on unique (mcc,mnc,lac,cellid): changes = actually inserted, ignored = duplicate (skipped)
    const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const flat = [];
    for (const r of batch) flat.push(r.mcc, r.mnc, r.lac, r.cellid, r.lat, r.lng, r.range, r.address, r.city, r.source, r.radio);
    db.run(`INSERT OR IGNORE INTO cells (mcc, mnc, lac, cellid, lat, lng, range, address, city, source, radio) VALUES ${placeholders}`, flat, function (err) {
      if (err) { failed += batch.length; errors.push('Batch error: ' + err.message); }
      else { inserted += this.changes; skipped += batch.length - this.changes; }
      cb();
    });
  };

  // Streaming batch flush so large decompressed CSVs never allocate all rows at once.
  const finish = () => {
    try { fs.unlinkSync(req.file.path); } catch (_) {}
    db.run('INSERT INTO uploads (user_id, filename, original_name, type, total, inserted, updated, failed, errors) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, req.file.filename, req.file.originalname, 'cells', total, inserted, skipped, failed, JSON.stringify(errors.slice(0, 100))], () => {});
    res.json({ total, inserted, skipped, failed, errors: errors.slice(0, 100) });
  };

  const csvRows = [];

  const name = (req.file.originalname || '').toLowerCase();
  const parseCsvStream = (input) => {
    const parser = csv();
    parser
      .on('data', (row) => {
        total++;
        const mcc = String(row.mcc || row.MCC || '').trim();
        const mnc = String(row.mnc || row.MNC || row.net || row.NET || '').trim();
        const lac = String(row.lac || row.LAC || row.area || row.AREA || '').trim();
        const cellid = String(row.cellid || row.cell_id || row.CELLID || row.CELL_ID || row.cell || row.CELL || '').trim();
        const lat = parseFloat(row.lat || row.latitude || row.LAT || row.LATITUDE);
        const lng = parseFloat(row.lng || row.longitude || row.LNG || row.LONGITUDE || row.lon || row.LON);
        if (!mcc || !mnc || !lac || !cellid || isNaN(lat) || isNaN(lng) || !isPlausibleLatLng(lat, lng, mcc)) {
          failed++; errors.push(`Row ${total}: Missing/invalid fields`);
          return;
        }
        csvRows.push({
          mcc, mnc, lac, cellid, lat, lng,
          range: parseInt(row.range || row.RANGE) || 0,
          address: row.address || row.Address || row.address_en || '',
          city: row.city || row.City || '',
          source: row.source || row.Source || 'csv',
          radio: normalizeRadio(row.radio || row.Radio || row.RADIO || row.act || row.ACT) || inferRadio(cellid, row.sector || row.SECTOR, row.radio || row.act)
        });
        if (csvRows.length >= 500) {
          parser.pause();
          const slice = csvRows.splice(0, 500);
          flushBatch(slice, () => parser.resume());
        }
      })
      .on('end', () => {
        if (csvRows.length > 0) {
          const slice = csvRows.splice(0, 500);
          flushBatch(slice, () => finish());
        } else {
          finish();
        }
      })
      .on('error', (e) => { try { fs.unlinkSync(req.file.path); } catch(_) {} res.status(500).json({ error: e.message }); });
    input.pipe(parser);
  };

  if (name.endsWith('.csv')) {
    parseCsvStream(fs.createReadStream(req.file.path));
  } else if (name.endsWith('.gz')) {
    parseCsvStream(fs.createReadStream(req.file.path).pipe(zlib.createGunzip()));
  } else if (name.endsWith('.zip')) {
    // Stream-extract the first .csv/.gz entry with yauzl so large archives
    // (>3MB) never fully buffer into memory (AdmZip.getData() blows up RAM).
    yauzl.open(req.file.path, { lazyEntries: true }, (err, zip) => {
      if (err) { try { fs.unlinkSync(req.file.path); } catch(_) {} return res.status(500).json({ error: err.message }); }
      let started = false;
      zip.readEntry();
      zip.on('entry', (entry) => {
        if (started || entry.fileName.startsWith('__MACOSX/') || entry.fileName.endsWith('/')) {
          zip.readEntry();
          return;
        }
        if (!/\.(csv|gz)$/i.test(entry.fileName)) {
          zip.readEntry();
          return;
        }
        started = true;
        zip.openReadStream(entry, (err2, input) => {
          if (err2) {
            try { fs.unlinkSync(req.file.path); } catch(_) {}
            zip.close();
            return res.status(500).json({ error: err2.message });
          }
          if (/\.gz$/i.test(entry.fileName)) {
            parseCsvStream(input.pipe(zlib.createGunzip()));
          } else {
            parseCsvStream(input);
          }
        });
      });
      zip.on('error', (e) => {
        try { fs.unlinkSync(req.file.path); } catch(_) {}
        if (!started) res.status(500).json({ error: e.message });
      });
      zip.on('end', () => {
        if (!started) {
          try { fs.unlinkSync(req.file.path); } catch(_) {}
          res.status(400).json({ error: 'No .csv or .gz file found inside zip' });
        }
      });
    });
  } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    try {
      const workbook = xlsx.readFile(req.file.path);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = xlsx.utils.sheet_to_json(sheet);
      const rows = data.map(row => {
        total++;
        const mcc = String(row.mcc || row.MCC || '').trim();
        const mnc = String(row.mnc || row.MNC || row.net || row.NET || '').trim();
        const lac = String(row.lac || row.LAC || row.area || row.AREA || '').trim();
        const cellid = String(row.cellid || row.cell_id || row.CELLID || row.CELL_ID || row.cell || row.CELL || '').trim();
        const lat = parseFloat(row.lat || row.latitude || row.LAT || row.LATITUDE);
        const lng = parseFloat(row.lng || row.longitude || row.LNG || row.LONGITUDE || row.lon || row.LON);
        if (!mcc || !mnc || !lac || !cellid || isNaN(lat) || isNaN(lng) || !isPlausibleLatLng(lat, lng, mcc)) {
          failed++; errors.push(`Row ${total}: Missing/invalid fields`);
          return null;
        }
        return {
          mcc, mnc, lac, cellid, lat, lng,
          range: parseInt(row.range || row.RANGE) || 0,
          address: row.address || row.Address || row.address_en || '',
          city: row.city || row.City || '',
          source: row.source || row.Source || 'csv',
          radio: normalizeRadio(row.radio || row.Radio || row.RADIO || row.act || row.ACT) || inferRadio(cellid, row.sector || row.SECTOR, row.radio || row.act)
        };
      }).filter(Boolean);
      const flushAll = (idx = 0) => {
        const slice = rows.slice(idx, idx + 500);
        if (slice.length === 0) return finish();
        flushBatch(slice, () => flushAll(idx + 500));
      };
      flushAll();
    } catch (e) {
      try { fs.unlinkSync(req.file.path); } catch(_) {}
      res.status(500).json({ error: e.message });
    }
  } else {
    try { fs.unlinkSync(req.file.path); } catch(_) {}
    res.status(400).json({ error: 'Unsupported format. Use .csv, .xlsx, .gz, or .zip' });
  }
});

// ========================
// CLF V4.1 conversion (G-MoN Pro) <-> OpenCellID CSV
// ========================
const clfUpload = multer({ dest: 'uploads/' });
const CLF_EXPORT_DIR = path.join(__dirname, 'uploads', 'clf');

function ensureClfDir() {
  if (!fs.existsSync(CLF_EXPORT_DIR)) fs.mkdirSync(CLF_EXPORT_DIR, { recursive: true });
}

// POST /api/convert/clf/from-csv — OpenCellID CSV -> CLF V4.1
// Accepts a multipart `file`, or no file at all to convert uploads/Database_free.csv.
app.post('/api/convert/clf/from-csv', requireAuth, requireAdmin, clfUpload.single('file'), async (req, res) => {
  const defaultCsv = path.join(__dirname, 'uploads', 'Database_free.csv');
  const srcPath = req.file ? req.file.path : defaultCsv;
  const srcName = req.file ? req.file.originalname : 'Database_free.csv';

  const cleanup = () => { if (req.file) { try { fs.unlinkSync(req.file.path); } catch (_) {} } };

  if (!fs.existsSync(srcPath)) {
    cleanup();
    return res.status(400).json({ error: 'File not found: ' + srcName + '. Upload a .csv file.' });
  }

  ensureClfDir();
  const stamp = Date.now();
  const outName = (srcName.replace(/\.[^.]+$/, '') || 'cells') + '_' + stamp + '.clf';
  const outPath = path.join(CLF_EXPORT_DIR, outName);

  try {
    const stat = await clfConverter.convertCsvFileToClf(srcPath, outPath);
    db.run('INSERT INTO uploads (user_id, filename, original_name, type, total, inserted, updated, failed, errors) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, outName, srcName, 'clf-export', stat.total, stat.converted, 0, stat.failed, JSON.stringify(stat.errors)], () => {});
    cleanup();

    let sample = [];
    try {
      sample = fs.readFileSync(outPath, 'utf8').split(/\r?\n/).slice(1, 6).filter(Boolean);
    } catch (_) {}

    res.json({
      success: true,
      file: outName,
      download: '/api/convert/clf/download/' + encodeURIComponent(outName),
      fields: clfConverter.CLF_FIELDS,
      total: stat.total,
      converted: stat.converted,
      failed: stat.failed,
      errors: stat.errors,
      sample
    });
  } catch (e) {
    cleanup();
    res.status(500).json({ error: e.message });
  }
});

// POST /api/convert/clf/to-csv — CLF V4.1 -> OpenCellID CSV
app.post('/api/convert/clf/to-csv', requireAuth, requireAdmin, clfUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  ensureClfDir();
  const stamp = Date.now();
  const outName = (req.file.originalname.replace(/\.[^.]+$/, '') || 'cells') + '_' + stamp + '.csv';
  const outPath = path.join(CLF_EXPORT_DIR, outName);

  try {
    const stat = await clfConverter.convertClfFileToCsv(req.file.path, outPath);
    db.run('INSERT INTO uploads (user_id, filename, original_name, type, total, inserted, updated, failed, errors) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, outName, req.file.originalname, 'clf-import', stat.total, stat.converted, 0, stat.failed, JSON.stringify(stat.errors)], () => {});
    try { fs.unlinkSync(req.file.path); } catch (_) {}

    let sample = [];
    try {
      sample = fs.readFileSync(outPath, 'utf8').split(/\r?\n/).slice(0, 4).filter(Boolean);
    } catch (_) {}

    res.json({
      success: true,
      file: outName,
      download: '/api/convert/clf/download/' + encodeURIComponent(outName),
      fields: clfConverter.OPENCELLID_FIELDS,
      total: stat.total,
      converted: stat.converted,
      failed: stat.failed,
      errors: stat.errors,
      sample
    });
  } catch (e) {
    try { fs.unlinkSync(req.file.path); } catch (_) {}
    res.status(500).json({ error: e.message });
  }
});

// GET /api/convert/clf/download/:file — download a converted file
app.get('/api/convert/clf/download/:file', requireAuth, (req, res) => {
  const name = path.basename(req.params.file);
  const full = path.join(CLF_EXPORT_DIR, name);
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'File not found' });
  res.setHeader('Content-Type', name.endsWith('.clf') ? 'text/plain; charset=utf-8' : 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="' + name + '"');
  res.sendFile(full);
});

// Excel upload for VinaPhone lookup
const vinaphoneUpload = multer({ dest: 'uploads/' });

app.post('/api/upload/vinaphone', requireAuth, vinaphoneUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    const results = [];
    let processed = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cellId = String(row[0] || row[1] || '').trim();
      if (!cellId) continue;

      processed++;
      const padded = cellId.padStart(8, '0');
      const hexStr = padded;
      const hexInt = BigInt('0x' + hexStr);
      const binaryStr = hexInt.toString(2).padStart(32, '0');

      let lac, ci;
      if (binaryStr.length >= 28) {
        lac = parseInt(binaryStr.substring(0, 12), 2);
        ci = parseInt(binaryStr.substring(12, 28), 2);
      } else {
        lac = 0; ci = 0;
      }

      const mcc = '452';
      const mnc = '02';

      db.get('SELECT * FROM cells WHERE mcc = ? AND mnc = ? AND lac = ? AND cellid = ?',
        [mcc, mnc, String(lac), String(ci)], (err, cellData) => {
        results.push({
          row: i + 1,
          cellId_hex: cellId,
          cellId_padded: padded,
          lac,
          ci,
          found: !!cellData,
          data: cellData || null
        });
        if (results.length === processed) {
          try { fs.unlinkSync(req.file.path); } catch(_) {}
          res.json({ total: processed, results });
        }
      });
    }

    if (processed === 0) {
      try { fs.unlinkSync(req.file.path); } catch(_) {}
      res.json({ total: 0, results: [] });
    }
  } catch (err) {
    try { fs.unlinkSync(req.file.path); } catch(_) {}
    res.status(500).json({ error: err.message });
  }
});

// User management (admin)
app.get('/api/admin/users', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  db.all('SELECT id, username, role, created_at, credit_balance FROM users ORDER BY created_at DESC', (err, users) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json((users || []).map(u => ({ ...u, credit_balance: Number(u.credit_balance) || 0 })));
  });
});

app.post('/api/admin/users', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  // Không nhận `credit`: điểm user mới chỉ đến từ bonus đăng ký.
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).json({ error: err.message });
    db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hash, role || 'user'], async function(err) {
      if (err) return res.status(500).json({ error: err.message });
      const userId = this.lastID;
      const balance = await applyUserInitialCredit(userId, req);
      res.json({ success: true, id: userId, credit_balance: balance });
    });
  });
});

app.put('/api/admin/users/:id', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { username, password, role } = req.body;
  if (password) {
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) return res.status(500).json({ error: err.message });
      db.run('UPDATE users SET username = COALESCE(?, username), password = ?, role = COALESCE(?, role) WHERE id = ?',
        [username || null, hash, role || null, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
      });
    });
  } else {
    db.run('UPDATE users SET username = COALESCE(?, username), role = COALESCE(?, role) WHERE id = ?',
      [username || null, role || null, req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, changes: this.changes });
    });
  }
});

app.delete('/api/admin/users/:id', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  db.run('DELETE FROM users WHERE id = ? AND role != ?', [req.params.id, 'admin'], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, deleted: this.changes });
  });
});

// Stats (admin)
app.get('/api/admin/stats', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  const result = {};
  db.get('SELECT COUNT(*) as total FROM users', [], (err, row) => { result.users = row.total; });
  db.get('SELECT COUNT(*) as total FROM cells', [], (err, row) => { result.cells = row.total; });
  db.get('SELECT COUNT(*) as total FROM lookup_history', [], (err, row) => { result.history = err ? 0 : row.total; });
  db.get('SELECT COUNT(*) as total FROM ip_tracker', [], (err, row) => { result.ipTracker = row.total; });
  db.get('SELECT COUNT(*) as total FROM ip_tracker_logs', [], (err, row) => { result.ipTrackerLogs = row.total; });

  db.get('SELECT COUNT(*) as total FROM uploads', [], (err, row) => {
    result.uploads = err ? 0 : row.total;
    res.json(result);
  });
});

// Logs (admin)
app.get('/api/admin/logs', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  db.all(`SELECT l.*, t.name as tracker_name, t.type as tracker_type, u.username
    FROM ip_tracker_logs l
    JOIN ip_tracker t ON l.tracker_id = t.id
    JOIN users u ON t.user_id = u.id
    ORDER BY l.timestamp DESC LIMIT 200`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ========================
// SETTINGS (admin)
// ========================
const SETTING_KEYS = ['max_online_resolve', 'lookup_history_retention_days',
  'credit_enabled', 'credit_cost_per_lookup', 'credit_signup_bonus', 'credit_allow_negative'];

// Toggle nhị phân + kiểu số cho từng setting.
const BOOL_SETTING_KEYS = new Set(['credit_enabled', 'credit_allow_negative']);
const SETTING_DEFAULTS = {
  max_online_resolve: '50', lookup_history_retention_days: '90',
  credit_enabled: '0', credit_cost_per_lookup: '1', credit_signup_bonus: '5', credit_allow_negative: '0'
};

// GET /api/settings
app.get('/api/settings', requireAuth, requireAdmin, async (req, res) => {
  try {
    const out = {};
    for (const k of SETTING_KEYS) out[k] = await getSetting(k, SETTING_DEFAULTS[k]);
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/settings - body { settings: { key: value, ... } }
app.put('/api/settings', requireAuth, requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const patch = body.settings && typeof body.settings === 'object' ? body.settings : body;

    // Bước 1: validate TOÀN BỘ trước khi ghi. Trước đây ghi ngay trong vòng lặp
    // nên 1 key lỗi ở giữa làm các key trước đó đã ghi (nửa vời) mà response lại
    // là 400 → UI báo lỗi và hiển thị sai trạng thái thật trong DB.
    const updates = [];
    for (const k of SETTING_KEYS) {
      if (patch[k] === undefined) continue;
      let v = String(patch[k]).trim();
      if (BOOL_SETTING_KEYS.has(k)) {
        // Chấp nhận 1/0, true/false, on/off → chuẩn hoá về '1'/'0'.
        const lower = v.toLowerCase();
        if (['1', 'true', 'on', 'yes'].includes(lower)) v = '1';
        else if (['0', 'false', 'off', 'no', ''].includes(lower)) v = '0';
        else return res.status(400).json({ error: `Giá trị không hợp lệ cho ${k}` });
        updates.push([k, v]);
        continue;
      }
      // Ô trống = không thay đổi (form luôn gửi mọi field, ô bỏ trống không phải
      // là ý định "đặt về 0" — nếu coi là lỗi thì cả form không lưu được).
      if (v === '') continue;
      if (!Number.isFinite(Number(v)) || Number(v) < 0) {
        return res.status(400).json({ error: `Giá trị không hợp lệ cho ${k}` });
      }
      // Chặn giá trị vô lý đẩy số dư/giá lên vô cực.
      if (Number(v) > 1e7) return res.status(400).json({ error: `Giá trị quá lớn cho ${k}` });
      updates.push([k, v]);
    }

    // Bước 2: mọi giá trị đã hợp lệ → ghi hết.
    for (const [k, v] of updates) await setSetting(k, v);

    const out = {};
    for (const k of SETTING_KEYS) out[k] = await getSetting(k, null);
    res.json({ success: true, settings: out });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ========================
// IP TRACKER TOOL
// ========================
// DATA SOURCES (Nguồn Online)
// ========================

// GET /api/sources - list all sources (sorted by priority)
app.get('/api/sources', requireAuth, requireAdmin, (req, res) => {
  db.all('SELECT * FROM data_sources ORDER BY priority ASC, id ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /api/sources - create source (name, type, api_key, mcc, priority)
app.post('/api/sources', requireAuth, requireAdmin, (req, res) => {
  const { name, type, api_key, mcc, priority } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  db.run(`INSERT INTO data_sources (name, type, base_url, api_key, username, password, mcc, mnc, lac, max_cells, priority)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, type || 'opencellid', '', api_key || '', '', '', mcc || '', '', '', 100, priority != null ? priority : 100], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: this.lastID });
  });
});

// PUT /api/sources/reorder - bulk reorder: body { order: [id, id, ...] }
app.put('/api/sources/reorder', requireAuth, requireAdmin, (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order) || order.length === 0) return res.status(400).json({ error: 'order array required' });
  const stmt = db.prepare('UPDATE data_sources SET priority = ? WHERE id = ?');
  order.forEach((id, i) => stmt.run([(i + 1) * 10, id]));
  stmt.finalize((err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// PUT /api/sources/:id - update source (name, type, api_key, enabled, mcc, priority)
app.put('/api/sources/:id', requireAuth, requireAdmin, (req, res) => {
  const { name, type, api_key, enabled, mcc, priority } = req.body;
  db.run(`UPDATE data_sources SET name = ?, type = ?, api_key = ?, enabled = ?, mcc = ?, priority = ? WHERE id = ?`,
    [name, type || 'opencellid', api_key || '', enabled === undefined ? 1 : (enabled ? 1 : 0), mcc || '', priority != null ? priority : 100, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, changed: this.changes });
    });
});

// DELETE /api/sources/:id - remove source
app.delete('/api/sources/:id', requireAuth, requireAdmin, (req, res) => {
  db.run('DELETE FROM data_sources WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, deleted: this.changes });
  });
});

// ========================
// SYNC JOBS (auto-update cells from OpenCellID)
// ========================
const scheduledTasks = new Map(); // job id -> node-cron task

function scheduleJob(job) {
  if (scheduledTasks.has(job.id)) { scheduledTasks.get(job.id).stop(); scheduledTasks.delete(job.id); }
  if (!job.enabled) return;
  if (!cron.validate(job.cron_expr || '')) {
    console.error(`sync job ${job.id}: invalid cron "${job.cron_expr}"`);
    return;
  }
  const task = cron.schedule(job.cron_expr, async () => {
    try {
      const apiKey = await getOpenCellIDKey();
      await ocidSync.runSyncJob(job, apiKey);
    } catch (e) {
      console.error(`sync job ${job.id} failed:`, e.message);
    }
  }, { timezone: 'Asia/Ho_Chi_Minh' });
  scheduledTasks.set(job.id, task);
}

// Load all enabled jobs and register them with node-cron.
function initSyncScheduler() {
  db.all('SELECT * FROM sync_jobs WHERE enabled = 1', [], (err, rows) => {
    if (err || !rows) return;
    rows.forEach(scheduleJob);
    if (rows.length) console.log(`Registered ${rows.length} sync job(s)`);
  });
}

// Retention: purge lookup_history older than the admin-configured number of days.
// Runs daily at 03:30 Asia/Ho_Chi_Minh (off-peak).
async function runLookupHistoryRetention() {
  const days = parseInt(await getSetting('lookup_history_retention_days', '90'), 10);
  if (!Number.isFinite(days) || days <= 0) return;
  db.run(`DELETE FROM lookup_history WHERE created_at < datetime('now', '-' || ? || ' days')`,
    [days], function(err) {
      if (err) return console.error('lookup_history retention error:', err.message);
      if (this.changes) console.log(`lookup_history retention: removed ${this.changes} row(s) older than ${days} day(s)`);
    });
}

function initLookupHistoryRetention() {
  try {
    cron.schedule('30 3 * * *', runLookupHistoryRetention, { timezone: 'Asia/Ho_Chi_Minh' });
    console.log('Lookup history retention job scheduled (daily 03:30)');
  } catch (e) {
    console.error('Failed to schedule retention job:', e.message);
  }
}

// GET /api/sync-jobs - list jobs (with source name)
app.get('/api/sync-jobs', requireAuth, requireAdmin, (req, res) => {
  db.all(`SELECT j.*, s.name AS source_name, s.type AS source_type
          FROM sync_jobs j LEFT JOIN data_sources s ON j.source_id = s.id
          ORDER BY j.id ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({ ...r, running: ocidSync.isRunning(r.id) })));
  });
});

// POST /api/sync-jobs - create a new job
app.post('/api/sync-jobs', requireAuth, requireAdmin, (req, res) => {
  const { source_id, cron_expr, scope, mcc_list, enabled } = req.body;
  if (cron_expr && !cron.validate(cron_expr)) return res.status(400).json({ error: 'Cron expression không hợp lệ' });
  db.run(`INSERT INTO sync_jobs (source_id, cron_expr, scope, mcc_list, enabled) VALUES (?, ?, ?, ?, ?)`,
    [source_id || null, cron_expr || '0 3 * * *', scope || 'mcc', mcc_list || '452',
     enabled === undefined ? 1 : (enabled ? 1 : 0)],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM sync_jobs WHERE id = ?', [this.lastID], (e2, job) => {
        if (!e2 && job) scheduleJob(job);
        res.json({ success: true, id: this.lastID });
      });
    });
});

// PUT /api/sync-jobs/:id - update job fields and reschedule
app.put('/api/sync-jobs/:id', requireAuth, requireAdmin, (req, res) => {
  const { source_id, cron_expr, scope, mcc_list, enabled } = req.body;
  if (cron_expr && !cron.validate(cron_expr)) return res.status(400).json({ error: 'Cron expression không hợp lệ' });
  db.run(`UPDATE sync_jobs SET source_id = ?, cron_expr = ?, scope = ?, mcc_list = ?, enabled = ? WHERE id = ?`,
    [source_id || null, cron_expr || '0 3 * * *', scope || 'mcc', mcc_list || '452',
     enabled === undefined ? 1 : (enabled ? 1 : 0), req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM sync_jobs WHERE id = ?', [req.params.id], (e2, job) => {
        if (!e2 && job) scheduleJob(job);
        res.json({ success: true, changed: this.changes });
      });
    });
});

// POST /api/sync-jobs/:id/run - run a job immediately
app.post('/api/sync-jobs/:id/run', requireAuth, requireAdmin, (req, res) => {
  db.get('SELECT * FROM sync_jobs WHERE id = ?', [req.params.id], async (err, job) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!job) return res.status(404).json({ error: 'Job không tồn tại' });
    try {
      const apiKey = await getOpenCellIDKey();
      const result = await ocidSync.runSyncJob(job, apiKey);
      res.json({ success: true, result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });
});

// DELETE /api/sync-jobs/:id
app.delete('/api/sync-jobs/:id', requireAuth, requireAdmin, (req, res) => {
  const id = req.params.id;
  if (scheduledTasks.has(Number(id))) { scheduledTasks.get(Number(id)).stop(); scheduledTasks.delete(Number(id)); }
  db.run('DELETE FROM sync_jobs WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, deleted: this.changes });
  });
});

// ========================
const crypto = require('crypto');
const sharp = require('sharp');
const trackerUpload = multer({ dest: 'uploads/tracker/' });

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = req.headers['x-real-ip'];
  if (realIp) return realIp;
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

function sanitizeHeaders(headers) {
  const safe = ['user-agent', 'accept', 'accept-language', 'accept-encoding', 'referer', 'origin',
    'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform', 'dnt', 'connection',
    'cache-control', 'pragma', 'upgrade-insecure-requests'];
  const result = {};
  for (const key of safe) {
    if (headers[key]) result[key] = headers[key];
  }
  return result;
}

// Async WAN IP lookup via ipify
async function getWanIp() {
  try {
    const resp = await axios.get('https://api.ipify.org?format=json', { timeout: 3000 });
    return resp.data.ip || 'unknown';
  } catch (_) {
    return 'lookup_failed';
  }
}

// Bot / crawler detection for social platforms
const BOT_PATTERNS = [
  'facebookexternalhit', 'Facebot', 'Twitterbot', 'Slackbot',
  'TelegramBot', 'WhatsApp', 'Viber', 'SkypeUriPreview',
  'Discordbot', 'Slack-ImgProxy',
  'Zalo', 'ZaloPC', 'ZaloAndroid',
  'Googlebot', 'Bingbot', 'YandexBot', 'DuckDuckBot',
  'LinkedInBot', 'Pinterest', 'MetaInspector', 'curl', 'Wget',
  'python-requests', 'Go-http-client'
];

function isBot(ua) {
  if (!ua) return false;
  const uaLower = ua.toLowerCase();
  return BOT_PATTERNS.some(p => uaLower.includes(p.toLowerCase()));
}

// OG HTML skeleton for social preview
function buildOgHtml(tracker, baseUrl) {
  const token = tracker.token;
  const type = tracker.type;

  // Default OG values
  let ogTitle = tracker.og_title || '';
  let ogDescription = tracker.og_description || '';
  let ogImage = tracker.og_image || '';
  let ogUrl = '';

  if (type === 'url') {
    ogUrl = `${baseUrl}/r/${token}`;
    if (!ogTitle) ogTitle = 'Bài viết mới - Tin tức 24h';
    if (!ogDescription) ogDescription = 'Xem bài viết mới nhất. Cập nhật tin tức nhanh chóng và chính xác.';
    if (!ogImage) ogImage = `${baseUrl}/api/tools/ip-tracker/og-default.jpg`; // fallback image
    // Use redirect_url as more realistic content for OG
    if (tracker.redirect_url) {
      try {
        const u = new URL(tracker.redirect_url);
        if (!ogTitle.includes('Bài viết')) ogTitle = `${u.hostname} - Bài viết mới`;
      } catch (_) {}
    }
  } else {
    ogUrl = `${baseUrl}/i/${token}`;
    if (!ogTitle) ogTitle = 'Hình ảnh mới';
    if (!ogDescription) ogDescription = 'Chia sẻ hình ảnh.';
    if (!ogImage) ogImage = `${baseUrl}/i/${token}`;
    if (tracker.og_image) ogImage = tracker.og_image;
  }

  // Build HTML
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(ogTitle)}</title>
  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtml(ogTitle)}">
  <meta property="og:description" content="${escapeHtml(ogDescription)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta property="og:url" content="${escapeHtml(ogUrl)}">
  <meta property="og:type" content="${type === 'url' ? 'article' : 'website'}">
  <meta property="og:site_name" content="Cell.id.vn">
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}">
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}">
  <meta name="twitter:image" content="${escapeHtml(ogImage)}">
  <!-- Redirect real users -->
  ${type === 'url' ? `<script>window.location.replace("${escapeHtml(tracker.redirect_url || 'https://www.google.com')}")</script>` : ''}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f2f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #fff; border-radius: 12px; padding: 40px; max-width: 500px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,.1); text-align: center; }
    h2 { color: #1a1a2e; margin-bottom: 12px; }
    p { color: #666; margin-bottom: 24px; }
    .btn { display: inline-block; padding: 12px 32px; border-radius: 8px; background: #2563eb; color: white; text-decoration: none; font-weight: 600; }
    .btn:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="card">
    <h2>${escapeHtml(ogTitle)}</h2>
    <p>${escapeHtml(ogDescription)}</p>
    ${type === 'url' ? `<a class="btn" href="${escapeHtml(tracker.redirect_url || 'https://www.google.com')}">Xem bài viết</a>` : ''}
    <p style="margin-top: 12px; font-size: 12px; color: #999;">Đang tải nội dung...</p>
  </div>
</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
   return String(str)
     .replace(/&/g, '\x26amp;')
     .replace(/"/g, '\x26quot;')
     .replace(/</g, '\x26lt;')
     .replace(/>/g, '\x26gt;');
}

// POST /api/tools/ip-tracker/create - Create tracking link
app.post('/api/tools/ip-tracker/create', requireAuth, trackerUpload.single('image'), async (req, res) => {
  try {
    const { type, name, redirect_url, og_title, og_description, og_image } = req.body;
    if (!type || !['url', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Type must be "url" or "image"' });
    }

    const token = crypto.randomBytes(16).toString('hex');
    let imagePath = null;
    let imageName = null;

    if (type === 'image') {
      if (!req.file) {
        return res.status(400).json({ error: 'Image file required for type "image"' });
      }
      imagePath = req.file.path;
      imageName = req.file.originalname || req.file.filename;

      // Create watermarked copy with tracking pixel
      try {
        const trackingPixel = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
          'base64'
        );
        const imgExt = path.extname(imageName).toLowerCase();
        let compositeImage;
        if (imgExt === '.png') {
          compositeImage = await sharp(imagePath)
            .composite([{ input: trackingPixel, top: 0, left: 0 }])
            .png()
            .toBuffer();
        } else {
          compositeImage = await sharp(imagePath)
            .composite([{ input: trackingPixel, top: 0, left: 0 }])
            .jpeg()
            .toBuffer();
        }
        const watermarkedPath = imagePath + '_tracked' + (imgExt === '.png' ? '.png' : '.jpg');
        fs.writeFileSync(watermarkedPath, compositeImage);
        req.watermarkedPath = watermarkedPath;
      } catch (sharpErr) {
        console.error('Sharp processing error:', sharpErr.message);
        req.watermarkedPath = null;
      }
    }

    db.run(`INSERT INTO ip_tracker (user_id, type, name, redirect_url, image_path, image_name, token, og_title, og_description, og_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, type, name || '', redirect_url || '', imagePath, imageName, token, og_title || '', og_description || '', og_image || ''],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        const trackerId = this.lastID;
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const result = {
          success: true,
          id: trackerId,
          token,
          name: name || '',
          type,
          trackingUrl: type === 'url' ? `${baseUrl}/r/${token}` : `${baseUrl}/i/${token}`,
          imageDownloadUrl: type === 'image' ? `${baseUrl}/d/${token}` : null,
          shareUrl: `${baseUrl}/api/tools/ip-tracker/${trackerId}/share`,
          dashboardUrl: null,
          createdAt: new Date().toISOString()
        };
        res.json(result);
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /r/:token - URL redirect tracking endpoint (public)
app.get('/r/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const [tracker, wanIp] = await Promise.all([
      new Promise((resolve, reject) => {
        db.get('SELECT * FROM ip_tracker WHERE token = ? AND type = ?', [token, 'url'], (err, row) => {
          if (err) reject(err); else resolve(row);
        });
      }),
      getWanIp()
    ]);

    if (!tracker) {
      return res.status(404).send('Not found');
    }

    const ua = req.headers['user-agent'] || 'unknown';

    // If crawler bot → return OG HTML for social preview
    if (isBot(ua)) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const html = buildOgHtml(tracker, baseUrl);
      return res.setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
    }

    const ip = getClientIp(req);
    const headers = sanitizeHeaders(req.headers);

    db.run(`INSERT INTO ip_tracker_logs (tracker_id, ip, wan_ip, user_agent, headers, query_params) VALUES (?, ?, ?, ?, ?, ?)`,
      [tracker.id, ip, wanIp, ua, JSON.stringify(headers), JSON.stringify(req.query || {})],
      (logErr) => {
        if (logErr) console.error('Log error:', logErr.message);
      }
    );

    // Redirect to target URL
    const target = tracker.redirect_url || 'https://www.google.com';
    res.redirect(target);
  } catch (err) {
    console.error('r error:', err.message);
    res.status(500).send('Error');
  }
});

// GET /i/:token - Image serve tracking endpoint (public)
app.get('/i/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const [tracker, wanIp] = await Promise.all([
      new Promise((resolve, reject) => {
        db.get('SELECT * FROM ip_tracker WHERE token = ? AND type = ?', [token, 'image'], (err, row) => {
          if (err) reject(err); else resolve(row);
        });
      }),
      getWanIp()
    ]);

    if (!tracker || !tracker.image_path) {
      return res.status(404).send('Not found');
    }

    const ua = req.headers['user-agent'] || 'unknown';

    // If crawler bot → return OG HTML for social preview
    if (isBot(ua)) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const html = buildOgHtml(tracker, baseUrl);
      return res.setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
    }

    const ip = getClientIp(req);
    const headers = sanitizeHeaders(req.headers);

    db.run(`INSERT INTO ip_tracker_logs (tracker_id, ip, wan_ip, user_agent, headers, query_params) VALUES (?, ?, ?, ?, ?, ?)`,
      [tracker.id, ip, wanIp, ua, JSON.stringify(headers), JSON.stringify(req.query || {})],
      (logErr) => {
        if (logErr) console.error('Log error:', logErr.message);
      }
    );

    // Serve the original image
    const imgExt = path.extname(tracker.image_name || '.png').toLowerCase();
    const contentType = imgExt === '.jpg' || imgExt === '.jpeg' ? 'image/jpeg' : 'image/png';
    res.setHeader('Content-Type', contentType);
    res.sendFile(path.resolve(tracker.image_path), (sendErr) => {
      if (sendErr) {
        res.status(500).send('Error serving image');
      }
    });
  } catch (err) {
    console.error('i error:', err.message);
    res.status(500).send('Error');
  }
});

// GET /d/:token - Download image with embedded tracking pixel
app.get('/d/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const [tracker, wanIp] = await Promise.all([
      new Promise((resolve, reject) => {
        db.get('SELECT * FROM ip_tracker WHERE token = ? AND type = ?', [token, 'image'], (err, row) => {
          if (err) reject(err); else resolve(row);
        });
      }),
      getWanIp()
    ]);

    if (!tracker || !tracker.image_path) {
      return res.status(404).send('Not found');
    }

    const ip = getClientIp(req);
    const ua = req.headers['user-agent'] || 'unknown';
    const headers = sanitizeHeaders(req.headers);

    db.run(`INSERT INTO ip_tracker_logs (tracker_id, ip, wan_ip, user_agent, headers, query_params) VALUES (?, ?, ?, ?, ?, ?)`,
      [tracker.id, ip, wanIp, ua, JSON.stringify(headers), JSON.stringify(req.query || {})],
      (logErr) => {
        if (logErr) console.error('Log error:', logErr.message);
      }
    );

    // Check if watermarked version exists
    const originalExt = path.extname(tracker.image_name || '.png').toLowerCase();
    const watermarkedPath = tracker.image_path + '_tracked' + (originalExt === '.png' ? '.png' : '.jpg');
    const fileToServe = fs.existsSync(watermarkedPath) ? watermarkedPath : tracker.image_path;

    const contentType = originalExt === '.jpg' || originalExt === '.jpeg' ? 'image/jpeg' : 'image/png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${tracker.image_name || 'image'}"`);
    res.sendFile(path.resolve(fileToServe), (sendErr) => {
      if (sendErr) {
        res.status(500).send('Error serving image');
      }
    });
  } catch (err) {
    console.error('d error:', err.message);
    res.status(500).send('Error');
  }
});

// GET /api/tools/ip-tracker/list - List user's tracking links
app.get('/api/tools/ip-tracker/list', requireAuth, (req, res) => {
  db.all(`SELECT t.*, 
    (SELECT COUNT(*) FROM ip_tracker_logs WHERE tracker_id = t.id) as click_count,
    (SELECT MAX(timestamp) FROM ip_tracker_logs WHERE tracker_id = t.id) as last_click
    FROM ip_tracker t WHERE t.user_id = ? ORDER BY t.created_at DESC`,
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      res.json(rows.map(r => ({
        ...r,
        trackingUrl: r.type === 'url' ? `${baseUrl}/r/${r.token}` : `${baseUrl}/i/${r.token}`,
        imageDownloadUrl: r.type === 'image' ? `${baseUrl}/d/${r.token}` : null,
        shareUrl: `${baseUrl}/api/tools/ip-tracker/${r.id}/share`
      })));
    }
  );
});

// GET /api/tools/ip-tracker/:id/results - Get detailed logs
app.get('/api/tools/ip-tracker/:id/results', requireAuth, (req, res) => {
  const trackerId = req.params.id;

  db.get('SELECT * FROM ip_tracker WHERE id = ? AND user_id = ?', [trackerId, req.user.id], (err, tracker) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!tracker) return res.status(404).json({ error: 'Tracker not found' });

    db.all('SELECT * FROM ip_tracker_logs WHERE tracker_id = ? ORDER BY timestamp DESC', [trackerId], (err2, logs) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ tracker, logs: logs.map(l => ({
        ...l,
        headers: l.headers ? JSON.parse(l.headers) : {},
        query_params: l.query_params ? JSON.parse(l.query_params) : {}
      })) });
    });
  });
});

// GET /api/tools/ip-tracker/:id/share - Public share page (no auth, renders HTML)
app.get('/api/tools/ip-tracker/:id/share', (req, res) => {
  const trackerId = req.params.id;
  db.get('SELECT * FROM ip_tracker WHERE id = ?', [trackerId], (err, tracker) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!tracker) return res.status(404).send('Not found');

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const html = buildOgHtml(tracker, baseUrl);
    res.setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
  });
});

// DELETE /api/tools/ip-tracker/:id - Delete tracker
app.delete('/api/tools/ip-tracker/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM ip_tracker WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, deleted: this.changes });
  });
});

// Fallback OG default image
app.get('/api/tools/ip-tracker/og-default.jpg', (req, res) => {
  // Return 1x1 transparent pixel as placeholder
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
  res.setHeader('Content-Type', 'image/png');
  res.send(pixel);
});

// ========================
// VNTA PORT CHECK PROXY
// ========================

const VNTA_BASE = 'https://vntelecom.vnta.gov.vn:10246';
const VNTA_SEARCH = VNTA_BASE + '/vnta/search';
const vntaAxios = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  maxRedirects: 0,
  timeout: 15000
});
const vntaSessions = new Map(); // sessionId -> { cookies }

// Get captcha from VNTA
app.get('/api/tools/port-check/captcha', requireAuth, async (req, res) => {
  try {
    // Step 1: GET search page to get session cookie
    const pageRes = await vntaAxios.get(VNTA_SEARCH, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      responseType: 'text',
      validateStatus: () => true
    });

    // Extract cookies
    const setCookie = pageRes.headers['set-cookie'];
    const cookieStr = setCookie ? setCookie.map(c => c.split(';')[0]).join('; ') : '';

    // Parse captcha URL from HTML
    const html = pageRes.data;
    const captchaMatch = html.match(/<img[^>]*src=["']([^"']*captcha[^"']*)["']/i);
    let captchaUrl;
    if (captchaMatch) {
      captchaUrl = captchaMatch[1];
      if (captchaUrl.startsWith('/')) captchaUrl = VNTA_BASE + captchaUrl;
    } else {
      // Try alternative patterns
      const imgMatch = html.match(/<img[^>]*src=["']([^"']*\/vnta\/[^"']*)["']/i);
      if (imgMatch) {
        captchaUrl = imgMatch[1];
        if (captchaUrl.startsWith('/')) captchaUrl = VNTA_BASE + captchaUrl;
      }
    }

    if (!captchaUrl) {
      return res.status(500).json({ error: 'Không tìm thấy captcha từ VNTA' });
    }

    // Step 2: Fetch captcha image
    const captchaRes = await vntaAxios.get(captchaUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': cookieStr,
        'Referer': VNTA_SEARCH
      },
      responseType: 'arraybuffer',
      validateStatus: () => true
    });

    const captchaBase64 = Buffer.from(captchaRes.data).toString('base64');

    // Parse CSRF tokens
    const csrfTokenMatch = html.match(/name="_csrf"\s+content="([^"]+)"/i) || html.match(/content="([^"]+)"\s+name="_csrf"/i);
    const csrfHeaderMatch = html.match(/name="_csrf_header"\s+content="([^"]+)"/i) || html.match(/content="([^"]+)"\s+name="_csrf_header"/i);

    const csrfToken = csrfTokenMatch ? csrfTokenMatch[1] : '';
    const csrfHeader = csrfHeaderMatch ? csrfHeaderMatch[1] : 'TOKEN';

    // Store session
    const sessionId = require('crypto').randomBytes(32).toString('hex');
    vntaSessions.set(sessionId, {
      cookies: cookieStr,
      csrfToken,
      csrfHeader,
      created: Date.now()
    });

    // Cleanup old sessions (>10 min)
    for (const [id, sess] of vntaSessions) {
      if (Date.now() - sess.created > 600000) vntaSessions.delete(id);
    }

    res.json({ captchaBase64, sessionId });
  } catch (err) {
    console.error('VNTA captcha error:', err.message);
    res.status(500).json({ error: 'Lỗi kết nối VNTA: ' + err.message });
  }
});

// Search phone number on VNTA
app.post('/api/tools/port-check/search', requireAuth, async (req, res) => {
  try {
    const { phone, captcha, sessionId } = req.body;
    if (!phone || !captcha || !sessionId) {
      return res.status(400).json({ error: 'Thiếu thông tin: phone, captcha, sessionId' });
    }

    const session = vntaSessions.get(sessionId);
    if (!session) {
      return res.status(400).json({ error: 'Phiên hết hạn, vui lòng tải lại captcha' });
    }

    const VNTA_SEARCH_INFO = VNTA_BASE + '/vnta/action/phone/searchInfo';

    // POST search to VNTA
    const searchRes = await vntaAxios.post(VNTA_SEARCH_INFO,
      new URLSearchParams({
        json: JSON.stringify({
          searchPhone: phone,
          recaptcha1: captcha
        })
      }).toString(),
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Cookie': session.cookies,
          'Referer': VNTA_SEARCH,
          'Origin': VNTA_BASE,
          [session.csrfHeader]: session.csrfToken
        },
        responseType: 'json',
        validateStatus: () => true
      }
    );

    const result = searchRes.data;

    if (!result) {
      vntaSessions.delete(sessionId);
      return res.status(500).json({ error: 'Không nhận được phản hồi từ VNTA' });
    }

    if (result.code === 11 || result.code === 999) {
      vntaSessions.delete(sessionId);
      return res.status(400).json({ error: result.message || 'Captcha không chính xác hoặc lỗi tra cứu' });
    }

    const obj = result.objInfos;
    if (!obj || obj.result !== 200) {
      vntaSessions.delete(sessionId);
      return res.status(400).json({ error: 'Không tìm thấy thông tin thuê bao hoặc lỗi hệ thống VNTA' });
    }

    const currentCarrier = (obj.mnp_status === "0") ? obj.origin_telco : obj.dst_telco;
    const responseData = {
      phone: obj.phone_number,
      subscriber: obj.phone_number,
      originalCarrier: obj.origin_telco,
      currentCarrier: currentCarrier,
      carrier: currentCarrier,
      details: (obj.mnp_status === "0") ? 'Chưa chuyển mạng' : `Đã chuyển mạng sang ${obj.dst_telco}`
    };

    vntaSessions.delete(sessionId);
    res.json(responseData);
  } catch (err) {
    console.error('VNTA search error:', err.message);
    res.status(500).json({ error: 'Lỗi kết nối VNTA: ' + err.message });
  }
});

// ========================
// SERVER START
// ========================

// Create upload directories if not exist
['uploads', 'uploads/tracker'].forEach(dir => {
  const p = path.join(__dirname, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  initSyncScheduler();
  initLookupHistoryRetention();
});
