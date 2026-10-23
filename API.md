# Public API v1 — Cell Tracker (cell.id.vn)

API cho ứng dụng / website khác tra cứu vị trí cell (trạm BTS) và lấy thông tin
tài khoản. Xác thực bằng **API key** (cổng kết nối) **+ JWT** (tài khoản bị trừ điểm).

- **Base URL:** `https://<domain-của-bạn>` (dev: `http://127.0.0.1:3000`)
- **Phiên bản:** `v1` — mọi response đều có trường `apiVersion`
- **Định dạng:** JSON (UTF-8)
- **CORS:** **không bật**. API dành cho gọi từ server. Trình duyệt ở domain khác
  sẽ bị same-origin policy chặn.

---

## 1. Quản lý API key

Đăng nhập trang admin → menu **API** → tab **Khoá API** → **Tạo khoá API**.

**Key là cổng kết nối, KHÔNG gắn với tài khoản nào.** Mỗi ứng dụng ngoài giữ một
key để chứng minh được cấp phép và chịu hạn mức riêng. Danh tính người dùng — và
do đó điểm bị trừ — đến từ lần đăng nhập của người dùng đó.

| Trường | Ý nghĩa |
|---|---|
| Tên khoá | Nhãn để bạn nhận ra key (VD: "App bán hàng — server") |
| Bắt buộc đăng nhập | Bật (mặc định) = phải gửi kèm JWT khi tra cứu. Chỉ tắt cho key dùng endpoint công khai |
| Quyền | `lookup` (tra cứu cell), `account` (xem thông tin tài khoản) |
| Hạn mức mỗi phút | Số request/phút cho key này (mọi tài khoản dùng chung key) |
| Hạn mức mỗi ngày | Số request/ngày cho key này |
| Ngày hết hạn | Để trống = không hết hạn |

> **Key chỉ hiển thị đúng 1 lần** lúc tạo. Server chỉ lưu SHA-256 của key nên
> không thể xem lại. Mất key → thu hồi và tạo key mới.

Key có dạng `sk_live_` + 64 ký tự hex (tổng 72 ký tự).

Các thao tác khác trong tab: **Tắt/Bật** (tạm ngưng, bật lại được), **Sửa**
(hạn mức, quyền, bắt buộc đăng nhập, ngày hết hạn), **Thu hồi** (vĩnh viễn, không
bật lại được), **Xoá** (chỉ khi key chưa từng được dùng). Cột **Request 24h** hiện
`24h / tổng`, kèm số tài khoản khác nhau đã dùng key (trong bộ lọc nhật ký).

---

## 2. Xác thực

Tra cứu cần **cả hai** header — key mở cổng, JWT xác định tài khoản:

```http
X-API-Key: <API_KEY_CUA_BAN>                        # dạng sk_live_ + 64 hex, tạo trong Admin
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...      # JWT từ /api/v1/login
```

Key cũng nhận qua `Authorization: Bearer sk_live_...` (nhưng khi đã dùng
`Authorization` cho JWT thì phải đặt key ở `X-API-Key`).

| Gửi gì | Kết quả |
|---|---|
| Key + JWT | Hợp lệ. Hạn mức theo key, scope = giao của key và JWT, điểm trừ tài khoản trong JWT |
| Chỉ JWT | Hợp lệ. Hạn mức riêng theo tài khoản (120/phút, 20.000/ngày) |
| Chỉ key | `401 USER_REQUIRED` — không biết trừ điểm của ai |
| Không gì | `401 NO_CREDENTIALS` |

Thứ tự kiểm tra với key: key tồn tại → chưa thu hồi → đang bật → chưa hết hạn →
trong hạn mức. Key không còn bước nào phụ thuộc tài khoản vì key không thuộc ai.

Với JWT: token hợp lệ và chưa hết hạn → tài khoản tồn tại → đang hoạt động (không
bị khoá, đã kích hoạt email).

### 2.1. Bảo trì website

