/**
 * Harness dùng chung cho test tích hợp HTTP: DB tạm + cổng trống + helper request.
 *
 * Cách dùng:
 *   const { start } = require('./_test-server');
 *   const h = await start();
 *   const res = await h.req('GET', '/api/...', undefined, h.token);
 *   await h.cleanup();
 *
 * Không đụng database.sqlite thật: patch sqlite3 trước khi require('./server')
 * (giống _topupapi.js / _credittest.js).
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const net = require('net');

const realDbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(path.dirname(__dirname), 'database.sqlite');

function patchSqlite(tmpDb) {
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
}

function pickFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

function waitPort(port) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    (function poll() {
      const s = net.connect(port, '127.0.0.1');
      s.on('connect', () => { s.destroy(); resolve(); });
      s.on('error', () => {
        s.destroy();
        if (Date.now() - t0 > 9000) return resolve();
        setTimeout(poll, 120);
      });
    })();
  });
}

async function start() {
  const tmpDb = path.join(os.tmpdir(), `cell-test-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`);
  patchSqlite(tmpDb);
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-admin';
  process.env.PORT = String(await pickFreePort());

  require('./server');
  const db = require('./database');
  await waitPort(Number(process.env.PORT));

  const base = () => `http://127.0.0.1:${process.env.PORT}`;

  function req(method, urlPath, body, token) {
    return new Promise((resolve, reject) => {
      const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
      const r = http.request(base() + urlPath, {
        method,
        headers: Object.assign(
          { 'Content-Type': 'application/json' },
          data ? { 'Content-Length': data.length } : {},
          token ? { Authorization: 'Bearer ' + token } : {}
        )
      }, (res) => {
        let buf = '';
        res.on('data', c => { buf += c; });
        res.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(buf); } catch (e) { parsed = buf; }
          resolve({ status: res.statusCode, body: parsed, headers: res.headers });
        });
      });
      r.on('error', reject);
      if (data) r.write(data);
      r.end();
    });
  }

  const sqlRun = (sql, params = []) => new Promise((resolve, reject) =>
    db.run(sql, params, function (err) { return err ? reject(err) : resolve(this); }));
  const sqlGet = (sql, params = []) => new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row))));

  const bcrypt = require('bcryptjs');

  /** Tạo user trực tiếp trong DB (nhanh, không qua route) + trả id. */
  async function createUser({ username, password = 'pw12345', role = 'user', status = 'active', email = null, verified = 0 }) {
    const hash = await bcrypt.hash(password, 4);
    const r = await sqlRun(
      `INSERT INTO users (username, password, role, status, email, email_verified, credit_balance)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [username, hash, role, status, email, verified]);
    return r.lastID;
  }

  async function login(username, password = 'pw12345') {
    const r = await req('POST', '/api/login', { username, password });
    return r.body && r.body.token ? r.body.token : null;
  }

  async function cleanup() {
    try { db.close(); } catch (e) { /* ignore */ }
    for (const f of [tmpDb, tmpDb + '-journal', tmpDb + '-wal', tmpDb + '-shm']) {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) { /* ignore */ }
    }
  }

  return { req, sqlRun, sqlGet, createUser, login, cleanup, db, tmpDb };
}

module.exports = { start, realDbPath };
