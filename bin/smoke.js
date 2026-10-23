#!/usr/bin/env node
/**
 * bin/smoke.js — smoke test "server có boot được và phục vụ được không".
 *
 * Vì sao có file này: bộ test e2e thủ công (`_*.js`) đã được dọn khỏi repo trước khi
 * lên production (xem CHANGELOG). Cần một cổng kiểm tra tự động, chạy được ở cả máy
 * dev lẫn CI, trả lời đúng câu hỏi: "bản này có khởi động và trả lời HTTP được không?"
 *
 * Cách làm: spawn `node server.js` với DB + thư mục upload TẠM (không đụng
 * database.sqlite thật), PORT trống, chờ `/healthz` (có truy vấn SQLite) và
 * `/api/version`, rồi tắt.
 *
 * Chạy:  node bin/smoke.js        (hoặc: npm run smoke)
 * Exit:  0 = pass, 1 = fail (in log server để đọc lỗi)
 *
 * Không cần quyền đặc biệt, không cần mạng ra ngoài.
 */
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS) || 45000;

function pickFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function get(port, urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: urlPath, timeout: 3000 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (d) => { body += d; });
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error(`timeout ${urlPath}`)));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(port, urlPath, deadline) {
  let lastErr = null;
  while (Date.now() < deadline) {
    try {
      const res = await get(port, urlPath);
      if (res.status === 200) return res;
      lastErr = new Error(`${urlPath} -> HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    await sleep(250);
  }
  throw lastErr || new Error(`hết thời gian chờ ${urlPath}`);
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-smoke-'));
  const dbPath = path.join(tmp, 'database.sqlite');
  const uploadDir = path.join(tmp, 'uploads');
  const port = await pickFreePort();
  const deadline = Date.now() + TIMEOUT_MS;

  let output = '';
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      HOST: '127.0.0.1',
      HTTPS_PORT: '0',
      JWT_SECRET: process.env.JWT_SECRET || 'smoke-test-secret-not-for-production',
      DB_PATH: dbPath,
      UPLOAD_DIR: uploadDir
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (d) => { output += d; });
  child.stderr.on('data', (d) => { output += d; });

  let exitInfo = null;
  child.on('exit', (code, signal) => { exitInfo = { code, signal }; });

  const fail = (msg) => {
    console.error(`\n[smoke] FAIL: ${msg}`);
    if (output.trim()) console.error(`\n----- server output -----\n${output.trim().slice(-4000)}\n-------------------------`);
    try { child.kill('SIGKILL'); } catch (_) {}
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
    process.exit(1);
  };

  let health;
  try {
    health = await waitFor(port, '/healthz', deadline);
  } catch (e) {
    if (exitInfo) return fail(`server thoát sớm (code=${exitInfo.code} signal=${exitInfo.signal}) trước khi /healthz sẵn sàng: ${e.message}`);
    return fail(`/healthz không sẵn sàng: ${e.message}`);
  }

  let healthJson;
  try { healthJson = JSON.parse(health.body); } catch (_) { return fail(`/healthz không trả JSON: ${health.body.slice(0, 200)}`); }
  if (!healthJson.ok) return fail(`/healthz báo không khoẻ: ${health.body.slice(0, 200)}`);

  const versionRes = await waitFor(port, '/api/version', deadline).catch((e) => fail(e.message));
  let versionJson;
  try { versionJson = JSON.parse(versionRes.body); } catch (_) { return fail(`/api/version không trả JSON: ${versionRes.body.slice(0, 200)}`); }
  if (!versionJson.version) return fail('/api/version thiếu trường version');

  // Trang tĩnh phải phục vụ được (bắt lỗi thiếu public/ trong artifact).
  for (const p of ['/', '/login.html', '/m/']) {
    const r = await get(port, p).catch((e) => fail(`${p}: ${e.message}`));
    if (r.status !== 200) return fail(`${p} -> HTTP ${r.status}`);
  }

  // Tắt êm: SIGTERM phải đóng trong 10s; nếu treo thì smoke cũng phải fail.
  child.kill('SIGTERM');
  const stopDeadline = Date.now() + 12000;
  while (!exitInfo && Date.now() < stopDeadline) await sleep(100);
  if (!exitInfo) {
    try { child.kill('SIGKILL'); } catch (_) {}
    return fail('server không thoát sau SIGTERM (shutdown bị treo)');
  }
  // Windows KHÔNG có signal thật: libuv giết tiến trình nên exit code = null,
  // signal = 'SIGTERM' (handler SIGTERM trong server không kịp chạy). Trên Linux
  // (CI/LXC) handler chạy và exit code phải = 0 — đó mới là thứ ta muốn kiểm tra.
  const exitedCleanly = exitInfo.code === 0
    || (process.platform === 'win32' && exitInfo.signal === 'SIGTERM');
  if (!exitedCleanly) return fail(`thoát sau SIGTERM với code=${exitInfo.code} signal=${exitInfo.signal}`);

  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  console.log(`[smoke] PASS — version ${versionJson.version}, /healthz ok, /, /login.html, /m/ 200, SIGTERM sạch`);
  process.exit(0);
})().catch((e) => {
  console.error('[smoke] FAIL (unexpected):', e && e.stack || e);
  process.exit(1);
});