Khi admin đóng website (Cấu hình → Website), mọi endpoint API v1 **trừ
`GET /api/v1/health`** trả `403` với `reason: "SITE_CLOSED"` cho tới khi mở lại.
Webhook payOS vẫn hoạt động. Endpoint công khai `GET /api/site/status` trả trạng
thái hiện tại (`{ open, closed, message }`) để client kiểm tra trước khi gọi API.

---

## 3. Endpoints

### 3.1 `GET /api/v1/health` — kiểm tra kết nối

Không cần xác thực.

```bash
curl https://your-domain/api/v1/health
```

```json
{
  "ok": true,
  "apiVersion": "v1",
  "service": "cell.id.vn",
  "time": "2026-10-20T12:17:57.848Z"
}
```

---

### 3.2 `POST /api/v1/login` — đăng nhập, trả JWT + thông tin tài khoản

Rate limit theo IP (30 lần / 5 phút) để chống dò mật khẩu.

**Body**

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `username` | string | ✔ | Tên đăng nhập **hoặc** email |
| `password` | string | ✔ | Mật khẩu |

```bash
curl -X POST https://your-domain/api/v1/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user01","password":"matkhau"}'
```

```json
{
  "ok": true,
  "apiVersion": "v1",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 86400,
  "user": {
    "id": 12,
    "username": "user01",
    "email": "user01@example.com",
    "role": "user",
    "status": "active",
    "credit_balance": 95
  }
}
```

Lỗi có thể gặp:

| HTTP | reason | Khi nào |
|---|---|---|
| 400 | `MISSING_CREDENTIALS` | Thiếu username/password |
| 401 | `INVALID_CREDENTIALS` | Sai tên đăng nhập hoặc mật khẩu |
| 403 | `ACCOUNT_DISABLED` | Tài khoản bị khoá |
| 403 | `EMAIL_NOT_VERIFIED` | Chưa kích hoạt email |
| 429 | — | Quá nhiều lần thử trong 5 phút |

---

### 3.3 `GET /api/v1/me` — thông tin tài khoản

Quyền: `account`.

```bash
curl https://your-domain/api/v1/me \
  -H "X-API-Key: sk_live_..." \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "ok": true,
  "apiVersion": "v1",
  "auth_type": "key+jwt",
  "user": {
    "id": 12,
    "username": "user01",
    "email": "user01@example.com",
    "role": "user",
    "status": "active",
    "created_at": "2026-01-15 09:30:00",
    "credit_balance": 95,
    "email_verified": true,
    "auth_type": "key+jwt"
  },
  "key": {
    "id": 3,
    "name": "App bán hàng",
    "prefix": "sk_live_ab12",
    "scopes": ["lookup", "account"],
    "rate_limit_per_min": 60,
    "rate_limit_per_day": 5000,
    "expires_at": null,
    "require_user": true
  }
}
```

`user` là **tài khoản đã đăng nhập** (nguồn bị trừ điểm), không phải "chủ của key"
— key không có chủ. `key` chỉ có mặt khi request có gửi key; gửi chỉ JWT thì
`auth_type` là `"jwt"` và không có `key`.

---

### 3.4 `GET /api/v1/cells/resolve` — tra cứu vị trí cell

Quyền: `lookup`.

**Query**

| Tham số | Bắt buộc | Mô tả |
|---|---|---|
| `mcc` | ✔ | Mã quốc gia di động (Việt Nam: `452`) |
| `mnc` | ✔ | Mã mạng (`01`, `02`, `04`, `05`, `07`…) |
| `lac` | ✔ | Location Area Code (hoặc TAC với 4G/5G) |
| `cellid` | ✔ | Cell ID (chấp nhận cả dạng ngắn và ECI dạng dài) |
| `sector` | — | Sector, dùng để dựng ECI khi `cellid` là dạng ngắn |
| `radio` | — | Gợi ý công nghệ: `GSM`, `UMTS`, `LTE`, `NR`… |
| `debug` | — | `1` = kèm lý do miss của từng nguồn (**chỉ admin**) |

