/**
 * CLF V4.1 converter for G-MoN Pro  <->  OpenCellID world database CSV.
 *
 * CLF V4.1 spec: https://sites.google.com/site/clfgmon/clf4
 *   Plain text / CSV, UTF-8 encoded, file extension `.clf`.
 *   One line per unique cell:
 *
 *   MCCMNC;CID;LAC;TYPE;LAT;LON;POS-RAT;DESC;SYS;LABEL;AZI;HEIGHT;HBW;VBW;TILT;LOC
 *   26207;04002;00432;0;50.12345;-8.12345;-1;This is sector 3;3;4002_3;240;30.5;65;7;6;1599XY03
 *
 * OpenCellID CSV (uploads/Database_free.csv) columns:
 *   radio,mcc,net,area,cell,unit,lon,lat,range,samples,changeable,created,updated,averageSignal
 *   GSM,452,1,10068,5293,0,105.8031464,20.95985413,1000,2,1,1459692342,1488347104,0
 *
 * Mapping notes:
 *   - MCCMNC is MCC + MNC concatenated, zero padded (`26207` = MCC 262 / MNC 07
 *     in the spec example). The OpenCellID dump carries MCC and MNC in separate
 *     `mcc` / `net` columns, so we join them (MCC is always 3 digits).
 *   - CID / LAC are padded to the spec's 5-digit width (`04002`, `00432`) but
 *     longer values are preserved as-is (UMTS cell ids are up to 9 digits).
 *   - SYS is the numeric radio access technology id used by G-MoN:
 *       1 = LTE, 2 = GSM, 3 = UMTS, 4 = CDMA, 5 = iDEN, 6 = EVDO, 7 = WLAN.
 *     TYPE stays 0 (unknown / omni) because the OpenCellID world dump carries no
 *     antenna information.
 *   - POS-RAT = -1 means "position not measured", as in the spec example. DESC
 *     packs the OpenCellID-only `range` / `samples` values so a round trip loses
 *     nothing; LABEL and LOC stay empty.
 *   - LAT / LON use `.` as the decimal separator and no thousands separator.
 */

const fs = require('fs');
const readline = require('readline');

// Exact field order of a CLF V4.1 record line.
const CLF_FIELDS = [
  'MCCMNC', 'CID', 'LAC', 'TYPE', 'LAT', 'LON', 'POS-RAT', 'DESC',
  'SYS', 'LABEL', 'AZI', 'HEIGHT', 'HBW', 'VBW', 'TILT', 'LOC'
];

const CLF_DELIMITER = ';';

// OpenCellID world database header (kept byte-identical so the reverse
// conversion produces a file the existing CSV uploader accepts).
const OPENCELLID_FIELDS = [
  'radio', 'mcc', 'net', 'area', 'cell', 'unit', 'lon', 'lat', 'range',
  'samples', 'changeable', 'created', 'updated', 'averageSignal'
];

// G-MoN SYS ids <-> OpenCellID `radio` strings.
const RADIO_TO_SYS = { LTE: 1, GSM: 2, UMTS: 3, CDMA: 4, IDEN: 5, EVDO: 6, WLAN: 7 };
const SYS_TO_RADIO = { 1: 'LTE', 2: 'GSM', 3: 'UMTS', 4: 'CDMA', 5: 'iDEN', 6: 'EVDO', 7: 'WLAN' };

// Fallbacks for OpenCellID-only columns that CLF cannot carry.
const DEFAULT_SAMPLES = 0;
const DEFAULT_CHANGEABLE = 1;
const DEFAULT_RANGE = 1000;
const DEFAULT_SIGNAL = 0;

/**
 * Zero-pad a numeric id to `width` digits, never truncating.
 * @param {string|number} value
 * @param {number} width
 * @returns {string}
 */
function padId(value, width) {
  const s = String(value === undefined || value === null ? '' : value).trim();
  if (!s) return '';
  if (!/^\d+$/.test(s)) return s;
  return s.length >= width ? s : s.padStart(width, '0');
}

/**
 * Format a coordinate the way the spec example does: plain decimal with `.` as
 * separator, no exponent, no trailing zeros. 7 decimals is ~1cm at the equator,
 * more precision than the source data carries.
 * @param {string|number} value
 * @returns {string}
 */
