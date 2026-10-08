/**
 * Cell ID helpers — convert between eNB ID / short Cell ID and ECI / long Cell ID.
 *
 * LTE E-UTRAN Cell Identity (ECI) is 28-bit (3GPP TS 36.331):
 *   ECI = (eNB ID << 8) | Cell ID
 * where eNB ID is 20-bit and Cell ID (sector) is 8-bit.
 *   ECI     = eNB_ID * 256 + sector
 *   eNB_ID  = ECI >> 8   (floor division)
 *   sector  = ECI & 0xFF (mod 256)
 *
 * Short IDs (<= 2^20 - 1) are treated as eNB IDs; larger values up to 2^28 - 1 as ECI.
 * Rationale: an eNB ID is 20-bit (max 1,048,575), so any value above that cannot be
 * a bare eNB ID and must already be an ECI (3GPP TS 36.331).
 */

const ECI_MAX = 0xFFFFFFF;      // 2^28 - 1
const SHORT_THRESHOLD = 0x100000; // 2^20 = 1,048,576 (max eNB ID + 1)

/**
 * Convert eNB ID + sector to ECI (long cell ID).
 * @param {number|string} enbId eNB ID (20-bit)
 * @param {number|string} [sector=0] Cell ID / sector (8-bit)
 * @returns {number} ECI
 */
function enbToEci(enbId, sector) {
  const enb = parseInt(enbId, 10);
  const sec = parseInt(sector, 10) || 0;
  if (isNaN(enb)) return NaN;
  return enb * 256 + (sec & 0xFF);
}

/**
 * Convert ECI (long cell ID) to { enbId, sector }.
 * @param {number|string} eci
 * @returns {{ enbId: number, sector: number }}
 */
function eciToEnb(eci) {
  const n = parseInt(eci, 10);
  if (isNaN(n)) return { enbId: NaN, sector: NaN };
  return { enbId: Math.floor(n / 256), sector: n & 0xFF };
}

/**
 * Heuristic: short cell ID (eNB ID) vs long cell ID (ECI).
 * @param {number|string} value
 * @returns {'short'|'long'}
 */
function classifyCellId(value) {
  const n = parseInt(value, 10);
  if (isNaN(n)) return 'short';
  return n > SHORT_THRESHOLD && n <= ECI_MAX ? 'long' : 'short';
}

/**
 * Parse any cell ID form into all representations.
 * @param {number|string} value Input short (eNB) or long (ECI) cell ID
 * @param {number|string} [sectorHint] Sector to use if value is short
 * @returns {{ input, kind, enbId, sector, eci, isShort }|null}
 */
function parseCellId(value, sectorHint) {
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 0) return null;
  const kind = classifyCellId(n);
  if (kind === 'long') {
    const { enbId, sector } = eciToEnb(n);
    return { input: n, kind, isShort: false, enbId, sector, eci: n };
  }
  // Short: treat n as eNB ID (sector from hint if provided)
  const sec = (sectorHint !== undefined && sectorHint !== null && sectorHint !== '')
    ? (parseInt(sectorHint, 10) || 0)
    : 0;
  return { input: n, kind, isShort: true, enbId: n, sector: sec, eci: enbToEci(n, sec) };
}

/**
 * Return equivalent string forms of an MNC so lookups match regardless of
 * zero-padding ("01" vs "1"). Both variants are tried; DB is left untouched.
 * @param {string|number} mnc
 * @returns {string[]} unique variants, e.g. ['01','1']
 */
function mncVariants(mnc) {
  const raw = String(mnc == null ? '' : mnc).trim();
  if (!raw) return [''];
  const digits = raw.replace(/[^\d]/g, '');
  const out = new Set();
  if (!digits) { out.add(raw); return [...out]; }
  out.add(raw);
  out.add(digits);                                  // "01" -> "1"
  out.add(digits.padStart(2, '0'));                 // "1"  -> "01"
  out.add(String(parseInt(digits, 10)));            // strip leading zeros
  return [...out].filter((v) => v !== '');
}

/**
 * Cell-ID lookup candidates for a raw cellid, in priority order (short first).
 * Tries the value exactly as stored, then its ECI/long form when a sector hint
 * is available. The DB is not modified — callers probe these in order.
 * @param {string|number} cellid Raw cell ID from the log row
 * @param {string|number} [sectorHint]
 * @returns {string[]} unique candidate strings, e.g. ['662079','169492237']
 */
function cellIdLookupKeys(cellid, sectorHint) {
  const raw = String(cellid == null ? '' : cellid).trim();
  if (!raw) return [];
  const out = new Set([raw]);
  const parsed = parseCellId(raw, sectorHint);
  if (parsed && parsed.isShort) {
    out.add(String(parsed.eci));                    // short -> long fallback
  }
  return [...out];
}

module.exports = { enbToEci, eciToEnb, classifyCellId, parseCellId, mncVariants, cellIdLookupKeys, ECI_MAX, SHORT_THRESHOLD };