```bash
curl "https://your-domain/api/v1/cells/resolve?mcc=452&mnc=01&lac=9000&cellid=123456" \
  -H "X-API-Key: sk_live_..." \
  -H "Authorization: Bearer $TOKEN"
```

> Thiếu JWT (chỉ gửi key) → `401 USER_REQUIRED`. Điểm trừ vào tài khoản của JWT.

**Tìm thấy — 200**

```json
{
  "ok": true,
  "apiVersion": "v1",
  "found": true,
  "source": "local",
  "radio_source": "declared",
  "radio_confident": true,
  "credit": { "balance": 94, "charged": 1 },
  "cell": {
    "mcc": "452",
    "mnc": "01",
    "lac": "9000",
    "cellid": "123456",
    "sector": "1",
    "lat": 21.0278,
    "lon": 105.8342,
    "range": 500,
    "radio": "LTE",
    "address": "Số 1 Đại Cồ Việt, Hà Nội"
  }
}
```

| Trường | Ý nghĩa |
|---|---|
| `source` | Nguồn trả kết quả: `local` (CSDL nội bộ), `opencellid`, `opencellid_web`, `t0stbrot`, `combain`, `google` |
| `radio_source` | `declared` = theo `radio` bạn gửi; `inferred` = server suy luận từ cellid |
| `radio_confident` | `false` = công nghệ chỉ là phỏng đoán |
| `credit.balance` | Số dư còn lại sau lần tra |
| `credit.charged` | Số điểm đã trừ lần này (0 nếu hệ thống tắt tính điểm) |
| `cell.range` | Bán kính ước lượng (mét) |
| `cell.address` | Địa chỉ mô tả (nếu có) |

**Không tìm thấy — 404**

```json
{
  "ok": false, "apiVersion": "v1", "found": false,
  "reason": "CELL_NOT_FOUND",
  "error": "Không tìm thấy cell trong CSDL nội bộ, OpenCellID.org, ..."
}
```

**Không đủ điểm — 402**

```json
{
  "ok": false, "apiVersion": "v1", "found": false,
  "reason": "INSUFFICIENT_CREDIT",
  "error": "Không đủ điểm",
  "balance": 0, "required": 1
}
```

**Thiếu tham số — 400**

```json
{ "ok": false, "apiVersion": "v1", "found": false,
  "reason": "BAD_REQUEST", "error": "mcc, mnc, lac, cellid required" }
```

> Thứ tự nguồn và cách trừ điểm **giống hệt** tra cứu trên web: CSDL nội bộ
> trước, rồi các nguồn online theo độ ưu tiên, cuối cùng là Google Geolocation.
> Mỗi lần tra **ra kết quả** trừ `credit_cost_per_lookup` điểm; **miss không trừ**.
> Retry cùng cell trong cùng giây không bị trừ 2 lần.

---

## 4. Hạn mức (rate limit)

Mỗi response (kể cả lỗi) đều kèm header:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Limit-Day: 5000
X-RateLimit-Remaining-Day: 4912
```

Khi vượt hạn mức — **429**:

```json
{ "ok": false, "apiVersion": "v1", "reason": "RATE_LIMITED",
  "error": "Vượt quá hạn mức gọi API. Thử lại sau 42 giây.",
  "retryAfter": 42, "limitPerMin": 60, "limitPerDay": 5000 }
