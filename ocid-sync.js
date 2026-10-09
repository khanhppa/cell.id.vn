/**
 * OpenCellID daily sync — download the per-MCC CSV dump (.csv.gz) and import
 * new cells into the local `cells` table.
 *
 * Source: https://opencellid.org/ocid/downloads?token=<KEY>&type=mcc&file=<mcc>.csv.gz
 * CSV columns: radio,mcc,net,area,cell,unit,lon,lat,range,samples,changeable,created,updated,averageSignal
 * Mapping -> cells(mcc, mnc, lac, cellid, lat, lng, range, source):
 *   net -> mnc, area -> lac, cell -> cellid, lon -> lng, source = 'opencellid'
 *
 * Writing policy: only insert NEW cells (INSERT OR IGNORE); existing rows untouched.
 */
const axios = require('axios');
const csv = require('csv-parser');
const zlib = require('zlib');
const db = require('./database');
const { normalizeRadio, inferRadio } = require('./radio-util');
const { isPlausibleLatLng } = require('./geo-util');

const OCID_DOWNLOAD_URL = 'https://opencellid.org/ocid/downloads';
const DOWNLOAD_TIMEOUT_MS = 120000; // 120s — the VN dump is a few hundred KB
const SUB_BATCH = 500;              // rows per INSERT statement (8000 sql vars)
const MAX_RETRIES = 3;

// OpenCellID world-database column order (fixed); we bind by position so we
// don't depend on the file's own header row naming.
const OCID_FIELDS = [
  'radio', 'mcc', 'net', 'area', 'cell', 'unit', 'lon', 'lat', 'range',
  'samples', 'changeable', 'created', 'updated', 'averageSignal'
];

// In-memory locks so a job never runs twice concurrently (across manual + cron).
const runningJobs = new Set();
function isRunning(jobId) { return runningJobs.has(jobId); }

// Download the MCC dump as a Node stream (gzip-compressed response body).
async function openMccStream(token, mcc, attempt = 1) {
  const url = `${OCID_DOWNLOAD_URL}?token=${encodeURIComponent(token)}&type=mcc&file=${encodeURIComponent(mcc)}.csv.gz`;
  try {
    const resp = await axios.get(url, {
      responseType: 'stream',
      timeout: DOWNLOAD_TIMEOUT_MS,
      headers: { 'User-Agent': 'cell-tracker/1.0' }
    });
    const ctype = String(resp.headers['content-type'] || '');
    // OCID returns JSON (e.g. RATE_LIMITED) instead of the gzip payload on errors.
    if (ctype.includes('application/json')) {
      const chunks = [];
      for await (const c of resp.data) chunks.push(c);
      let msg = 'Tải thất bại';
      try { const j = JSON.parse(Buffer.concat(chunks).toString('utf8')); msg = j.message || j.error || msg; } catch (_) {}
      const e = new Error(`OpenCellID: ${msg}`);
      e.rateLimited = /RATE_LIMITED/i.test(msg);
      throw e;
    }
    return resp.data;
  } catch (err) {
    if (err.rateLimited) throw err; // don't retry rate limits
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      return openMccStream(token, mcc, attempt + 1);
    }
    throw err;
  }
}


