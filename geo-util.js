/**
 * Geo gate — chặn toạ độ rác từ nguồn ngoài / file import.
 *
 * Vì sao cần: cell id ngắn (kiểu GSM Cell ID hoặc LTE eNB ID) rất dễ trúng một
 * row khác trong bảng nội bộ hoặc một ô cùng tên ở nước khác, sinh marker sai
 * (đôi khi lệch cả nghìn km). Gate này loại các giá trị vô lý trước khi ghi vào
 * bảng `cells`, thay vì tin tuyệt đối vào nguồn trả về.
 *
 * Quy tắc:
 *   - Toạ độ phải hợp lệ toàn cầu (lat ±90, lng ±180) và không phải 0,0
 *     (0,0 là giá trị "null" hay gặp của nhiều nguồn).
 *   - MCC Việt Nam là 452. Khi mcc = 452, toạ độ bắt buộc nằm trong khung bao
 *     VN (nới hơn biên thật để không chặn nhầm cell sát biên/đảo).
 *
 * Cấu hình qua env (đặt cả 4 = 0 để tắt phần khung nước, chỉ còn kiểm tra toàn cầu):
 *   GEO_GATE_DISABLE=1
 *   GEO_GATE_VN_LAT_MIN / _MAX / GEO_GATE_VN_LNG_MIN / _MAX
 */
const GEO_GATE_DISABLED = process.env.GEO_GATE_DISABLE === '1';

const VN_BBOX = {
  latMin: parseFloat(process.env.GEO_GATE_VN_LAT_MIN || '8.0'),
  latMax: parseFloat(process.env.GEO_GATE_VN_LAT_MAX || '23.8'),
  lngMin: parseFloat(process.env.GEO_GATE_VN_LNG_MIN || '102.0'),
  lngMax: parseFloat(process.env.GEO_GATE_VN_LNG_MAX || '110.5')
};

const VN_MCC = '452';

function isValidGlobalLatLng(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
    && !(lat === 0 && lng === 0);
}

// Trả true nếu (lat, lng) đủ tin để ghi vào bảng cells cho MCC đã cho.
function isPlausibleLatLng(lat, lng, mcc) {
  if (GEO_GATE_DISABLED) return true;
  if (!isValidGlobalLatLng(lat, lng)) return false;
  // mcc rỗng/không rõ → chỉ áp kiểm tra toàn cầu, không đủ căn cứ siết theo nước.
  if (String(mcc == null ? '' : mcc).trim() !== VN_MCC) return true;
  if (VN_BBOX.latMax <= VN_BBOX.latMin || VN_BBOX.lngMax <= VN_BBOX.lngMin) return true;
  return lat >= VN_BBOX.latMin && lat <= VN_BBOX.latMax
    && lng >= VN_BBOX.lngMin && lng <= VN_BBOX.lngMax;
}

module.exports = { isPlausibleLatLng, isValidGlobalLatLng, VN_BBOX, VN_MCC, GEO_GATE_DISABLED };
