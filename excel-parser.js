const XLSX = require('xlsx');
const { classifyCellId } = require('./cell-id');


const NETWORKS = {
  VIETTEL: { name: 'Viettel', mcc: '452', mnc: '04' },
  MOBIFONE: { name: 'Mobifone', mcc: '452', mnc: '01' },
  VINAPHONE: { name: 'Vinaphone', mcc: '452', mnc: '02' }
};

/**
 * Detect network type from filename (and fallback to content when ambiguous).
 * @param {string} filename Original upload filename
 * @returns {{ key: string, name: string, mcc: string, mnc: string }}
 */
function detectNetworkType(filename) {
  const name = (filename || '').toLowerCase();
  if (name.includes('viettel')) return { key: 'VIETTEL', ...NETWORKS.VIETTEL };
  if (name.includes('mobi')) return { key: 'MOBIFONE', ...NETWORKS.MOBIFONE };
  if (name.includes('vina')) return { key: 'VINAPHONE', ...NETWORKS.VINAPHONE };
  // Ambiguous — default Viettel (most common)
  return { key: 'VIETTEL', ...NETWORKS.VIETTEL };
}

/**
 * Normalize phone number: strip non-digits, ensure 84 prefix.
 */
function normalizePhone(num) {
  if (!num) return '';
  let s = String(num).replace(/[^0-9]/g, '');
  if (s.startsWith('84')) return s;
  if (s.startsWith('0')) return '84' + s.slice(1);
  return '84' + s;
}

/**
 * Parse an Excel serial date or string into ISO-ish "YYYY-MM-DDTHH:MM:SS".
 */
