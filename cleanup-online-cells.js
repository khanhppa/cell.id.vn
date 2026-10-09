#!/usr/bin/env node
/**
 * cleanup-online-cells.js — Dọn row sai trong bảng `cells`.
 *
 * Phương án B (đã duyệt): chỉ XÓA 2 row chắc chắn trúng nhầm, SỬA 1 row radio sai.
 * KHÔNG xóa toàn bộ row nguồn online.
 *
 *   DELETE id=836166  (452-2-1, cellid=1, lac=1 — khoá vô nghĩa, đè nhầm ô LTE)
 *   DELETE id=836167  (452-04-12298, cellid=8864 — toạ độ không khớp row csv
 *                      577364 cùng cellid ở 452-4-20168, cách ~700km)
 *   UPDATE id=820452  radio: GSM → LTE  (cellid 662091 là ECI LTE; toạ độ trùng
 *                      khớp row 836168, nên toạ độ đúng, chỉ RAT sai)
 *
 * An toàn:
 *   1. Backup D:\Code\database.sqlite → .backup-cleanup-<timestamp> TRƯỚC khi ghi.
 *   2. Xuất nguyên row sắp xóa/sửa ra JSON để khôi phục tay được.
 *   3. Ghi mọi thao tác vào cells_audit.
 *   4. Idempotent: chạy lần 2 → 0 changes, không lỗi.
 *
 * Chạy:  node cleanup-online-cells.js            (dry-run, chỉ in)
 *        node cleanup-online-cells.js --apply    (ghi thật)
 */

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = process.env.DB_PATH || 'D:/Code/database.sqlite';
const APPLY = process.argv.includes('--apply');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');

// Danh sách thao tác đã duyệt (phương án B).
const TO_DELETE = [836166, 836167];
const RAT_FIX = [{ id: 820452, radio: 'LTE' }];

const db = new sqlite3.Database(DB_PATH);
const q = (sql, params = []) => new Promise((res, rej) =>
  db.all(sql, params, (e, rows) => (e ? rej(e) : res(rows || []))));
const run = (sql, params = []) => new Promise((res, rej) =>
  db.run(sql, params, function (e) { return e ? rej(e) : res(this.changes); }));