```

kèm header `Retry-After: 42` (giây).

Hạn mức tính theo từng API key (mọi tài khoản dùng chung key đó). Request bị chặn
**không** bị tính vào hạn mức (và không bị trừ điểm). Khi chỉ gửi JWT (không key),
hạn mức tính riêng theo tài khoản.

---

## 5. Bảng mã lỗi

| HTTP | `reason` | Ý nghĩa | Cách xử lý |
|---|---|---|---|
| 400 | `BAD_REQUEST` | Thiếu/sai tham số | Sửa query |
| 400 | `MISSING_CREDENTIALS` | Thiếu username/password khi login | Gửi đủ |
| 401 | `NO_CREDENTIALS` | Không gửi header xác thực | Thêm `X-API-Key` + `Authorization` |
| 401 | `USER_REQUIRED` | Có key nhưng chưa đăng nhập | Gọi `/api/v1/login`, gửi kèm JWT |
| 401 | `INVALID_KEY` | Key không tồn tại | Kiểm tra lại key |
| 401 | `INVALID_TOKEN` | JWT sai hoặc hết hạn | Đăng nhập lại |
| 401 | `KEY_REVOKED` | Key đã bị thu hồi | Xin admin cấp key mới |
| 401 | `KEY_EXPIRED` | Key quá ngày hết hạn | Xin admin gia hạn |
| 401 | `INVALID_CREDENTIALS` | Sai tài khoản/mật khẩu | Kiểm tra lại |
| 402 | `INSUFFICIENT_CREDIT` | Tài khoản không đủ điểm | Nạp điểm |
| 403 | `KEY_DISABLED` | Key đang bị tắt | Xin admin bật lại |
| 403 | `INSUFFICIENT_SCOPE` | Key (hoặc tài khoản) thiếu quyền | Xin admin thêm quyền cho key |
| 403 | `ACCOUNT_DISABLED` | Tài khoản đăng nhập bị khoá | Liên hệ admin |
| 403 | `EMAIL_NOT_VERIFIED` | Chưa kích hoạt email | Kích hoạt email |
| 404 | `CELL_NOT_FOUND` | Không nguồn nào có cell | Kiểm tra MCC/MNC/LAC/CellID |
| 429 | `RATE_LIMITED` | Vượt hạn mức | Chờ `Retry-After` giây |
| 500 | `INTERNAL_ERROR` | Lỗi server | Thử lại / báo admin |

---

## 6. Ví dụ tích hợp

Mẫu dưới đây cho thấy mô hình đúng: ứng dụng giữ **key** (cấu hình 1 lần), còn
**JWT** lấy từ lần đăng nhập của từng người dùng và đi kèm mỗi request tra cứu.

### Node.js

```js
const API_BASE = 'https://your-domain';
const API_KEY = process.env.CELL_API_KEY;   // cấu hình 1 lần cho cả ứng dụng

