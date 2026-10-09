#!/usr/bin/env node
/**
 * audit-cells.js — Rà soát bảng `cells` (READ-ONLY, KHÔNG ghi DB).
 *
 * Mục đích: liệt kê các row nghi vấn để admin duyệt tay trước khi xóa.
 *   X — rác hình học: lat/lng NULL, 0, hoặc ngoài [-90,90]/[-180,180]
 *   Y — cùng cellid xuất hiện ở nhiều RAT (dấu hiệu trúng nhầm ô khác RAT)
 *   Z — cellid quá dài mà gán radio='GSM' (cellid form ECI bị gán nhầm RAT)
 *   + phân bố row theo source / created_at / user_id
 *
 * Chạy:  node audit-cells.js
 * Xuất:  audit-cells-report.txt  (cạnh script)
 *
 * Script này chỉ SELECT. Muốn xóa/sửa thì dùng cleanup-online-cells.js.
 */

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = process.env.DB_PATH || 'D:/Code/database.sqlite';
const OUT_PATH = path.join(__dirname, 'audit-cells-report.txt');

const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY);
const q = (sql, params = []) => new Promise((res, rej) =>
  db.all(sql, params, (e, rows) => (e ? rej(e) : res(rows || []))));

// GSM/UMTS cellid thực tế là số 16-bit (<= 65535); giá trị > 2^20 chắc chắn là
// form ECI (LTE/NR) bị gán nhầm sang GSM.
const GSM_CELLID_MAX = 1048576; // 2^20

// Khung nước VN (mcc 452): lat 8.0–23.8, lng 102.0–110.5 (rộng hơn đất liền
// để không loại oan đảo/Trường Sa).
const VN_BOX = { latMin: 8, latMax: 23.8, lngMin: 102, lngMax: 110.5 };

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };

function table(rows) {
  if (!rows.length) { log('  (không có row nào)'); return; }
  const cols = Object.keys(rows[0]);
  const w = cols.map(c => Math.max(String(c).length, ...rows.map(r => String(r[c] == null ? '' : r[c]).length)));
  const sep = '+' + w.map(n => '-'.repeat(n + 2)).join('+') + '+';
  log(sep);
  log('| ' + cols.map((c, i) => String(c).padEnd(w[i])).join(' | ') + ' |');
  log(sep);
  for (const r of rows) log('| ' + cols.map((c, i) => String(r[c] == null ? '' : r[c]).padEnd(w[i])).join(' | ') + ' |');
  log(sep);
}

