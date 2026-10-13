/**
 * payOS gateway wrapper — cổng nạp điểm qua chuyển khoản ngân hàng.
 *
 * Nguyên tắc:
 *  1. Module này KHÔNG tự cộng điểm. Nó chỉ tạo link / verify webhook / đồng bộ
 *     trạng thái. Việc cộng điểm do server.js gọi credits.topUp(type='payment').
 *  2. Mọi hàm trả `{ok, ...}` / `{ok:false, reason}` theo convention của
 *     credits.js — không throw ra ngoài để route không phải try/catch từng nhánh.
 *  3. `payos_test_mode=1` → bỏ qua mạng hoàn toàn, trả link nội bộ + QR giả để
 *     test end-to-end trên local (xem route /api/admin/payments/:code/mock-paid).
 *  4. Config đọc từ bảng settings MỖI LẦN GỌI (giống credits.js) → admin đổi
 *     credential là có hiệu lực ngay, không cần restart. Client payOS được cache
 *     theo "dấu vân tay" config để không tạo instance mới mỗi request.
 */
const db = require('./database');
const { PayOS } = require('@payos/node');
const QRCode = require('qrcode');

const DEFAULT_BASE_URL = 'https://api-merchant.payos.vn';

/**
 * Sinh ảnh QR (data-URL PNG) từ **chuỗi VietQR** do payOS trả về.
 *
 * payOS KHÔNG trả URL ảnh QR — `qrCode` là chuỗi EMVCo VietQR
 * (`00020101021238540010A000000727...`). Trình duyệt không render được chuỗi đó
 * bằng `<img src>` nên phải tự dựng ảnh. Dùng `qrcode` (thuần JS, không native)
 * → không phụ thuộc CDN/dịch vụ ngoài và test offline được.
 *
 * @param {string} qrCode chuỗi VietQR (rỗng/undefined → trả null)
 * @returns {Promise<string|null>} `data:image/png;base64,...` hoặc null khi lỗi/rỗng
 */
async function buildQrImage(qrCode) {
  const payload = (qrCode || '').trim();
  if (!payload) return null;
  // Chỉ nhận chuỗi VietQR. Test mode trả URL nội bộ (`/topup.html?order=..&mock=1`)
  // thay vì chuỗi QR → cả URL tuyệt đối lẫn đường dẫn tương đối đều KHÔNG phải
  // nội dung QR, bỏ qua (client hiện nút mở trang payOS thay thế).
  if (/^https?:\/\//i.test(payload) || payload.startsWith('/')) return null;
  try {
    return await QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 1, width: 320 });
  } catch (e) {
    // QR hỏng KHÔNG được làm hỏng việc tạo đơn — client sẽ hiện link payOS dự phòng.
    return null;
  }
}

// Cache client: key = fingerprint config, value = PayOS instance.
let cachedClient = null;
let cachedKey = '';

function getSetting(key, dflt) {
  return new Promise((resolve) => {
    db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
      resolve(err || !row || row.value === null || row.value === undefined ? dflt : row.value);
    });
  });
}

/** Đọc toàn bộ config payOS từ settings (không lộ secret ra ngoài route public). */
async function getConfig() {
  const [enabled, clientId, apiKey, checksumKey, baseUrl, webhookUrl, testMode, base] = await Promise.all([
    getSetting('payos_enabled', '0'),
    getSetting('payos_client_id', ''),
    getSetting('payos_api_key', ''),
    getSetting('payos_checksum_key', ''),
    getSetting('payos_base_url', ''),
    getSetting('payos_webhook_url', ''),
    getSetting('payos_test_mode', '0'),
    getSetting('public_base_url', '')
  ]);
  return {
    enabled: enabled === '1',
    testMode: testMode === '1',
    clientId: String(clientId || '').trim(),
    apiKey: String(apiKey || '').trim(),
    checksumKey: String(checksumKey || '').trim(),
    baseUrl: String(baseUrl || '').trim() || DEFAULT_BASE_URL,
    webhookUrl: String(webhookUrl || '').trim(),
    publicBaseUrl: String(base || '').trim().replace(/\/+$/, '')
  };
}

/** Đã bật cổng VÀ có đủ 3 credential chưa. */
async function isConfigured() {
  const c = await getConfig();
  return c.enabled && !!(c.clientId && c.apiKey && c.checksumKey);
}