function formatCoord(value) {
  const n = typeof value === 'number' ? value : parseFloat(String(value || '').trim());
  if (!isFinite(n)) return '';
  return String(parseFloat(n.toFixed(7)));
}

/**
 * Validate an integer-ish field coming from CLF text.
 * @returns {string} integer as string, or '' when not parseable
 */
function intField(value) {
  const s = String(value === undefined || value === null ? '' : value).trim();
  if (!s) return '';
  const n = parseInt(s, 10);
  return isNaN(n) ? '' : String(n);
}

/**
 * Split MCCMNC back into MCC (3 digits) + MNC (rest). MCC is always 3 digits so
 * the split is unambiguous for the 452 / 262 style values used by the spec and
 * by the sample data.
 * @param {string} mccmnc
 * @returns {{ mcc: string, mnc: string }}
 */
function splitMccMnc(mccmnc) {
  const s = String(mccmnc || '').trim();
  if (s.length <= 3) return { mcc: s, mnc: '' };
  return { mcc: s.slice(0, 3), mnc: s.slice(3) };
}

/**
 * Escape a CLF field. The delimiter is `;`, so any `;` inside free-text fields
 * (DESC, LABEL, LOC) becomes `,` to keep the 16 columns aligned.
 * @param {*} value
 * @returns {string}
 */
function clfField(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/[\r\n]+/g, ' ')
    .replace(/;/g, ',');
}

/**
 * Build one CLF V4.1 line from a parsed OpenCellID CSV row.
 * @param {Object} row OpenCellID row (string values from CSV)
 * @returns {string|null} CLF line, or null when the row is unusable
 */
function csvRowToClfLine(row) {
  const mcc = String(row.mcc || '').trim();
  const mnc = String(row.net !== undefined ? row.net : row.mnc || '').trim();
  const lac = String(row.area !== undefined ? row.area : row.lac || '').trim();
  const cid = String(row.cell !== undefined ? row.cell : row.cellid || '').trim();
  const lat = formatCoord(row.lat);
  const lon = formatCoord(row.lon !== undefined ? row.lon : row.lng);
  if (!mcc || !mnc || !lac || !cid || !lat || !lon) return null;

  const radio = String(row.radio || '').trim().toUpperCase();
  const sys = RADIO_TO_SYS[radio];

  const range = parseInt(row.range, 10) || DEFAULT_RANGE;
  const samples = parseInt(row.samples, 10);
  // DESC packs the two OpenCellID-only numeric values that have no CLF column,
  // so clfLineToCsvLine() can restore them on the way back.
  const desc = `range=${range} samples=${isNaN(samples) ? DEFAULT_SAMPLES : samples}`;

  const fields = [
    mcc + padId(mnc, 2),          // MCCMNC
    padId(cid, 5),                // CID
    padId(lac, 5),                // LAC
    '0',                          // TYPE (0 = unknown, dump has no antenna data)
    lat,                          // LAT
    lon,                          // LON
    '-1',                         // POS-RAT (position not measured)
    desc,                         // DESC
    sys ? String(sys) : '',       // SYS
    '',                           // LABEL
    '0',                          // AZI
    '0',                          // HEIGHT
    '0',                          // HBW
    '0',                          // VBW
    '0',                          // TILT
    ''                            // LOC
  ];
  return fields.map(clfField).join(CLF_DELIMITER);
}

/**
 * Build one OpenCellID CSV line from a CLF V4.1 record line. Accepts `;` (spec)
 * and tolerates `,` as delimiter.
 * @param {string} line
 * @param {number} [now] Epoch ms used for the created/updated fallbacks
 * @returns {string|null} CSV line, or null when the line is unusable
 */