// Parse a gzipped OCID CSV stream and INSERT OR IGNORE new rows in sub-batches.
function importOcidStream(gzStream) {
  return new Promise((resolve, reject) => {
    const stats = { inserted: 0, skipped: 0, errors: 0, total: 0 };
    let pending = [];        // buffered valid rows awaiting a DB write
    let writing = false;     // serialize DB writes so we never interleave
    let ended = false;       // csv stream finished

    const maybeDone = () => {
      if (ended && !writing && pending.length === 0) resolve(stats);
    };

    const flush = () => {
      if (writing || pending.length === 0) return maybeDone();
      writing = true;
      const slice = pending.splice(0, SUB_BATCH);
      // Mỗi nhánh UNION ALL tự lọc row bằng correlated NOT EXISTS: bỏ row mà DB
      // đã có cùng khoá nhưng RAT khác (dấu hiệu cellid ngắn trúng nhầm ô khác RAT).
      const placeholders = slice.map(() =>
        `SELECT ? AS mcc, ? AS mnc, ? AS lac, ? AS cellid, ? AS lat, ? AS lng, ? AS range, ? AS source, ? AS radio
         WHERE NOT EXISTS (
           SELECT 1 FROM cells e WHERE e.mcc = ? AND e.mnc = ? AND e.lac = ? AND e.cellid = ?
             AND e.radio IS NOT NULL AND e.radio <> '' AND e.radio <> ?
         )`).join(' UNION ALL ');
      const flat = [];
      slice.forEach((v) => flat.push(...v, v[0], v[1], v[2], v[3], v[8]));
      db.run(
        `INSERT OR IGNORE INTO cells (mcc, mnc, lac, cellid, lat, lng, range, source, radio)
         ${placeholders}`,
        flat,
        function (err) {
          if (err) stats.errors += slice.length;
          else { stats.inserted += this.changes; stats.skipped += slice.length - this.changes; }
          writing = false;
          flush();
        }
      );
    };

    const onErr = (e) => {
      if (stats.total === 0) return reject(e);
      ended = true;
      maybeDone();
    };

    gzStream.on('error', onErr)
      .pipe(zlib.createGunzip()).on('error', onErr).pipe(csv({ headers: OCID_FIELDS }))
      .on('data', (row) => {
        stats.total++;
        const mcc = String(row.mcc || row.MCC || '').trim();
        const mnc = String(row.net || row.mnc || '').trim();
        const lac = String(row.area || row.lac || '').trim();
        const cellid = String(row.cell || row.cellid || '').trim();
        const lat = parseFloat(row.lat || row.latitude);
        const lon = parseFloat(row.lon || row.lng || row.longitude);
        const range = parseInt(row.range, 10) || 1000;
        if (!mcc || !mnc || !lac || !cellid || isNaN(lat) || isNaN(lon) || !isPlausibleLatLng(lat, lon, mcc)) { stats.errors++; return; }
        pending.push([mcc, mnc, lac, cellid, lat, lon, range, 'opencellid', normalizeRadio(row.radio) || inferRadio(cellid, null, row.radio)]);
        if (pending.length >= SUB_BATCH) flush();
      })
      .on('end', () => { ended = true; flush(); })
      .on('error', onErr);
  });
}

// Parse the MCC list ("452,440") into a clean array of numeric strings.
function parseMccList(mccList) {
  return String(mccList || '')
    .split(/[,\s;]+/)
    .map((m) => m.replace(/[^\d]/g, ''))
    .filter((m) => m.length > 0);
}

function setJobStatus(id, status, message, count) {
  db.run(
    `UPDATE sync_jobs SET last_run = CURRENT_TIMESTAMP, last_status = ?, last_message = ?, last_count = ? WHERE id = ?`,
    [status, message || '', count || 0, id],
    () => {}
  );
}

// Run one job: download every MCC in its list and import new cells.
async function runSyncJob(job, apiKey) {
  if (isRunning(job.id)) return { skipped: true, reason: 'already running' };
  if (!apiKey) throw new Error('OpenCellID API key chưa cấu hình');

  const mccs = parseMccList(job.mcc_list);
  if (mccs.length === 0) throw new Error('Danh sách MCC trống');

  runningJobs.add(job.id);
  setJobStatus(job.id, 'running', 'Đang tải...', 0);
  const totals = { inserted: 0, skipped: 0, errors: 0, total: 0, mccs: [] };

  try {
    for (const mcc of mccs) {
      const gzStream = await openMccStream(apiKey, mcc);
      const res = await importOcidStream(gzStream);
      totals.inserted += res.inserted;
      totals.skipped += res.skipped;
      totals.errors += res.errors;
      totals.total += res.total;
      totals.mccs.push({ mcc, ...res });
    }
    setJobStatus(job.id, 'ok',
      `MCC ${mccs.join(',')}: +${totals.inserted} mới, ${totals.skipped} bỏ qua, ${totals.errors} lỗi`,
      totals.inserted);
    return totals;
  } catch (err) {
    setJobStatus(job.id, 'error', err.message, totals.inserted);
    throw err;
  } finally {
    runningJobs.delete(job.id);
  }
}

module.exports = { runSyncJob, isRunning, parseMccList, importOcidStream };
