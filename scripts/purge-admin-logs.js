/**
 * Script 1 lần: xoá dữ liệu "Xem Rút list" (call_logs) + shape bản đồ (annotations)
 * của tài khoản admin (user_id = 1). Chạy: node scripts/purge-admin-logs.js
 * Backup database.sqlite TRƯỚC khi chạy. Xoá file này sau khi dùng xong.
 */
const path = require('path');
const sqlite3 = require('sqlite3');
const ADMIN_ID = 1;
// Mặc định giữ hành vi cũ: DB nằm ở thư mục CHA của repo (local dev).
// Production: đặt DB_PATH (xem .env.example).
const REPO_ROOT = path.dirname(__dirname);
const DB_PATH = process.env.DB_PATH || path.join(path.dirname(REPO_ROOT), 'database.sqlite');
const db = new sqlite3.Database(DB_PATH);
const all = (sql, p) => new Promise((res, rej) => db.all(sql, p || [], (e, r) => e ? rej(e) : res(r)));
const run = (sql, p) => new Promise((res, rej) => db.run(sql, p || [], function (e) { e ? rej(e) : res(this.changes); }));

(async () => {
  try {
    const before = {
      call_logs: (await all('SELECT COUNT(*) c FROM call_logs WHERE user_id = ?', [ADMIN_ID]))[0].c,
      annotations: (await all('SELECT COUNT(*) c FROM annotations WHERE user_id = ?', [ADMIN_ID]))[0].c
    };
    console.log('TRƯỚC:', JSON.stringify(before));

    const d1 = await run('DELETE FROM call_logs WHERE user_id = ?', [ADMIN_ID]);
    const d2 = await run('DELETE FROM annotations WHERE user_id = ?', [ADMIN_ID]);
    console.log(`Đã xoá: call_logs=${d1}, annotations=${d2}`);

    const after = {
      call_logs: (await all('SELECT COUNT(*) c FROM call_logs WHERE user_id = ?', [ADMIN_ID]))[0].c,
      annotations: (await all('SELECT COUNT(*) c FROM annotations WHERE user_id = ?', [ADMIN_ID]))[0].c
    };
    console.log('SAU:', JSON.stringify(after));
    console.log(after.call_logs === 0 && after.annotations === 0 ? 'OK — đã xoá sạch' : 'CẢNH BÁO — còn sót dữ liệu');
    db.close();
  } catch (e) {
    console.error('LỖI:', e.message);
    db.close();
    process.exit(1);
  }
})();