/**
 * URL công khai của site, dùng cho returnUrl/cancelUrl/webhook.
 * Thứ tự ưu tiên: public_base_url → payos_webhook_url (bỏ path) → host của request.
 * Nhờ vậy local tự nhận http://localhost:3000 mà không cần cấu hình gì.
 */
async function resolveBaseUrl(req) {
  const c = await getConfig();
  if (c.publicBaseUrl) return c.publicBaseUrl;
  if (c.webhookUrl) {
    try { return new URL(c.webhookUrl).origin; } catch (e) { /* fallthrough */ }
  }
  if (req && req.get) {
    const host = req.get('host');
    if (host) return `${req.protocol || 'http'}://${host}`;
  }
  return '';
}

/** URL webhook đã cấu hình, hoặc mặc định `<base>/api/payos/webhook`. */
async function resolveWebhookUrl(req) {
  const c = await getConfig();
  if (c.webhookUrl) return c.webhookUrl;
  const base = await resolveBaseUrl(req);
  return base ? `${base}/api/payos/webhook` : '';
}

/** Tỉ lệ quy đổi VND → điểm. */
async function getVndPerCredit() {
  const n = Number(await getSetting('topup_vnd_per_credit', '1000'));
  return Number.isFinite(n) && n > 0 ? n : 1000;
}

/** Khoảng nạp cho phép (VND). */
async function getLimits() {
  const [min, max] = await Promise.all([
    getSetting('topup_min_vnd', '10000'),
    getSetting('topup_max_vnd', '5000000')
  ]);
  const mn = Number(min), mx = Number(max);
  return {
    min: Number.isFinite(mn) && mn > 0 ? Math.round(mn) : 10000,
    max: Number.isFinite(mx) && mx > 0 ? Math.round(mx) : 5000000
  };
}

/** Quy đổi VND sang điểm, làm tròn 4 chữ số thập phân (khớp credits.js). */
async function vndToCredits(vnd) {
  const per = await getVndPerCredit();
  return Math.round((Number(vnd) / per) * 10000) / 10000;
}

/** Client payOS, cache theo fingerprint config. */
function getClient(cfg) {
  const key = `${cfg.clientId}|${cfg.apiKey}|${cfg.checksumKey}|${cfg.baseUrl}`;
  if (cachedClient && cachedKey === key) return cachedClient;
  cachedClient = new PayOS({
    clientId: cfg.clientId,
    apiKey: cfg.apiKey,
    checksumKey: cfg.checksumKey,
    baseURL: cfg.baseUrl
  });
  cachedKey = key;
  return cachedClient;
}

// payOS giới hạn description 25 ký tự, chỉ chữ/số/khoảng trắng (không dấu,
// không ký tự đặc biệt) → sinh từ orderCode để luôn hợp lệ và tra được đơn.
function buildDescription(orderCode) {
  return `Nap diem ${orderCode}`.slice(0, 25);
}

/**
 * Tạo payment link.
 * @returns {{ok:true, data:object}|{ok:false, reason:string, message?:string}}
 */
async function createPaymentLink({ orderCode, amount, description, returnUrl, cancelUrl, buyerName }) {
  const cfg = await getConfig();
  if (!cfg.enabled) return { ok: false, reason: 'disabled', message: 'Cổng thanh toán đang tắt' };
  if (!(cfg.clientId && cfg.apiKey && cfg.checksumKey)) {
    return { ok: false, reason: 'not_configured', message: 'Chưa cấu hình payOS' };
  }

  // Test mode: không gọi mạng. Trả link nội bộ để admin/user tự "trả tiền".
  if (cfg.testMode) {
    const base = await resolveBaseUrl(null);
    const checkout = `${base}/topup.html?order=${orderCode}&mock=1`;
    return {
      ok: true,
      testMode: true,
      data: {
        bin: '970000',
        accountNumber: '0000000000',
        accountName: 'PAYOS TEST MODE',
        amount,
        description: description || buildDescription(orderCode),
        orderCode,
        currency: 'VND',
        paymentLinkId: `test_${orderCode}`,
        status: 'PENDING',
        checkoutUrl: checkout,
        qrCode: checkout
      }
    };
  }

  try {
    const client = getClient(cfg);
    const data = await client.paymentRequests.create({
      orderCode,
      amount,
      description: description || buildDescription(orderCode),
      cancelUrl,
      returnUrl,
      ...(buyerName ? { buyerName } : {})
    });
    // payOS trả `qrCode` là CHUỖI VietQR (không phải URL ảnh) → dựng sẵn ảnh PNG
    // để client chỉ việc nhét vào <img src>. Lỗi QR không làm hỏng việc tạo đơn.
    if (data && typeof data === 'object') {
      data.qrImage = await buildQrImage(data.qrCode);
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, reason: 'payos_error', message: mapError(e) };
  }
}

