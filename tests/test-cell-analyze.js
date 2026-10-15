/**
 * Unit test cho excel-parser.aggregateCellsFromRecords — lõi của luồng
 * "Tra cứu chuyển mạng giữ số" (popup full-window).
 *
 * Chạy:  node tests/test-cell-analyze.js
 * Không cần server, không đụng DB.
 *
 * Kịch bản: dựng workbook Excel trong RAM bằng `xlsx` → parseWorkbook() →
 * aggregateCellsFromRecords() với canonicalKey/inferRadio/radioConfident
 * giống hệt server.js, rồi assert kết quả gom nhóm.
 */
const XLSX = require('xlsx');

const excelParser = require('../excel-parser');
const cellId = require('../cell-id');
const { inferRadio, radioConfident } = require('../radio-util');

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

const ECI = cellId.enbToEci(662091, 7);

// canonicalCellKey giống server.js: collapse alias short-cellid/ECI.
function canonicalCellKey(c) {
  const candidates = cellId.cellIdCandidates(c.cellid, c.sector);
  const eci = candidates[0] || String(c.cellid);
  return `${c.mcc}-${c.mnc}-${c.lac}-${eci}`;
}

// Header tối thiểu để detectHeader() nhận diện: cột 0 = "STT",
// có "Thời gian" + "Loại cuộc gọi".
const HEADER = ['STT', 'Thời gian', 'Loại cuộc gọi', 'Số liên hệ', 'Thời lượng',
  'Mã địa danh', 'Tên địa danh', 'Cell ID', 'Sector', 'LAC', 'MCC', 'MNC'];