// Đăng nhập hộ người dùng → JWT (điểm sẽ trừ vào tài khoản này).
async function login(username, password) {
  const res = await fetch(`${API_BASE}/api/v1/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`[${body.reason}] ${body.error}`);
  return { token: body.token, user: body.user };
}

// Tra cứu: gửi CẢ key (cổng) lẫn JWT (tài khoản).
async function resolveCell(token, { mcc, mnc, lac, cellid, sector, radio }) {
  const qs = new URLSearchParams({ mcc, mnc, lac, cellid });
  if (sector) qs.set('sector', sector);
  if (radio) qs.set('radio', radio);

  const res = await fetch(`${API_BASE}/api/v1/cells/resolve?${qs}`, {
    headers: { 'X-API-Key': API_KEY, 'Authorization': `Bearer ${token}` }
  });
  const body = await res.json();

  if (res.ok) return body.cell;
  if (res.status === 404) return null;            // không có cell này
  if (res.status === 401 && body.reason === 'USER_REQUIRED') {
    throw new Error('Cần đăng nhập lại');         // thiếu/hết JWT
  }
  if (res.status === 429) {                       // bị chặn tạm thời
    const wait = Number(res.headers.get('Retry-After') || 30);
    await new Promise(r => setTimeout(r, wait * 1000));
    return resolveCell(token, { mcc, mnc, lac, cellid, sector, radio });
  }
  throw new Error(`[${body.reason}] ${body.error}`);
}

// Số dư của tài khoản đang đăng nhập
async function getBalance(token) {
  const res = await fetch(`${API_BASE}/api/v1/me`, {
    headers: { 'X-API-Key': API_KEY, 'Authorization': `Bearer ${token}` }
  });
  const body = await res.json();
  return body.user.credit_balance;
}
```

### PHP

```php
function apiHeaders(?string $token = null): array {
    $h = ['X-API-Key: ' . getenv('CELL_API_KEY')];
    if ($token) $h[] = 'Authorization: Bearer ' . $token;
    return $h;
}

function resolveCell(string $token, $mcc, $mnc, $lac, $cellid) {
    $url = 'https://your-domain/api/v1/cells/resolve?' . http_build_query([
        'mcc' => $mcc, 'mnc' => $mnc, 'lac' => $lac, 'cellid' => $cellid,
    ]);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => apiHeaders($token),
        CURLOPT_TIMEOUT => 20,
    ]);
    $body = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $data = json_decode($body, true);
    if ($status === 200) return $data['cell'];
    if ($status === 404) return null;
    throw new RuntimeException('[' . ($data['reason'] ?? '?') . '] ' . ($data['error'] ?? ''));
}
```

### Python

```python
import os, requests

API_BASE = "https://your-domain"
API_KEY = os.environ["CELL_API_KEY"]

def api_headers(token=None):
    """Key luôn có; JWT thêm vào khi đã đăng nhập."""
    h = {"X-API-Key": API_KEY}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h

def login(username, password):
    """Đăng nhập hộ người dùng → JWT. Điểm trừ vào tài khoản này."""
    r = requests.post(f"{API_BASE}/api/v1/login",
                      json={"username": username, "password": password}, timeout=20)
    r.raise_for_status()
    return r.json()["token"]

def resolve_cell(token, mcc, mnc, lac, cellid, sector=None):
    params = {"mcc": mcc, "mnc": mnc, "lac": lac, "cellid": cellid}
    if sector:
        params["sector"] = sector
    r = requests.get(f"{API_BASE}/api/v1/cells/resolve",
                     params=params, headers=api_headers(token), timeout=20)
    if r.status_code == 200:
        return r.json()["cell"]
    if r.status_code == 404:
        return None
    data = r.json()
    raise RuntimeError(f"[{data.get('reason')}] {data.get('error')}")
```

---

## 7. Lưu ý bảo mật

- **Không nhúng API key vào JavaScript chạy trên trình duyệt** — ai cũng đọc
  được. Key dùng cho server-to-server.
- Đặt key trong biến môi trường, không commit vào git.
- Key là **cấp cho ứng dụng**, không phải cho người dùng: một key cho mỗi ứng
  dụng để thu hồi riêng lẻ khi cần. Một key có thể phục vụ nhiều tài khoản.
- **Không bao giờ trả JWT của người dùng này cho người dùng khác.** JWT là danh
  tính và là nguồn trừ điểm — coi như mật khẩu phiên. Hết hạn sau 24 giờ.
- Key mất hoặc nghi bị lộ → admin **Thu hồi** ngay, rồi tạo key mới. Thu hồi key
  không ảnh hưởng tài khoản/dữ liệu nào (key không sở hữu gì).
- Đặt hạn mức phút/ngày vừa đủ dùng để giảm thiệt hại nếu key bị lộ.

---

## 8. Ghi chú vận hành (cho admin)

- Tab **Nhật ký gọi API** ghi mọi request: thời gian, key, **tài khoản đã đăng
  nhập**, method, path, status, thời gian xử lý, số cell tra được, điểm đã trừ,
  IP, thông báo lỗi. Cột tài khoản cho biết điểm bị trừ của ai.
- Lọc theo trạng thái hoặc theo key.
- Bộ lọc key hiện số tài khoản khác nhau đã dùng key đó — một key phục vụ nhiều
  người dùng là bình thường.
- Không bao giờ ghi key thô vào nhật ký — chỉ `key_prefix`.
- Nhật ký cũ tự dọn theo `api_request_logs_retention_days` (mặc định 30 ngày).

---

## 9. Tra cứu địa chỉ IP (bổ sung)

Ngoài API cell, máy chủ còn có **tra cứu IP đa nguồn**. Đây là endpoint dùng cho
trang công cụ `/tools/ip-lookup.html`, xác thực bằng **JWT** (không dùng API key
`sk_live_...` của mục 1 — API key đó dành cho tra cell).

| Endpoint | Xác thực | Mô tả |
|---|---|---|
| `GET /api/tools/ip-lookup?ip=8.8.8.8` | JWT | Tra mọi nguồn đang bật, hạn mức theo tài khoản/ngày |
| `GET /api/tools/ip-lookup/guest?ip=8.8.8.8` | công khai | Chỉ nguồn không cần key, hạn mức theo IP người gọi/ngày |
| `GET /api/tools/ip-lookup/me` | JWT | IP hiện tại của người gọi (không tra cứu, không tốn hạn mức) |
| `GET /api/tools/ip-lookup/config` | công khai | Danh sách nguồn đang bật + hạn mức (không trả key) |
| `GET /api/tools/ip-lookup/console` | công khai (admin bật) | IP công khai của CHÍNH MÁY CHỦ, hạn mức theo ngày; tắt mặc định |

Tham số thêm cho endpoint đầu tiên: `sources=dbip,ipwho_is` (giới hạn nguồn),
`fresh=1` (bỏ qua cache), `self=1` (tra IP của chính người gọi).

```bash
curl -H "Authorization: Bearer $JWT" \
     "https://cell.id.vn/api/tools/ip-lookup?ip=113.163.26.78"
```

Response rút gọn:

```json
{
  "ok": true,
  "ip": "113.163.26.78",
  "ipVersion": 4,
  "cacheHits": 2,
  "results": [
    { "source": "dbip", "label": "DB-IP", "ok": true, "cached": false, "ms": 812,
      "data": { "country": "Vietnam", "countryCode": "VN", "city": "Can Tho", "asn": "AS7552" } },
    { "source": "ipwho_is", "label": "ipwho.is", "ok": true, "cached": true, "ms": 1, "data": { } }
  ],
  "aggregate": {
    "sources_total": 5, "sources_ok": 4, "agreement": 0.88,
    "fields": {
      "country": { "value": "Vietnam", "count": 4, "sources": ["dbip", "ipwho_is"] },
      "asn": { "value": "AS7552", "count": 4, "sources": ["dbip", "ipwho_is"] }
    },
    "lat": 10.0334, "lon": 105.78336,
    "flags": { "isMobile": { "value": true, "sources": ["ipinfo"] } }
  },
  "usage": { "used": 1, "limit": 50, "remaining": 49 }
}
```

Quy ước quan trọng:

- `aggregate.fields.<trường>.value` là giá trị **nhiều nguồn đồng ý nhất**,
  `count`/`sources` cho biết mức đồng thuận, `alternatives` là các phương án khác
  (tối đa 3). `aggregate.lat/lon` là **trung vị** của các nguồn có toạ độ — không
  phải toạ độ thiết bị.
- Mỗi phần tử `results[]` có `ok:false` + `error` khi nguồn lỗi/hết hạn mức/thiếu
  key; **các nguồn khác vẫn trả bình thường** (không có chuyện cả request thất bại
  chỉ vì một nguồn chết).
- Cờ `flags.isProxy`/`flags.isHosting`/`flags.isMobile` là **hợp nhất**: true nếu
  bất kỳ nguồn nào nói true.
- Hạn mức: `429` kèm `code: "IP_LOOKUP_QUOTA"` (tài khoản) hoặc
  `code: "IP_TRIAL_EXHAUSTED"` (khách). Mốc reset ngày theo `ip_lookup_day_cutoff_hour`
  (giờ Việt Nam), cấu hình trong admin → **Tra cứu IP** → tab Cấu hình.
- Cache dùng chung giữa khách và người dùng đăng nhập, TTL theo từng nguồn
  (`cache_days`, mặc định 3–7 ngày; kết quả lỗi chỉ cache 1 ngày).
- Dữ liệu vị trí IP chỉ mang tính tham khảo (NAT/CGNAT, toạ độ ở mức vùng/nhà mạng).