function clfLineToCsvLine(line, now) {
  const raw = String(line || '').trim();
  if (!raw || raw.startsWith('#')) return null;

  const delim = raw.indexOf(CLF_DELIMITER) !== -1 ? CLF_DELIMITER : ',';
  const parts = raw.split(delim);
  if (parts.length < 6) return null;

  const mccmnc = (parts[0] || '').trim();
  const cid = (parts[1] || '').trim();
  const lac = (parts[2] || '').trim();
  const lat = formatCoord(parts[4]);
  const lon = formatCoord(parts[5]);
  if (!mccmnc || !cid || !lac || !lat || !lon) return null;

  const desc = (parts[7] || '').trim();
  const sys = intField(parts[8]);
  const { mcc, mnc } = splitMccMnc(mccmnc);
  if (!mcc) return null;

  // Restore range/samples that csvRowToClfLine() packed into DESC.
  let range = DEFAULT_RANGE;
  let samples = DEFAULT_SAMPLES;
  const rangeMatch = desc.match(/range\s*=\s*(\d+)/i);
  const samplesMatch = desc.match(/samples\s*=\s*(\d+)/i);
  if (rangeMatch) range = parseInt(rangeMatch[1], 10);
  if (samplesMatch) samples = parseInt(samplesMatch[1], 10);

  const ts = Math.floor((now || Date.now()) / 1000);
  const cells = [
    SYS_TO_RADIO[sys] || 'GSM',   // radio
    mcc,                          // mcc
    mnc,                          // net
    lac,                          // area
    cid,                          // cell
    '0',                          // unit
    lon,                          // lon
    lat,                          // lat
    String(range),                // range
    String(samples),              // samples
    String(DEFAULT_CHANGEABLE),   // changeable
    String(ts),                   // created
    String(ts),                   // updated
    String(DEFAULT_SIGNAL)        // averageSignal
  ];
  return cells.join(',');
}


/**
 * Convert a CLF V4.1 buffer into an OpenCellID CSV buffer.
 * @param {Buffer|string} input .clf content (UTF-8)
 * @param {Object} [opts]
 * @param {boolean} [opts.bom] Prepend UTF-8 BOM (default true, helps Excel)
 * @returns {{ csv: string, fields: string[], total: number, converted: number, failed: number, errors: string[] }}
 */
function clfToOpenCellIdCsv(input, opts) {
  const options = opts || {};
  const text = Buffer.isBuffer(input) ? input.toString('utf8') : String(input || '');
  const lines = text.split(/\r?\n/);

  const out = [OPENCELLID_FIELDS.join(',')];
  let total = 0;
  const errors = [];
  const now = Date.now();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    // A CLF file has no header row, but tolerate one so re-running a converted
    // file does not emit a garbage record.
    if (i === 0 && /MCCMNC/i.test(line)) continue;
    total++;
    const csvLine = clfLineToCsvLine(line, now);
    if (csvLine) out.push(csvLine);
    else errors.push(`Line ${i + 1}: invalid CLF record`);
  }

  const converted = out.length - 1;
  const body = out.join('\n') + '\n';
  return {
    csv: options.bom === false ? body : '\uFEFF' + body,
    fields: OPENCELLID_FIELDS.slice(),
    total, converted, failed: total - converted,
    errors: errors.slice(0, 100)
  };
}

/**
 * Convert an OpenCellID CSV buffer into a CLF V4.1 buffer.
 * @param {Buffer|string} input CSV content
 * @param {Object} [opts]
 * @param {boolean} [opts.bom] Prepend UTF-8 BOM (default true)
 * @returns {{ clf: string, fields: string[], total: number, converted: number, failed: number, errors: string[] }}
 */
function openCellIdCsvToClf(input, opts) {
  const options = opts || {};
  const text = Buffer.isBuffer(input) ? input.toString('utf8') : String(input || '');
  const lines = text.split(/\r?\n/);

  const out = [];
  let total = 0;
  const errors = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    if (i === 0 && /(^|,)mcc(,|$)/i.test(line) && /(^|,)radio(,|$)/i.test(line)) continue;

    const cols = line.split(',');
    if (cols.length < 9) continue;
    total++;
    const row = {};
    OPENCELLID_FIELDS.forEach((f, idx) => { row[f] = cols[idx]; });

    const clfLine = csvRowToClfLine(row);
    if (clfLine) out.push(clfLine);
    else errors.push(`Line ${i + 1}: missing mcc/net/area/cell/lat/lon`);
  }

  const body = out.join('\n') + '\n';
  return {
    clf: options.bom === false ? body : '\uFEFF' + body,
    fields: CLF_FIELDS.slice(),
    total, converted: out.length, failed: total - out.length,
    errors: errors.slice(0, 100)
  };
}

/**
 * Streaming OpenCellID CSV -> CLF converter. Reads the CSV line by line and
 * writes records as they are converted, so multi-hundred-MB world dumps never
 * buffer fully into memory (matches the uploader's streaming approach).
 * @param {string} inPath
 * @param {string} outPath
 * @returns {Promise<{ total: number, converted: number, failed: number, errors: string[] }>}
 */