/** Lấy thông tin link theo paymentLinkId hoặc orderCode. */
async function getPaymentLink(id) {
  const cfg = await getConfig();
  if (cfg.testMode) {
    return { ok: true, testMode: true, data: { id: String(id), orderCode: Number(id) || 0, status: 'PENDING', amountPaid: 0, transactions: [] } };
  }
  try {
    const client = getClient(cfg);
    const data = await client.paymentRequests.get(id);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, reason: 'payos_error', message: mapError(e) };
  }
}

/** Huỷ link thanh toán. */
async function cancelPaymentLink(id, reason) {
  const cfg = await getConfig();
  if (cfg.testMode) return { ok: true, testMode: true, data: { id: String(id), status: 'CANCELLED' } };
  try {
    const client = getClient(cfg);
    const data = await client.paymentRequests.cancel(id, reason || 'Admin huy');
    return { ok: true, data };
  } catch (e) {
    return { ok: false, reason: 'payos_error', message: mapError(e) };
  }
}

/** Đăng ký webhook URL với payOS (payOS sẽ gọi thử endpoint để xác thực). */
async function confirmWebhook(webhookUrl) {
  const cfg = await getConfig();
  if (!(cfg.clientId && cfg.apiKey && cfg.checksumKey)) {
    return { ok: false, reason: 'not_configured', message: 'Chưa cấu hình payOS' };
  }
  try {
    const client = getClient(cfg);
    const data = await client.webhooks.confirm(webhookUrl);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, reason: 'payos_error', message: mapError(e) };
  }
}

/**
 * Verify chữ ký webhook. SDK throw khi sai → wrap thành {ok:false}.
 * @returns {{ok:true, data:object}|{ok:false, reason:string, message:string}}
 */
async function verifyWebhook(webhook) {
  const cfg = await getConfig();
  if (!cfg.checksumKey) return { ok: false, reason: 'not_configured', message: 'Chưa cấu hình checksum key' };
  if (!webhook || typeof webhook !== 'object') return { ok: false, reason: 'invalid_body', message: 'Body không hợp lệ' };
  // Test mode vẫn verify bình thường — route mock tự ký bằng checksumKey thật.
  try {
    const client = getClient(cfg);
    const data = await client.webhooks.verify(webhook);
    if (!data || typeof data !== 'object') return { ok: false, reason: 'invalid_data', message: 'Dữ liệu webhook rỗng' };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, reason: 'invalid_signature', message: 'Chữ ký webhook không hợp lệ' };
  }
}

/**
 * Ký 1 payload webhook (dùng cho route test mode để đi đúng luồng verify).
 * @returns {Promise<{data:object, signature:string}>}
 */
async function signWebhookPayload(data) {
  const cfg = await getConfig();
  const client = getClient(cfg);
  const signature = await client.crypto.createSignatureFromObj(data, cfg.checksumKey);
  return { data, signature };
}

/** Map lỗi SDK/HTTP sang message tiếng Việt cho admin/user đọc được. */
function mapError(e) {
  const status = e && (e.status || (e.response && e.response.status));
  const desc = (e && (e.message || (e.error && e.error.desc))) || 'Lỗi không xác định';
  if (status === 401) return 'payOS từ chối: sai client-id hoặc api-key';
  if (status === 403) return 'payOS từ chối: tài khoản không có quyền';
  if (status === 429) return 'payOS giới hạn tần suất, thử lại sau';
  return `payOS lỗi: ${desc}`;
}

module.exports = {
  DEFAULT_BASE_URL,
  getSetting,
  getConfig,
  isConfigured,
  resolveBaseUrl,
  resolveWebhookUrl,
  getVndPerCredit,
  getLimits,
  vndToCredits,
  buildDescription,
  buildQrImage,
  createPaymentLink,
  getPaymentLink,
  cancelPaymentLink,
  confirmWebhook,
  verifyWebhook,
  signWebhookPayload,
  mapError
};