(async () => {
  log('='.repeat(78));
  log('AUDIT CELLS REPORT — ' + new Date().toISOString());
  log('DB: ' + DB_PATH);
  log('='.repeat(78));
  log('');

  // ---------- 1. Tổng quan theo source ----------
  log('--- 1. Tổng theo source / user_id ---');
  table(await q(`SELECT source,
      COUNT(*) AS so_row,
      SUM(CASE WHEN user_id IS NULL THEN 1 ELSE 0 END) AS thieu_user,
      MIN(created_at) AS xua_nhat,
      MAX(created_at) AS moi_nhat
    FROM cells GROUP BY source ORDER BY so_row DESC`));
  log('');

  // ---------- 2. Nhóm X — rác hình học ----------
  log('--- 2. Nhóm X: rác hình học (lat/lng NULL, 0, ngoài khung) ---');
  const geoAll = await q(`SELECT id, mcc, mnc, lac, cellid, lat, lng, radio, source, created_at
    FROM cells
    WHERE lat IS NULL OR lng IS NULL OR lat = 0 OR lng = 0
       OR abs(lat) > 90 OR abs(lng) > 180
    ORDER BY id`);
  table(geoAll);

  log('');
  log('  Ngoài khung VN nhưng còn trong toạ độ hợp lệ (mcc=452) — nghi trúng ô nước khác:');
  const geoOutVn = await q(`SELECT id, mcc, mnc, lac, cellid, lat, lng, radio, source, created_at
    FROM cells
    WHERE mcc = '452' AND lat IS NOT NULL AND lng IS NOT NULL
      AND (lat < ? OR lat > ? OR lng < ? OR lng > ?)
    ORDER BY id LIMIT 200`, [VN_BOX.latMin, VN_BOX.latMax, VN_BOX.lngMin, VN_BOX.lngMax]);
  table(geoOutVn);
  log('');

  // ---------- 3. Nhóm Y — cùng cellid khác RAT ----------
  log('--- 3. Nhóm Y: cùng cellid xuất hiện ở nhiều RAT (nghi trúng nhầm ô) ---');
  const ratConflicts = await q(`SELECT cellid,
      COUNT(DISTINCT radio) AS so_rat,
      GROUP_CONCAT(DISTINCT radio) AS cac_rat,
      COUNT(*) AS so_row
    FROM cells GROUP BY cellid HAVING so_rat > 1 ORDER BY cellid`);
  table(ratConflicts);
  log('');
  log('  Chi tiết từng row của các cellid trên:');
  const ratRows = await q(`SELECT c.id, c.mcc, c.mnc, c.lac, c.cellid, c.lat, c.lng,
      c.radio, c.source, c.created_at
    FROM cells c
    WHERE c.cellid IN (SELECT cellid FROM cells GROUP BY cellid HAVING COUNT(DISTINCT radio) > 1)
    ORDER BY c.cellid, c.id`);
  table(ratRows);
  log('');
  log('  Gợi ý: row source=\'csv\' thường là gốc tin cậy — ưu tiên giữ.');
  log('         Row đáng ngờ khi source<>csv, hoặc lac/cellid vô nghĩa (lac=1, cellid=1),');
  log('         hoặc toạ độ không khớp row csv cùng cellid.');
  log('');

  // ---------- 4. Nhóm Z — cellid dài cho GSM ----------
  log(`--- 4. Nhóm Z: radio='GSM' nhưng cellid > ${GSM_CELLID_MAX} (form ECI) ---`);
  const gsmLong = await q(`SELECT id, mcc, mnc, lac, cellid, lat, lng, radio, source, created_at
    FROM cells
    WHERE radio = 'GSM' AND cellid NOT GLOB '*[^0-9]*' AND CAST(cellid AS INTEGER) > ?
    ORDER BY id LIMIT 500`, [GSM_CELLID_MAX]);
  table(gsmLong);
  log(`  Tổng nhóm Z: ${gsmLong.length} row (hiển thị tối đa 500).`);
  log('');

  // ---------- 5. Toàn bộ row nguồn online ----------
  log('--- 5. Row có source <> csv (nguồn online ghi vào local) ---');
  const onlineRows = await q(`SELECT id, mcc, mnc, lac, cellid, lat, lng, radio, source, created_at
    FROM cells WHERE source IS NULL OR source <> 'csv' ORDER BY created_at, id`);
  log(`  Tổng: ${onlineRows.length} row. Hiển thị tối đa 100 dòng đầu:`);
  table(onlineRows.slice(0, 100));
  log('');

  // ---------- 6. Phân bố theo ngày thêm ----------
  log('--- 6. Phân bố row theo ngày thêm (created_at) và source ---');
  table(await q(`SELECT substr(created_at, 1, 10) AS ngay, source, COUNT(*) AS so_row
    FROM cells GROUP BY ngay, source ORDER BY ngay, source`));
  log('');

  // ---------- 7. Khoá trùng lẽ ra không thể xảy ra ----------
  log('--- 7. Kiểm tra unique index (mcc,mnc,lac,cellid) ---');
  const dupKeys = await q(`SELECT mcc, mnc, lac, cellid, COUNT(*) AS n
    FROM cells GROUP BY mcc, mnc, lac, cellid HAVING n > 1`);
  table(dupKeys);
  if (!dupKeys.length) log('  OK — không có khoá trùng (unique index còn hiệu lực).');
  log('');

  // ---------- 8. Tổng kết ----------
  log('='.repeat(78));
  log('TỔNG KẾT');
  log('='.repeat(78));
  log(`  Nhóm X (rác hình học, toàn bảng)        : ${geoAll.length} row`);
  log(`  Ngoài khung VN (mcc 452, còn hợp lệ)    : ${geoOutVn.length} row (hiển thị ≤200)`);
  log(`  Nhóm Y (cellid nhiều RAT)               : ${ratConflicts.length} cellid / ${ratRows.length} row`);
  log(`  Nhóm Z (GSM + cellid ECI)               : ${gsmLong.length} row (hiển thị ≤500)`);
  log(`  Row nguồn online (source <> csv)        : ${onlineRows.length} row`);
  log('');
  log('Bước tiếp theo: chọn id cần xóa/sửa, rồi chạy cleanup-online-cells.js');
  log('(script đó tự backup DB trước khi ghi).');

  fs.writeFileSync(OUT_PATH, lines.join('\n') + '\n', 'utf8');
  console.log('\nĐã ghi báo cáo: ' + OUT_PATH);
  db.close();
})().catch((e) => { console.error('LỖI:', e.message); db.close(); process.exit(1); });