function aggFromRows(rows) {
  const ws = XLSX.utils.aoa_to_sheet([HEADER, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const parsed = excelParser.parseWorkbook(buf, 'analyze-test.xlsx');
  return {
    network: parsed.network,
    records: parsed.records,
    cells: excelParser.aggregateCellsFromRecords(parsed.records, {
      canonicalKey: canonicalCellKey,
      inferRadio: (cellid, sector, hint) => inferRadio(cellid, sector, hint),
      radioConfident: (cellid, sector, hint) => radioConfident(cellid, sector, hint)
    })
  };
}

// Dòng log LTE: cellid = ECI đầy đủ.
function lteRow(stt, ts, type, phone, eci, lac) {
  return [stt, ts, type, phone, 12, 'DANH1', 'Hà Nội', eci, '', lac, 452, '01'];
}


console.log('\n== aggregateCellsFromRecords: gom nhóm + đếm dòng ==');

// --- 1. Dedup theo canonical key ---
// Lưu ý hành vi thật: với Viettel/Vinaphone, file KHÔNG có cột Sector nên
// parseWorkbook() tự suy sector (dòng ECI → sector = ECI & 0xFF; dòng ngắn →
// '0'). Vì vậy dedup chỉ gộp khi ECI trùng nhau.
{
  const rows = [
    lteRow(1, '2024-01-01 08:00:00', 'CALL_OUT', '0912000001', ECI, 1001),
    lteRow(2, '2024-01-01 09:30:00', 'SMS_IN', '0912000001', ECI, 1001),
    lteRow(3, '2024-01-01 10:15:00', 'CALL_IN', '0912000002', ECI, 1001)
  ];
  const { cells } = aggFromRows(rows);
  ok('3 bản ghi cùng ECI → 1 cell', cells.length === 1);
  if (cells.length === 1) {
    const c = cells[0];
    ok('rowCount = 3', c.rowCount === 3);
    ok('key dùng ECI (canonical)', String(c.key).endsWith(String(ECI)));
    ok('firstTs = thời điểm sớm nhất', c.firstTs === '2024-01-01T08:00:00');
    ok('lastTs = thời điểm muộn nhất', c.lastTs === '2024-01-01T10:15:00');
    ok('actionTypes đếm đúng từng loại',
      c.actionTypes.CALL_OUT === 1 && c.actionTypes.SMS_IN === 1 && c.actionTypes.CALL_IN === 1);
    ok('phones gom tối đa 5 số, dedup (đã chuẩn hoá 84…)', c.phones.length === 2 &&
      c.phones.indexOf('84912000001') !== -1 && c.phones.indexOf('84912000002') !== -1);
    ok('sector suy ra từ ECI (ECI & 0xFF = 7)', String(c.sector) === '7');
  }
}

// --- 1b. Cùng eNB nhưng khác sector → 2 cell ---
{
  const rows = [
    lteRow(1, '2024-01-01 08:00:00', 'CALL_OUT', '0912000001', cellId.enbToEci(662091, 7), 1001),
    lteRow(2, '2024-01-01 08:05:00', 'CALL_OUT', '0912000001', cellId.enbToEci(662091, 8), 1001)
  ];
  const { cells } = aggFromRows(rows);
  ok('cùng eNB khác sector → 2 cell riêng', cells.length === 2);
}

// --- 2. Cell khác nhau (khác LAC) → tách riêng ---
{
  const rows = [
    lteRow(1, '2024-01-01 08:00:00', 'CALL_OUT', '0912000001', ECI, 1001),
    lteRow(2, '2024-01-01 08:05:00', 'CALL_OUT', '0912000001', ECI, 1002),
    lteRow(3, '2024-01-01 08:10:00', 'CALL_IN', '0912000003', ECI, 1003)
  ];
  const { cells } = aggFromRows(rows);
  ok('3 LAC khác nhau → 3 phần tử', cells.length === 3);
  ok('tổng rowCount = 3', cells.reduce((s, c) => s + c.rowCount, 0) === 3);
}

// --- 3. Radio: gọi trực tiếp với records thủ công ---
// (Không qua parseWorkbook: parser luôn suy sector nên không dựng được case
//  "cellid ngắn không sector". Đơn vị đang test là aggregateCellsFromRecords.)
{
  const recs = [
    { mcc: 452, mnc: '01', lac: 1001, cellid: '662091', sector: '7', timestamp: 't1' },
    { mcc: 452, mnc: '01', lac: 1002, cellid: '5000000000', sector: '', timestamp: 't2' },
    { mcc: 452, mnc: '01', lac: 1003, cellid: '662079', sector: '', timestamp: 't3' }
  ];
  const cells = excelParser.aggregateCellsFromRecords(recs, {
    canonicalKey: canonicalCellKey,
    inferRadio: (cellid, sector, hint) => inferRadio(cellid, sector, hint),
    radioConfident: (cellid, sector, hint) => radioConfident(cellid, sector, hint)
  });
  const byLac = {};
  for (const c of cells) byLac[String(c.lac)] = c;
  ok('có sector → radio = LTE', byLac['1001'] && byLac['1001'].radio === 'LTE');
  ok('có sector → radioConfident = true', byLac['1001'] && byLac['1001'].radioConfident === true);
  ok('GSM (cellid > 2^28) → radio = GSM', byLac['1002'] && byLac['1002'].radio === 'GSM');
  ok('GSM → radioConfident = true', byLac['1002'] && byLac['1002'].radioConfident === true);
  ok("id ngắn không sector → radio = '' (mơ hồ, UI hiện '?')",
    byLac['1003'] && byLac['1003'].radio === '');
  ok('id ngắn không sector → radioConfident = false',
    byLac['1003'] && byLac['1003'].radioConfident === false);

  // LTE dạng ECI (không sector) → vẫn chắc chắn LTE (2^20 < id <= 2^28).
  const eciOnly = excelParser.aggregateCellsFromRecords(
    [{ mcc: 452, mnc: '01', lac: 1004, cellid: String(ECI), sector: '', timestamp: 't4' }],
    { canonicalKey: canonicalCellKey, inferRadio, radioConfident });
  ok('ECI dải LTE (không sector) → radio = LTE, confident',
    eciOnly.length === 1 && eciOnly[0].radio === 'LTE' && eciOnly[0].radioConfident === true);
}

// --- 4. Bỏ bản ghi không đủ mcc/lac/cellid ---
{
  const rows = [
    lteRow(1, '2024-01-01 08:00:00', 'CALL_OUT', '0912000001', ECI, 1001),
    [2, '2024-01-01 08:05:00', 'CALL_OUT', '0912000002', 12, 'DANH1', 'Hà Nội', '', '', '', 452, '01'],
    [3, '2024-01-01 08:10:00', 'CALL_OUT', '0912000003', 12, 'DANH1', 'Hà Nội', 12345, '', '', 452, '01']
  ];
  const { cells, records } = aggFromRows(rows);
  ok('records vẫn giữ 3 dòng thô', records.length === 3);
  ok('cell thiếu cellid hoặc LAC bị bỏ → chỉ còn 1 cell', cells.length === 1);
}

// --- 5. addresses dedup ---
{
  const rows = [
    lteRow(1, '2024-01-01 08:00:00', 'CALL_OUT', '0912000001', ECI, 1001),
    lteRow(2, '2024-01-01 08:05:00', 'CALL_OUT', '0912000002', ECI, 1001),
    lteRow(3, '2024-01-01 08:10:00', 'CALL_OUT', '0912000003', ECI, 1001)
  ];
  const { cells } = aggFromRows(rows);
  ok('cùng địa chỉ (dù 3 dòng) → addresses dedup còn 1',
    cells.length === 1 && cells[0].addresses.length === 1 &&
    cells[0].addresses[0] === 'Hà Nội');
}

// --- 6. Input rỗng / null an toàn ---
{
  ok('records rỗng → []', excelParser.aggregateCellsFromRecords([]).length === 0);
  ok('records null → []', excelParser.aggregateCellsFromRecords(null).length === 0);
  ok('options vắng → key mặc định, không throw',
    excelParser.aggregateCellsFromRecords([
      { mcc: 452, mnc: '01', lac: 1001, cellid: '169495303', sector: '', timestamp: 'x' }
    ]).length === 1);
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
