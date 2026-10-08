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
      res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    });
  });
});

app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).json({ error: err.message });
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username already exists' });
        return res.status(500).json({ error: err.message });
      }
      const token = jwt.sign({ id: this.lastID, username, role: 'user' }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token, user: { id: this.lastID, username, role: 'user' } });
    });
  });
});

app.get('/api/me', requireAuth, (req, res) => {
  db.get('SELECT id, username, role, created_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  });
});

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
// lat, lng, range, source, found }]. mode: 'single' | 'batch'.
function logLookups(userId, mode, batchId, items) {
  if (!items || items.length === 0) return;
  const ph = items.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
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
    );
  }
  db.run(`INSERT INTO lookup_history
    (user_id, mode, mcc, mnc, lac, cellid, sector, lat, lng, range, source, found, batch_id)
    VALUES ${ph}`, flat, () => {});
}

// GET /api/lookup-history - current user's lookup history (paged, filter by mode)
app.get('/api/lookup-history', requireAuth, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;
  const mode = req.query.mode;
  let where = 'WHERE user_id = ?';
  const params = [req.user.id];
  if (mode === 'single' || mode === 'batch') { where += ' AND mode = ?'; params.push(mode); }
  db.get(`SELECT COUNT(*) AS total FROM lookup_history ${where}`, params, (err, cnt) => {
    if (err) return res.status(500).json({ error: err.message });
    db.all(`SELECT * FROM lookup_history ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset], (err2, rows) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ data: rows, total: cnt.total, page, limit, totalPages: Math.max(1, Math.ceil(cnt.total / limit)) });
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

// DELETE /api/lookup-history/batch/:batchId - delete one batch (owner only)
app.delete('/api/lookup-history/batch/:batchId', requireAuth, (req, res) => {
  db.run('DELETE FROM lookup_history WHERE user_id = ? AND batch_id = ?', [req.user.id, req.params.batchId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, deleted: this.changes });
  });
});

// POST /api/lookup-history/delete - delete selected ids (owner only)
app.post('/api/lookup-history/delete', requireAuth, (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
  const nums = ids.map((n) => parseInt(n, 10)).filter((n) => Number.isFinite(n));
  if (nums.length === 0) return res.status(400).json({ error: 'no valid ids' });
  const ph = nums.map(() => '?').join(', ');
  db.run(`DELETE FROM lookup_history WHERE user_id = ? AND id IN (${ph})`, [req.user.id, ...nums], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, deleted: this.changes });
  });
});

// DELETE /api/lookup-history/:id - delete a single entry (owner only)
app.delete('/api/lookup-history/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM lookup_history WHERE user_id = ? AND id = ?', [req.user.id, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, deleted: this.changes });
  });
});

// ========================
// Admin: User Management
// ========================
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
  db.all('SELECT id, username, role, status, created_at FROM users ORDER BY created_at DESC', (err, users) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(users);
  });
});

app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  const { username, password, role, status } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).json({ error: err.message });
    db.run('INSERT INTO users (username, password, role, status) VALUES (?, ?, ?, ?)',
      [username, hash, role || 'user', status || 'active'], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
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
  const sql = 'SELECT mcc, mnc, lac, cellid, lat, lng AS lon, range, description FROM cells WHERE lat IS NOT NULL AND lng IS NOT NULL ORDER BY id DESC LIMIT 20000';
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

// Cell resolve online — local first (always #1), then online sources by priority ASC
app.get('/api/cells/resolve', optionalAuth, (req, res) => {
  const { mcc, mnc, lac, cellid, sector } = req.query;
  if (!mcc || !mnc || !lac || !cellid) return res.status(400).json({ error: 'mcc, mnc, lac, cellid required' });
  const userId = req.user ? req.user.id : null;
  const logOne = (found, source, lat, lng, range) => logLookups(userId, 'single', null,
    [{ mcc, mnc, lac, cellid, sector, lat, lng, range, source, found }]);
  const lookupLocal = () => probeCellRow({ mcc, mnc, lac, cellid, sector });
  lookupLocal().then(async (row) => {
    if (row && row.lat) {
      logOne(true, 'local', row.lat, row.lng, row.range);
      return res.json({ source: 'local', data: { ...row, lon: row.lng } });
    }

    // Build candidate cellid list (raw first, then ECI form for OpenCellID)
    const parsed = cellId.parseCellId(cellid);
    const candidates = [String(cellid)];
    if (parsed && parsed.isShort && String(parsed.eci) !== String(cellid)) {
      candidates.push(String(parsed.eci));
    }

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
        } else if (src.type === 't0stbrot') {
          data = await resolveT0stbrot({ mcc, mnc, lac, cellid });
        } else if (src.type === 'combain') {
          data = await resolveCombain({ mcc, mnc, lac, cellid });
        }
        if (data && data.lat != null) {
          const storeCellid = data.cellid || cellid;
          db.run('INSERT OR REPLACE INTO cells (mcc, mnc, lac, cellid, lat, lng, range, description, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [mcc, mnc, lac, storeCellid, data.lat, data.lon, data.range, data.description || '', src.type], () => {});
          logOne(true, src.type, data.lat, data.lon, data.range);
          return res.json({ source: src.type, data });
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
  const { cells } = req.body;
  if (!Array.isArray(cells) || cells.length === 0) return res.status(400).json({ error: 'cells array required' });

  const batchId = require('crypto').randomUUID();
  const userId = req.user ? req.user.id : null;
  const onlineSources = await getEnabledOnlineSources();
  const results = [];
  const MAX_ONLINE = parseInt(await getSetting('max_online_resolve', '50'), 10);
  const maxOnline = Number.isFinite(MAX_ONLINE) && MAX_ONLINE > 0 ? MAX_ONLINE : 0;
  let onlineCount = 0;

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
      historyItems.push({ ...c, lat: reused.lat, lng: reused.lon, range: reused.range, source: reused.source, found: !!reused.lat });
      continue;
    }

    const row = await probeCellRow({ mcc: c.mcc, mnc: c.mnc, lac: c.lac, cellid: c.cellid, sector: c.sector });
    if (row && row.lat) {
      const r = { source: 'local', lat: row.lat, lon: row.lng, range: row.range, description: row.description };
      for (const a of aliases) memo.set(a, r);
      memo.set(canon, r);
      results.push({ key, ...r });
      historyItems.push({ ...c, lat: row.lat, lng: row.lng, range: row.range, source: 'local', found: true });
    } else {
      results.push({ key, source: null, lat: null, lon: null, range: null, pending: true });
      historyItems.push({ ...c, lat: null, lng: null, range: null, source: null, found: false });
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
      historyItems[i] = { ...c, lat: reused.lat, lng: reused.lon, range: reused.range, source: reused.source, found: !!reused.lat };
      continue;
    }

    if (onlineCount >= maxOnline) { hasMore = true; continue; }

    const parsedB = cellId.parseCellId(c.cellid);
    const candidatesB = [String(c.cellid)];
    if (parsedB && parsedB.isShort && String(parsedB.eci) !== String(c.cellid)) {
      candidatesB.push(String(parsedB.eci));
    }

    let saved = null;
    let savedType = null;
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
        } else if (src.type === 't0stbrot') {
          data = await resolveT0stbrot({ mcc: c.mcc, mnc: c.mnc, lac: c.lac, cellid: c.cellid });
        } else if (src.type === 'combain') {
          data = await resolveCombain({ mcc: c.mcc, mnc: c.mnc, lac: c.lac, cellid: c.cellid });
        }
        if (data && data.lat != null) {
          const storeCellid = data.cellid || c.cellid;
          db.run('INSERT OR REPLACE INTO cells (mcc, mnc, lac, cellid, lat, lng, range, description, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [c.mcc, c.mnc, c.lac, storeCellid, data.lat, data.lon, data.range, data.description || '', src.type], () => {});
          saved = data;
          savedType = src.type;
        }
      } catch (e) { /* not found, try next source */ }
    }

    if (saved) {
      onlineCount++;
      const r2 = { source: savedType, lat: saved.lat, lon: saved.lon, range: saved.range, description: saved.description };
      for (const a of aliases) memo.set(a, r2);
      memo.set(canon, r2);
      results[i] = { key: r.key, ...r2 };
      historyItems[i] = { ...c, lat: saved.lat, lng: saved.lon, range: saved.range, source: savedType, found: true };
    } else {
      const miss = { source: null, lat: null, lon: null, range: null };
      for (const a of aliases) memo.set(a, miss);
      memo.set(canon, miss);
      results[i] = { key: r.key, source: null, lat: null, lon: null, range: null };
      historyItems[i] = { ...c, lat: null, lng: null, range: null, source: null, found: false };
    }
  }

  for (const r of results) delete r.pending;

  logLookups(userId, 'batch', batchId, historyItems);
  res.json({ results, onlineLookups: onlineCount, batchId, hasMore, pending: hasMore });
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
const ONLINE_SOURCE_TYPES = ['opencellid', 't0stbrot', 'combain'];
const ONLINE_SOURCE_DEFAULTS = { opencellid: { name: 'OpenCellID.org', priority: 10 }, t0stbrot: { name: 't0stbrot.net', priority: 20 }, combain: { name: 'Combain.com', priority: 30 } };

// Seed the built-in online sources once, so admins see them in the UI.
function seedOnlineSources() {
  for (const type of ONLINE_SOURCE_TYPES) {
    const def = ONLINE_SOURCE_DEFAULTS[type];
    db.get('SELECT id FROM data_sources WHERE type = ? LIMIT 1', [type], (err, row) => {
      if (err || row) return;
      db.run('INSERT INTO data_sources (name, type, base_url, api_key, enabled, priority) VALUES (?, ?, ?, ?, 1, ?)',
        [def.name, type, '', '', def.priority], () => {});
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
  return { mcc, mnc, lac, cellid, lat: d.lat, lon: d.lon, range: d.range || 1000, description: d.address || `OpenCellID ${mcc}-${mnc}` };
}

// t0stbrot.net — free LTE cell lookup (3GPP ECI -> lat/lon). No API key.
// Docs: https://docs.t0stbrot.net/cells/info — GET /api/public/cells/info/lte?mcc&mnc&cid
// The endpoint indexes by ECI (Cell ID), so try the ECI form first, then raw.
async function resolveT0stbrot({ mcc, mnc, lac, cellid }) {
  const parsed = cellId.parseCellId(cellid);
  const cids = [];
  if (parsed) {
    cids.push(String(parsed.eci));                 // short -> ECI, long -> itself
    if (String(parsed.eci) !== String(cellid)) cids.push(String(cellid)); // raw fallback
  } else {
    cids.push(String(cellid));
  }
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
async function resolveCombain({ mcc, mnc, lac, cellid }, apiKey) {
  const key = apiKey || await getCombainKey();
  if (!key) throw new Error('Combain API key chưa cấu hình');

  // Auto-detect radio type from the cell id: a parseable LTE shape (eNB/ECI)
  // maps to 'lte', otherwise fall back to 'gsm'. Send the ECI form so Combain
  // receives the full LTE cell identity.
  const parsed = cellId.parseCellId(cellid);
  const radioType = parsed ? 'lte' : 'gsm';
  const sendCellId = parsed ? parsed.eci : parseInt(cellid, 10);

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
    description: `Combain ${radioType} ${mcc}-${mnc}`
  };
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
        if (d && d.lat) {
          db.run('UPDATE cells SET lat = ?, lng = ?, range = ?, source = ? WHERE mcc = ? AND mnc = ? AND lac = ? AND cellid = ?',
            [d.lat, d.lon, d.range || 1000, 'opencellid', c.mcc, c.mnc, c.lac, c.cellid], () => {});
          db.run('INSERT OR IGNORE INTO cells (mcc, mnc, lac, cellid, lat, lng, range, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [c.mcc, c.mnc, c.lac, c.cellid, d.lat, d.lon, d.range || 1000, 'opencellid'], () => {});
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

    if (mcc === '' || mnc === '' || lac === '' || cellid === '' || isNaN(lat) || isNaN(lon)) {
      session.errors++;
      errorsDetail.push({ row: idx + 1, error: 'Missing/invalid fields' });
      return;
    }
    valid.push([mcc, mnc, lac, cellid, lat, lon, range, 'csv']);
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
    const placeholders = slice.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const flat = [];
    slice.forEach(v => flat.push(...v));
    db.run(`INSERT OR IGNORE INTO cells (mcc, mnc, lac, cellid, lat, lng, range, source) VALUES ${placeholders}`, flat, function(err) {
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
    db.all(`SELECT mcc, mnc, lac, cellid, lat, lng, range FROM cells WHERE lac IN (${ph}) AND lat IS NOT NULL`, lacList, (err, cellRows) => {
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
          if (c && c.lat != null) { r.lat = c.lat; r.lon = c.lng; r.cell_range = c.range; break; }
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
    const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const flat = [];
    for (const r of batch) flat.push(r.mcc, r.mnc, r.lac, r.cellid, r.lat, r.lng, r.range, r.address, r.city, r.source);
    db.run(`INSERT OR IGNORE INTO cells (mcc, mnc, lac, cellid, lat, lng, range, address, city, source) VALUES ${placeholders}`, flat, function (err) {
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
        if (!mcc || !mnc || !lac || !cellid || isNaN(lat) || isNaN(lng)) {
          failed++; errors.push(`Row ${total}: Missing/invalid fields`);
          return;
        }
        csvRows.push({
          mcc, mnc, lac, cellid, lat, lng,
          range: parseInt(row.range || row.RANGE) || 0,
          address: row.address || row.Address || row.address_en || '',
          city: row.city || row.City || '',
          source: row.source || row.Source || 'csv'
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
        if (!mcc || !mnc || !lac || !cellid || isNaN(lat) || isNaN(lng)) {
          failed++; errors.push(`Row ${total}: Missing/invalid fields`);
          return null;
        }
        return {
          mcc, mnc, lac, cellid, lat, lng,
          range: parseInt(row.range || row.RANGE) || 0,
          address: row.address || row.Address || row.address_en || '',
          city: row.city || row.City || '',
          source: row.source || row.Source || 'csv'
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
  db.all('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC', (err, users) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(users);
  });
});

app.post('/api/admin/users', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).json({ error: err.message });
    db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hash, role || 'user'], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
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
const SETTING_KEYS = ['max_online_resolve', 'lookup_history_retention_days'];

// GET /api/settings
app.get('/api/settings', requireAuth, requireAdmin, async (req, res) => {
  try {
    const out = {};
    for (const k of SETTING_KEYS) out[k] = await getSetting(k, k === 'max_online_resolve' ? '50' : '90');
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
    for (const k of SETTING_KEYS) {
      if (patch[k] !== undefined) {
        const v = String(patch[k]).trim();
        if (v === '' || !Number.isFinite(Number(v)) || Number(v) < 0) {
          return res.status(400).json({ error: `Giá trị không hợp lệ cho ${k}` });
        }
        await setSetting(k, v);
      }
    }
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
  <meta property="og:site_name" content="cell-tracker">
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
