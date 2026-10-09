/**
 * RAT (Radio Access Technology) helpers — dùng chung cho server.js và ocid-sync.js.
 *
 * Nhãn chuẩn (khớp với RADIO_STYLE ở public/app.js):
 *   GSM, CDMA, UMTS, LTE, NR, NBIOT, EVDO, IDEN
 */
const cellId = require('./cell-id');

// Suy RAT khi nguồn không khai báo.
//
// CẢNH BÁO: cell id một mình KHÔNG đủ để chắc chắn là GSM hay LTE — dải giá trị
// chồng lấn (id ngắn có thể là GSM Cell ID *hoặc* LTE eNB ID). Trước đây hàm này
// kết luận "id ngắn → GSM", và chính vì vậy các lần tra LTE cellid ngắn bị đẩy
// sang bảng GSM → toạ độ sai (đôi khi ra nước khác).
//
// Thứ tự quyết định (chỉ trả '' khi thật sự không biết):
//   1. `radioHint` do nguồn khai báo (cột radio/act của CSV, DB cell row, ...).
//   2. Có `sectorHint` → log tách eNB ID và sector riêng ⇒ đây là LTE
//      (eNB ID 20-bit + Cell ID 8-bit, 3GPP TS 36.331).
//   3. id nằm trong dải ECI hợp lệ nhưng lớn hơn 2^20 → không thể là eNB ID ⇒ LTE.
//   4. id vượt hẳn 2^28 → không phải LTE (GSM/UMTS cell id dài hơn).
//   5. Còn lại: mơ hồ ⇒ '' (để nguồn tra cứu tự quyết, không đoán bừa).
function inferRadio(cellid, sector, radioHint) {
  const known = normalizeRadio(radioHint);
  if (known) return known;
  try {
    const n = parseInt(cellid, 10);
    if (!Number.isFinite(n) || n < 0) return '';
    if (sector !== undefined && sector !== null && String(sector).trim() !== '') return 'LTE';
    if (n > cellId.SHORT_THRESHOLD && n <= cellId.ECI_MAX) return 'LTE';
    if (n > cellId.ECI_MAX) return 'GSM';
    return '';
  } catch (e) {
    return '';
  }
}

// Alias → nhãn chuẩn. Giá trị nguồn có thể là 'LTE', '4G', 'lte-a', 'NB-IoT'...
const RADIO_ALIASES = {
  'GSM': 'GSM', '2G': 'GSM',
  'CDMA': 'CDMA', 'CDMA2000': 'CDMA',
  'UMTS': 'UMTS', 'WCDMA': 'UMTS', '3G': 'UMTS', 'HSPA': 'UMTS',
  'LTE': 'LTE', 'LTE-M': 'LTE', 'LTEM': 'LTE', '4G': 'LTE', 'EUTRAN': 'LTE',
  'NR': 'NR', '5G': 'NR', 'NR5G': 'NR', '5GNR': 'NR',
  'NBIOT': 'NBIOT', 'NB-IOT': 'NBIOT', 'NB_IOT': 'NBIOT',
  'EVDO': 'EVDO', 'IDEN': 'IDEN'
};

// Chuẩn hoá giá trị RAT từ nhiều nguồn về nhãn chuẩn; '' khi không nhận diện được.
function normalizeRadio(radio) {
  if (radio === null || radio === undefined) return '';
  const k = String(radio).trim().toUpperCase().replace(/[\s_]/g, '');
  return RADIO_ALIASES[k] || '';
}

module.exports = { inferRadio, normalizeRadio, RADIO_ALIASES };