(async () => {
  console.log(`DB     : ${DB_PATH}`);
  console.log(`Mode   : ${APPLY ? 'APPLY (ghi thật)' : 'DRY-RUN (chỉ in, chưa ghi)'}`);
  console.log(`Delete : id ${TO_DELETE.join(', ')}`);
  console.log(`Fix RAT: ${RAT_FIX.map(r => `id ${r.id} → ${r.radio}`).join(', ')}`);
  console.log('');

  const beforeCount = (await q('SELECT COUNT(*) AS c FROM cells'))[0].c;
  console.log(`Tổng row trước: ${beforeCount}`);

  // Lấy nguyên row hiện tại của các id liên quan (trước khi đổi).
  const ids = [...TO_DELETE, ...RAT_FIX.map(r => r.id)];
  const ph = ids.map(() => '?').join(',');
  const rowsBefore = await q(`SELECT * FROM cells WHERE id IN (${ph})`, ids);

  console.log('');
  console.log('--- Row sẽ tác động (hiện tại) ---');
  for (const r of rowsBefore) {
    console.log(`  id=${r.id}  ${r.mcc}-${r.mnc}-${r.lac}-${r.cellid}  ${r.lat},${r.lng}  radio=${r.radio}  source=${r.source}  created=${r.created_at}`);
  }
  const missing = ids.filter(id => !rowsBefore.some(r => r.id === id));
  if (missing.length) console.log(`  (Không tìm thấy id: ${missing.join(', ')} — có thể đã xử lý trước đó.)`);

  // Ghi file khôi phục (luôn ghi, kể cả dry-run, để admin có tham chiếu).
  const dumpPath = path.join(__dirname, `cleanup-online-${STAMP}.json`);
  fs.writeFileSync(dumpPath, JSON.stringify({
    at: new Date().toISOString(),
    db: DB_PATH,
    to_delete: TO_DELETE,
    rat_fix: RAT_FIX,
    rows_before: rowsBefore,
  }, null, 2), 'utf8');
  console.log('');
  console.log(`Đã xuất bản ghi khôi phục: ${dumpPath}`);

  if (!APPLY) {
    console.log('');
    console.log('DRY-RUN kết thúc. Chạy lại với --apply để thực thi (sẽ backup DB trước).');
    db.close();
    return;
  }

  // ---------- Bước 1: BACKUP (bắt buộc) ----------
  const backupPath = `${DB_PATH}.backup-cleanup-${STAMP}`;
  console.log('');
  console.log('--- Bước 1: Backup DB ---');
  fs.copyFileSync(DB_PATH, backupPath);
  const srcSize = fs.statSync(DB_PATH).size;
  const dstSize = fs.statSync(backupPath).size;
  if (srcSize !== dstSize) {
    throw new Error(`Backup KHÔNG khớp kích thước (${srcSize} vs ${dstSize}) — dừng, không ghi gì.`);
  }
  console.log(`  OK: ${backupPath} (${dstSize} bytes)`);

  // ---------- Bước 2: XÓA ----------
  console.log('');
  console.log('--- Bước 2: Xóa row trúng nhầm ---');
  let deleted = 0;
  for (const id of TO_DELETE) {
    const old = rowsBefore.find(r => r.id === id);
    if (!old) { console.log(`  id ${id}: không tồn tại, bỏ qua.`); continue; }
    const n = await run('DELETE FROM cells WHERE id = ?', [id]);
    deleted += n;
    await run(`INSERT INTO cells_audit (cell_id, action, old_json, new_json, username, note)
      VALUES (?, 'delete', ?, NULL, 'cleanup-script', 'Phương án B: row online trúng nhầm ô khác')`,
      [id, JSON.stringify(old)]);
    console.log(`  id ${id}: đã xóa (${n} row).`);
  }
  console.log(`  Tổng đã xóa: ${deleted}`);

  // ---------- Bước 3: SỬA RAT ----------
  console.log('');
  console.log('--- Bước 3: Sửa radio sai ---');
  let updated = 0;
  for (const f of RAT_FIX) {
    const old = rowsBefore.find(r => r.id === f.id);
    if (!old) { console.log(`  id ${f.id}: không tồn tại, bỏ qua.`); continue; }
    if (old.radio === f.radio) { console.log(`  id ${f.id}: đã là ${f.radio}, bỏ qua.`); continue; }
    const n = await run('UPDATE cells SET radio = ? WHERE id = ?', [f.radio, f.id]);
    updated += n;
    const after = (await q('SELECT * FROM cells WHERE id = ?', [f.id]))[0];
    await run(`INSERT INTO cells_audit (cell_id, action, old_json, new_json, username, note)
      VALUES (?, 'update', ?, ?, 'cleanup-script', 'Phương án B: sửa RAT theo form ECI của cellid')`,
      [f.id, JSON.stringify(old), JSON.stringify(after)]);
    console.log(`  id ${f.id}: radio ${old.radio} → ${f.radio} (${n} row).`);
  }
  console.log(`  Tổng đã sửa: ${updated}`);

  // ---------- Bước 4: VERIFY ----------
  console.log('');
  console.log('--- Bước 4: Kiểm tra sau khi ghi ---');
  const afterCount = (await q('SELECT COUNT(*) AS c FROM cells'))[0].c;
  console.log(`  Tổng row sau: ${afterCount} (giảm ${beforeCount - afterCount}, kỳ vọng ${deleted})`);
  const leftover = await q(`SELECT id FROM cells WHERE id IN (${ph})`, ids);
  console.log(`  Row còn lại theo id: ${leftover.map(r => r.id).join(', ') || '(không có)'}`);
  for (const f of RAT_FIX) {
    const row = (await q('SELECT id, radio FROM cells WHERE id = ?', [f.id]))[0];
    if (row) console.log(`  id ${f.id} radio hiện tại = ${row.radio}`);
  }
  const auditCount = (await q('SELECT COUNT(*) AS c FROM cells_audit'))[0].c;
  console.log(`  cells_audit: ${auditCount} bản ghi.`);
  console.log('');
  console.log('HOÀN TẤT. Backup: ' + backupPath);
  db.close();
})().catch((e) => { console.error('LỖI:', e.message); db.close(); process.exit(1); });
