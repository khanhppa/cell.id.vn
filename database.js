const path = require('path');
const fs = require('fs');

const dbDir = path.dirname(__dirname);
const dbPath = path.join(dbDir, 'database.sqlite');

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Legacy `history` table is superseded by `lookup_history` (below). Drop it.
  db.run(`DROP TABLE IF EXISTS history`);

  // Generic key/value settings (admin-configurable).
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Full audit of cell lookups (single + batch), replacing the old `history`.
  db.run(`CREATE TABLE IF NOT EXISTS lookup_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    mode TEXT,
    mcc TEXT,
    mnc TEXT,
    lac TEXT,
    cellid TEXT,
    sector TEXT,
    lat REAL,
    lng REAL,
    range REAL,
    source TEXT,
    found INTEGER DEFAULT 0,
    batch_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS cells (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mcc TEXT,
    mnc TEXT,
    lac TEXT,
    cellid TEXT,
    lat REAL,
    lng REAL,
    range REAL DEFAULT 0,
    description TEXT,
    address TEXT,
    city TEXT,
    source TEXT,
    user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS data_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'opencellid',
    base_url TEXT DEFAULT '',
    api_key TEXT DEFAULT '',
    username TEXT DEFAULT '',
    password TEXT DEFAULT '',
    mcc TEXT DEFAULT '',
    mnc TEXT DEFAULT '',
    lac TEXT DEFAULT '',
    max_cells INTEGER DEFAULT 100,
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`ALTER TABLE data_sources ADD COLUMN priority INTEGER DEFAULT 100`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error('priority column:', err.message);
  });

  db.run(`CREATE TABLE IF NOT EXISTS call_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    network TEXT,
    phone_number TEXT,
    action_type TEXT,
    timestamp TEXT,
    contact_number TEXT,
    duration TEXT,
    mcc TEXT,
    mnc TEXT,
    lac TEXT,
    cellid TEXT,
    cell_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    filename TEXT,
    original_name TEXT,
    type TEXT,
    total INTEGER DEFAULT 0,
    inserted INTEGER DEFAULT 0,
    updated INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    errors TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS ip_tracker (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('url', 'image')),
    name TEXT DEFAULT '',
    redirect_url TEXT DEFAULT '',
    image_path TEXT,
    image_name TEXT,
    token TEXT UNIQUE NOT NULL,
    og_title TEXT DEFAULT '',
    og_description TEXT DEFAULT '',
    og_image TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS ip_tracker_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracker_id INTEGER NOT NULL,
    ip TEXT,
    wan_ip TEXT,
    user_agent TEXT,
    headers TEXT,
    query_params TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tracker_id) REFERENCES ip_tracker(id) ON DELETE CASCADE
  )`);

  // Fix: add wan_ip column if missing on existing DB
  db.run(`ALTER TABLE ip_tracker_logs ADD COLUMN wan_ip TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding wan_ip column:', err.message);
    }
  });

  // Fix: add status column to existing users
  db.run(`ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding status column:', err.message);
    }
  });

  // Fix: add cells extra columns on existing DB
  db.run(`ALTER TABLE cells ADD COLUMN range REAL DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding range column:', err.message);
    }
  });
  db.run(`ALTER TABLE cells ADD COLUMN description TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding description column:', err.message);
    }
  });
  db.run(`ALTER TABLE cells ADD COLUMN user_id INTEGER`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding user_id column:', err.message);
    }
  });

  // Fix: add user_id column to existing call_logs table
  db.run(`ALTER TABLE call_logs ADD COLUMN user_id INTEGER`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding call_logs user_id column:', err.message);
    }
  });

  // Fix: add enb_id / sector columns (short cell ID conversions) to existing call_logs table
  db.run(`ALTER TABLE call_logs ADD COLUMN enb_id TEXT DEFAULT ''`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding call_logs enb_id column:', err.message);
    }
  });
  db.run(`ALTER TABLE call_logs ADD COLUMN sector TEXT DEFAULT ''`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding call_logs sector column:', err.message);
    }
  });

  // Fix: add og columns if missing on existing DB
  db.run(`ALTER TABLE ip_tracker ADD COLUMN og_title TEXT DEFAULT ''`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding og_title column:', err.message);
    }
  });
  db.run(`ALTER TABLE ip_tracker ADD COLUMN og_description TEXT DEFAULT ''`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding og_description column:', err.message);
    }
  });
  db.run(`ALTER TABLE ip_tracker ADD COLUMN og_image TEXT DEFAULT ''`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding og_image column:', err.message);
    }
  });

  // Create indexes
  // Dedupe then add UNIQUE so bulk INSERT OR IGNORE is fast & skips dupes in one statement.
  // Drop any pre-existing NON-unique index of the same name first — CREATE UNIQUE ... IF NOT EXISTS
  // would otherwise be a silent no-op because the name is already taken.
  db.run(`DELETE FROM cells WHERE id NOT IN (SELECT MIN(id) FROM cells GROUP BY mcc, mnc, lac, cellid)`);
  db.run(`DROP INDEX IF EXISTS idx_cells_lookup`, () => {
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_cells_lookup ON cells(mcc, mnc, lac, cellid)`, (err) => {
      if (err) console.error('idx_cells_lookup (unique) warning:', err.message);
    });
  });
  db.run(`CREATE INDEX IF NOT EXISTS idx_cells_lookup_nonunique ON cells(lat)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_call_logs_user ON call_logs(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ip_tracker_token ON ip_tracker(token)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ip_tracker_user ON ip_tracker(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ip_tracker_logs_tracker ON ip_tracker_logs(tracker_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_lookup_history_user ON lookup_history(user_id, created_at DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_lookup_history_batch ON lookup_history(batch_id)`);

  // Seed default settings (only when missing — never overwrite admin changes).
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('max_online_resolve', '50')`);
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('lookup_history_retention_days', '90')`);

  // Automatic OpenCellID sync jobs (VN / MCC 452 by default, daily at 03:00).
  db.run(`CREATE TABLE IF NOT EXISTS sync_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER,
    cron_expr TEXT DEFAULT '0 3 * * *',
    scope TEXT DEFAULT 'mcc',
    mcc_list TEXT DEFAULT '452',
    enabled INTEGER DEFAULT 1,
    last_run DATETIME,
    last_status TEXT,
    last_message TEXT,
    last_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Backfill MCC on existing OpenCellID sources, then seed a default VN sync job.
  db.run(`UPDATE data_sources SET mcc = '452' WHERE type = 'opencellid' AND (mcc IS NULL OR mcc = '')`);
  db.get(`SELECT COUNT(*) AS c FROM sync_jobs`, [], (err, row) => {
    if (err || (row && row.c > 0)) return;
    db.get(`SELECT id FROM data_sources WHERE type = 'opencellid' ORDER BY id LIMIT 1`, [], (err2, src) => {
      const sourceId = src ? src.id : null;
      db.run(`INSERT INTO sync_jobs (source_id, cron_expr, scope, mcc_list, enabled) VALUES (?, ?, ?, ?, 1)`,
        [sourceId, '0 3 * * *', 'mcc', '452'], () => {});
    });
  });
});

module.exports = db;