function convertCsvFileToClf(inPath, outPath) {
  return new Promise((resolve, reject) => {
    const outStream = fs.createWriteStream(outPath, { encoding: 'utf8' });
    outStream.write('\uFEFF');

    const rl = readline.createInterface({
      input: fs.createReadStream(inPath, { encoding: 'utf8' }),
      crlfDelay: Infinity
    });

    let total = 0, converted = 0, lineNo = 0;
    let paused = false;
    const errors = [];
    let settled = false;

    // Single drain handler: writing many chunks while back-pressured must not
    // stack one-shot `drain` listeners (which also fire after rl.close()).
    outStream.on('drain', () => {
      if (paused) { paused = false; rl.resume(); }
    });

    const writeChunk = (text) => {
      if (outStream.write(text)) return;
      // Back-pressure: pause reading until the single drain handler resumes us.
      if (!paused) { paused = true; rl.pause(); }
    };

    rl.on('line', (line) => {
      lineNo++;
      if (!line || !line.trim()) return;
      if (lineNo === 1 && /(^|,)mcc(,|$)/i.test(line) && /(^|,)radio(,|$)/i.test(line)) return;

      const cols = line.split(',');
      if (cols.length < 9) {
        total++;
        if (errors.length < 100) errors.push(`Line ${lineNo}: missing columns`);
        return;
      }
      total++;
      const row = {};
      OPENCELLID_FIELDS.forEach((f, idx) => { row[f] = cols[idx]; });

      const clfLine = csvRowToClfLine(row);
      if (!clfLine) {
        if (errors.length < 100) errors.push(`Line ${lineNo}: missing mcc/net/area/cell/lat/lon`);
        return;
      }
      converted++;
      writeChunk(clfLine + '\n');
    });

    const finish = () => {
      if (settled) return;
      settled = true;
      // end() flushes anything still buffered before emitting 'finish'.
      outStream.end();
    };

    rl.on('close', finish);
    rl.on('error', reject);
    outStream.on('error', reject);
    outStream.on('finish', () => resolve({ total, converted, failed: total - converted, errors }));
  });
}

/**
 * Streaming CLF -> OpenCellID CSV converter.
 * @param {string} inPath
 * @param {string} outPath
 * @returns {Promise<{ total: number, converted: number, failed: number, errors: string[] }>}
 */
function convertClfFileToCsv(inPath, outPath) {
  return new Promise((resolve, reject) => {
    const outStream = fs.createWriteStream(outPath, { encoding: 'utf8' });
    outStream.write('\uFEFF');
    outStream.write(OPENCELLID_FIELDS.join(',') + '\n');

    const rl = readline.createInterface({
      input: fs.createReadStream(inPath, { encoding: 'utf8' }),
      crlfDelay: Infinity
    });

    let total = 0, converted = 0, lineNo = 0;
    let paused = false;
    const errors = [];
    let settled = false;
    const now = Date.now();

    outStream.on('drain', () => {
      if (paused) { paused = false; rl.resume(); }
    });

    rl.on('line', (line) => {
      lineNo++;
      if (!line || !line.trim()) return;
      if (lineNo === 1 && /MCCMNC/i.test(line)) return;

      total++;
      const csvLine = clfLineToCsvLine(line, now);
      if (!csvLine) {
        if (errors.length < 100) errors.push(`Line ${lineNo}: invalid CLF record`);
        return;
      }
      converted++;
      if (!outStream.write(csvLine + '\n') && !paused) {
        paused = true;
        rl.pause();
      }
    });

    const finish = () => {
      if (settled) return;
      settled = true;
      outStream.end();
    };

    rl.on('close', finish);
    rl.on('error', reject);
    outStream.on('error', reject);
    outStream.on('finish', () => resolve({ total, converted, failed: total - converted, errors }));
  });
}

module.exports = {
  CLF_FIELDS,
  CLF_DELIMITER,
  OPENCELLID_FIELDS,
  RADIO_TO_SYS,
  SYS_TO_RADIO,
  padId,
  formatCoord,
  splitMccMnc,
  csvRowToClfLine,
  clfLineToCsvLine,
  openCellIdCsvToClf,
  clfToOpenCellIdCsv,
  convertCsvFileToClf,
  convertClfFileToCsv
};
