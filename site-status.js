/**
 * Trạng thái bật/đóng website (chế độ bảo trì).
 *
 * Nguồn sự thật là bảng `settings`:
 *   - `site_open`            '1' = mở, '0' = đóng (mặc định '1')
 *   - `site_closed_message`  thông báo hiển thị khi đóng; rỗng = dùng mặc định
 *
 * Module tách khỏi server.js để dùng chung cho:
 *   - middleware chặn /api khi website đóng (server.js),
 *   - GET /api/site/status (công khai),
 *   - GET /maintenance.html + GET /site-status.js (bootstrap phía client),
 *   - PUT /api/settings (gọi invalidate() sau khi admin lưu).
 *
 * Cache 5 giây: trạng thái được đọc trên gần như mọi request /api, đọc DB mỗi
 * lần sẽ thừa. Admin bật/tắt xong gọi invalidate() nên có hiệu lực ngay; nếu
 * có tiến trình khác ghi DB thì trễ tối đa CACHE_TTL_MS.
 */
const db = require('./database');

/** Thông báo mặc định khi admin để trống nội dung. */
const DEFAULT_MESSAGE =
  'Website đang bảo trì để nâng cấp hệ thống. Vui lòng quay lại sau ít phút. Xin lỗi vì sự bất tiện này.';

const CACHE_TTL_MS = 5000;

let cache = null;      // { open, closed, message }
let cacheAt = 0;       // thời điểm ghi cache (ms)
let inflight = null;   // Promise đang đọc DB — gộp các request đồng thời
let generation = 0;    // tăng mỗi lần invalidate(); chặn kết quả đọc cũ ghi đè cache mới

/** Đọc 1 setting dạng chuỗi; thiếu/lỗi → giá trị mặc định. */
function readValue(key, dflt) {
  return new Promise((resolve) => {
    db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
      resolve(err || !row || row.value === null || row.value === undefined ? dflt : row.value);
    });
  });
}

/** Chuẩn hoá thông báo: rỗng/chỉ khoảng trắng → thông báo mặc định. */
function resolveMessage(raw) {
  const s = String(raw == null ? '' : raw).trim();
  return s || DEFAULT_MESSAGE;
}

async function readStatus() {
  const [openRaw, messageRaw] = await Promise.all([
    readValue('site_open', '1'),
    readValue('site_closed_message', '')
  ]);
  const closed = String(openRaw).trim() === '0';
  return {
    open: !closed,
    closed,
    message: closed ? resolveMessage(messageRaw) : ''
  };
}

/**
 * Trạng thái hiện tại (cache ngắn).
 * Lỗi DB → fail-open (coi như đang mở) để sự cố DB không khoá toàn website.
 * @returns {Promise<{open:boolean, closed:boolean, message:string}>}
 */
async function getStatus() {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_TTL_MS) return cache;
  if (inflight) return inflight;

  const gen = generation;
  const p = (async () => {
    try {
      const status = await readStatus();
      // Chỉ ghi cache nếu chưa có invalidate() xen vào giữa lúc đọc.
      if (gen === generation) {
        cache = status;
        cacheAt = Date.now();
      }
      return status;
    } catch (e) {
      // Tránh spam log: chỉ log khi cache chưa từng có trạng thái đóng.
      if (!cache || !cache.closed) console.error('[site-status] đọc settings lỗi:', e && e.message);
      return { open: true, closed: false, message: '' };
    }
  })();

  inflight = p;
  // Chỉ xoá tham chiếu nếu đây vẫn là request đang giữ inflight (invalidate có
  // thể đã thay bằng request mới).
  p.then(() => { if (inflight === p) inflight = null; });
  return p;
}

/** Buộc request kế tiếp đọc lại từ DB (gọi sau khi admin lưu settings). */
function invalidate() {
  generation++;
  cache = null;
  cacheAt = 0;
  inflight = null;
}

module.exports = {
  DEFAULT_MESSAGE,
  CACHE_TTL_MS,
  resolveMessage,
  getStatus,
  invalidate
};