function parseTimestamp(cellVal) {
  if (typeof cellVal === 'number') {
    const d = XLSX.SSF.parse_date_code(cellVal);
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}T${String(d.H || 0).padStart(2, '0')}:${String(d.M || 0).padStart(2, '0')}:${String(d.S || 0).padStart(2, '0')}`;
    }
    return '';
  }
  const str = String(cellVal || '').trim();
  if (!str) return '';
  // Try "DD/MM/YYYY HH:MM:SS" or "YYYY-MM-DD HH:MM:SS"
  const m = str.match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    return `${m[1]}-${m[2]}-${m[3]}T${String(m[4]).padStart(2, '0')}:${m[5]}:${String(m[6] || '00').padStart(2, '0')}`;
  }
  const dm = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (dm) {
    return `${dm[3]}-${String(dm[2]).padStart(2, '0')}-${String(dm[1]).padStart(2, '0')}T${String(dm[4]).padStart(2, '0')}:${dm[5]}:${String(dm[6] || '00').padStart(2, '0')}`;
  }
  const d = new Date(str.replace(/\//g, '-'));
  return isNaN(d.getTime()) ? str : d.toISOString();
}

/**
 * Map call type string to action_type.
 */
function mapActionType(argv, isSmsViaType) {
  const raw = String(argv || '').toLowerCase();
  const isCall = raw.includes('cuộc gọi') || raw.includes('cuoc goi') || raw.includes('call') || raw.includes('voice') || raw.includes('goi den') || raw.includes('goi di');
  const isSms = raw.includes('tin nhắn') || raw.includes('tin nhan') || raw.includes('sms') || isSmsViaType;
  if (isSms) {
    return (raw.includes('đến') || raw.includes('den') || raw.includes('in') || raw.includes('vào') || raw.includes('vao'))
      ? 'SMS_IN' : 'SMS_OUT';
  }
  if (isCall) {
    return (raw.includes('đến') || raw.includes('den') || raw.includes('in') || raw.includes('vào') || raw.includes('vao'))
      ? 'CALL_IN' : 'CALL_OUT';
  }
  return 'UNKNOWN';
}

/**
 * Find header row + column mapping for a sheet's raw 2D array.
 * Detects either Mobifone ("Số thứ tự") or Viettel ("Số đi") header.
 * @returns {{ rowIdx: number, cols: Object }} or null if not found
 */
function detectHeader(rows) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const cells = row.map(c => String(c || '').trim().toLowerCase());
    const joined = cells.join('|');
    if (cells[0] === 'stt' || cells[0].startsWith('số thứ tự') || cells[0].startsWith('so thu tu') ||
        cells[0] === '#' || cells[0].startsWith('số đi') || cells[0].startsWith('so di')) {
      // Must have a time column and a call-type column
      const hasTime = joined.includes('thời gian') || joined.includes('thoi gian');
      const hasType = joined.includes('loại cuộc gọi') || joined.includes('loai cuoc goi') ||
                      joined.includes('cuộc gọi') || joined.includes('cuoc goi') ||
                      joined.includes('type') || joined.includes('direction');
      // Skip subscriber-info rows (like "Thuê bao: 09xxx") that are NOT data headers.
      // Note: "số chủ" is a legitimate column name in Mobifone headers — don't exclude it.
      const isSubInfo = joined.includes('thuê bao') || joined.includes('thue bao');
      if (hasTime && hasType && !isSubInfo) {
        const cols = {};
        cells.forEach((c, idx) => {
          if (c.includes('thời gian') || c.includes('thoi gian')) cols.time = idx;
          else if (c.includes('loại cuộc gọi') || c.includes('loai cuoc goi') || c.includes('type_action') || c === 'type') cols.actionType = idx;
          else if (c.includes('số chủ') || c.includes('so chu') || c.includes('số đi') && !c.includes('số thứ')) cols.caller = idx;
          else if (c.includes('số liên hệ') || c.includes('so lien he') || c.includes('số đến') || c.includes('so den')) cols.callee = idx;
          else if (c.includes('thời lượng') || c.includes('thoi luong') || c === 'giây' || c === 'giay' || c.includes('second') || c.includes('giây')) cols.duration = idx;
          else if (c.includes('mã địa danh') || c.includes('ma dia danh')) cols.maDanh = idx;
          else if (c.includes('tên địa danh') || c.includes('ten dia danh') || c.includes('địa chỉ trạm') || c.includes('dia chi tram') || c.includes('address') || c.includes('địa chỉ')) cols.address = idx;
          else if (c.includes('imei')) cols.imei = idx;
          else if (c === 'lac' || c.includes('lac')) cols.lac = idx;
          else if (c.includes('số cell') || c.includes('so cell') || c.includes('cellid') || c.includes('cell_id') || c.includes('cell')) cols.cellid = idx;
          else if (c.includes('imsi')) cols.imsi = idx;
          else if (c === 'direction' || c.includes('direction') || c.includes('hướng')) cols.direction = idx;
          else if (c === 'type' || c.includes('type')) cols.type = idx;
        });
        return { rowIdx: i, cols };
      }
    }
  }
  return null;
}

/**
 * Extract MCC/MNC/LAC/CellID from a row given network + found columns.
 * @returns {{ mcc, mnc, lac, cellid }}
 */
function extractCellRef(row, network, cols) {
  const mobi = network.key === 'MOBIFONE';
  const mcc = network.mcc;
  const mnc = network.mnc;

  let lac = '', cellid = '', enbId = '', sector = '';
  if (mobi) {
    // Parse gộp "Mã địa danh": 452-01-47450-662079-13
    // Format: MCC-MNC-LAC-CellID[-sector]
    // parts[0]=MCC, parts[1]=MNC, parts[2]=LAC, parts[3]=CellID, parts[4]=sector (optional)
    const maDanh = cols.maDanh >= 0 ? String(row[cols.maDanh] || '').trim() : '';
    if (maDanh) {
      const parts = maDanh.split('-');
      if (parts.length >= 4) {
        lac = String(parts[2] || '').trim();
        cellid = String(parts[3] || '').trim();
        sector = String(parts[4] || '').trim();
      }
    }
  } else {
    // Viettel/Vinaphone: separate LAC + Số Cell columns
    lac = cols.lac >= 0 ? String(row[cols.lac] || '').trim() : '';
    cellid = cols.cellid >= 0 ? String(row[cols.cellid] || '').trim() : '';
  }

  const cleanLac = lac.replace(/[^\d]/g, '');
  const cleanCell = cellid.replace(/[^\d]/g, '');
  const cleanSector = sector.replace(/[^\d]/g, '');

  // Store the cell ID EXACTLY as it appears in the file (no conversion) so the
  // DB stays a faithful copy of the source. When looking up a cell we try this
  // raw value first (short), then fall back to its ECI form (long).
  // enb/sector are kept only as a hint for that fallback.
  let enb = cleanCell;
  let sec = cleanSector;
  if (cleanCell) {
    if (classifyCellId(cleanCell) === 'short') {
      enb = cleanCell;
      sec = cleanSector || '0';
    } else {
      // Long (ECI) already — derive eNB + sector for reference/tooltip.
      const n = parseInt(cleanCell, 10);
      enb = String(Math.floor(n / 256));
      sec = cleanSector || String(n & 0xFF);
    }
  }

  return {
    mcc,
    mnc,
    lac: cleanLac,
    cellid: cleanCell,
    enbId: enb,
    sector: sec
  };
}

/**
 * Parse a workbook buffer into call-log records.
 * Scans each sheet, drops metadata above header, reads data rows below.
 * @param {Buffer} buffer XLSX/XLS file buffer
 * @param {string} filename Original filename (for network detection)
 * @returns {{ network: Object, records: Array, errors: Array }}
 */
function parseWorkbook(buffer, filename) {
  const network = detectNetworkType(filename);
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const records = [];
  const errors = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws || !ws['!ref']) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
    const header = detectHeader(rows);
    if (!header) continue;

    const { rowIdx, cols } = header;
    for (let r = rowIdx + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      if (!row.length) continue;

      // Time is required — skip rows without it
      const timeCell = cols.time >= 0 ? row[cols.time] : '';
      if (timeCell === '' || timeCell === null || timeCell === undefined) continue;

      const timestamp = parseTimestamp(timeCell);
      if (!timestamp) continue;

      // Phone numbers: caller = "Số chủ"/"Số đi", callee = "Số liên hệ"/"Số đến"
      const caller = cols.caller >= 0 ? String(row[cols.caller] || '').trim() : '';
      const callee = cols.callee >= 0 ? String(row[cols.callee] || '').trim() : '';
      const phoneNumber = normalizePhone(caller || callee);
      const contactNumber = normalizePhone(callee || caller);

      // Action type
      const actionRaw = cols.actionType >= 0 ? row[cols.actionType] : (cols.type >= 0 ? row[cols.type] : '');
      const direction = cols.direction >= 0 ? String(row[cols.direction] || '').trim() : '';
      const typeRaw = cols.type >= 0 ? String(row[cols.type] || '') : '';
      const actionType = mapActionType(
        String(actionRaw || direction || typeRaw),
        typeRaw.toUpperCase() === 'SMS'
      );

      const durationRaw = cols.duration >= 0 ? String(row[cols.duration] || '').trim() : '';
      const duration = parseInt(durationRaw) || 0;

      const ref = extractCellRef(row, network, cols);

      const address = cols.address >= 0 ? String(row[cols.address] || '').trim() : '';
      const imei = cols.imei >= 0 ? String(row[cols.imei] || '').trim() : '';

      records.push({
        network: network.name,
        phone_number: phoneNumber,
        action_type: actionType,
        timestamp,
        contact_number: contactNumber,
        duration: String(duration),
        mcc: ref.mcc,
        mnc: ref.mnc,
        lac: ref.lac,
        cellid: ref.cellid,
        enb_id: ref.enbId,
        sector: ref.sector,
        cell_address: address,
        imei
      });
    }
  }

  if (records.length === 0 && errors.length === 0) {
    errors.push('Không tìm thấy dữ liệu hợp lệ trong file');
  }

  return { network, records, errors };
}

/**
 * Backward-compatible wrapper: parse an Excel file path.
 * @deprecated Use parseWorkbook(buffer, filename)
 */
function parseExcel(filePath, originalName) {
  const buffer = require('fs').readFileSync(filePath);
  const result = parseWorkbook(buffer, originalName || filePath);
  return { network: result.network.name, records: result.records };
}

module.exports = {
  detectNetworkType,
  parseWorkbook,
  parseExcel,
  normalizePhone,
  parseTimestamp,
  mapActionType,
  extractCellRef,
  NETWORKS
};