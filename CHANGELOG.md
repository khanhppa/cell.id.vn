# Changelog

Mọi thay đổi đáng chú ý của Cell.id.vn được ghi ở đây.
Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/),
phiên bản theo [Semantic Versioning](https://semver.org/lang/vi/).

### Security
- **Giới hạn của captcha chữ (đã cân nhắc, chấp nhận)**: captcha hiện trả cả `id` lẫn
  `text` trong JSON nên **không** chống được bot đọc được response. Giá trị thực tế là
  chặn script spam ngây thơ và buộc mọi client phải gọi `GET /api/captcha` trước (tạo
  điểm rate-limit + để lại dấu vết). Muốn chống bot thật cần render ảnh ở server
  (SVG/canvas) — sẽ làm ở giai đoạn sau nếu bị lạm dụng.
- **Rate limit route auth** 30 request / 5 phút / IP; mã xác thực giới hạn 5 lần nhập sai
  rồi buộc xin mã mới; captcha và token đều one-shot, so sánh bằng `crypto.timingSafeEqual`.
- `smtp_pass` là secret: API admin chỉ trả bản che `••••1234`, gửi lại bản che nghĩa là
  "giữ nguyên" (không ghi đè).

## [2.4.0] - 2026-10-12

### Added
- **Trang nạp điểm riêng `public/topup.html`** — tách toàn bộ luồng nạp khỏi `credits.html`.
  Wizard **5 bước** có thanh tiến trình **(1) Số tiền → (2) Số tiền tự chọn → (3) Đơn nạp →
  (4) Thanh toán → (5) Hoàn tất**: bước 1 chọn gói, bước 2 nhập số tiền tự chọn (tách riêng khỏi
  bước 1), bước 3 xác nhận đơn, bước 4 quét QR thanh toán, bước 5 hiển thị kết quả **tại chỗ**
  (số tiền · điểm · trạng thái · số dư mới) kèm nút **Nạp đơn khác** (reset về bước 1) và
  **Về trang điểm**. Điều hướng bằng **mũi tên Quay lại/Tiếp tục** ở mỗi bước hoặc **bấm mốc**
  trên thanh tiến trình (mốc 1–3 quay lại tự do; mốc 4 chỉ bấm được khi đơn đã `PAID`). Bước
  hiện tại ghi vào `?step=` (`history.replaceState`) nên F5/back/forward hoạt động; đơn đang dở
  lưu `sessionStorage['ct_topup_order']` để khôi phục khi tải lại. Deep-link `?order=<code>` vào
  thẳng bước thanh toán (đơn `PAID` → bước 5).
- **Nút “Nạp điểm” trên `credits.html`** (`.topup-cta` + `#topupCta` → `/topup.html`).
  `payment-result.html` có thêm nút **Nạp đơn khác** → `topup.html` (nút **Về trang điểm** giữ nguyên).

- **`credits.html` chia thành 3 tab**: **Nạp điểm** (mặc định) · **Đơn nạp gần đây** · **Lịch sử giao dịch**
  (`.tabs` / `.tab-btn` / `.tab-pane`, hàm `switchCreditTab(name)` — cùng pattern với tab Cấu hình ở
  `admin.html`). Tab đang mở ghi vào URL `?tab=orders|tx` (`history.replaceState`, giữ nguyên `?order=`
  của payOS), deep-link `?tab=` mở thẳng tab đó. Dữ liệu **lazy-load**: chỉ gọi API khi tab được mở lần
  đầu. Số đơn hiện thành badge `(n)` ngay trên nhãn tab thay cho việc ẩn/hiện cả card.
- **Luồng nạp điểm thành wizard 4 bước** trong tab Nạp điểm, có thanh tiến trình
  **(1) Số tiền → (2) Đơn nạp → (3) Thanh toán → (4) Hoàn tất**:
  bước 1 chọn gói / nhập số tiền (đơn được tạo ở đây qua `POST /api/credits/topup/create`),
  bước 2 xác nhận đơn (mã · gói · số tiền · điểm · hạn) với nút **Quay lại** (huỷ đơn tạm
  `POST /api/credits/topup/<code>/cancel` rồi về bước 1) và **Tiếp tục thanh toán**, bước 3 là thẻ
  thanh toán + khung nhúng payOS như trước, bước 4 sáng mốc "Hoàn tất" rồi tự chuyển sang
  `payment-result.html`. Deep-link `?order=<code>` / nút **Xem** của đơn `PENDING` vào **thẳng bước 3**
  (không qua bước 1–2), giữ nguyên hành vi cũ.
- **Giao diện thanh toán nhúng (embedded checkout) của payOS trên `credits.html`**: bấm một gói nạp
  (hoặc "Nạp số tiền này") là khung thanh toán payOS mở **ngay trong trang**, không phải nhảy sang
  tab mới. Nạp thư viện chính chủ `payos-checkout` v1 qua CDN
  `https://cdn.payos.vn/payos-checkout/v1/stable/payos-initialize.js` (global `window.PayOSCheckout`);
  cấu hình `usePayOS({ RETURN_URL, ELEMENT_ID: 'config_root', CHECKOUT_URL, onSuccess, onCancel, onExit })`
  rồi `open(true)` (nhúng, không phải popup). Nút **Thanh toán ngay** mở lại khung bất cứ lúc nào;
  **Đóng khung thanh toán** gọi `exit()` và trả thẻ đơn về đúng giao diện QR như trước.
- **Trang kết quả thanh toán riêng `public/payment-result.html`** (`?order=<code>&status=...`):
  card lớn "Thanh toán thành công / Đang chờ thanh toán / Đơn đã huỷ / Đơn hết hạn / Thanh toán thất bại",
  kèm mã đơn, số tiền, điểm nạp, thời gian trả tiền, số dư mới và nút **Về trang điểm**. Trang tự kiểm tra
  lại mỗi 4 giây khi đơn còn `PENDING` (tối đa 90 giây, sau đó user bấm **Kiểm tra lại**). Đây là
  `returnUrl`/`cancelUrl` mới mà `POST /api/credits/topup/create` gửi cho payOS.

### Changed
- **`credits.html` gọn lại chỉ còn số dư + “Đơn nạp gần đây” + “Lịch sử giao dịch”** (2 tab).
  Toàn bộ thanh wizard, pane bước, khung nhúng payOS (`#config_root`, CDN `payos-checkout`) và
  `<dialog id="payDialog">` đã được **gỡ khỏi `credits.html`** — chuyển sang `topup.html`.
  Nút **Xem** của đơn `PENDING` chuyển hướng `topup.html?order=<code>`.
- **Bỏ hẳn khung nhúng payOS và dialog thanh toán** (không còn `usePayOS`/`openEmbeddedCheckout`/
  `payEmbeddedFallback`): payOS **không cho ẩn tên chủ tài khoản nhận tiền**
  (`CreatePaymentLinkRequest` không có tham số nào), nên bước 4 render QR VietQR + số TK + nội dung
  CK trực tiếp trên trang (layout 2 cột, mobile 1 cột) — **không lộ tên chủ TK**, không còn khoảng
  trắng dưới QR. Nút **Mở trang thanh toán payOS** vẫn giữ làm đường dự phòng.
- **Test mode trả `checkoutUrl`/`qrCode` = `/topup.html?order=<code>&mock=1`** (`payos.js`) thay vì
  `credits.html?order=...`.

- **`credits.html`: ẩn tên chủ tài khoản nhận tiền khỏi quy trình thanh toán.** Bỏ dòng
  *"Chủ tài khoản"* (`#payAccName`) khỏi thẻ thanh toán ở bước 3 và bỏ `account_name` khỏi response
  `POST /api/credits/topup/create` (`server.js`) — không còn đường nào để client đọc tên chủ TK nhận.
  **Số tài khoản (`#payAccNo`) vẫn hiển thị** kèm nút sao chép, để khách còn chuyển khoản tay.
  ⚠️ **Giới hạn của payOS (không phải lỗi tích hợp)**: `CreatePaymentLinkRequest` của SDK
  `@payos/node` v2.0.5 **không có** tham số nào ẩn tên chủ tài khoản nhận tiền — `accountName` do payOS
  trả về và payOS tự render trong `<iframe>` (cross-origin, merchant không can thiệp nội dung được).
  Vì vậy **không còn tự bơm khung nhúng payOS nữa** (xem mục dưới); chỉ khi khách tự bấm
  **Thanh toán ngay** hoặc **Mở trang thanh toán** mới thấy giao diện payOS kèm tên chủ TK.
- **`credits.html`: thay khung nhúng payOS bằng dialog thanh toán NỘI BỘ (`<dialog id="payDialog">`)**.
  Vào bước 3 (và mỗi lần bấm **Mở QR thanh toán**) là `openPayDialog(d)` gọi `showModal()` — dialog chỉ
  chứa thứ trang này render được: ảnh VietQR (`#payDialogQr`), số tiền / điểm / **số tài khoản**
  (`#payDialogAccNo`) / nội dung CK (`#payDialogDesc`) kèm nút sao chép, countdown hạn thanh toán
  (`#payDialogCountdown`, dùng chung nhịp với `#payCountdown`) và nút **Mở trang thanh toán payOS**
  (fallback). Dialog **không có** tên chủ tài khoản. `closePayDialog()` gọi `close()` khi bấm **Đóng**,
  nhấn `ESC`, hoặc khi đơn rời `PENDING`; `closePayCard()` / `cancelOrder()` cũng dọn dialog.
  Đơn không có `qr_code` (test mode / link lỗi) → ẩn `#payDialogQrBox` và hiện cảnh báo trong
  `#payDialogMsg` trỏ khách sang nút mở trang payOS. Khung nhúng payOS (`#payEmbedded`,
  `isPayosCheckoutUrl()`, `openEmbeddedCheckout()`, `exitEmbeddedPay()`) **vẫn giữ nguyên** làm fallback
  thủ công qua nút **Thanh toán ngay** — không tự mở nữa, để tránh lộ tên chủ TK ngoài ý muốn.
- **Tạo đơn tách khỏi thanh toán trên `credits.html`**: `createOrder()` / `createCustomOrder()` không mở
  thẻ thanh toán nữa mà chỉ `fillConfirmStep(d)` rồi `wzGotoStep(2)` — khách xem lại đơn trước khi trả tiền.
  `showPayCard()` gọi `renderWizard(3)` (đích danh pane chứa `#payCard`) nên `resumeOrder()` vẫn vào thẳng
  bước 3; `closePayCard()` quay về bước 1 và gỡ `?order=`; `startPolling()` khi `PAID` gọi `renderWizard(4)`
  rồi `redirectToPaymentResult()` (bỏ qua khi test mode hoặc `?mock=1`).
- **`showPayCard()` mở dialog nội bộ (`openPayDialog()`)** thay vì tự mở khung nhúng payOS; thẻ đơn +
  khối QR vẫn nằm trong DOM và vẫn dùng được. `updatePayActions()` tự đóng **cả** khung nhúng **lẫn**
  dialog khi đơn rời trạng thái `PENDING`; `closePayCard()` dọn cả hai.
- **`returnUrl`/`cancelUrl` của payOS đổi từ `credits.html?order=` sang `payment-result.html?order=`**
  (`server.js`, route `POST /api/credits/topup/create`) để khách thấy trang kết quả rõ ràng. Trang
  `credits.html?order=<code>` vẫn hoạt động như cũ (mở lại thẻ đơn) — nút "Xem chi tiết đơn" ở trang
  kết quả trỏ về đó.

### Fixed
- **`credits.html` wizard: nút "Tiếp tục thanh toán" ở bước 2 không sang bước 3.** `createOrder()` và
  `createCustomOrder()` gọi `fillConfirmStep(d)` + `wzGotoStep(2)` nhưng **không gán `activeOrder = d`**,
  nên `confirmOrderNext()` đâm vào `if (!activeOrder) return;` và thoát im lặng — nút như chết. Hệ quả
  phụ: **Quay lại** cũng không huỷ được đơn tạm (`confirmOrderBack()` cũng cần `activeOrder`). Nay cả hai
  hàm tạo đơn gán `activeOrder = d` ngay trước `fillConfirmStep(d)`, và `confirmOrderNext()` khi thiếu đơn
  thì ghi `console.warn` + báo lỗi cụ thể ở `#wzMsg` thay vì `return` trần.
  Thêm test runtime `_creditwizard.test.js` (eval JS inline của trang trong DOM stub, không thêm dependency)
  chạy đúng chuỗi `createOrder → confirmOrderNext → #wzStep3 hiện` — đã xác minh ngược (bỏ `activeOrder = d`
  thì test đỏ 6 assert).
- **Test mode (`payos_test_mode=1`) không nhúng được vì `checkoutUrl` là URL nội bộ** (`/credits.html`):
  nhúng chính `credits.html` vào iframe của nó sẽ đệ quy vô hạn. Nay `isPayosCheckoutUrl()` chỉ cho nhúng
  link thật `*.payos.vn`; mọi trường hợp khác (test mode, thiếu CDN, thư viện lỗi) rơi xuống nhánh dự phòng
  — QR + link mở tab mới như trước, kèm cảnh báo trong khối đó. Thêm `payEmbedBusy` chặn double-init.
- **Điểm vẫn chỉ được cộng bởi webhook** `POST /api/payos/webhook` (đã verify chữ ký). `onSuccess` của
  thư viện chỉ để đóng khung và chuyển sang trang kết quả; trang kết quả chỉ **đọc** trạng thái đơn nên
  không có đường nào để client tự cộng điểm.

### Changed
- **"Cấu hình hệ thống" chia thành 5 tab theo nhóm chức năng**: trước đây toàn bộ ~30 field
  nằm trong một card cao, phải cuộn hết trang mới thấy nút Lưu và khó tìm đúng nhóm cần sửa.
  Nay tách thành **Chung** (tra online + lịch sử) · **Điểm** (credit) · **payOS** ·
  **Quy đổi & nạp** (tỉ lệ/giới hạn/public base URL) · **Email (SMTP)**, mỗi nhóm một
  `.tab-pane#settingstab-<name>` với thanh `.tabs#settingsTabs` ở đầu section. Dùng lại đúng
  pattern tab đã có ở "Quản lý dữ liệu Local" (`switchLocalTab`), thêm `switchSettingsTab()`
  (guard null + `console.warn`, gỡ `active` trong `#settingsTabs` và `#section-settings`
  nên **không** đụng tab Local hay sidebar). **Không đổi id field nào** → `loadSettings()`,
  `saveSettings()`, `collectPayosSettings()` chạy nguyên; nút **Lưu cấu hình** giữ 1 nút chung
  đặt ngoài mọi pane (vì save gửi toàn bộ form một lần, không tách theo tab). Thêm `flex-wrap`
  cho `.tabs` để 5 tab không tràn trên màn hình hẹp. Thêm 17 test chống hồi quy (đủ 5 pane,
  đúng 1 pane `active`, mỗi field nằm đúng pane, nút Lưu ngoài pane, `switchSettingsTab` cô lập).

### Fixed
- **Zoho `554 5.7.8 Access Restricted` bị chẩn đoán nhầm thành sai mật khẩu**: Zoho trả
  `Invalid login: 554 5.7.8 Access Restricted...`; chuỗi chứa cả `Invalid login` lẫn `5.7.8`
  nên rơi vào nhánh auth của `explainSmtpError` → admin được khuyên đi đổi mật khẩu, sai hướng
  hoàn toàn. Thêm nhánh riêng cho `554`/`Access Restricted` **đặt trước** nhánh auth, nêu đúng
  việc bị **từ chối quyền relay** và 5 điểm cần kiểm (hạn gói, SMTP bật trong admin console,
  đúng máy chủ/DataCenter, giới hạn IP, `smtp_user` là địa chỉ/alias hợp lệ). Có chèn gợi ý
  riêng khi host là Zoho. **Không** khớp trần `5.7.8` vì lỗi 535 của Gmail cũng mang `535-5.7.8`
  — khớp trần sẽ tái tạo chính lỗi chẩn đoán nhầm này cho Gmail (đã có test chống hồi quy).
- **`smtppro.zoho.com` không được nhận là Zoho**: regex cũ `(^|\.)zoho\.(...)$` không khớp
  hostname có tiền tố `smtppro.`/`smtp.` → `detectProvider` rơi vào `"SMTP tùy chỉnh"`, gợi ý
  cấu hình sai. Nay khớp `(smtp|smtppro).zoho.<tld>` và phân biệt **loại tài khoản** theo host:
  - `smtp.zoho.<tld>` = **Free Organization** / personal;
  - `smtppro.zoho.<tld>` = **Paid Organization** (domain riêng).
  Kèm tên DataCenter (`.com`=US, `.eu`=EU, `.in`=Ấn Độ, `.jp`=Nhật, `.com.au`=Úc, `.ca`=Canada).
  Dùng lẫn hai loại host là nguyên nhân phổ biến nhất của `554 5.7.8 Access Restricted`:
  gói Free gọi `smtppro.zoho.com` sẽ bị Zoho từ chối quyền gửi dù auth đúng. Khi host là
  `smtppro.*`, `getTransport` ghi cảnh báo console (một lần) nhắc rằng máy chủ này chỉ dành
  cho gói trả phí — không suy đoán gói của admin từ host nên không cảnh báo sai.
- **Xác thực lại kết quả (test)**: thêm 15 test cho nhánh `554`/Zoho DataCenter/free-vs-paid
  (gồm test khẳng định lỗi 535 vẫn vào nhánh auth, và lỗi `554` **không** được khuyên đổi mật
  khẩu). Toàn bộ suite: **1051 pass / 0 fail**, mọi file exit=0.

## [2.3.1] - 2026-10-10

### Fixed
- **Gửi email thử trong admin lỗi `tls_validate_record_header:wrong version number`**:
  cấu hình SMTP là cặp `(port, secure)` mâu thuẫn — `smtp_port=587` (STARTTLS: kết nối
  plaintext rồi nâng cấp TLS) nhưng `smtp_secure=1` (bắt tay TLS ngay từ byte đầu). Máy chủ
  cổng 587 trả banner plaintext `220 smtp.gmail.com ESMTP...`; OpenSSL đọc byte đầu
  `0x32` (`'2'`) như version byte của TLS record → báo "wrong version number".
  `mailer.normalizeTls(port, secure)` giờ suy `secure` từ port (465 ⇒ bật, còn lại ⇒ tắt)
  và ghi cảnh báo ra console; `getTransport` dùng giá trị đã chuẩn hoá + đặt
  `tls.servername` (tránh `ALTNAME_MISMATCH` với relay/AWS SES).
- **Thông báo lỗi SMTP khó hiểu**: `mailer.explainSmtpError()` dịch các lỗi thường gặp
  (sai kiểu TLS, self-signed cert, 535 auth, ENOTFOUND, ECONNREFUSED) thành hướng dẫn
  sửa cụ thể (vi) rồi mới nối thông điệp gốc — thay vì để admin đọc stack thô của OpenSSL.
- **UI Cấu hình admin**: ô Cổng và ô "TLS ngay" giờ có `syncSmtpTlsHint()` — cảnh báo
  ngay khi (port, secure) mâu thuẫn (`⚠ Cổng 587 dùng STARTTLS, KHÔNG bật "TLS ngay"`),
  xác nhận khi đúng (`✓ Cổng 587 + STARTTLS`). Chạy cả khi nạp config lẫn khi gõ.
- **SMTP hoá generic, không còn thiên Gmail** (dùng được cho Zoho, Brevo, Resend, Mailgun,
  SendGrid, SES, Outlook…): thêm `mailer.detectProvider(host)` nhận diện nhà cung cấp từ
  hostname để sinh gợi ý đúng (user/mật khẩu/cổng khuyến nghị) mà **không** đổi luồng gửi —
  host lạ vẫn chạy như "SMTP tùy chỉnh". Thông điệp lỗi auth (`explainSmtpError`) không còn
  hard-code "Với Gmail phải dùng App Password" mà liệt kê nhiều dịch vụ, và chèn gợi ý riêng
  của provider khi biết `smtp_host` (vd Zoho → `accounts.zoho.com → Security`). Thêm nhánh
  lỗi bị từ chối địa chỉ gửi (550/553) → nhắc verify domain + SPF/DKIM.
- **Cảnh báo `smtp_from` bị ghi đè** (`mailer.warnFromOverride`): chỉ Gmail/Yahoo tự thay
  header From bằng tài khoản xác thực. Khi phát hiện `(provider ghi đè) && from ≠ user` →
  log 1 lần hướng dẫn (thêm alias "Send mail as" hoặc đổi sang relay SMTP riêng). Với Zoho/
  Brevo/Resend/Mailgun — vốn tôn trọng `smtp_from` khi domain đã verify — không cảnh báo.
- **Bỏ khoảng trắng trong `smtp_pass`**: App Password Gmail (`abcd efgh ijkl mnop`), SMTP Key
  Brevo, API Key… khi copy thường kèm space; trước đây chuỗi được truyền nguyên → auth fail dù
  nhìn đúng. `getConfig()` giờ `replace(/\s+/g, '')` cho `pass`.
- **UI SMTP đa nhà cung cấp**: placeholder `smtp_host`/`smtp_user` nêu nhiều ví dụ
  (gmail/zoho/brevo, `user@ten-mien`), thêm dòng hint động "Nhận diện: Zoho Mail — Tài khoản…
  Mật khẩu…" cập nhật theo `smtp_host` (`#setSmtpProviderHint`), và khối hướng dẫn liệt kê
  mật khẩu riêng của từng dịch vụ.
- **Đăng nhập popup thất bại + captcha trắng (cùng một nguyên nhân)**: `GET /api/captcha`
  trước đây dùng CHUNG bucket rate-limit với `/api/login`, `/api/register`… (30/5 phút/IP).
  Mỗi lần mở popup gọi captcha 1 lượt, nên chỉ vài chục lần mở là hết quota → server trả
  429 cho cả captcha (canvas trắng) lẫn đăng nhập. Tách bucket riêng cho captcha
  (`CAPTCHA_RATE_LIMIT` 120/5 phút/IP) qua `makeRateLimit(max, hits)`; login/register/verify/
  forgot/reset giữ nguyên 30/5 phút/IP.
- **Popup đăng nhập/đăng ký**: canvas captcha khi lỗi mạng/429 giờ tự thử lại tối đa 3 lần
  rồi vẽ thông báo "Không tải được mã — bấm để thử lại" thay vì để trắng câm lặng; chỉ lấy
  mã mới khi server trả `BAD_CAPTCHA` (không tốn quota vô ích); lỗi 429 hiện thông báo
  "quá nhiều lần thử" rõ ràng (vi/en) thay vì câu thô từ server.
- **Scrollbar popup đăng ký**: `#authPopupBox` chuyển sang `overflow:hidden` +
  `display:flex;flex-direction:column`, chỉ vùng `#apBody` cuộn — scrollbar không còn chồng
  lên viền bo 16px; thanh cuộn mảnh 8px, `max-height:calc(100dvh - 32px)` cho mobile.
- **`window.Auth` không tồn tại → đăng nhập luôn "thành công" nhưng token không lưu**:
  `public/auth.js` khai báo `const Auth = {...}` ở top-level; `const` KHÔNG tự tạo
  property trên `window`. Trong khi đó `auth-popup.js` `finishLogin()` chỉ lưu token khi
  `if (window.Auth)` → guard luôn false → `Auth.setToken()`/`setUser()` bị **bỏ qua**.
  Kết quả: `POST /api/login` trả 200 + token, popup chuyển hướng về trang chủ, nhưng
  `localStorage` vẫn rỗng → lần tải trang kế tiếp vào guest mode (`window.__guestMode`)
  → API cần đăng nhập ném "Cần đăng nhập để dùng tính năng này." Đây là **nguyên nhân
  chính**, không phải rate-limit hay captcha. Thêm `window.Auth = Auth;` cuối `auth.js`;
  `index.html` (`if (window.Auth && Auth.isLoggedIn())`) và `AuthPopup.open()` cũng đúng
  lại nhờ đó.
- **Đăng xuất lại dẫn tới `/login.html` thay vì trang chủ**: `logout()` rẽ nhánh theo
  `window.AuthPopup` — chỉ trang chủ/`login.html` nạp file này, nên đứng ở `credits.html`,
  `version.html`, `admin.html` hay các trang `tools/*` thì rơi vào nhánh cũ và bị đá sang
  `/login.html`. Giờ `logout()` **luôn** gọi `Auth.goLogin()` → về trang chủ (kèm nạp lại
  trang nếu đang ở đó); `Auth.goLogin()` không còn nhánh `/login.html`. Gỡ nốt các redirect
  cứng `/login.html` ở `version.html`, `credits.html`, `tools/ip-tracker.html`,
  `tools/ip-tracker.js`; nút "Đăng ký ngay" trong kết quả tra cứu trỏ `/index.html#register`.
- **Hết phiên giữa chừng làm nhảy trang**: `logout()` vừa xoá session vừa điều hướng, nhưng
  nó cũng được gọi từ nhánh 401 trong `checkSession()`/`Auth.fetch()` và `app.js` — nghĩa là
  bất kỳ API trả 401 giữa lúc đang dùng cũng đá người dùng về trang chủ. Tách
  `Auth.clearSession()` (chỉ xoá token/user, **không** điều hướng) cho các nhánh 401; chúng
  báo qua hook `window.__onSessionExpired` để trang chủ chuyển UI sang chế độ khách tại chỗ.
- **Navbar không đổi theo dark mode ở `credits.html`, `version.html`, `tools/ip-tracker.html`**:
  CSS navbar dùng chung (inject từ `auth.js`) tô màu qua `var(--header-bg)`,
  `var(--bg-surface)`, `var(--bg-surface2)`, `var(--bg-btn-primary)`, `var(--border-focus)`
  với **fallback hardcode màu sáng**. Ba trang trên không tự khai báo các biến này (chỉ có
  `--bg-page`/`--bg-card`/`--text-*` riêng), nên khi bật dark: thân trang tối mà navbar vẫn
  sáng. Đã bổ sung 5 biến cho cả `:root`/`[data-theme="light"]` và `[data-theme="dark"]` của
  từng trang, theo đúng palette sẵn có. Thêm test chặn hồi quy: mọi trang có `data-theme`
  phải khai báo đủ 5 biến (≥ 2 giá trị: light + dark).
- **Đăng nhập xong phải F5 mới thấy tài khoản**: `finishLogin()` (và `logout()`,
  `Auth.requireAuth()`) điều hướng bằng `window.location.href = '/index.html#welcome=1'`.
  Khi popup mở NGAY trên trang chủ, URL chỉ đổi phần hash nên trình duyệt **không nạp lại**
  `app.js` — `initAuth()` không chạy lại, navbar giữ nguyên trạng thái khách cho tới khi
  người dùng F5. Giờ khi đang ở `/index.html` (hoặc `/`), luồng này đổi hash rồi gọi
  `window.location.reload()`; ở trang khác vẫn điều hướng về trang chủ như cũ. Gom logic
  vào `Auth.goLogin()` để `logout()`/`requireAuth()`/`finishLogin()` dùng chung một đường.
- **Token hết hạn còn sót trong `localStorage` làm "đăng nhập xong vẫn như chưa"**:
  `Auth.isLoggedIn()` trước đây chỉ kiểm tra `!!token`, nên token cũ (quá 24h, hoặc ký
  bằng `JWT_SECRET` khác) khiến trang chủ render giao diện như đã đăng nhập, nhưng mọi
  API kèm token đó trả 401 → `Auth.logout()` → quay về popup đăng nhập; hard-refresh
  KHÔNG xoá `localStorage` nên lỗi tái diễn. Thêm `Auth.decodeToken()` +
  `Auth.isTokenExpired()` (đọc `exp` trong payload JWT, không verify chữ ký); giờ:
  `isLoggedIn()` = token còn hạn, `checkSession()` dọn token hết hạn thay vì gọi
  `/api/me`, và `enterGuestMode()` (public/app.js) xoá token hết hạn trước khi vào chế
  độ khách — chặn vòng lặp 401 → logout. Token không phải JWT vẫn được coi là "chưa rõ",
  server giữ vai trò chốt cuối (401).

### Changed
- **Số phiên bản xuống góc dưới-phải left bar** (`#guestPanelFoot`): hiện ở CẢ khách lẫn
  người dùng đã đăng nhập (trước đây bị bọc trong `.guest-only` nên ẩn khi đã đăng nhập),
  căn phải, và **bỏ liên kết** — `#cellPanelVer` giờ là nhãn tĩnh `<span>` (không `href`,
  không `can-link`, không toast cho non-admin). Số lượt thử `#cellPanelTrial` vẫn chỉ hiện
  với khách (`body.guest-mode`).

_Nội dung 2.3.0 đã phát hành — xem mục bên dưới._

## [2.3.0] - 2026-10-10

### Added
- **Đăng nhập / đăng ký bằng popup ngay trên trang chủ**: nút Đăng nhập / Đăng ký trên
  navbar và overlay mời đăng ký giờ mở popup (`public/auth-popup.js`, tự chứa + i18n
  vi/en) thay vì rời sang `/login.html`. Popup có 5 màn: Đăng nhập, Đăng ký, Kích hoạt,
  Quên mật khẩu, Đặt lại mật khẩu. Hỗ trợ phím Enter để gửi form, Esc để đóng, và mở
  theo hash (`#login`, `#register`, `#verify`, `#forgot`, `#reset&email=..&code=..`).
  `/login.html` vẫn giữ cho link cũ (có banner + nút mở popup) và chuyển sang popup khi
  bấm form đăng ký cũ. `logout()`/`requireAuth()` giờ điều hướng về trang chủ mở popup.
- **Captcha 6 ký tự khi đăng ký và quên mật khẩu**: `GET /api/captcha` phát chuỗi 6 ký tự
  (bỏ các ký tự dễ nhầm 0/O/1/I/L), client vẽ lên canvas kèm nhiễu. Lưu in-memory `Map`
  với TTL 5 phút, one-shot (xoá sau lần kiểm tra đầu), tối đa 5000 entry, so sánh bằng
  `crypto.timingSafeEqual`.
- **Trường Email + kích hoạt tài khoản**: `users` thêm `email`, `email_verified`,
  `terms_accepted_at`; unique index partial trên `email`. Bảng mới `email_verifications`
  (code 6 số + token 32 byte hex, TTL 15 phút, tối đa 5 lần nhập sai, one-shot) phục vụ
  cả kích hoạt lẫn đặt lại mật khẩu. User mới có `status='pending'` — đăng nhập khi chưa
  kích hoạt trả `403 EMAIL_NOT_VERIFIED` để UI mở màn nhập mã. User cũ được backfill
  `email_verified=1` nên KHÔNG bị chặn đăng nhập sau khi nâng cấp.
- **Kích hoạt bằng mã 6 số hoặc link trong email**: `POST /api/verify-email` (mã),
  `GET /api/verify-email?token=` (link, trả trang HTML rồi chuyển về trang chủ),
  `POST /api/resend-verification` (gửi lại mã; luôn trả 200 để không lộ tài khoản có tồn tại).
- **Quên / đặt lại mật khẩu**: `POST /api/forgot-password` (có captcha, luôn trả 200),
  `POST /api/reset-password` (email + mã 6 số), `GET /api/reset-password?token=` (form đổi
  mật khẩu) và `POST /api/reset-password/token`. Đặt lại mật khẩu thành công trả token JWT
  để đăng nhập luôn.
- **Đổi mật khẩu khi đã đăng nhập**: `PUT /api/auth/password` — route này đã có sẵn trong
  client nhưng chưa từng tồn tại ở server (luôn 404), nay đã bổ sung (xác minh mật khẩu hiện tại).
- **Trang điều khoản sử dụng** `public/terms.html`: gồm tài khoản, phạm vi dữ liệu, hành vi
  bị cấm, điểm & thanh toán, giới hạn trách nhiệm, thay đổi điều khoản, ghi chú quyền riêng
  tư (mật khẩu lưu dạng băm bcrypt). Checkbox đồng ý điều khoản bắt buộc khi đăng ký.
- **Gửi email giao dịch qua SMTP (nodemailer)**: module `mailer.js` đọc config từ bảng
  settings mỗi lần gọi; chưa cấu hình thì ghi mã + link ra console server và trả `dev_code`
  / `dev_link` trong response (chỉ khi SMTP tắt) để test local không cần tài khoản mail. Có
  `POST /api/admin/smtp/test` để admin gửi email thử. Settings mới: `smtp_enabled`,
  `smtp_host`, `smtp_port`, `smtp_secure`, `smtp_user`, `smtp_pass` (che `••••1234`),
  `smtp_from`, `smtp_from_name` — có UI trong Cấu hình admin. Bật SMTP mà thiếu host/from
  thì server trả 400.
- **Quản lý user (admin) mở rộng**: `GET /api/admin/users` và `/api/admin/credits/users` trả
  thêm `email`, `email_verified`, `terms_accepted_at`. Bảng Người dùng có cột Email + nhãn
  xác thực, nút **gửi lại mã**, **kích hoạt tay** (`POST /api/admin/users/:id/verify`) và
  **copy link kích hoạt** (`GET /api/admin/users/:id/verification-link`). Admin tạo user qua
  `POST /api/admin/users` (hoặc `PUT /api/users`) có thể đặt email, coi như đã xác thực.
- **Rate limit route auth**: 30 request / 5 phút / IP cho các route đăng nhập, đăng ký,
  captcha, verify, forgot/reset. Test tự động đặt `AUTH_TEST_NO_RATELIMIT=1` để tắt.
- **Email che khi trả ra công khai**: `maskEmail()` (ví dụ `ng***@gmail.com`) dùng cho mọi
  response auth công khai.
- Test mới `_authtest.js` (65 case end-to-end: captcha one-shot, validate đăng ký, trạng thái
  pending, kích hoạt bằng mã/link, đổi mật khẩu, quên/đặt lại mật khẩu, resend, trùng
  username/email, route admin SMTP + che secret).
- **Nạp điểm qua payOS (chuyển khoản ngân hàng)**: user chọn gói nạp hoặc nhập số tiền
  tự chọn ở trang Điểm, quét QR/mở trang thanh toán payOS, điểm tự cộng khi webhook
  xác nhận. Tỉ lệ quy đổi mặc định **1000đ = 1 điểm** (đổi được trong Cấu hình).
- **Trang admin "Nạp điểm (payOS)"**: quản lý gói nạp (thêm/sửa/tắt/xoá), danh sách đơn
  nạp có filter (trạng thái, user/mã đơn, khoảng ngày), đồng bộ/huỷ đơn, biểu đồ doanh
  thu 30 ngày, top 10 nạp và top 10 dùng, và bộ số liệu tổng hợp (doanh thu, điểm đã cấp,
  điểm đã dùng, tỉ lệ chuyển đổi, điểm còn lại toàn hệ thống).
- Khối **cấu hình payOS** trong Cấu hình: bật/tắt cổng, client-id / api-key / checksum-key,
  base URL (cho sandbox), webhook URL, `public_base_url`, tỉ lệ quy đổi, min/max nạp, và
  chế độ test. Có nút kiểm tra kết nối + đăng ký webhook với payOS.
- **API**: `DELETE /api/call-logs/batch/:batchId` xoá toàn bộ bản ghi của 1 lần upload
  (chỉ của user hiện tại); `GET /api/call-logs` trả thêm `batch_id`.
- **Phiên rút list (upload Excel)**: mỗi lần upload Excel ở tab *Xem rút list* giờ được
  lưu thành 1 phiên trong bảng `call_log_batches` (batch_id, user_id, file_name, network,
  row_count, created_at) — **chỉ metadata, không lưu nội dung file**. Tab *Lịch sử tra cứu*
  có khối **Phiên rút list** liệt kê các phiên kèm nút **Mở lại** (nạp lại đúng bản ghi cũ
  từ `call_logs`) và **Xoá phiên** (xoá cả bản ghi lẫn metadata). Bảng cũ
  (`b1791598058002` v.v.) được backfill tự động, idempotent (`INSERT OR IGNORE … GROUP BY`).
- **API**: `GET /api/call-log-sessions` (danh sách, phân trang), `GET /api/call-log-sessions/:batchId`
  (toàn bộ bản ghi của phiên), `DELETE /api/call-log-sessions/:batchId` (xoá cả phiên).
  Route cũ `DELETE /api/call-logs/batch/:batchId` giữ làm alias. `DELETE /api/call-logs`
  (xoá tất cả) nay xoá luôn metadata phiên.
- **API**: `GET /api/credits/packages`, `POST /api/credits/topup/create`,
  `GET /api/credits/topup/:orderCode`, `GET /api/credits/topup`, webhook công khai
  `POST /api/payos/webhook`, và các route admin `/api/admin/payments*`,
  `/api/admin/topup/packages*`, `/api/admin/payos/*`.
- **Chế độ test** (`payos_test_mode`): bỏ qua payOS thật, trả link nội bộ + QR giả và cho
  admin dùng nút *Giả lập đã trả tiền* để test trọn luồng nạp offline.
- **Trang nạp điểm tiện hơn**: nút **sao chép** số tiền / số tài khoản / nội dung chuyển
  khoản (có fallback cho `http://localhost` không có Clipboard API); **đếm ngược hạn** thanh
  toán (lấy `expiredAt` từ payOS, fallback `created_at + 15 phút`), tự đổi trạng thái
  *Hết hạn* và ngừng chờ khi quá hạn; **loading** trên gói nạp/ô nhập khi đang tạo đơn;
  **quy đổi live** + 4 nút số tiền nhanh; **tab "Đơn nạp gần đây"** liệt kê 20 đơn gần nhất
  kèm badge trạng thái và nút Xem/Huỷ.
- **User tự huỷ đơn nạp chưa trả tiền**: `POST /api/credits/topup/:orderCode/cancel`
  (huỷ trên payOS best-effort, rate-limit 10 lần/phút/user; đơn đã PAID trả 400).
- **Giả lập thanh toán cho user thường ở test mode**: `POST /api/credits/topup/:orderCode/mock-paid`
  — chỉ hoạt động khi `payos_test_mode=1` VÀ đơn thuộc chính người gọi.
- Cột `payment_orders.expires_at` (migration idempotent) + tự đánh dấu `EXPIRED` đơn PENDING
  quá hạn mỗi lần user xem đơn/danh sách (không cần webhook).
- `GET /api/credits/packages` trả thêm `test_mode`; `GET /api/credits/topup*` trả thêm
  `expires_at`, `description`, `package_label`.
- Test E2E `_topupflow.js` (36 test): vòng đời đơn trên DB tạm — tạo/xem/mock-paid/huỷ/EXPIRED
  + phân quyền + chặn mock khi tắt test mode.
- Test tích hợp `_payos.test.js` (97 test): quy đổi điểm, ký/verify webhook, chống cộng
  trùng khi webhook retry, phân quyền, thống kê, bảo mật secret trong settings.
- Endpoint `DELETE /api/call-logs` — xoá **toàn bộ** dữ liệu rút list của user hiện tại
  (chỉ theo `user_id`, không đụng user khác).

### Security
- **Webhook payOS xác thực chữ ký HMAC** bằng checksum-key trước khi cộng điểm; luôn trả
  HTTP 200 để payOS không retry vô hạn nhưng không xử lý payload sai chữ ký.
- **Cộng điểm idempotent 2 lớp**: trạng thái đơn `PAID` + unique index
  `(user_id, type, ref)` trên `credit_transactions` → payOS retry không cộng 2 lần.
- `api-key` và `checksum-key` của payOS **không bao giờ trả nguyên văn** qua `GET /api/settings`
  (che dạng `••••1234`); gửi lại bản che không ghi đè giá trị thật.
- Server luôn tính lại số điểm từ gói/tỉ lệ trong DB, **không tin** `credits`/số tiền do client gửi.

### Changed
- **Tab Xem rút list gọn hơn**: bộ lọc phụ (loại hành động + khoảng ngày) nay **thu gọn**
  sau nút *Bộ lọc* (có badge đếm điều kiện đang bật), `<select>` lọc loại thay bằng **5 chip
  icon** một hàng (Tất cả / Gọi Đến / Gọi Đi / SMS Đến / SMS Đi); ô tìm kiếm luôn hiện.
- **Dòng phiên đang xem** (`#clCurrentSession`) hiện tên file + số bản ghi + nút *Xoá phiên*
  ngay trên danh sách. Bỏ header nhóm batch lẫn trong từng trang bản ghi — trước đây batch
  lớn bị `LIMIT 500` nên header chỉ nằm ở trang 1, nút xoá "chìm" không thấy được.
- **Xoá theo từng lần upload Excel (batch)**: mỗi lần tải call-log giờ được gắn `batch_id`
  (cột mới `call_logs.batch_id`); tab **Xem Rút List** nhóm bản ghi theo lần tải và có nút
  **Xoá lần tải** để xoá trọn 1 nhóm thay vì chỉ xoá được toàn bộ. Bản ghi cũ (trước khi có
  cột) coi như không thuộc nhóm nào và vẫn xoá bằng nút **Xoá phiên**.
- **Nút "Xoá phiên"** giờ xoá cả phiên local (`sessionStorage`) **lẫn** dữ liệu rút list
  trên server; có hộp thoại xác nhận trước khi xoá (không thể hoàn tác).
- **Popup dữ liệu cell trên bản đồ**: tiêu đề nay là `MCC-MNC-LAC/TAC-CELLID` trên một
  dòng; CELLID hiển thị dạng *short* (eNB/short ID) hay *long* (ECI) tùy dữ liệu mạng
  (`classifyCellId`). Dòng chi tiết eNB/Sector/ECI vẫn giữ bên dưới.
- **Cú pháp tra cứu 1 dòng trong panel** chấp nhận `-` hoặc `,` làm phân cách
  (chuẩn mới `MCC-MNC-LAC-CELLID`, vẫn tương thích dấu phẩy cũ). Placeholder cập nhật
  thành `MCC-MNC-LAC-CellID`.

## [2.2.0] - 2026-10-09

### Added
- **Cell ID Database tách 3 menu con** trên sidebar: **Quản lý nguồn dữ liệu Online**,
  **Quản lý dữ liệu Local**, **Lịch sử chỉnh sửa**. Nhóm cha có caret gập/mở, mục
  đang xem được tô sáng.
- **Quản lý dữ liệu Local: mỗi bảng 1 tab riêng** — trước đây 3 khối (CSDL Cells,
  Nhập hàng loạt CSV, Chuyển đổi CLF) xếp dọc trong một trang dài; panel CSDL Cells
  chiếm gần hết màn hình nên phải cuộn mới tới 2 khối kia. Nay có thanh tab
  `#localTabs` (CSDL Cells / Nhập hàng loạt / Chuyển đổi CLF), điều hướng bằng
  `switchLocalTab()` — chỉ 1 `.tab-pane` hiện, không đụng sidebar. Số row
  (`#cdbTotal`) chuyển lên nhãn tab "CSDL Cells".
- Công cụ **Upload CSV** và **Chuyển đổi CLF** nay nằm trong **Quản lý dữ liệu Local**
  (cùng bảng CSDL Cells và vùng xoá toàn bộ).
- Danh sách **Lịch sử tra cứu** tô màu theo công nghệ mạng: badge + viền trái của
  mỗi dòng lấy màu từ `RADIO_STYLE` (2G/3G/4G/5G/NB-IoT/CDMA...), đồng bộ với màu
  marker trên bản đồ. Dòng không xác định được RAT giữ màu theo chế độ tra.
- Danh sách cell con trong một lần tra hàng loạt cũng hiện badge màu theo RAT.
- Chế độ khách gọn hơn: chỉ còn tab **Tra cứu** cùng các ô nhập mã cell; các tab
  cần đăng nhập (Xem rút list, Lịch sử tra cứu) bị ẩn khỏi sidebar. Kèm chú thích
  màu theo công nghệ mạng ngay trong panel khách.
- **Phiên "Xem rút list" giữ qua F5**: kết quả tra cứu lưu tạm trong `sessionStorage`
  (`ct_session_logs`) nên tải lại trang trong cùng tab không mất dữ liệu. Đóng tab là
  phiên tự xoá; muốn xem lại phải vào **Lịch sử tra cứu**. Kèm banner "Khôi phục phiên
  trước" + nút **Xoá phiên** để chủ động reset.
- Bấm **một dòng lịch sử tra hàng loạt** nay nạp toàn bộ cell của nhóm đó sang tab
  **Xem rút list** với đầy đủ công cụ (lọc, lên bản đồ, phát lại hành trình) — không
  chỉ vẽ marker như trước. Bản ghi từ lịch sử được đánh dấu riêng nên không có nút xoá
  và không bị tra lại online (không tiêu điểm).
- Bấm **một dòng kết quả tra cứu** (danh sách cell bên trái) hoặc **một cell con trong
  lịch sử** nay zoom bản đồ tới cell đó kèm vòng nhấp nháy màu theo RAT.
- Bản đồ có **checkbox bật/tắt lớp "Cell / Log đã tra"** — trước đây chỉ có nút chọn
  nền bản đồ (radio) nên cảm giác "bấm không có tác dụng".
- Tab **Xem rút list** thêm thanh tổng kết nhanh (số bản ghi · số cell · số cell có toạ
  độ), màn hình rỗng có nút **Tải Excel** / **Mở Lịch sử**, và phím tắt khi phát lại
  hành trình: `←`/`→` bước một điểm, `Space` dừng/tiếp tục.

### Changed
- Admin panel mục **Phiên bản** nay chỉ hiển thị **phiên bản đang chạy** (chip "Đang chạy"),
  kèm link sang trang Lịch sử phiên bản đầy đủ — thay vì đổ toàn bộ CHANGELOG vào trang quản trị.
- **Lịch sử tra cứu gộp kết quả trùng**: cùng một cell (mcc-mnc-lac-cellid-sector)
  tra nhiều lần chỉ hiện **1 dòng** — dòng mới nhất. Số cell/found của mỗi lần tra
  hàng loạt cũng đếm theo cell duy nhất, khớp với danh sách chi tiết.
- Khách chuyển tab bằng lệnh khác vẫn bị đưa về tab Tra cứu (phòng hờ tab bị gọi
  từ script hoặc phím tắt).

### Fixed
- **Shape vẽ trên bản đồ (annotation) không lưu đúng**: (1) `plotCallLogs()` gọi
  `drawnItems.clearLayers()` nên mọi thao tác trên tab Xem Rút List (lọc, tìm kiếm,
  đổi trang) đều xoá sạch shape đang vẽ — nay shape người dùng và shape cell-log nằm ở
  2 `FeatureGroup` riêng (`drawnItems` / `logShapeGroup`); (2) handler `draw:edited` là
  stub rỗng và `draw:deleted` **không tồn tại**, nên sửa/xoá shape xong F5 là quay lại
  bản cũ — nay cả hai handler đều đồng bộ server (sửa = xoá bản ghi cũ + ghi bản mới,
  xoá = `DELETE /api/annotations/:id`), layer được gắn `_annotationId` khi tạo và khi tải.
- **Click dòng lịch sử tra cứu bị cắt cụt vòng bán kính cell**: `highlightCellOnMap()`
  hardcode `setView(..., 17)` nên cell có range hàng km tràn ra ngoài màn hình. Nay
  `zoomForRadius()` dùng `map.getBoundsZoom()` để chọn mức zoom vừa khít vòng tròn
  (clamp 11–18) theo đúng bán kính cell.
- Chọn/xoá nhiều dòng lịch sử nay dùng đúng khoá dòng (chuỗi id), sửa lỗi checkbox
  không khớp khi id là số.
- Form thêm/sửa nguồn Online bổ sung lựa chọn `opencellid_web` (OpenCellID scrape
  web, không cần API key) — trước đây type này có ở server nhưng thiếu trong dropdown.
- **Menu admin "Cell ID Database" hiển thị đè lên các mục khác**: panel
  `#sub-local` bị gắn cứng class `active` trong HTML, mà CSS `.section { display:none }`
  / `.section.active { display:block }` có độ ưu tiên bằng `.sidebar-sub { display:none }`
  nên panel này luôn hiện. Sang Dashboard / User Management / Cấu hình / Phiên bản đều
  bị nội dung Cell ID Database đè lên. Nay panel chỉ được bật bằng `switchCellSub()`.
- Mục con "Quản lý dữ liệu Local" không còn tô sáng khi đang xem mục khác — `switchSection()`
  gỡ class `active` khỏi mọi `.sidebar-sub-item` khi rời nhóm Cell ID Database.
- **Nhấn "Cell ID Database" ra trang trắng**: `switchSection()` deref thẳng
  `document.getElementById('section-' + name).classList` — nhưng nhóm `cells` không còn
  `#section-cells` (đã thay bằng `#sub-sources` / `#sub-local` / `#sub-audit` khi gộp menu).
  Truy cập `null.classList` → `TypeError` giữa handler `onclick` → các dòng sau không chạy →
  không `.section` nào được bật → nội dung trắng. Nay `switchSection()` guard `null` cho cả
  `#section-<name>` lẫn `.sidebar-item[data-section]`. Lỗi này bị panel `#sub-local`
  hardcode `active` che trước đây; bỏ hardcode mới lộ ra.
- Panel `Cell ID Database` giờ mở đúng ở mục con `local` khi nhấn mục cha (đi qua `switchCellSub('local')`).

## [2.1.0] - 2026-10-09

### Added
- **Chống lách lượt dùng thử (Phương án A)**: định danh khách bằng 3 lớp — cookie `ct_guest` do server phát (HttpOnly, ký HMAC-SHA256, khách không đọc/sửa/xoá được), fingerprint nhiều tín hiệu, và **khoá kép** `guest_net_key = sha256(ipPrefix + họ trình duyệt)`.
- Cửa sổ dùng thử **30 ngày** (`expires_at`) — hết hạn thì khách được thử lại; tránh IP dùng chung (NAT công ty, quán net, CGNAT 4G) bị khoá vĩnh viễn.
- Chân panel trái ở tab Tra cứu: hiển thị phiên bản + (với khách) số lượt thử còn lại.
- Admin panel: mục **Phiên bản** ở sidebar xem được lịch sử thay đổi.

### Changed
- **Breaking**: `/api/version/changelog` nay chỉ dành cho quản trị viên (`requireAuth` + `requireAdmin`). `/api/version` vẫn công khai.
- Trang `/version.html` chỉ mở cho quản trị viên; người khác bị chuyển về `/login.html`.
- Bỏ banner "Bạn đang dùng bản khách" ở đầu trang và badge version trên navbar.
- Panel trái không còn bị đẩy xuống thấp khi dùng ở chế độ khách.
- `guest_trials` thêm cột `guest_net_key`, `client_id`, `ua_family`, `expires_at` + index `idx_guest_trials_net`, `idx_guest_trials_client`.

### Fixed
- Khách mở tab ẩn danh hoặc đổi User-Agent không còn lách được lượt dùng thử (trùng khoá mạng).
- Nâng cấp trình duyệt (đổi số version trong User-Agent) không còn vô tình tạo khoá mới.

### Notes
- Đánh đổi có chủ đích: nhiều người cùng một IP + cùng họ trình duyệt sẽ chia nhau số lượt thử. Nới bằng `settings.guest_trial_max` (mặc định 1, trần 50; đặt 0 = tắt hẳn).
- Nên khai báo biến môi trường `GUEST_SECRET` khi chạy production, nếu không cookie khách sẽ bị vô hiệu sau mỗi lần khởi động lại.

## [2.0.0] - 2026-10-09

### Added
- Quản lý phiên bản: badge version trên navbar + trang "Lịch sử phiên bản" (`/version.html`) + API công khai `/api/version`, `/api/version/changelog`.
- Trang chủ (`/`) mở công khai cho khách chưa đăng nhập; khách xem được bản đồ và giao diện.
- Khách được tra cứu thử **1 lượt duy nhất** với dữ liệu nội bộ; hết lượt hệ thống mời đăng ký tài khoản để tra cứu tiếp (kèm điểm thưởng đăng ký và nguồn dữ liệu OpenCellID).
- Trang đăng nhập: mở đúng tab Đăng ký khi vào `/login.html#register`, thêm link về trang chủ.

### Changed
- Toàn bộ API dữ liệu (`/api/cells/stats`, `/api/cells/search`, `/api/cells/all`, `/api/cells/convert`, `/api/phones`, `/api/records/:phone`) nay yêu cầu đăng nhập.
- Navbar: khách không còn thấy menu người dùng, badge điểm, link Admin; thay bằng nút Đăng nhập / Đăng ký.
- Admin: cấu hình điểm dùng toggle switch thay cho checkbox.
- Sửa lỗi admin lưu cấu hình "Bật tính điểm khi tra cứu" không có hiệu lực (thiếu `Content-Type: application/json`).
- `credits.html`: navbar hiển thị đúng (selector `.navbar`).

## [1.0.0] - 2026-09-01

### Added
- Tra cứu Cell ID từ CSDL nội bộ + tra cứu bổ sung từ OpenCellID.org.
- Quản lý call log / SMS và hiển thị lộ trình trên bản đồ.
- Hệ thống điểm tra cứu (nạp điểm, lịch sử giao dịch, đối soát).
- Trang quản trị: người dùng, cell, nguồn dữ liệu, tác vụ đồng bộ theo cron.
- Bộ công cụ: tra cứu chuyển mạng (port check), IP tracker, đổi eNB ↔ ECI.
