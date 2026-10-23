# Changelog

Mọi thay đổi đáng chú ý của Cell.id.vn được ghi ở đây.
Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/),
phiên bản theo [Semantic Versioning](https://semver.org/lang/vi/).

## [Unreleased]

### Removed — dọn repo trước khi lên production
- **Toàn bộ test/harness thủ công ở gốc repo** (31 file `_*.js`) và `tests/` (5 file).
  Đã chạy baseline trước khi xoá: `_authtest.js` 99/99, `_payos.test.js` 103/103,
  `_credittest.js` 304/304, `_uxtest.js` 800/800, `_version.test.js` 76/77 (1 fail có sẵn:
  `ALWAYS_REVALIDATE` đã mở rộng cho `admin.js`/`admin.html` nhưng test chưa cập nhật).
  Toàn bộ vẫn lấy lại được từ tag `backup/pre-cleanup-20261024`.
- **Dữ liệu mẫu `sample/`** (Mobifone/Viettel/Vinaphone) — chỉ dùng bởi test đã xoá.
- **Snapshot wiki OpenCellID** `opencellid-api.html`, `opencellid-tok.html`,
  `opencellid-downloads.html` (không file nào tham chiếu; nội dung đã nằm trong `API.md`).
- **File rác/debug**: `.probe_*` (một file chứa JWT!), log tạm, `audit-cells-report.txt`,
  `Cell-tracker.code-workspace`, `stop.ps1`.
- `better-sqlite3` khỏi `dependencies` (không chỗ nào `require`) — trước đó đã bỏ nhưng
  ghi lại ở đây cho đủ ngữ cảnh.

### Changed — cấu trúc repo
- **Script vận hành một lần chuyển vào `scripts/`**: `audit-cells.js`, `backfill-radio.js`,
  `cleanup-online-cells.js`, `purge-admin-logs.js` (trước là `_purge_admin_logs.js`).
  Bỏ hard-code `D:/Code/database.sqlite`; dùng `DB_PATH` với mặc định giữ hành vi cũ.
  Kèm `scripts/README.md`. Cả thư mục bị loại khỏi artifact deploy.
- `.gitignore` chặn `.probe*`, `*.tmp`, `*.tar.gz`, `release-artifacts/`, `audit-*.txt`;
  `.gitattributes` ép `*.sh` LF, `*.ps1` CRLF và loại `scripts/`, `deploy/`, `.github/`,
  tài liệu khỏi `git archive`.
- `package.json`: version `2.10.0`, thêm `npm run smoke` / `npm run check`.

### Changed
- **IP Tracker → Bẫy địa chỉ IP** (`/tools/ip-tracker.html`): đổi tên hiển thị trên trang,
  menu **Công cụ** và tiêu đề tab (EN: *IP Address Trap*). Giữ nguyên đường dẫn trang và
  các endpoint `/api/tools/ip-tracker/*`, `/r/:token`, `/i/:token`, `/d/:token` để link đã
  phát tán không bị chết.

### Added — Bẫy địa chỉ IP
- **OG Image: dán link hoặc tải ảnh lên** (cả 2 tab). Ảnh tải lên được `sharp` tự xoay theo
  EXIF, cắt về **1200×630** và nén JPEG chất lượng 85 rồi lưu ngoài thư mục release; phục vụ
  qua `GET /og/:token` (cache `immutable`, không ghi log vì đó là IP của Facebook/Telegram).
  `og_image` dán tay vẫn dùng được; ảnh tải lên được ưu tiên hơn URL.
- **Thu thập dữ liệu người xem tối đa** — mỗi lượt click/xem ảnh giờ ghi:
  - IP (ưu tiên `X-Forwarded-For` / `CF-Connecting-IP` / `X-Real-IP`), `wan_ip`, và **mã
    thiết bị ẩn danh** `_ctid` (cookie 1 năm) trong cột `visitor_id` → nhận ra cùng một máy
    dù đổi mạng/đổi IP.
  - **Vị trí + nhà mạng** (quốc gia/tỉnh/thành/ISP/ASN/toạ độ/proxy/hosting) tra qua module
    `ip-lookup.js` sẵn có, chạy **ở nền** sau khi response đã gửi đi.
  - **User-Agent được parse** thành `{browser, version, os, device, engine, bot}` (kèm nhận
    diện bot mạng xã hội, Zalo, Facebook, Telegram, curl…).
  - **Header đầy đủ**: client hints (`sec-ch-ua-*`), `sec-fetch-*`, `accept-language`,
    `referer`, `origin`, cờ proxy (`via`, `forwarded`, số hop XFF). Cookie chỉ lưu **tên**,
    không lưu giá trị.
  - **Beacon phía trình duyệt** (`POST /px/:token`): màn hình, viewport, DPR, múi giờ, locale,
    số nhân CPU, RAM, pin, loại mạng (4G/3G/…), canvas fingerprint, `userAgentData` độ chi
    tiết cao và **IP WAN thật** do chính trình duyệt victim hỏi ipify (chỉ dùng khi server
    chỉ thấy IP LAN). Nhiều gói beacon được **merge** vào cùng row, gói nào lỗi thì mất đúng
    phần đó.
- **Trang trung chuyển nhẹ cho link**: `/r/:token` trả HTML ~3 KB có spinner, gửi beacon bằng
  `sendBeacon` (không mất dữ liệu khi chuyển trang) rồi `location.replace` sau ~0,4 s; có
  `<noscript>` meta-refresh.
- **Modal kết quả mới**: chip tổng hợp (tổng lượt / IP khác nhau / thiết bị khác nhau /
  quốc gia), thẻ từng lượt mở rộng được (thiết bị, màn hình, múi giờ, pin, mạng, vị trí,
  header, query params) và nút **Xuất CSV** (UTF-8 BOM, mở được bằng Excel).
- **`GET /api/tools/ip-tracker/:id/share` trả JSON hoặc HTML** tuỳ `Accept`: `fetch()` nhận
  JSON (modal trạng thái), người mở link bằng trình duyệt nhận trang trạng thái gọn.
- **`GET /px.js?token=...`**: file beacon tĩnh (cache 1 năm) cho ai muốn nhúng tay vào trang
  khác.

### Fixed
- **`wan_ip` từng ghi IP của MÁY CHỦ** (gọi `api.ipify.org` trong mỗi request): vô nghĩa và
  làm chậm mỗi lượt click. Giờ `wan_ip` = IP công khai mà server thấy; nếu server chỉ thấy
  IP LAN thì lấy IP WAN thật từ beacon của trình duyệt victim.
- **Vị trí IP không bao giờ được điền**: `tracker.pickGeo()` đọc thẳng `aggregate.country`
  trong khi `aggregate()` trả `{ fields: { country: { value } } }` → luôn `null`. Đã thêm
  `flattenAggregate()`.
- **Beacon ghi đè lẫn nhau**: mỗi gói `UPDATE client_json = ?` nên gói sau xoá sạch gói trước
  (mất pin/màn hình…). Giờ **merge** và mở rộng cửa sổ ghép lên 60 s.
- **`/api/tools/ip-tracker/:id/share` luôn trả trang OG HTML** nên modal "Link kiểm tra" báo
  lỗi parse. Đã tách hành vi theo `Accept`.
- **Xoá bẫy không xoá log** khi `PRAGMA foreign_keys` chưa bật → rò dữ liệu; giờ xoá log
  tường minh, kèm xoá file ảnh/ảnh OG trên đĩa.
- **Tạo bẫy ảnh: mọi ảnh không phải PNG đều bị ép `.jpeg`** (kể cả GIF/WEBP) và phần đuôi
  file suy từ `originalname`; giờ dùng `sharp().metadata()` và giữ đúng loại ảnh
  (png/jpeg/webp/gif) khi phục vụ.
- Ảnh tải lên giới hạn **25 MB** và chỉ nhận `image/*`; file tạm của multer được dọn khi
  route lỗi giữa chừng.

### Added
- **Bật/đóng website (chế độ bảo trì)**: tab **Cấu hình → Website** cho phép admin bật/tắt
  truy cập và nhập thông báo bảo trì (để trống = thông báo mặc định). Khi đóng, mọi trang
  của website (desktop + mobile) chuyển tới `/maintenance.html` có nội dung thông báo
  (không hiển thị nút đăng nhập — quản trị viên tự mở `/login.html`); API nghiệp vụ trả
  `403 SITE_CLOSED`, chỉ admin (JWT role `admin`) đăng nhập được và bật/tắt lại. Thêm banner
  cảnh báo + nút "Mở lại website" ngay trên Dashboard, endpoint công khai
  `GET /api/site/status`, và script gate `/site-status.js` chặn trang theo trạng thái thật
  từ server. Webhook payOS, health check và luồng quên/đặt lại mật khẩu vẫn hoạt động
  trong thời gian bảo trì.
- **Google Analytics 4 trong trang admin**: tab **Cấu hình → Google Analytics** cho phép
  bật/tắt tracking, nhập Measurement ID, GA4 Property ID và dán file JSON Service Account
  (secret được che khi GET, giống payOS/SMTP). Server tự sinh `/ga.js` để gắn thẻ gtag vào
  các trang public; chưa bật/chưa đủ cấu hình thì trả JS rỗng, không tải gtag.
- **Xem số liệu GA ngay trong Dashboard**: realtime đang online, người dùng, phiên,
  lượt xem trang, tỷ lệ tương tác, thời lượng phiên TB, tỷ lệ thoát; so sánh kỳ trước;
  biểu đồ xu hướng; top trang, nguồn truy cập, thiết bị, quốc gia. Số liệu cache 60s,
  lỗi Google được map thành mã dễ hiểu (thiếu quyền Viewer, sai Property ID, hết quota…).
- **Dashboard tổng quan mới**: gom chỉ số local vào một endpoint `/api/admin/dashboard`
  (người dùng, cell, lượt tra cứu, doanh thu, điểm, API 24h, IP tracker), biểu đồ xu hướng,
  hoạt động gần đây và sức khoẻ hệ thống (uptime/RAM/DB/version/đồng bộ cuối). Thêm index
  `created_at` cho các bảng dashboard để tránh full scan.
- **Sửa user đầy đủ trường**: modal sửa cho phép chỉnh username, email, trạng thái xác thực
  email, mật khẩu, vai trò và trạng thái (thêm `disabled`). Có `GET /api/admin/users/:id` để
  nạp dữ liệu mới nhất; đổi email tự reset xác thực; chặn tự hạ quyền/tự khoá/tự xoá và
  hạ quyền admin cuối cùng. Số dư điểm vẫn chỉ đổi qua ledger (nút "Nạp điểm").

### Changed
- **Trang thông báo bảo trì** (`/maintenance.html`): bỏ nút Đăng nhập, chỉ còn nút "Thử lại";
  quản trị viên tự mở `/login.html` khi cần đăng nhập.
- **Trang đăng nhập `/login.html`**: bỏ khối "Mẹo" và 2 nút mở popup đăng nhập/đăng ký;
  trang chỉ còn form đăng nhập/đăng ký trực tiếp.

### Fixed
- **IP Tracker** (`/tools/ip-tracker.html`) — sửa loạt lỗi frontend:
  - Nút hành động trong bảng dùng `onclick` nội tuyến có nhét URL vào chuỗi
    (`'${item.trackingUrl}'`), nên URL/tên chứa dấu `'` (rất phổ biến) làm gãy cả thẻ
    `<button>`; thẻ Xóa còn bị khai báo `class` hai lần. Đổi sang `data-act`/`data-id`
    và gắn listener một lần trên `<tbody>`.
  - Tên/User-Agent/header/IP/query param được đưa vào `innerHTML` **không escape**
    → XSS và vỡ bảng khi User-Agent có `"` hoặc `<`. Thêm `esc()` cho mọi chỗ.
  - Modal Kết quả có thêm cột **Query params** (server vẫn trả `query_params` nhưng UI
    bỏ qua); escape tiêu đề và giá trị headers.
  - Thời gian lưu dạng `YYYY-MM-DD HH:MM:SS` (UTC, không có `Z`) nên hiển thị lệch 7 giờ
    và ra `Invalid Date` trên Safari. Thêm `fmtDate()`.
  - Sau khi tạo link, code gán `btn.textContent = ...` lên nút bọc `<span data-i18n>`
    → mất `<span>`, lần đổi ngôn ngữ sau không dịch lại nhãn nút. Thêm
    `syncButtonText()` và khôi phục `<span>` sau khi tạo xong.
  - `navigator.clipboard` không có (http trên LAN) → nút Copy im lặng không làm gì;
    thêm fallback `execCommand('copy')`.
  - `/share` trả HTML trang OG chứ không phải JSON nên modal Share luôn báo lỗi parse;
    UI giờ dò `content-type` và báo "không hỗ trợ" thay vì văng lỗi.
  - Phần auth chạy ngoài `try/catch` và gọi `Auth.*` mà không kiểm tra tồn tại: thiếu
    `/auth.js` là `ReferenceError` giết cả file (tab, upload, danh sách chết theo).
    Giờ được bọc `try` và luôn kiểm tra `typeof Auth !== 'undefined'`.
  - HTTP `401` (token hết hạn) giờ dọn session rồi về trang chủ mở popup đăng nhập,
    thay vì hiện bảng trống + alert khó hiểu.
  - Listener click overlay của modal Kết quả bị gắn lại mỗi lần mở (rò listener).
  - Dọn markup công cụ bị lọt vào cuối `ip-tracker.html`.
- **`Unexpected token '<', "<!DOCTYPE "... is not valid JSON`** khi mở tab **Tra cứu IP**
  hoặc trang `/tools/ip-lookup.html`: khi bản server đang chạy chưa có route mới (chưa
  khởi động lại sau khi cập nhật), Express trả trang 404 HTML nên `res.json()` chết với
  thông báo vô nghĩa. Đã sửa hai phía:
  - Server: mọi `/api/*` không khớp route giờ trả **JSON 404** (`code: "API_NOT_FOUND"`,
    kèm gợi ý khởi động lại) thay vì trang HTML mặc định của Express.
  - Client: admin và trang công cụ dùng helper `readJsonHttp`/`readJson` — nếu response
    không phải JSON thì báo rõ *"Máy chủ trả về HTML thay vì JSON cho &lt;url&gt; (HTTP 404).
    Có thể máy chủ chưa được khởi động lại sau khi cập nhật"* kèm đoạn nội dung server trả,
    thay vì ném lỗi parse khó hiểu. Lỗi không còn làm trắng bảng/tab: phần còn lại của
    trang vẫn dùng được.

### Added
- **Tra cứu địa chỉ IP đa nguồn** — trang `/tools/ip-lookup.html` + module `ip-lookup.js`
  và mục quản trị **Tra cứu IP** trong admin. Tra một IPv4/IPv6 qua nhiều nguồn cùng lúc,
  chuẩn hoá về một bộ trường chung rồi **bỏ phiếu chọn giá trị được nhiều nguồn đồng ý**
  (toạ độ lấy trung vị), kèm độ đồng thuận và cờ proxy/hosting/mobile hợp nhất.
  - **Nguồn tích hợp**: **DB-IP** (`http://api.db-ip.com/v2/{key|free}/{ip}`, chỉ HTTP),
    **IPinfo** (`/lite/` miễn phí hoặc `/lookup/` cho token Core), **ipwho.is**, **ipapi.is**,
    **ip-api.com** (HTTP, 45 req/phút), **freeipapi.com**, **iplocation.net**, và bản
    **DB-IP free** (tự bỏ qua khi đã có key DB-IP). Mỗi nguồn có `parse()` riêng nên
    lỗi riêng của nguồn (DB-IP `errorCode`, IPinfo `error`, freeipapi trả toàn `null`,
    ip-api.com `status:fail`…) đều thành câu thông báo đọc được thay vì "không có dữ liệu".
  - **API**: `GET /api/tools/ip-lookup` (đăng nhập: mọi nguồn đang bật, hạn mức theo
    user/ngày), `GET /api/tools/ip-lookup/guest` (khách: chỉ nguồn không cần key, hạn mức
    theo IP/ngày), `GET /api/tools/ip-lookup/me` (IP người gọi), `/api/tools/ip-lookup/console`
    (IP máy chủ — tắt mặc định), `GET /api/tools/ip-lookup/config` (cấu hình công khai).
  - **Cache + hạn mức**: bảng `ip_lookup_cache` (UNIQUE theo IP/nguồn, TTL theo cấu hình;
    lỗi chỉ cache 1 ngày để nguồn free tự phục hồi), `ip_lookup_logs` (nhật ký, đếm hạn
    mức, dọn theo `ip_lookup_log_retention_days`), `ip_guest_trials` (hạn mức khách theo IP).
    Mốc reset ngày đặt được bằng `ip_lookup_day_cutoff_hour` (giờ Việt Nam).
  - **Quản trị (admin → Tra cứu IP)**: 3 tab Nguồn / Nhật ký / Cấu hình & chạy thử —
    bật/tắt, sắp ưu tiên, sửa base_url/plan/timeout/cache, nhập API key (chỉ trả bản che
    `••••1234`, gửi lại bản che = giữ nguyên), nút **Kiểm tra** từng nguồn, xem lỗi gần nhất,
    thống kê 24h + tổng, lọc nhật ký theo IP/nguồn, chạy thử kèm tuỳ chọn "gồm nguồn đang tắt"
    và "bỏ qua cache" (không tính hạn mức).
  - **Cấu hình mới**: `ip_lookup_public_enabled`, `ip_lookup_public_guest_daily`,
    `ip_lookup_user_daily`, `ip_lookup_console_enabled`, `ip_lookup_console_per_day`,
    `ip_lookup_day_cutoff_hour`, `ip_lookup_log_retention_days` (seed tự động, admin sửa
    trong tab Cấu hình). Cron dọn nhật ký/cache chạy 03:40 hằng ngày.
  - Test: `_iplookup.test.js` (166 assert — parse từng nguồn, ghép URL, bỏ phiếu/tổng hợp,
    cache, nguồn thiếu key, một nguồn lỗi không làm gãy lô, hạn mức khách/user, CRUD nguồn,
    wiring route/UI/DB).
- **Nút "IP của tôi" lấy IP WAN thật (IPv4 + IPv6)** — trước đây nút này trả địa chỉ
  mà *server* nhìn thấy, nên khi chạy local là `127.0.0.1`/IP LAN và thường chỉ có một
  họ địa chỉ. Nay trang công cụ dò **song song** hai endpoint chuyên biệt một họ
  (`ipv4.ident.me`, `api-ipv4.ip.sb`, `ipv4.icanhazip.com` / bản `ipv6.*`) — chỉ dùng
  dịch vụ có `Access-Control-Allow-Origin: *` để trình duyệt gọi được — hiển thị một chip
  cho IPv4 và một chip cho IPv6 (kèm "không có" nếu mạng không có họ đó), bấm chip để tra
  ngay, tự điền + tra IP ưu tiên IPv4. Có timeout 4,5s mỗi endpoint, tự chuyển endpoint dự phòng,
  và dự phòng cuối bằng `/api/tools/ip-lookup/me` khi dịch vụ ngoài bị chặn. Route `/me`
  giờ trả thêm `private` (loopback/LAN/CGNAT) và `wan_ip` (chỉ khi là IP công khai thật)
  nhờ `ip-lookup.isPrivateIp()` mới. Khách chưa đăng nhập cũng dùng được nút này.
- **Mở rộng chi tiết từng nguồn** ở bảng "Kết quả từng nguồn": bấm vào một dòng (hoặc
  Enter/Space khi dòng đang focus) để bung khối chi tiết ngay dưới dòng đó — hiển thị **toàn bộ
  trường mà nguồn trả về** (quốc gia/mã, châu lục, vùng, thành phố, mã bưu chính, toạ độ,
  múi giờ + GMT offset, ASN/tên ASN, ISP, tổ chức, tên miền, loại kết nối, loại sử dụng,
  cờ proxy/hosting/mobile, loại proxy, mức đe doạ), danh sách **trường nguồn không trả**,
  và JSON riêng của nguồn đó. Nguồn lỗi cũng mở rộng được để xem thông báo lỗi đầy đủ.
  Có nút **Mở rộng/Thu gọn tất cả**, caret xoay theo trạng thái, giữ `aria-expanded`/`aria-controls`
  cho screen reader; mọi giá trị của nguồn đều được escape trước khi render.
- **Tra cứu IP trên ứng dụng di động `/m/`** — tab **Công cụ** có thêm thẻ **Tra cứu địa chỉ IP**:
  nhập IPv4/IPv6 (bàn phím text, `autocapitalize=off`), nút **Tra cứu IP** và **IP của tôi
  (IPv4/IPv6)** dò song song 2 endpoint một họ (`ipv4/ipv6.ident.me`, `api-ipv4/6.ip.sb`,
  `ipv4/6.icanhazip.com` — chỉ dịch vụ có CORS) với timeout 4,5s, dự phòng bằng `/api/tools/ip-lookup/me`;
  chip IPv4/IPv6 chạm để tra ngay. Kết quả hiển thị các dòng tổng hợp (quốc gia, vùng/thành phố, ASN,
  nhà mạng, toạ độ trung vị, múi giờ, số nguồn đồng thuận, cảnh báo proxy/hosting) và **danh sách nguồn
  dạng accordion `<details>`** — chạm tiêu đề nguồn (vùng chạm ≥ 44px) để xem đủ trường nguồn đó trả về
  + danh sách trường nguồn không trả; nguồn lỗi cũng mở rộng được. Dùng chung endpoint/cache/hạn mức với
  bản web. `CACHE_VERSION` của service worker tăng `cell-m-v8` → `cell-m-v9` để client nhận bản mới.
- **Tab Công cụ trên `/m/` thu gọn dạng accordion** — trước đây 3 công cụ (check số điện
  thoại, chuyển đổi Cell ID, tra cứu IP) xếp dọc luôn mở nên trang rất dài và phải cuộn
  nhiều. Nay mỗi công cụ là một card có **nút tiêu đề** (vùng chạm ≥ 44px) và phần thân
  ẩn mặc định: **cả 3 đóng khi mở app**, chạm tiêu đề để mở, **mở công cụ nào thì công cụ
  đang mở tự đóng** (chỉ một cái mở tại một thời điểm), chạm lại tiêu đề đang mở thì đóng.
  Có `aria-expanded`/`aria-controls` + mũi tên xoay 180° theo trạng thái, card đang mở viền
  sáng nhẹ. Captcha VNTA chỉ tải khi mở công cụ check số (trước đây tải ngay khi vào tab).
  Các luồng nhảy vào công cụ đều tự mở đúng thẻ trước khi hiện kết quả: nút **eNB ↔ ECI**
  trong kết quả tra cứu gọi `mToolOpen('convert')`, nếu không kết quả sẽ nằm trong thân
  đang đóng và người dùng không thấy gì. `CACHE_VERSION` `cell-m-v9` → `cell-m-v10`.
- **Trang NẠP ĐIỂM trên `/m/` (payOS)** — trước đây nút "Nạp thêm điểm" đá sang
  `/topup.html` (trang máy tính, 62 KB) nên trên điện thoại phải phóng to/thu nhỏ. Nay là
  một bottom sheet toàn màn hình ngay trong app, dùng đúng API sẵn có (**không thêm endpoint**):
  - **Chọn gói**: lưới 2 cột lấy từ `/api/credits/packages`, chạm để chọn, hiện ngay
    "Nhận được X điểm"; hoặc **nạp số tiền tự do** trong khoảng min–max (server trả về),
    chặn số tiền sai ngay trên client trước khi gọi API.
  - **Tạo đơn**: `POST /api/credits/topup/create` với `package_id` **hoặc** `amount_vnd` —
    client KHÔNG gửi số điểm, server tự tính từ gói.
  - **Đơn chờ**: mã đơn, số tiền, điểm, **đếm ngược hết hạn** (mm:ss, cập nhật mỗi giây),
    ảnh **VietQR** khi có, nội dung chuyển khoản + nút copy, link mở trang payOS, nút
    "Tôi đã chuyển khoản — kiểm tra lại" (gọi `/sync`), nút **Huỷ đơn**.
  - **Tự cập nhật**: hỏi trạng thái mỗi 4 s; quá 20 s mà webhook chưa tới thì tự gọi
    `/sync` để đối soát; PAID → cộng số dư ngay trên app (topbar + tab Tài khoản + tiêu đề
    sheet), rung nhẹ, toast xác nhận. Timer được dọn khi đóng sheet.
  - **Chế độ thử** (`payos_test_mode`): hiện nút **"Thanh toán thử"** gọi `/mock-paid`
    để test trọn luồng mà không mất tiền thật.
  - **Đơn gần đây**: 5 đơn cuối kèm badge trạng thái (PENDING/PAID/CANCELLED/EXPIRED/
    UNDERPAID/FAILED), chạm để mở lại; mở sheet mà có đơn đang chờ thì vào thẳng đơn đó
    (bấm "Tạo đơn khác" thì mới hiện lại màn chọn gói).
  - Cổng nạp tắt (`available=false`) → banner báo rõ và ẩn nút tạo đơn.
  - Back của điện thoại đóng sheet (`popstate`), khoá cuộn trang nền.
  - `CACHE_VERSION` `cell-m-v10` → `cell-m-v11`.
- **Sửa lỗi `/m/`: mở lại Nạp điểm sau khi đã nạp vẫn hiện màn "chúc mừng" cũ** — `TP.order`
  chỉ bị xoá khi bấm "Tạo đơn khác", nên đóng sheet rồi mở lại thì `mTopupLoad()` thấy
  `TP.order` vẫn là đơn PAID của lần trước và không vẽ lại màn chọn gói → người dùng thấy
  lại thông báo "Đã cộng N điểm" thay vì trang nạp tiền. Nay `mOpenTopup()` và `mCloseTopup()`
  đều **reset `TP.order`/`paidShown`/lựa chọn gói** + dừng timer, nên mỗi lần mở là một phiên
  nạp mới; đơn **PENDING** vẫn được tự mở lại như trước (và "Tạo đơn khác" thì bỏ qua việc
  mở lại đó). Màn "Đã thanh toán" thêm nút **Nạp thêm điểm** và **Xong**. `cell-m-v11` → `cell-m-v12`.
- **`/m/` tab Tra cứu: ẩn lối tắt "Xem vị trí trên bản đồ" khi không có kết quả** — nút này
  trước đây luôn hiện; bấm khi chưa tra (hoặc tra miss) thì `mOpenMap()` không có toạ độ nên
  **đá người dùng sang `/index.html`** (bản máy tính), phá vỡ trải nghiệm app. Nay:
  - Nút `#mLkMapBtn` **mặc định ẩn** (`hidden` trong HTML).
  - Chỉ hiện khi lần tra gần nhất **có toạ độ** (`renderLookup` gọi `mLkMapBtnToggle(true)`);
    kết quả miss/lỗi (qua `mShowResult` với `#mLkResult`) và **đăng xuất** đều ẩn lại
    (`mLogout` cũng xoá luôn khung kết quả cũ).
  - `mOpenMap()` không còn điều hướng sang trang máy tính khi thiếu toạ độ: hiện toast
    *"Chưa có vị trí để hiển thị. Hãy tra cứu một cell trước."* và ở lại `/m/`.
  - Lối vào bản đồ vẫn còn: nút **Bản đồ** trong khung kết quả và nút bản đồ trên thẻ lịch sử.
  - `CACHE_VERSION` `cell-m-v12` → `cell-m-v13`.
- **Hạ tầng triển khai production (Proxmox LXC)** — `deploy/` chứa runbook và script cho
  một container Debian 12 (Nginx → Node `127.0.0.1:3000`, systemd, certbot), cùng pipeline
  đóng gói từ `git HEAD` + deploy có kiểm tra `/api/version` và tự rollback:
  `deploy/proxmox/create-lxc.sh`, `deploy/proxmox/bootstrap-app.sh`, `deploy/deploy.ps1`,
  `bin/deploy-release.sh`, `bin/backup-db.sh`.
- **`.env` cho cấu hình runtime** (dotenv): `DB_PATH`, `UPLOAD_DIR`, `HOST`, `TRUST_PROXY`
  (xem `.env.example`) — tách dữ liệu (`shared/`) khỏi thư mục code của từng release trên
  server, đồng thời giữ nguyên hành vi cũ khi không đặt biến (local dev, script test).
- **Ứng dụng di động `/m/` (PWA)** — bản tối giản dành cho điện thoại, dùng chung
  `Auth` và toàn bộ API sẵn có (không thêm endpoint, không đổi schema DB). Đăng nhập
  ở `/m/` có hiệu lực luôn trên bản web và ngược lại (cùng origin, cùng localStorage).
  - **Giao diện đăng nhập / đăng ký**: đăng nhập bằng username **hoặc email**, đăng ký
    có **captcha chữ** (server trả `{id, text}`, client vẽ canvas → dataURL), xác nhận
    điều khoản, **kích hoạt email** bằng mã 6 số (dùng `dev_code` khi máy chủ chưa cấu
    hình SMTP), **quên / đặt lại mật khẩu** ngay trong app.
  - **Tab Tra cứu (màn hình chính)**: tra **cell đơn lẻ** (MCC/MNC/LAC/Cell ID + sector
    + công nghệ), hiện toạ độ, bán kính, nguồn dữ liệu, nhãn RAT; cảnh báo khi công nghệ
    mạng chỉ là suy luận; copy toạ độ, mở Google Maps, nhảy sang công cụ eNB ↔ ECI.
    Xử lý đủ **404** (không tìm thấy cell), **402** (hết điểm — kèm số dư + link nạp),
    mất mạng, và các mã lỗi khác.
  - **Tab Lịch sử — CHỈ cell đơn lẻ**: luôn gọi `GET /api/lookup-history?mode=single`
    nên **phiên tra theo danh sách (batch) không bao giờ lọt vào đây**; chip lọc
    Tất cả / Đã tra được / Không có kết quả, phân trang "Xem thêm", tra lại, copy toạ
    độ, xoá từng lượt (`DELETE /api/lookup-history/:id`), tự nạp lại sau khi tra.
  - **Tab Công cụ**:
    - **Check số điện thoại** = tra **nhà mạng hiện tại** của số qua cổng VNTA
      (chuyển mạng giữ số), có **captcha ảnh** + session one-shot; hiện thuê bao,
      mạng gốc, mạng hiện tại, trạng thái chuyển mạng. (Trước đây form này gọi
      `/api/phones` — danh sách số trong lịch sử cuộc gọi của chính user — sai mục đích.)
    - **Chuyển đổi** eNB ID ↔ ECI (`GET /api/cells/convert`) + nút "Dùng ECI để tra cứu".
  - **Tab Tài khoản**: số dư điểm, làm mới thông tin, nạp thêm điểm, đăng xuất, phiên bản.
  - **PWA**: `public/m/manifest.webmanifest` (start_url/scope `/m/`, `display:standalone`,
    icon 192/512 + maskable, 3 shortcut), `public/m/sw.js` (precache app shell **tuần tự**
    — thêm song song bằng `cache.add` từng bị trình duyệt huỷ giữa chừng làm thiếu
    `app.js`/`auth.js` trong cache, **network-first cho điều hướng**, stale-while-
    revalidate cho asset, **bỏ qua toàn bộ `/api/`** và request cross-origin → không
    cache dữ liệu tài khoản), `public/m/offline.html`, đăng ký SW scope `/m/`.
  - **Điều hướng trong app**: mỗi tab được ghi vào URL (`#lookup/#history/#tools/
    #account`) bằng `history.pushState` (lần đầu dùng `replaceState` để không tạo mục
    lịch sử thừa) → **nút Back của Android quay về tab trước thay vì thoát app**, và
    **shortcut PWA / deep link** (`/m/#history`) mở đúng tab. `popstate` + `hashchange`
    đều dùng chế độ `silent` để không nhân đôi lịch sử.
  - **Banner "Cài ứng dụng"**: chỉ hiện **sau khi đã vào app** (trước đây che mất nút
    Đăng nhập/Tạo tài khoản), tự ẩn khi đăng xuất, và trên **iOS/Safari** (không có
    `beforeinstallprompt`) hiện hướng dẫn *Chia sẻ → "Thêm vào MH chính"* thay cho nút
    Cài (nút này bấm sẽ không có tác dụng trên iOS). Nhận diện cả **iPadOS giả UA
    Macintosh** qua `maxTouchPoints`; đã cài (standalone) thì không hiện nữa.
  - **Bản đồ trong app** (thay cho việc đá sang trang máy tính): bottom sheet toàn màn
    hình `#mMapSheet` dùng **Leaflet 1.9.4** (nạp `defer` từ CDN, chỉ khởi tạo lần đầu mở
    → không tốn tài nguyên lúc khởi động). Marker tròn + **vòng bán kính** theo `range`
    của cell, popup tên cell + toạ độ. **3 lớp nền giống bản máy tính** (Đường phố/Vệ
    tinh/Địa hình, nhớ lựa chọn trong `localStorage`), nút phóng to/thu nhỏ/về vị trí
    (44×44px), dải toạ độ ở tiêu đề, nút Copy + mở Google Maps. Mở từ **kết quả tra
    cứu** hoặc từ **nút bản đồ trên thẻ lịch sử** (chỉ thẻ có toạ độ). Khoá cuộn trang
    nền khi mở, **Back của điện thoại đóng bản đồ** thay vì thoát app, `invalidateSize`
    khi mở sheet / xoay máy (nếu thiếu, Leaflet vẽ lệch hoặc xám). Leaflet tải lỗi
    (mất mạng, CDN bị chặn) → khối dự phòng + nút mở Google Maps, không màn trắng.
  - **HTTPS cho LAN (để cài PWA trên điện thoại thật)**: PWA chỉ chạy trong
    *secure context* — mở `http://<IP-LAN>:3000/m/` thì trình duyệt **không** đăng ký
    service worker và **không** bắn `beforeinstallprompt`, nên trước đây không có nút
    cài. `server.js` nhận `HTTPS_PORT` (vd. `HTTPS_PORT=3443 node server.js`) → mở thêm
    HTTPS song song HTTP, cert tự ký sinh bằng `node:crypto` ([`tls-selfsigned.js`](tls-selfsigned.js),
    **không cần OpenSSL**, không thêm dependency), SAN tự gồm mọi IPv4 LAN + localhost +
    127.0.0.1, hạn 825 ngày, dùng lại cert còn hạn và tự sinh lại khi đổi IP. Thư mục
    `.certs/` đã vào `.gitignore`.
  - **Banner cài đặt không còn im lặng**: nếu trình duyệt không hỗ trợ cài tự động
    (iOS/iPadOS, Firefox, hoặc đang chạy HTTP), banner vẫn hiện và nút đổi thành
    **"Cách cài"** → mở bottom sheet hướng dẫn **theo từng trình duyệt** (Safari iOS:
    Chia sẻ → Thêm vào MH chính; Chrome iOS: mở bằng Safari; Firefox/Edge: menu ⋮).
    Riêng trường hợp HTTP, hướng dẫn nói thẳng *cần HTTPS* kèm cách xử lý cảnh báo
    chứng chỉ tự ký. Có prompt thật thì nút giữ là **"Cài"** và gọi hộp thoại hệ thống.
  - **Điều hướng**: mở trang chủ bằng UA di động → `302 /m/` (có lối thoát `?desktop=1`);
    `/m` tự `301` sang `/m/`.
  - `server.js`: khai báo MIME `application/manifest+json` cho `.webmanifest` (Express 4
    mặc định trả `octet-stream` → trình duyệt từ chối cài PWA) và ép `Cache-Control:
    no-cache` cho tài nguyên `/m/*.js|css|html|webmanifest` để bản mới không bị SW giữ lại.
  - **`_mobtest.js`** — 159 assertion tĩnh: mọi handler inline trong `index.html` đều có
    trong `app.js`, manifest/SW/offline hợp lệ, đúng endpoint (và **không** dùng
    `/api/phones`), lịch sử chỉ `mode=single`, dữ liệu máy chủ đều qua `esc()`, server
    khai báo MIME + redirect đúng thứ tự trước `express.static`, tab ghi vào URL +
    `popstate` + hướng dẫn cài cho iOS, và bản đồ (Leaflet, 3 lớp nền, marker/vòng bán
    kính, invalidateSize, Back đóng sheet, escape toạ độ).
  - **`_mobe2e.js`** — 36 assertion end-to-end trên server thật: đăng ký → captcha →
    kích hoạt email → đăng nhập → `/api/me` → tra cứu (hit/miss/400) → lịch sử chỉ
    `mode=single` → xoá 1 lượt → chuyển đổi eNB/ECI (cả 2 chiều) → không lộ lịch sử
    khi không có token. Tự tạo & xoá user test.
  - **`_pwatest.js`** — 18 assertion PWA bằng Chrome/Edge headless (CDP): manifest đọc
    được + không lỗi khả cài đặt, SW `activated` scope `/m/`, precache đủ app shell,
    **tắt server vẫn mở được app từ cache**, `/m/offline.html` render offline, và
    **không có response `/api/` nào bị cache**. Tự bỏ qua nếu máy không có Chrome
    (đặt `CHROME_PATH` để chỉ định).
- **Public API v1 cho ứng dụng/website khác** — xác thực bằng **API key** (server-to-server)
  hoặc **JWT** (đăng nhập bằng tài khoản). Không bật CORS.
  - `GET /api/v1/health` — kiểm tra kết nối, không cần xác thực.
  - `POST /api/v1/login` — đăng nhập bằng username **hoặc email**, trả `token` (JWT 24h,
    `expires_in: 86400`) + `user` (id, username, email, role, status, credit_balance).
  - `GET /api/v1/me` — thông tin tài khoản đang dùng, kèm thông tin key (scope, hạn mức)
    khi xác thực bằng key.
  - `GET /api/v1/cells/resolve` — tra cứu cell, trả `cell` (mcc/mnc/lac/cellid/sector/lat/
    lon/range/radio/address), `source`, `radio_source`, `radio_confident`, `credit`.
  - **Dùng chung `resolveCellCore()`** với `/api/cells/resolve` của web (tách ra từ handler
    cũ) → thứ tự nguồn, geo gate và cách trừ điểm không bao giờ lệch nhau.
  - Mã lỗi máy đọc được: `NO_CREDENTIALS`, `INVALID_KEY`, `INVALID_TOKEN`, `KEY_REVOKED`,
    `KEY_EXPIRED`, `KEY_DISABLED`, `INSUFFICIENT_SCOPE`, `INSUFFICIENT_CREDIT`,
    `CELL_NOT_FOUND`, `BAD_REQUEST`, `ACCOUNT_DISABLED`, `EMAIL_NOT_VERIFIED`, `RATE_LIMITED`.
  - Header hạn mức mỗi response: `X-RateLimit-Limit`, `X-RateLimit-Remaining`,
    `X-RateLimit-Limit-Day`, `X-RateLimit-Remaining-Day`, `Retry-After` khi 429.
- **Tab "API" trong trang admin** — 3 tab con: **Khoá API** (tạo, tắt/bật, sửa hạn mức &
  quyền, thu hồi, xoá), **Nhật ký gọi API** (lọc theo trạng thái / theo khoá), **Tài liệu
  tích hợp** (endpoint, mã lỗi, ví dụ cURL, nút copy). Thẻ thống kê: tổng key, đang hoạt
  động, đã thu hồi, request 24h, lỗi 24h, cell đã tra 24h.
- **Bảng `api_keys`** — key lưu dạng SHA-256 (`key_hash`), chỉ giữ `key_prefix` 12 ký tự đầu
  để admin nhận ra key. Key thô chỉ trả về **đúng 1 lần** lúc tạo. `revoked_at` (thu hồi vĩnh
  viễn) tách khỏi `enabled` (tạm tắt, bật lại được) → key đã thu hồi không thể bật lại.
- **Bảng `api_request_logs`** — mọi request `/api/v1`: key, user, method, path, status,
  thời gian xử lý, số cell, điểm đã trừ, IP, user-agent, lỗi. Không bao giờ ghi key thô.
  Tự dọn theo `api_request_logs_retention_days` (mặc định 30 ngày, cron 03:35).
- **`api-keys.js`** — module sinh/hash/kiểm tra key, rate limit cửa sổ trượt (phút + ngày),
  CRUD, log, thống kê, prune.
- **`API.md`** — tài liệu tích hợp đầy đủ: xác thực, từng endpoint, bảng mã lỗi, ví dụ
  Node.js / PHP / Python, lưu ý bảo mật.
- **`_apitest.js`** — 148 assertion: health, login (username/email/hoa-thường), JWT, API key
  (cả `X-API-Key` và `Bearer`), scope, resolve (200/400/404), tắt/bật/hết hạn/thu hồi/xoá,
  chủ key bị khoá/chưa kích hoạt, log, stats, và kiểm tra bảo mật (không lộ hash/raw key,
  không có CORS, `hasScope` không bao giờ cấp `admin`).

### Changed
- **Đường dẫn dữ liệu cấu hình được** — DB và thư mục upload không còn phụ thuộc vị trí code:
  - `DB_PATH` (mặc định vẫn là thư mục CHA của repo như cũ) — production trỏ vào
    `/opt/cell-tracker/shared/database.sqlite`.
  - `UPLOAD_DIR` thay cho `multer({ dest: 'uploads/' })` tương đối theo CWD (trước đây
    systemd chạy sai `WorkingDirectory` sẽ ghi file vào `/`); thư mục `uploads/tracker`,
    `uploads/clf` được tạo theo cùng biến này.
- **`HOST`** để giới hạn interface listen (prod: `127.0.0.1`, sau Nginx).
- **`TRUST_PROXY`** bật `app.set('trust proxy')` — cần khi chạy sau reverse proxy để link
  kích hoạt email và `returnUrl` payOS dựng đúng `https` và đúng IP client.
- **Bỏ `better-sqlite3` khỏi `dependencies`** — không có chỗ nào `require`, chỉ làm nặng
  `npm ci` trên server (native build).
- `package.json` thêm `engines.node >= 22` (khớp Node 24 dùng ở local/production).

### Fixed
- **Production thiếu `JWT_SECRET` giờ dừng hẳn** (log `FATAL`) thay vì chạy với secret
  mặc định `cell-tracker-secret-key-2024` — trước đây ai biết mã nguồn cũng tự ký được
  token admin.
- `HTTPS_PORT` rỗng (`HTTPS_PORT=`) được hiểu là `0` thay vì bật HTTPS trên cổng 0.
- Script test (`_authtest.js`, `_credittest.js`, `_payos.test.js`, `_topupapi.js`,
  `_topupflow.js`, `_batchcredit.test.js`, `_googlesource.test.js`) tôn trọng `DB_PATH`
  để patch sqlite3 trỏ đúng file DB tạm mà `database.js` đang dùng.
- **Nhấn vào ô ngày vẫn không mở bảng chọn — thay hẳn sang 1 bảng lịch tự vẽ.** Bản sửa
  trước (bên dưới) vẫn dựa vào `<input type="date">` native nên không đủ: mỗi ô là **một**
  bảng lịch riêng của trình duyệt, và `showPicker()` bị chặn
  (`NotAllowedError: requires a user gesture`). Nay:
  - **Bỏ 2 ô `#clDateFromField`/`#clDateToField`**, thay bằng **1 nút lịch `#clDateBtn`** mở
    **1 popup lịch `#clCalPop`** dùng chung → cả panel chỉ còn **đúng 1 icon lịch**.
  - **Chọn 1 ngày**: bấm 1 ngày rồi bấm **Áp dụng** (hoặc bấm lần thứ hai vào chính ngày đó).
  - **Chọn khoảng**: bấm ngày đầu rồi ngày cuối → tô màu cả khoảng; ngày cuối nhỏ hơn ngày
    đầu thì tự đảo lại.
  - Điều hướng **năm trước / tháng trước / tháng sau / năm sau**, nút **Hôm nay**, tuần bắt
    đầu **Thứ 2**, đánh dấu hôm nay bằng chấm nhỏ, ô ngoài tháng vẫn bấm được (mờ).
  - Nhãn nút: `Mọi ngày` → `18/10/2026` (1 ngày) → `15/10 → 18/10/2026` (khoảng), kèm nút ✕
    bỏ lọc ngày. Đóng popup khi bấm ra ngoài hoặc nhấn **Esc**.
  - Giá trị cuối vẫn ghi vào `#dateFrom`/`#dateTo` (nay `type="hidden"`) nên
    `getFilteredLogs` và code cũ đọc nguyên trạng.
  - **Bug tự đóng popup**: `renderClCalendar()` dựng lại `innerHTML` nên phần tử vừa click đã
    bị gỡ khỏi DOM khi sự kiện nổi lên `document` → handler "bấm ra ngoài" thấy target không
    thuộc `#clDateRange` và đóng popup **ngay sau lần chọn đầu**, làm lần chọn thứ hai (ngày
    cuối khoảng) rơi vào khoảng trống. Sửa bằng `composedPath()` + cờ `clCalRendering` hạ ở
    `setTimeout(…, 0)` — hạ đồng bộ trong `finally` là vô dụng vì sự kiện chưa lan tới
    `document`.
- **Chọn ngày trong `.cl-date-range` không hoạt động** (tab Tra cứu danh sách → bộ lọc). Hai
  nguyên nhân cộng lại:
  - `#clRecordsBlock` — khối chứa bộ lọc + khoảng ngày — chỉ được gỡ `hidden` khi **đã có**
    danh sách cell (`if (search && has)`). Lúc chưa nạp file, cả khối bị `display:none` nên ô
    ngày có kích thước `0×0` và không nhận được click; `showPicker()` cũng không mở vì phần
    tử không render. Nay khối **luôn hiện** (`if (search) search.hidden = false`).
  - Icon lịch gọi `openClDatePicker()` → `input.showPicker()`, mà `showPicker()` ném
    `NotAllowedError` nếu thiếu user-activation. Input native vốn đã phủ khít ô
    (`opacity:0`, `z-index:1`) nên nhận click trực tiếp — bỏ `onclick` khỏi icon và bỏ
    `showPicker()` (đổi sang `input.click()`), trình duyệt tự mở bảng chọn ngày.
- **Lịch sử "Tra cứu danh sách" không hiển thị** — bấm mở mục ra khung trống dù API trả
  đủ phiên. `renderHistSections()` truyền **`'histBatchList'`** (thẻ `<div class="hist-list">`
  nằm *bên trong* body) vào chỗ cần **`'histBatchBody'`** (chính body thu gọn). Hệ quả:
  `hidden` bị gỡ trên **danh sách**, còn `#histBatchBody` vẫn giữ `hidden` từ HTML → wrapper
  giãn ra (`is-expanded`) nhưng nội dung bên trong vẫn bị ẩn, nên không thấy phiên nào. Mục
  "Tra cứu đơn lẻ" không bị vì đã trỏ đúng `'histSingleBody'`.
  - Sửa lại cặp id cho mục danh sách.
  - `toggleHistSection()` trước đây chỉ nạp dữ liệu cho mục **"single"**; mở mục **"batch"**
    không gọi lại API nên danh sách có thể là bản cũ. Nay nạp lại cả hai khi mở (vẫn không
    gọi mạng khi đóng, và vẫn giữ luật chỉ 1 mục mở tại một thời điểm).
- **Giờ trong Lịch sử tra cứu lệch 7 tiếng** (hiện `14:57` thay vì `21:57`). SQLite lưu
  `created_at` bằng `CURRENT_TIMESTAMP` theo **UTC**, dạng `"2026-10-20 14:57:13"` và **không
  kèm hậu tố múi giờ**. `new Date(chuỗi)` của JS hiểu chuỗi đó là giờ **địa phương**, nên
  mọi mốc thời gian hiển thị đều lệch đúng offset của người xem (VN: chậm 7 tiếng).
  - Thêm `parseServerTime(ts)`: chuỗi có `Z` hoặc offset `±hh:mm` thì tôn trọng; chuỗi
    **không có zone** được dựng bằng `Date.UTC(...)` (tức là coi là UTC); số (epoch ms) giữ
    nguyên; không khớp → `new Date(s)`.
  - Áp cho `fmtDateTime`, `fmtTick`, so sánh sắp xếp timeline, `t0`/`t1` và cột thời gian ở
    bảng dữ liệu di động. Đã kiểm chứng cùng một mốc `14:57:13` UTC: Asia/Saigon →
    `21:57`, Asia/Tokyo → `23:57`, UTC → `14:57`.
- **Tab Lịch sử: mục "Tra cứu đơn lẻ" không hiện dữ liệu ngay lần đầu mở tab** — phải đóng
  rồi mở lại mục mới thấy. Nguyên nhân: mục này mặc định ĐANG MỞ (`histSectionOpen.single =
  true`) nhưng `switchTab('lookuphistory')` chỉ nạp danh sách phiên (`loadHistBatches`), còn
  lịch sử tra đơn lẻ chỉ được nạp bên trong `toggleHistSection()` — mà hàm đó chỉ chạy khi
  user bấm đóng/mở. Nay `switchTab` nạp luôn nếu mục đang mở; mục đang đóng vẫn KHÔNG nạp
  (giữ thiết kế "chỉ nạp khi mở").
- **Bỏ cờ `histSingle.loaded`** — nguồn gốc lỗi thứ hai: `applyHistDate()` set cờ này ngay cả
  khi mục đang đóng, nên lần mở sau bị chặn không nạp. Giờ mục "Tra cứu đơn lẻ" nạp lại MỖI
  LẦN mở (dữ liệu có thể vừa thay đổi do vừa tra cell mới) — đúng hơn cả về mặt dữ liệu.
- **`hasScope` không còn cấp quyền `admin`**: trước đây nếu chuỗi scope chứa `admin` (hoặc
  bất kỳ chuỗi khớp) thì `hasScope(scopes, 'admin')` trả `true`. Nay chỉ 2 scope của API
  công khai (`lookup`, `account`) mới hợp lệ — API công khai không bao giờ có quyền admin.
- **Xoá `authResultPage` bị khai báo trùng** trong `server.js` (2 bản y hệt).
- **`deleteLookupEntry` dùng biến `r` trong khi biến là `row`** → `ReferenceError` làm popup
  xác nhận xoá lượt tra đơn lẻ không mở được.

### Added
- **Lọc theo trạng thái cell ở tab "Tra cứu danh sách"**: thêm hàng chip trong bộ lọc với 4
  lựa chọn, mỗi chip kèm số dòng:
  - **Tất cả** — mọi dòng của phiên.
  - **Đã tra được** (`found`) — cell đã có toạ độ.
  - **Chưa tra được** (`unpaid`) — chưa trả phí / hết điểm / đang tra (`unpaid`, `pending`,
    `busy` gộp chung, vì cả ba đều là "chưa có kết quả cuối cùng").
  - **Không có kết quả** (`miss`) — đã tra nhưng không nguồn nào có cell.

  Lọc áp **sau** bộ lọc hành động / khoảng ngày / tìm kiếm nên số dòng luôn khớp chip vừa
  bấm. Số trên chip đếm trên **toàn bộ** danh sách phiên (không phụ thuộc bộ lọc khác) để
  người dùng thấy tổng quan trước khi bấm; số này cũng là badge trên nút **Bộ lọc**.
  Đổi/nạp/mở phiên mới tự đưa bộ lọc về **Tất cả**.
  - Dùng container `#clRecordStatusChips`, **không** dùng `#clStatusChips` — id đó đã thuộc
    bộ lọc trạng thái của overlay bảng cell; đặt trùng sẽ làm `getElementById` trả sai phần tử
    và bảng cell mất chip.
  - Trạng thái dòng lấy từ `clRecordState()` (ưu tiên `clAnalyze.results`, rồi trạng thái cell
    do server trả, cuối cùng suy từ quyền xem toạ độ) và chuẩn hoá key bằng
    `canonicalClientKey()` — cell ID ngắn được đổi sang ECI nên nếu so key thô sẽ lệch và mọi
    dòng bị xếp nhầm vào "chưa tra được".

### Added
- **Nút "Tra lại" trên thẻ lịch sử tra đơn lẻ** (`.hist-card--single`, thêm `.hist-card--rat`
  khi có RAT). Chỉ hiện với cell **không tra được** (không có toạ độ); đứng ngay trước nút
  Xoá trong cụm mới `.hist-card-acts`, cùng khuôn icon 12px.
  - Bấm → nút chuyển spinner, thẻ hiện thanh trạng thái `.hist-retry-bar.busy` ("Đang tra
    lại…") **ngay** trước khi gọi API.
  - Tra ra toạ độ → cập nhật `lat/lng/range/radio/source` ngay trên dòng, thanh xanh, toast
    `Đã tra lại — tìm thấy toạ độ.`; tải lại danh sách ⇒ **nút Tra lại tự mất** vì thẻ đã có
    toạ độ.
  - Vẫn không ra → thanh đỏ + toast `Đã tra lại — vẫn không nguồn nào có cell này.`, giữ nút.
  - Hết điểm (HTTP 402) → thanh vàng + toast nêu `điểm/cell · số dư`, **không** đánh dấu là
    "không ra kết quả"; nút Tra lại vẫn còn để tra lại sau khi nạp điểm.
  - Lỗi khác → thanh `fail`, không nhầm với miss. Chống bấm trùng bằng `histRetryBusy`.
  - Khác `lookupCell`: **không** ghi vào form tra cứu / khu kết quả ở tab khác, không nhảy bản
    đồ — kết quả hiện ngay tại thẻ.

### Changed
- **Dòng không có cuộc gọi hiện chính cell ID thay cho nhãn "Cell trong phiên".** Chỗ số điện
  thoại giờ là `log-card-cell` dạng `MCC-MNC-LAC-CELLID` (class thêm `log-card-cell-lead` để
  đậm hơn một chút). Nhãn `calllogs.cellOnly` chỉ còn làm fallback khi dòng không có `cellid`.
- **Bổ sung tra cứu 1 cell ngay trên dòng bản ghi.** Cuối `.log-card-sub` có icon
  `.log-card-go` (chỉ hiện với cell **chưa tra** / **chưa đủ điểm**, tức `unpaid` hoặc
  `pending`; cell đã tra ra hoặc đã xác nhận không có kết quả thì ẩn).
  - Bấm → dòng chuyển `busy` và hiện thanh trạng thái `.log-lookup-bar.busy` ("Đang tra cell
    này…") **ngay**, trước khi gửi API.
  - Tra ra toạ độ → ghi vào `clAnalyze.results` **và** mọi dòng `myLogsCache` cùng cell ⇒ dòng
    tự nhảy sang nhóm "đã tra được", chip đếm lại, bộ lọc trạng thái thấy ngay. Thanh xanh
    "Đã tra được — có toạ độ" + toast báo số điểm đã trừ.
  - Không nguồn nào có cell → state `miss`, thanh đỏ "Không nguồn nào có cell này" + toast.
  - Thiếu điểm → **giữ `unpaid`** (không đánh dấu miss), thanh vàng + toast báo "1 điểm/cell ·
    số dư N điểm"; nút tra cứu vẫn còn để nạp điểm rồi tra lại.
  - Dùng chung `uploadId` của phiên nên server tái dùng kết quả đã trả phí, **không trừ 2 lần**;
    chống bấm trùng bằng `clOneCellBusy`; lỗi mạng khôi phục nguyên trạng thái cũ.
  - Thanh trạng thái tự ẩn sau ~3 giây.
- **Nút lịch nằm CHUNG hàng `.cl-filter-chips`, cùng format icon với các chip khác.**
  - `#clDateBtn` giờ là chip thứ 6 của `#clActionChips` (5 loại hành động + 1 lịch), cùng
    class `.cl-chip` → cùng cao **30px**, cùng `flex: 1 1 0`, cùng bo góc **6px**, cùng trạng
    thái `.active`, **icon-only + tooltip `title`** đúng khuôn các chip hành động.
  - Bỏ hẳn kiểu nút rộng có nhãn chữ (`.cl-date-btn`, `.cl-date-btn-txt`, `.cl-date-btn-caret`).
  - Thay nhãn chữ bằng **chấm đỏ `.cl-chip-dir`** ở góc phải-dưới (đúng chỗ mũi tên hướng của
    chip Gọi/SMS) để báo "đang lọc ngày".
  - Khoảng ngày đang lọc hiện ở dòng riêng `#clDateActive` (chỉ hiện khi có lọc) kèm nút ✕;
    toàn bộ khoảng cũng nằm trong `title` của chip.
  - **Bug popup tụt 84px**: popup từng đặt trong `#clDateRange` mà khối đó có
    `position: relative` → `offsetParent` là chính khối nằm **dưới** hàng chip nên cộng dồn
    khoảng cách. Nay `#clCalPop` đặt trực tiếp trong `.cl-filter-panel` (bỏ
    `position: relative` khỏi `.cl-date-range`) và `positionClCalendar()` canh `top` theo đáy
    thật của `#clActionChips` (+6px), canh lại mỗi lần render và khi cửa sổ đổi bề rộng.
- **Bộ lọc trạng thái cell đồng bộ hiển thị với hàng chip hành động.** `#clRecordStatusChips`
  giờ cùng nhịp hình học với `.cl-filter-chips`: cùng chiều cao **30px**, cùng `gap: 4px`,
  cùng bo góc **6px**, cùng dàn đều `flex: 1 1 0` → 2 hàng chip xếp khít thành một khối lọc.
  Bỏ kiểu "pill bo tròn 999px" lệch tông với hàng trên. Thứ tự panel: **hành động → trạng
  thái → ngày**, hai hàng chip đứng sát nhau.
  - Nhãn rút gọn để 4 chip vừa 1 hàng: `Tất cả` / `Tra được` / `Chưa tra` / `Không KQ`;
    mô tả đầy đủ chuyển vào `title` (`filter.cell*Tip`, có i18n vi + en).
  - Màn hẹp (`≤ 420px`) ẩn nhãn chữ, chỉ còn icon + số.
  - Giữ nguyên bảng màu trạng thái của overlay bảng cell (xanh/đỏ/cam).
- **Card phiên gọn hơn**: bỏ dòng `.cls-meta` (mạng · số cell · số dòng) và icon `.cls-badge`.
  Card giờ chỉ còn tên file + dòng tổng kết + 2 nút **Mở bảng cell cần tra** / **Đóng**. Số
  liệu chi tiết đã nằm ở `#clListSummary` ngay dưới nên hiện lại ở `.cls-meta` là lặp. Dòng
  tổng kết cũng **không còn lặp tên file** khi nằm trong card (đã có ở `.cls-detail`).
- **Cột cell trong danh sách bản ghi hiện ĐẦY ĐỦ `MCC-MNC-LAC-CELLID`** (trước đây rút gọn
  `MCC-MNC-LAC/TAC-CELLID` — LTE/NR đổi nhãn thành `TAC`). CSS `.log-card-cell` cho chiếm trọn
  dòng (`max-width:100%`) để chuỗi dài không bị cắt sớm.
- **Bỏ hoàn toàn "nguồn kết quả tra cứu" khỏi giao diện** (theo yêu cầu): gỡ badge nguồn
  (`.cl-src-badge`) ở bảng cell và danh sách bản ghi, dòng "Nguồn:" trong popup cell, nhãn
  nguồn ở kết quả tra đơn lẻ, icon nguồn ở lịch sử (`histSrcIcon` giờ luôn trả rỗng — giữ hàm
  để chỗ gọi cũ không vỡ), nguồn trong chi tiết bản ghi và hậu tố "· CSDL nội bộ" trong text
  trạng thái. Xoá CSS không còn dùng (`.cl-src-badge*`, `.hist-src-i*`). Server/API vẫn trả
  `source` — chỉ giao diện không hiện nữa.
- **Khoá API không còn gắn tài khoản — key chỉ là cổng kết nối.** Trước đây tạo key phải
  chọn một tài khoản chủ, và mọi lượt tra qua key đều trừ điểm tài khoản đó (một key = một
  người dùng). Nay key **không thuộc ai**: ứng dụng ngoài giữ key để chứng minh được cấp
  phép và chịu hạn mức riêng, còn danh tính — và điểm bị trừ — đến từ JWT của người dùng
  đăng nhập. Một key phục vụ được nhiều tài khoản.
  - Tra cứu cần **cả hai** header: `X-API-Key` (cổng) + `Authorization: Bearer <JWT>`
    (tài khoản). Chỉ gửi key → `401 USER_REQUIRED` kèm `hint: "POST /api/v1/login"`, vì
    server không biết trừ điểm của ai.
  - `auth_type` trong response: `key+jwt` (đủ cả hai) · `jwt` (chỉ JWT, hạn mức riêng theo
    tài khoản) · `key` (không bao giờ dùng được cho endpoint cần danh tính).
  - Scope hiệu lực = **giao** của scope key và scope tài khoản → cấp key hẹp vẫn không vượt
    được quyền của chính người dùng.
  - Trường mới `require_user` (mặc định `1`) trên key: tắt chỉ dành cho endpoint công khai;
    endpoint cần danh tính vẫn trả `USER_REQUIRED` khi thiếu JWT.
  - **Migration `migrateApiKeysToOwnerless()`** — SQLite không bỏ được `NOT NULL`/FK bằng
    `ALTER TABLE`, nên dựng bảng mới và chép dữ liệu, **giữ nguyên `id`** để
    `api_request_logs.api_key_id` còn khớp. `user_id` chuyển thành `NULL`. Idempotent:
    chạy lại không làm gì.
  - Bỏ `owner_username` / `owner_role` / `user_id` khỏi mọi response; thêm `user_count` (số
    tài khoản khác nhau đã dùng key) và `require_user`.
  - **Trang admin**: bỏ ô chọn "Chủ sở hữu", thay bằng công tắc **Bắt buộc đăng nhập**; cột
    thứ 3 đổi tên thành **Đăng nhập** hiện `bắt buộc` / `không cần`. Tab Tài liệu viết lại:
    mẫu cURL 4 bước dùng cả 2 header, bảng lỗi thêm `USER_REQUIRED`.
  - **`API.md` viết lại** theo mô hình cổng + JWT; ví dụ Node.js/PHP/Python đều đăng nhập lấy
    JWT rồi gửi kèm key. Ghi rõ: không nhúng key vào JS trình duyệt, không dùng chung JWT
    giữa các người dùng (JWT là nguồn trừ điểm).
- **Tổng kết phiên chuyển vào trong card phiên** (tab Tra cứu danh sách): `#clListSummary`
  rời khỏi `#clRecordsBlock` để nằm ngay trong card `#clSessionCard`, dưới tên file — đúng
  chỗ của phiên đang làm việc thay vì một dải riêng phía trên danh sách. Nội dung giữ
  nguyên: số bản ghi · số cell có kết quả · không ra · chưa tra. Hai nút **Mở bảng cell cần
  tra** và **Đóng** giữ nguyên vị trí bên phải card.
  - Trong card, tổng kết bỏ nền/viền riêng (card đã có khung) và **ẩn tên file** vì tên đã
    hiện ở `.cls-detail` ngay trên — tránh lặp.
  - `syncClLoadUi()` nay cập nhật luôn tổng kết khi card hiện; trước đây phần tử mang sẵn
    `display:none` nên nếu chỉ chuyển chỗ mà không nạp lại thì card hiện mà tổng kết vẫn ẩn.
- **Thêm nút "Mở trên Google Maps" cạnh icon copy toạ độ** trong popup thông tin cell: cặp
  icon `.cell-coord-acts` (copy + `fa-map-location-dot`) đứng cạnh nhau sau toạ độ. Bấm mở tab
  mới `https://www.google.com/maps/search/?api=1&query=<lat>,<lon>` với
  `window.open(url, '_blank', 'noopener,noreferrer')`. Helper dùng chung
  `coordActionIcons(lat, lon)` + `openInGoogleMaps(lat, lon)` nên áp cho **mọi** chỗ hiện toạ độ:
  popup marker bản đồ (`buildCellPopupHtml`), kết quả tra đơn lẻ, ô toạ độ ở bảng cell, dòng
  chi tiết bản ghi (`clRecordDetailHtml`), và popup lịch sử chuyển động. Icon có
  `event.stopPropagation()` để không đóng popup/card, kèm `role`/`aria-label`/`title`.
- **Bấm toạ độ trên bản đồ của cell tra ĐƠN LẺ → popup chi tiết đầy đủ** (giống tra theo
  danh sách): MCC-MNC-LAC-CellID, eNB/Sector/ECI, công nghệ mạng (màu theo RAT), nguồn dữ
  liệu (chỉ admin), bán kính, toạ độ + nút copy, địa chỉ cell. Trước đây `highlightCellOnMap`
  chỉ bind một nhãn chữ nên bấm vào cell không xem được gì.
  - `highlightCellOnMap(lat, lon, range, radio, label, info)` nhận thêm `info` và dựng popup
    bằng `buildCellPopupHtml()` — dùng chung builder với marker tra theo danh sách.
  - Bind popup cho **cả pin và đường tròn bán kính** → bấm vùng nào cũng mở chi tiết.
  - Áp dụng cho 3 đường: dòng ở Lịch sử tra đơn lẻ (`histOpenOnMap`), dòng bản ghi ở tab
    "Tra cứu danh sách" (`openClRecordOnMap`, kèm danh sách lần gọi/SMS cùng cell), và dòng
    ở ô tìm kiếm cell (`openCellSearchResult`). Hai handler sau thay cho `onclick` nhồi tham
    số, dữ liệu lấy từ map `clRecordRows` / `cellSearchRows`.
- **Sửa lỗi `ReferenceError` trong `deleteLookupEntry`**: dùng biến `r` trong khi biến là
  `row` → popup xác nhận xoá lượt tra đơn lẻ bị lỗi trước khi mở.
- **Popup `?` bám theo panel**: bề rộng = bề rộng panel trừ lề 8px mỗi bên, **canh giữa panel**
  (đo thật: panel 340 → popup 324, khe 8/8; kéo panel lên 520 → popup 504, vẫn cân). Tự đặt lại
  vị trí khi panel đổi bề rộng hoặc cửa sổ resize. Nội dung dài thì cuộn bên trong, không tràn
  viewport.
- **Popup lịch nằm SÁT icon lịch**: cách đáy nút 2px, mép phải popup trùng mép phải nút (đo thật
  `topGap: 2`, `rightAligned: true`).
- **Sửa lỗi toạ độ popup trong panel**: `#sidebar` là `position: fixed` nên nó trở thành
  containing block của phần tử con `position: fixed` → popup bị lệch đúng 48px theo trục dọc.
  Hai popup (`showHelpPopup`, `histDatePopup`) nay được gắn vào `<body>` trước khi đặt toạ độ.
- **Tab "Lịch sử tra cứu" thành accordion**: mục **Tra cứu đơn lẻ** lên trên, **mở sẵn**; mục
  **Tra cứu danh sách** xuống dưới, **đóng mặc định**. Mục đang mở chiếm hết chiều cao panel
  (`.hist-sub.is-expanded`, danh sách tự cuộn, pager ghim đáy); mục đang đóng chỉ còn dòng
  tiêu đề (33px). Mở mục này thì mục kia **tự đóng** (`toggleHistSection` đặt
  `histSectionOpen[other] = false`, vẽ lại qua `renderHistSections()`), nên 2 danh sách không
  bao giờ mở cùng lúc.
- **Mọi nút xoá trong app dùng popup xác nhận tự dựng** (`#confirmModal` / `openConfirmDialog()`
  → `Promise<boolean>`) thay `window.confirm()` của hệ điều hành: có tiêu đề + icon, mô tả,
  khối **cảnh báo nguy hiểm** (đỏ), khối **ghi chú** (xanh), **chi tiết đối tượng sẽ xoá**
  (tên file / mạng / số cell / số bản ghi / toạ độ / thời gian) và 2 nút Huỷ / Xoá vĩnh viễn.
  Đóng bằng Esc, bấm nền mờ hoặc nút Huỷ — cả 3 đều trả `false` (không xoá). Áp dụng cho:
  xoá 1 lượt tra đơn lẻ (`deleteLookupEntry`), xoá 1 phiên tra theo danh sách
  (`deleteCallLogSession`, cảnh báo riêng "điểm đã trừ KHÔNG hoàn lại" khi phiên đã tra cell),
  xoá toàn bộ dữ liệu rút list (`resetCallSession`).
- **Tab "Xem rút list" đổi tên thành "Tra cứu danh sách"** (`tab.callLogs`, cả vi + en).
- **Chọn mạng + nạp file chỉ hiện ở bước đầu**: khi phiên đã có danh sách cell, khối upload
  được thay bằng **card phiên đang làm việc** (tên file, mạng, số cell, số dòng) với nút
  **Đóng** (`#clSessionCloseBtn` → `closeClSession()`) — bấm Đóng để quay lại giao diện
  chọn mạng + upload. Danh sách bản ghi/bộ lọc bên dưới cũng ẩn khi chưa có phiên.
- **Phiên được lưu ngay khi nạp file** (không chờ bấm Tra cứu): `uploadCallLogAnalyze` gọi
  `ensureCallLogSession()` với danh sách cell đầy đủ → mọi phiên (kể cả đã đóng, chưa tra
  cell nào) đều nằm trong **Lịch sử tra cứu**. Đóng phiên chỉ dọn màn hình + `sessionStorage`,
  toạ độ đã trả phí được gửi nốt (`flushCallSessionResolved()`) trước khi dọn.
- **Nút `?` hướng dẫn ở tra cứu đơn lẻ** (`#cellHelpBtn` cạnh tiêu đề "Tra Cứu Cell ID"):
  hướng dẫn nhập MCC/MNC/LAC/CellID, sector/công nghệ, cách đọc kết quả, ô "Tìm Kiếm Cell"
  miễn phí, và lưu ý về dữ liệu/điểm. Popup hướng dẫn dùng chung `showHelpPopup()` (neo theo
  nút, tự lật lên trên khi tràn viewport) cho cả 2 tab.
- **Soạn lại nội dung hướng dẫn tab "Tra cứu danh sách"**: 6 bước (chọn mạng → nạp file →
  tích cell → tra cứu → đóng/nạp file khác → mở lại ở Lịch sử) + mục "Đọc file" giải thích
  định dạng, cách chọn mạng, thời điểm trừ điểm, và việc phiên được lưu từ lúc nạp file.
- **Nạp Excel ngay trong tab "Xem rút list"** (bỏ bước mở popup): đầu tab có ô chọn mạng
  rồi khung upload — bấm vào khung là mở hộp chọn file (input phủ toàn khung), kéo-thả vẫn
  dùng được. Nạp xong mở thẳng **Bảng cell cần tra**; lỗi/đọc file hiện trạng thái ngay trên
  khung. Bỏ bước `pick`/`busy` khỏi overlay `#clTableOverlay` (chỉ còn bảng), bỏ nút
  "Load Excel" và nút "Chọn file Excel" trên header overlay. Các nội dung khác (bộ lọc,
  danh sách bản ghi, chọn cell, tra cứu, bản đồ, Lịch sử) giữ nguyên.
- **Bỏ nút "Hướng dẫn"** ở tab: nội dung hướng dẫn (guide1..7) + giải thích định dạng file /
  tính điểm nằm trong popup của nút `?` cạnh ô chọn mạng.
- **Chọn mạng gọn lại 1 hàng**: radio + logo chữ cái → `<select>` native (`#clNetSelect`)
  hiển thị **logo thật** của mạng (`public/img/net/`: viettel/mobifone/vinaphone `.svg`,
  vietnamobile/gmobile `.png`), tên mạng, mũi tên; mạng chưa hỗ trợ bị khoá trong list.

### Fixed
- **Khôi phục `public/index.html`** bị hỏng encoding (ký tự tiếng Việt thành `?`/control char) và
  thừa 1 thẻ `</div>` làm vỡ layout panel trái. Lấy lại bản sạch từ commit `0f548dd5`, sau đó
  áp lại toàn bộ thay đổi của đợt này (tab đổi tên, card phiên + nút Đóng, select chọn mạng
  có logo thật, nút `?` tra cứu đơn lẻ). Đã kiểm tra: 0 ký tự hỏng, số `<div>` mở/đóng khớp
  (151/151), `_uxtest.js` 606/606 pass.
- **Tra cứu danh sách Excel nhanh hơn nhiều**: `POST /api/cells/resolve-batch` phase 1
  (tra CSDL nội bộ) không còn 1 query/cell `await` tuần tự. Gom mọi khoá của lô vào
  ít câu `SELECT ... WHERE (lac, cellid) IN (VALUES (?, ?), ...)` (400 khoá/câu) —
  đo trên DB thật 251k dòng: 600 cell = **~170 ms / 2 câu** thay vì 600 lượt query
  (mỗi lượt `lac = ? AND cellid = ?` mất 30-50 ms do `lac`/`cellid` là TEXT nên không
  dùng được unique index khi thiếu `mcc`). Đã loại các cách full-scan
  (`lac IN (...)`, `cellid % 100`, `mcc IN (...)`).
  - `prefetchLocalRows()` + `pickLocalRow()` + `probeMissingLocally()` (fallback cho
    cell lẻ / khác dạng MNC-lac) trong `server.js`.
  - `loadLocalRowIndex` không dùng nữa; thêm index `idx_call_log_batches_batch`,
    `idx_lookup_history_user_batch` (`database.js`).
  - Đo thời gian từng pha khi cần: đặt env `CT_DEBUG_RESOLVE=1` (mặc định tắt).
  - Cell đã có trong CSDL nội bộ hiện toạ độ NGAY trên bảng sau khi nạp file
    (`clApplyLocalHints`, trạng thái `local`, miễn phí) — không phải chờ bấm Tra cứu.
- **Sửa lỗi tính điểm khi tra lô**: dedup "đã trả phí" dùng khoá physical cell
  (`chargeKey`: mcc-mnc-lac-cellid gốc) thay vì alias ECI — trước đây ECI của cell
  hàng xóm trùng chuỗi alias nên cell thật bị coi là đã trả phí và **không bị trừ
  điểm**. Cell trả lại từ memo mang cờ `reusedCharge` nên không bị trừ lần 2.

### Added
- **Tab Lịch sử có mục "Tra cứu danh sách (Excel)"**: mỗi lần bấm Tra cứu ở bảng cell
  (đã trừ điểm) hiện ngay 1 dòng — tên file, thời gian, tổng cell / số cell ra toạ độ,
  phân trang, lọc theo `#histDate`. Bấm dòng = vẽ lại cell trên bản đồ;
  nút bảng = mở lại bảng cell (cell đã trả phí hiện sẵn, không trừ điểm lại).
  - `#histBatchList` trong `#histPaneSingle`, i18n `hist.batchSection/singleSection/
    openTable/batchEmptyHistory` (vi+en), `loadHistBatches()/renderHistBatches()`.
  - `resolveClSelected()` làm mới danh sách này nếu tab Lịch sử đang mở.
- **Kéo giãn panel trái (sidebar)**: tay kéo `.sidebar-resizer` bám mép phải panel, kéo ngang
  để đổi độ rộng `--sidebar-width` (min `260px`, max `720px` / chừa tối thiểu `360px` cho
  bản đồ). Độ rộng lưu `localStorage['sidebarWidth']`, khôi phục lại khi mở trang.
  - Nháy đúp tay kéo (hoặc `Home`) để đặt lại mặc định `340px` và xoá key đã lưu.
  - Hỗ trợ bàn phím: `ArrowLeft`/`ArrowRight` đổi 20px/lần; tay kéo có
    `role="separator"` + `tabindex="0"`.
  - Hỗ trợ cảm ứng (`touchstart`/`touchmove`).
  - `applySidebarWidth()` cập nhật **cả** `--sidebar-width` **và** `--sidebar-collapsed`
    (thay vì hardcode `-340px`) nên thu gọn luôn đẩy panel ra ngoài đúng bề rộng hiện tại.
  - Gọi `map.invalidateSize()` sau khi thả chuột và sau transition thu gọn/mở (320ms).
  - Cửa sổ nhỏ lại thì tự clamp độ rộng về khoảng hợp lệ.
  - i18n vi+en: `sidebar.resize`, `sidebar.resizeReset`, `sidebar.widthSaved`.
- **Popup full-window "Nạp Excel → bảng cell" (CHỈ ĐỌC, không tốn phí)**: nút trên topbar
  mở overlay toàn màn hình 3 bước (nạp file → xem bảng cell dedup → tra điểm & vẽ map).
  Endpoint mới `POST /api/call-logs/analyze` (`requireAuth`, `multer` memory/disk tạm,
  xoá file trong `finally`) parse workbook **trong RAM**, gom cell bằng
  `excelParser.aggregateCellsFromRecords()` với cùng `canonicalKey`/`inferRadio`/
  `radioConfident` như `/api/cells/resolve-batch` nên **số dòng bảng = đúng số cell sẽ hỏi nguồn**.
  - **Không ghi DB, không trừ điểm, không đốt quota nguồn online**: chỉ `SELECT ... FROM cells`
    theo `lac` (kèm `lat IS NOT NULL`) để gắn sẵn `localLat`/`localLon`/`localRange` cho cell
    đã có trong CSDL nội bộ; điểm chỉ bị trừ khi user bấm "Tra cứu" (→ `/api/cells/resolve-batch`).
  - Bảng hiển thị mỗi cell 1 dòng: LAC/Cell ID/Sector, RAT (`radio`; mơ hồ hiện `?` khi
    `radioConfident === false`), số dòng dữ liệu, khoảng thời gian, số liên hệ, địa chỉ,
    trạng thái toạ độ nội bộ. Sort mọi cột + chọn từng dòng/chọn tất cả.
  - `radioConfident` giữ nguyên luật "không đoán bừa": `radio = ''` (UI hiện `?`) khi
    cellid ngắn (≤ 2^20) mà không có sector/`radioHint`.
  - i18n vi+en cho toàn bộ nhãn/nút/thông báo của popup.
- **Nguồn online `google` (Google Geolocation API)**: nguồn thứ 5 trong chuỗi tra online.
  Google **không tra theo từng cell** mà trả **1 toạ độ ước lượng cho cả tập cell**
  (multilateration), nên nguồn này chạy **SAU** mọi nguồn per-cell và **chỉ nhận các cell đã
  miss hết nguồn khác**; các cell miss được gom thành nhóm ≤ `max_google_per_batch` (mặc định
  `10`) → **1 request/nhóm**, toạ độ trả về gán **chung** cho mọi cell trong nhóm với
  `range = accuracy` do Google báo. Mặc định **TẮT** (tốn phí theo request) — admin phải bật
  và nhập API key trong **Cell ID Database → Nguồn Online** (key lưu bảng `data_sources`,
  fallback env `GOOGLE_MAPS_API_KEY`).
  - Request: `{ homeMobileCountryCode, homeMobileNetworkCode, radioType, considerIp: false, cellTowers[] }`.
    `considerIp: false` là **bắt buộc** — nếu để `true`, khi cell không đủ dữ liệu Google trả
    toạ độ theo **IP của server**, tức toạ độ rác đúng định dạng sẽ lọt geo gate và ghi bẩn bảng `cells`.
  - `cellId` uint32: LTE lấy dạng ECI (long) qua `cellIdCandidates`; cell vượt range bị **loại
    khỏi mảng** (gửi kèm sẽ làm cả request 400 và mất luôn các cell hợp lệ khác). NR gửi
    `newRadioCellId` (uint64) và **không** gửi `cellId`; GSM/CDMA thiếu LAC hợp lệ (0..65535) bị loại.
  - Lỗi 400 (request sai) / 403 (key hoặc billing) / 429 (hạn mức) và response thiếu `location`
    đều coi như **miss** (fail-soft, chuỗi nguồn không sập); toạ độ ngoài khung MCC vẫn qua
    geo gate → không ghi DB. Không cấu hình key → **không gọi mạng**.
  - Setting mới `max_google_per_batch` (mặc định `10`, trần `1e5`) chỉnh trong
    **Cấu hình → Chung**; admin UI thêm option nguồn, hint cảnh báo tốn phí + link bật
    Geolocation API/billing, badge `google` trong bảng CSDL.
- **Tra lần lượt khi thiếu điểm + thông báo 3 số**: nạp Excel mà số điểm không đủ tra cả
  danh sách thì tra **tuần tự từ đầu đến cuối** — 1 cell ra kết quả = trừ 1 điểm, dừng khi
  hết điểm. Server gán `results[].charged` theo **thứ tự** (chỉ `affordable` cell found ĐẦU
  TIÊN được trả phí) và **ẩn toạ độ** cell found vượt số dư (`lat/lon/range = null`,
  `unpaid:true`) → không rò kết quả chưa trả phí ở tầng server, không phụ thuộc client.
  Thông báo kết quả (`#clCreditNotice`) hiện đủ **3 số**:
  `Đã tra {f}/{n} cell — trừ {c} điểm · {m} cell không ra kết quả · còn {z} cell chưa tra (hết điểm)`
  (i18n vi+en). Server trả thêm `credit.found`, `credit.missed`, `credit.unpaid`.
  Client tích luỹ `found`/`missed`/`unpaid` qua các vòng, bỏ qua cell `unpaid` khi cập nhật
  `myLogsCache` (để lại chờ nạp điểm rồi tra tiếp).

### Changed
- **Tra cứu bảng cell: tra được một phần thay vì chặn khi thiếu điểm**: trước đây số dư
  không đủ cho **cả** danh sách thì nút "Tra cứu" bị chặn ngay, không tra được gì. Nay luật là
  **"còn đủ giá 1 cell thì cho chạy"**:
  - `clCanStartQuote(q)` (`public/app.js`) trả `false` **chỉ khi** bật chế độ điểm mà
    `balance < giá 1 cell`; thiếu tổng vẫn `canStart = true`.
  - `resolveClSelectedClick()` hết điểm → toast đỏ `calllogs.confirmNoCredits` +
    mời nạp điểm; thiếu tổng nhưng còn điểm → toast info `calllogs.notEnoughTotal` (nêu
    số cần / số còn) rồi **vẫn mở** modal xác nhận.
  - Modal xác nhận (`openClConfirmResolveModal`) và footer (`renderClSheetResolve`) dùng
    `canStart` để disable nút (thay `enough`), chỉ khi hết điểm mới đổi nút thành "Nạp điểm";
    banner tách 2 mức (info `notEnoughTotal` / cảnh báo `confirmNoCredits`) kèm ghi chú
    "tra tới khi hết điểm rồi dừng".
  - `resolveClSelected()` có lưới an toàn `outOfCredit()` (số dư tụt dưới giá 1 cell giữa
    chừng) → dừng vòng, gắn `stoppedNoCredit` và toast `calllogs.stopNoCredit`; các cell còn
    lại giữ `state: 'unpaid'` để tra tiếp sau khi nạp điểm.
  - `updateClResolveNowBtn()` đếm cell chưa tra **từ bảng đang mở** qua `clUnpaidCount()`
    (bỏ cell `found`/`miss`) thay vì `countResolveNeeded()` suy từ `myLogsCache`.
- **Tab Lịch sử chỉ còn danh sách tra cứu đơn lẻ**: bỏ tab con `#histTabBatch` (phiên rút
  list trùng chức năng với tab "Xem rút list"). `histKind` cố định `'single'`;
  `setHistKind()`/`renderHistKind()` chỉ nạp `loadLookupHistory()` và ẩn pane batch —
  pane này chỉ còn lời nhắn + nút `switchTab('calllogs')` (i18n `hist.batchMoved`,
  `hist.openCallLogs`). `switchTab('lookuphistory')` không còn gọi `loadCallLogSessions()`;
  xoá `onHistBatchDateChange`/`clearHistBatchDate` (giữ stub `syncHistBatchDateClear` cho
  HTML cũ) và mọi id `histBatch*`.
- **Pager + danh sách phiên rút list chuyển về tab "Xem rút list"**:
  `#clSessionPicker` (số phiên + trang + nút mở `#clSessionsList`), `toggleCallLogSessionList()`
  và `updateClSessionsPager()` trỏ `#clSession*`; `loadCallLogSessions()` bỏ filter ngày
  (danh sách phiên gộp toàn bộ). i18n `hist.prevPage`/`hist.nextPage` dùng chung.
  `renderCurrentSessionBar()` bỏ nút xoá (xoá phiên nằm trong danh sách phiên).

### Removed
- **Nút xoá từng bản ghi trong `#logRecordList`**: bỏ `delBtn` + `deleteCallLog()`
  (`DELETE /api/call-logs/:id` không còn được gọi từ UI) — xoá theo phiên nằm ở danh sách phiên.
- **Nút "Hiển thị tất cả trên bản đồ" ở footer bảng cell**: bỏ `#clMapAllBtn`,
  `plotClTableOnMap()` và i18n `calllogs.mapAllBtn`/`mapAllDone`/`mapAllPartial`; muốn xem
  trên bản đồ thì dùng tab "Xem rút list" (đã tự vẽ marker).
- **Cột Sóng dạng text trong bảng cell**: thay bằng badge RAT màu (`clRadioBadgeHtml`,
  bảng `RADIO_STYLE`), hiện `?` khi `radioConfident === false`. Dòng trạng thái thêm icon
  (`clStatusIconHtml`) + badge nguồn (`csdl`/`online`). CSS mới `.cl-radio-badge`,
  `.cl-src-badge`, sọc dòng chẵn và cột # gọn hơn.

### Fixed
- **Nạp Excel → bấm "Tra cứu" nhưng không có phiên trong tab "Xem rút list"**:
  server chỉ tạo dòng `call_log_batches` khi có bản ghi call-log, nên file chỉ tra toạ
  độ (không có cuộc gọi) không hiện ở đâu cả; `POST .../cells` còn trả `404 batch not found`.
  - Route mới `PUT /api/call-log-sessions/:batchId` (`requireAuth`) upsert metadata phiên
    (`file_name`, `network`, `row_count`, `cell_count`) — idempotent theo `batch_id`, **không
    đụng `resolved_cells`**, **không trừ điểm**, trả `403` nếu batch thuộc user khác.
  - Cột mới `call_log_batches.cell_count` (`ALTER TABLE` idempotent + backfill số cell duy
    nhất cho phiên cũ); `GET /api/call-log-sessions` trả thêm `cell_count`.
  - Client `ensureCallLogSession()` gọi **trước** vòng `resolve-batch` trong `resolveClSelected`
    (file được nạp mà chưa tra vẫn không tạo phiên — đúng thiết kế), `clFlushResolvedCells`
    tự đăng ký lại 1 lần khi gặp lỗi (không mất toạ độ đã trả phí); `clSessionCellTotal`
    fallback `cell_total → cell_count → row_count`; tab "Xem rút list" tự nạp lại danh sách
    phiên khi mở (`clRefreshSessionsIfVisible`).
- **Không xem được toạ độ vừa tra trên bản đồ**: thêm nút `#clMapResultsBtn` ("Xem N toạ độ
  trên bản đồ") ở footer bảng cell, chỉ bật khi có cell `found` (`updateClMapResultsBtn`
  trong `renderClTableSummary`). `clPlotResultsOnMap()` chỉ đưa cell `state === 'found'`
  (kèm `_charged`) sang `myLogsCache`, đóng bảng và vẽ lại danh sách — không lộ cell
  `unpaid`/`miss`. i18n: `calllogs.mapResults`, `calllogs.mapNone`.
- **Bản đồ căn giữa bỏ qua panel trái (cell nằm sau sidebar)**: helper mới
  `mapSidebarWidth()` (0 khi panel thu gọn), `mapVisiblePad()` (`paddingTopLeft` chừa
  `--sidebar-width`), `fitBoundsVisible()`, `centerOnVisible()` (dịch tâm sang trái nửa bề
  rộng panel qua `map.project`/`unproject`). Đã wire vào `plotCallLogs`,
  `histOpenBatchOnMap`, `highlightCellOnMap`, `showCellOnMap` và nút "Vị trí của tôi".
- **Danh sách bản ghi `#logRecordList` chưa gọn/khó quét mắt**: thay inline style bằng card
  `.log-card` (viền trái theo trạng thái `found`/`locked`/`miss`/`pending`, sọc chẵn lẻ,
  hover), dùng lại `clRadioBadgeHtml` / `.cl-row-status` / `.cl-src-badge` / `clCellShort`,
  bỏ `lastBatch` chết. Thêm i18n `calllogs.partner`.
- **Bảng cell cần tra: cột nhảy / cell dài dòng + panel không kéo giãn được khi bảng mở**:
  - Cột bảng chuyển sang **auto-fit**: `.cl-col-*` không còn `width` cứng (`190px`, `210px`…)
    mà `width: 1%` + `min-width` (đủ chữ), riêng `.cl-col-addr` `width: 100%` để ăn phần dư;
    `.cl-tbl-addr` xuống ellipsis theo cột thay vì `max-width: 220px`. `<colgroup>` sinh từ
    `CL_TBL_COLS` (thêm khoá `col`) nên không lệch giữa header và `<col>`.
  - Cột **Cell** gọn 1 dòng `MCC-MNC-LAC/TAC-CELLID` (`clCellShort()`, LTE/NR dùng nhãn `TAC`,
    còn lại `LAC`); cell dạng ECI (id dài) có thêm dòng phụ `eNB · sector` cỡ nhỏ.
  - Khi bảng cell mở, **tay kéo panel vẫn dùng được**: `syncSidebarResizeBlock()` giờ chỉ
    `blocked` cho `.modal-overlay.show` / `.legend-panel.show`; riêng `.cl-fullsheet.show` thì
    gắn `.sidebar-resizer.over-sheet` (`z-index: 4950` > overlay `4900`, `pointer-events: auto`)
    — handle nổi trên overlay, vạch mép panel vẫn hiện.
- **Mất toạ độ đã trả phí / bị trừ điểm lần 2 khi đóng tab ngay sau khi tra**:
  - Client: `clResolvedCellsForSave(batchId)` chỉ lấy toạ độ `state=found` của bảng đang mở và
    **bỏ `myLogsCache`** (dữ liệu mở từ Lịch sử tra cứu, `_fromHistory`, không thuộc phiên đang
    mở không còn bị nhét vào `resolved_cells`). Batch của bảng khác phiên đang mở → không gửi.
  - `saveCallSessionResolved(batchId, { flush: true })` + `flushCallSessionResolved()` gọi ngay sau
    mỗi vòng tra, khi **bấm X đóng bảng**, và trên `pagehide` / `beforeunload` /
    `visibilitychange=hidden` (đăng ký trong `initCallSessionResolvedFlush()`) → không bị mất bởi
    debounce 800ms.
  - `clLoadBatchCells()` trả `{ cells, resolvedCells, fileName, network, totalRows, batchId }`;
    `clCellsFromSource()` ghép `resolvedCells` thành `state=found` (cell đã trả phí không hiện
    "chưa tra" kể cả khi `lookup_history` đã mất).
  - Server: `POST /api/cells/resolve-batch` đọc **thêm `call_log_batches.resolved_cells`** vào
    `chargedBefore` (cùng `cellAliasKeys`) → cell đã trả phí trong phiên được trả toạ độ lại
    **miễn phí** dù `lookup_history` trống; nhánh fallback của
    `GET /api/lookup-history/batch/:batchId/cells` trả kèm `resolvedCells`.
- **Handle kéo giãn panel trái nuốt chuột khi overlay đang phủ**: `.sidebar-resizer` là `position:absolute` **trong** `.sidebar` nên khi mở overlay toàn màn hình (bảng cell cần tra `.cl-fullsheet.show`, modal, panel chú thích) nó vẫn nằm trên cùng ở mép phải panel và **vẫn nhận `mousedown`** — chuột rơi vào 6px mép trái màn hình bị nó nuốt nên không bấm/kéo được thứ phía trên/dưới. Nay `syncSidebarResizeBlock()` gắn class `.sidebar-resizer.blocked` (`pointer-events: none`) mỗi khi có `.cl-fullsheet.show` / `.modal-overlay.show` / `.legend-panel.show`, `initSidebarResizeBlock()` theo dõi bằng `MutationObserver` (class của `body` + các overlay) và theo `window.resize` để bật/tắt lại ngay. `initSidebarResizeBlock()` chỉ tạo `MutationObserver`
  khi môi trường có (guard `typeof MutationObserver === 'function'`) — trước đó test chạy `app.js`
  trong `node:vm` không có DOM thật bị `ReferenceError: MutationObserver is not defined` ngay khi nạp script.
- **Mất nút "Xoá phiên" khi mở lại phiên rút list từ tab Lịch sử**: `currentCallLogBatchId()`
  loại mọi bản ghi có `_fromHistory` (di chứng từ v2.6 khi nút xoá nằm ở header từng nhóm batch,
  còn bản ghi lịch sử tra cứu hàng loạt thì không xoá được) → mở phiên từ khối **Phiên rút list**
  trả về `''` nên dòng `#clCurrentSession` bị ẩn cùng nút xoá. Nay có biến `currentOpenBatchId`
  lưu `batch_id` của phiên đang xem (ưu tiên hơn suy từ rows), `openCallLogSession()` giữ nguyên
  `batch_id` trong từng row, và `currentCallLogBatchId()` không còn loại theo `_fromHistory`.
  Phiên lịch sử của phiên rút list vẫn xoá được đúng batch; dữ liệu phục hồi từ **lịch sử tra cứu
  hàng loạt** (`lookup_batches`) thì cố ý KHÔNG gán `currentOpenBatchId` để không gọi API xoá nhầm.
  `currentOpenBatchId` cũng được lưu vào phiên `sessionStorage` nên F5 vẫn giữ nút xoá.
- **Nguồn online miss trong im lặng — admin không biết vì sao "bật nguồn mà không ra dữ liệu"**:
  mọi `catch` trong chuỗi nguồn per-cell (`/api/cells/resolve` + `/api/cells/resolve-batch`) đều
  bỏ qua lỗi không lưu vết, và log chỉ ra `console.warn` (không ghi file). Nay mỗi lỗi được ghi
  vào bộ nhớ per-nguồn (`noteSourceError`/`clearSourceError`, giữ 1 entry/nguồn, cắt 300 ký tự)
  và `GET /api/sources` trả thêm `last_error` + `last_error_at` — bảng **Nguồn Online** hiện cột
  **"Lỗi gần nhất"** (badge đỏ + message) nên thấy ngay ca thật đã gặp: Google trả
  `403 PERMISSION_DENIED: You must enable Billing on the Google Cloud Project`. Lỗi cũ được
  **xoá** khi nguồn tra thành công (không hiện cảnh báo sai).
- **`?debug=1` cho admin khi miss single resolve**: `GET /api/cells/resolve?...&debug=1` trả thêm
  `debug.sources[<type>] = { key: 'set'|'missing', lastError, lastErrorAt }` để biết nguồn nào thiếu
  key / đang lỗi gì mà không phải mò log. **Chỉ admin** nhận được (user thường không có `payload.debug`).
- **Google Geolocation gửi `cellId` bịa cho cell ID dạng short (eNB) thiếu sector**: `googleTower`
  lấy `cellIdCandidates(cellid, sector)[0]`; với id short (≤ 2^20) không sector, candidate đầu là ECI
  **dựng** bằng `enbToEci(id, 0)` — tức bịa sector 0, Google sẽ trỏ trạm khác hoặc miss và có thể
  ghi **nhầm toạ độ** vào bảng `cells`. Nay cell short **không có sector hint** bị **loại khỏi request**
  (tower rỗng → không gọi mạng, ghi `last_error` giải thích); có sector hint thì vẫn dựng ECI và gửi
  bình thường. `googleTower` cũng nhận tham số `reason` để message lỗi nêu đích danh cell bị loại
  (vd `cellid 662091 là eNB short, thiếu sector để dựng ECI`) thay vì "không có cell hợp lệ để gửi".


  (GET `/api/call-logs`) gán sẵn `lat/lon` cho cell có trong bảng `cells`, mà
  `countResolveNeeded()` lại bỏ qua mọi dòng đã có toạ độ → cell local không bao giờ được gửi
  lên `/api/cells/resolve-batch` → tra ra kết quả nhưng **không có bút toán trừ điểm**.
  `countResolveNeeded()` giờ chỉ bỏ qua dòng mở từ Lịch sử (`_fromHistory`) và dòng đã trả phí
  trong phiên (`_charged`) — **cell local vẫn tính điểm** (luật: tra ra kết quả là trừ điểm,
  không phân biệt nguồn).
- **Nút "Đóng" lộ toạ độ cell chưa trả phí**: `skipClResolve` cũ tắt cờ hoãn rồi vẽ hết →
  cell có sẵn trong CSDL hiện marker dù chưa trừ điểm (cảm giác "tra miễn phí"). Nay điều kiện
  "được xem" là **bền**: `canViewRecord(r)` = có toạ độ **và** (`_charged` hoặc `_fromHistory`).
- **Rò toạ độ cell chưa trả phí qua nhiều đường khác**: sau khi hết điểm, cell vẫn hiện toạ độ
  khi click dòng trong panel, bấm **Hiển Thị Bản Đồ**, đổi trang/lọc, hoặc bấm **Xem lịch sử**
  (play). Nay `canViewRecord` áp dụng đồng nhất ở `plotCallLogs`, `renderCallLogs` (chặn
  `onclick` highlight), `playCallLogs`, `updatePlayBtn`, `updateCallSessionUi`; dòng chưa trả
  phí hiện icon khoá thay vì icon vị trí.
- **Trừ điểm 2 lần cho cùng cell sau F5**: cờ `_charged` là trạng thái phiên, server không lưu →
  sau khi `loadCallLogs()` nạp lại rows từ server là mất. Thêm `restoreChargedFlags()` khôi phục
  `_charged` từ `sessionStorage` (so khớp canonical key) ngay sau khi nạp.
- **Nạp điểm xong vẫn không tra cứu được**: (1) `renderClConfirm` chỉ gọi
  `Auth.refreshCreditBalance()` khi cache **null** → số dư cache cũ (0) giữ nút "Đồng ý tra cứu"
  ở trạng thái `disabled` dù đã nạp tiền; nay **luôn** refresh (fallback cache khi lỗi mạng) và
  tự tính lại khi cửa sổ focus lại (`focus` + `visibilitychange`) — đúng luồng quay về từ
  `/topup.html`. (2) Sau khi rời trang (đi nạp tiền) popup xác nhận **không tự mở lại** nên
  user không còn đường bấm tra; thêm nút cố định **`#clResolveNowBtn` ("Tra cứu ngay")** ở
  `.cl-topbar` — chỉ hiện khi còn cell chưa trả phí, kèm số cell (`updateClResolveNowBtn()`
  gọi trong `renderCallLogs`). (3) `showResolveResult` tự mở `#callLogFilterPanel` để user luôn
  thấy thông báo đã trừ bao nhiêu điểm / còn bao nhiêu cell (panel trước đây đóng thì thông báo
  bị ẩn).

### Changed
- **Server trả cờ `charged` theo từng cell**: `POST /api/cells/resolve-batch` thêm
  `results[].charged = !!historyItems[i].found` → client biết cell nào đã tính phí trong phiên
  (miss không tính tiền). Client đọc cờ này để đánh dấu `_charged` và có helper `keyToCell(key)`
  tách key `mcc-mnc-lac-cellid` thành object cell.
- `resolveUnmatchedCells` không còn bỏ qua dòng đã có toạ độ khi cập nhật `myLogsCache` — cell
  local vẫn cần nhận `cell_range` + dấu `_resolvedOnline`.

### Tests
- `_uxtest.js` (+10 case): bảng cell **auto-fit** (`.cl-col-*` `width:1%`+`min-width`, không còn
  `width:190px`, `.cl-col-addr` `100%`, `.cl-tbl-addr` block+ellipsis), `<colgroup>` sinh từ
  `CL_TBL_COLS` (9 khoá `col`), `clCellShort` dạng `mcc-mnc-lac/tac-cellid` và
  `clTableRowHtml` không còn ghép LAC chung dòng cell; handle panel `.over-sheet` (z-index 4950,
  `pointer-events:auto`) khi bảng mở + `syncSidebarResizeBlock` chỉ `blocked` cho modal/legend;
  `clResolvedCellsForSave(batchId)` không đọc `myLogsCache`; flush `opts.flush` /
  `flushCallSessionResolved()` trên `pagehide`/`beforeunload`/`visibilitychange` + trong
  `closeClTableOverlay`; `clLoadBatchCells` trả `{ cells, resolvedCells }` và
  `clCellsFromSource` ghép `resolvedCells` → `state=found`.
- `_batchcredit.test.js` (+4 case): batch có `call_log_batches.resolved_cells` nhưng **không có**
  `lookup_history` → `resolve-batch` trả toạ độ lại, `credit.charged = 0`, số dư không đổi;
  `GET /api/lookup-history/batch/:id/cells` trả `resolvedCells` (kể cả nhánh fallback).
- `_googlesource.test.js` (76 case, +16): mock `axios.post` → kiểm request shape (`considerIp:false`,
  `radioType` chữ thường, `cellTowers[]` số nguyên, `homeMobileCountryCode` number), NR dùng
  `newRadioCellId` và **không** có `cellId`, cell vượt uint32 bị loại khỏi mảng, GSM LAC ngoài range
  bị loại, lỗi 400/403/429 + response thiếu `location` → miss không ghi DB, geo gate chặn toạ độ
  ngoài MCC, option B (chỉ 1 request cho nhóm cell miss, cell local không gửi Google), chia nhóm
  `2+2+1` khi `max_google_per_batch=2` (đổi live qua `PUT /api/settings`), không key → không gọi mạng.
  Bổ sung: `last_error` xuất hiện trong `GET /api/sources` sau 403 và **được xoá** khi tra thành công,
  `?debug=1` chỉ trả `payload.debug` cho admin (kèm `key`/`lastError` per nguồn), cell short thiếu
  sector **không** gọi Google (tránh ECI bịa) còn cell short **có** sector vẫn gửi ECI đúng.
- `_uxtest.js`: nhóm mới `Nguồn Google Geolocation` — static assert registry/default-tắt,
  `considerIp: false`, NR không set `cellId`, gom nhóm theo `max_google_per_batch`, fallback
  `GOOGLE_MAPS_API_KEY`, setting có trong `SETTING_KEYS/DEFAULTS/NUM_MAX`, admin option + input
  `#setGoogleMax` + nhánh hint + badge `google` (282 passed).
- `_adminhtml.test.js`: nhóm mới `Nguồn Google Geolocation` — option `google` trong `#srcType`,
  input `#setGoogleMax`, admin.js load/save `max_google_per_batch`, hint cảnh báo tốn phí,
  badge `google` (86 passed).
- `_batchcredit.test.js`: case 1 cập nhật theo luật "tra lần lượt" — số dư 2/3 cell found →
  chỉ 2 cell ĐẦU có toạ độ + `charged:true`, cell thứ 3 `unpaid:true`/không toạ độ; case 7 mới
  (lô trộn 3 found + 1 miss, số dư 2) → `credit.found = 3`, `credit.missed = 1`,
  `credit.unpaid = 1`, `charged = 2`, số dư về 0; tra lại cùng vòng = `duplicate` không trừ thêm
  (45 passed).
- `_uxtest.js`: nhóm mới `Tra lần lượt khi thiếu điểm + thông báo 3 số` — client tích luỹ
  `credit.found/missed/unpaid`, bỏ qua cell `unpaid`; `showResolveResult` dùng `{m}` (không ra
  kết quả) + `{z}` (chưa tra); i18n vi+en có `{m}`; server gán `charged` theo thứ tự, ẩn toạ độ
  cell vượt điểm, `duplicate` coi như đã trả phí cả lô (282 passed).
- `_uxtest.js`: nhóm mới `Trừ điểm cell đã có trong CSDL nội bộ` — `countResolveNeeded` không
  bỏ qua `lat/lon`, có skip `_charged`/`_fromHistory`; client đọc `results[].charged`; có
  `keyToCell` + `restoreChargedFlags` (gọi trong `loadCallLogs`); có `canViewRecord` và được
  áp dụng ở `plotCallLogs`/`renderCallLogs`/`playCallLogs`/`updatePlayBtn`/`updateCallSessionUi`;
  không còn cờ `clPlotOnlyPaid`.
- `_batchcredit.test.js`: assert `results[].charged === true` cho cell found (khớp
  `credit.requested`) + case 6 mới — cell miss → `charged:false`, `credit.charged = 0`, số dư
  giữ nguyên.
- `_topupflow.js`: case 10 mới — **nạp điểm xong tra cứu được**: user 0 điểm + 2 cell có toạ độ
  trong CSDL nội bộ → `resolve-batch` 402 (`reason:insufficient`, không trừ âm) → nạp 5 điểm →
  `GET /api/credits/balance` trả 5 → tra LẠI cùng `uploadId`/`roundIdx` → 200 + toạ độ 2 cell +
  `results[].charged:true` + `credit.charged:2` + số dư còn 3; retry cùng vòng không trừ lại
  (64 passed).

## [2.9.0] - 2026-10-13

### Fixed
- **Rút list trừ điểm sai (chỉ trừ vòng đầu)**: bút toán trừ điểm dùng `ref = batchId` cho
  MỌI vòng resolve → vòng 2+ gặp `DUPLICATE_TX` nên `charged:0`; tra ra rất nhiều cell mà
  chỉ bị trừ vài điểm. Server giờ nhận `roundIdx` và dùng `ref = batchId + ':r' + roundNo`
  → mỗi vòng trừ riêng, retry CÙNG vòng vẫn idempotent.
- **Kết quả tra không hiện trên bản đồ sau khi Đồng ý/Bỏ qua**: `resolveUnmatchedCells`
  trả sớm khi không còn cell cần tra và nuốt lỗi trong `catch` → bản đồ trống tới khi bấm
  "Hiển Thị Bản Đồ". Giờ luôn `clMapDeferred = false` + `renderCallLogs()` cả ở nhánh
  early-return lẫn `catch`.
- **Vào trang chủ tự bật popup nạp danh sách cuộc gọi**: init gọi `loadCallLogs()` với
  `prompt` mặc định → `showResolvePrompt()` mở popup đè tab Tra cứu. Init giờ gọi
  `loadCallLogs({ prompt: false })`; popup chỉ mở khi user thao tác (Load Excel / mở phiên).

### Changed
- **Kết quả tra cứu rút list nằm trong panel bộ lọc**: `#clCreditNotice` (đã trừ bao nhiêu
  điểm / còn bao nhiêu cell chưa tra) chuyển vào `#callLogFilterPanel` → chỉ hiện khi user
  mở bộ lọc, không chiếm chỗ trên danh sách.
- **Đồng bộ ô tìm kiếm**: `.cl-search-box` bọc input + icon kính lúp + nút xoá nhanh
  (`#logSearchClear`, `clearLogSearch`); placeholder dùng i18n
  `calllogs.searchPlaceholder`; `syncLogSearchClear` bật/tắt nút xoá theo nội dung.
  Ô tìm kiếm nằm NGOÀI `.form-group` nên CSS khai báo đầy đủ tại `.cl-search-box`
  (height 30px, border, background, `:focus-within`) và `#logSearchInput`
  (`border:0`, transparent, font-size 12px, `::placeholder`); nút lọc ép `height:30px`
  để thẳng hàng.
- **Tab "Xem rút list": gọn topbar + search row** — topbar chỉ còn **Load Excel** +
  **Hướng dẫn** (bỏ nút *Lịch sử tra cứu* và *Xoá phiên* — xoá phiên vẫn ở dòng
  `#clCurrentSession`). Ô tìm kiếm chuyển sang `.cl-search-row` (input co giãn + nút
  bộ lọc chỉ-icon ngang hàng), bỏ nhãn `cells.search` riêng của tab này.
- **Popup hướng dẫn mới `#clGuideModal`** (`openClGuideModal/closeClGuideModal`) — 7 bước
  giải thích luồng nạp Excel → xác nhận tra → trừ điểm, mở từ topbar. Empty-state cuối
  panel chỉ còn hint text (bỏ nút *Load Excel* + *Hướng dẫn* trùng với topbar).
  i18n `calllogs.guideBtn/guideTitle/guide1..7` (vi + en).
- **Hoãn vẽ bản đồ tới khi xác nhận**: cờ `clMapDeferred` (mặc định `false`).
  `uploadCallLogExcel` bật cờ → `plotCallLogs` **clear overlay rồi return** (không lộ kết
  quả tra trước khi user đồng ý). `confirmClResolve`/`skipClResolve`/`resolveUnmatchedCells`
  tắt cờ → mới vẽ. Cell chưa tra (thiếu toạ độ) tự động không hiện.
- **`resolveUnmatchedCells` dừng ngay khi hết điểm**: `break` ngay khi
  `resp.credit.insufficient` — không gọi vòng kế tiếp (vòng sau cũng không đủ điểm).
- **`renderClConfirm` cảnh báo thiếu điểm tổng**: khi `balance < total` (nhưng còn đủ
  cho 1 cell) hiện `calllogs.notEnoughTotal` + link **Nạp điểm** → `/topup.html`; nút
  confirm chỉ disable khi `balance < cost`.
- **Popup marker dùng chung `buildCellPopupHtml(opts)`** — tách từ `showCellOnMap`, dùng
  cho cả tra đơn lẻ lẫn `plotCallLogs`. `opts.extra` cho phép rút list thêm "Số bản ghi"
  + list timestamp (giữ nguyên output cũ của tra đơn lẻ). `SOURCE_LABELS` nâng thành hằng
  dùng chung; popup giờ có nhãn nguồn/bán kính/toạ độ như tra đơn lẻ.
- **Phục hồi từ Lịch sử / phiên đã lưu KHÔNG mở popup nữa** (`openClResolveForRestore`
  chỉ tắt cờ hoãn + `renderCallLogs`) — hiện ngay kết quả đã tra trước đó, không trừ điểm.
  `openCallLogsFromHistory`/`openCallLogSession` tương ứng.
- **Bỏ panel phiên bản ở chân trái**: gỡ `#cellPanelVer` + `#cellPanelVerNote`;
  `renderPanelVersion()` chỉ còn vẽ số lượt thử của khách (`#cellPanelTrial`).
- Tests cập nhật: `_uxtest.js` (topbar, search row, guide modal, `clMapDeferred`,
  `buildCellPopupHtml`, restore không popup), `_version.test.js`, `_guesttrial.test.js`,
  `_popup.test.js` (popup dùng chung).

## [2.8.0] - 2026-10-13

### Changed
- **Tab "Xem rút list": nạp Excel chuyển thành popup (modal)** — bỏ nhóm thu gọn
  `<details id="clUploadTools">` và hộp inline `#clResolvePrompt`; thanh hành động gọn
  `.cl-topbar` (nút **Load Excel** mở popup + **Lịch sử** + **Xoá phiên**) thay cho khối cũ.
  Popup `#clUploadModal` chạy 3 bước `pick → busy → confirm`
  (`setClUpStep`): chọn mạng + **dropzone kéo-thả** (`initClUpDrop`) → tiến trình upload →
  xác nhận. `openClUploadModal/closeClUploadModal`.
- **Popup dùng chung cho luồng phục hồi từ Lịch sử**: `showResolvePrompt()` giờ mở thẳng popup
  ở bước `confirm` (`renderClConfirm`) thay vì vẽ hộp inline. Dữ liệu `_fromHistory` vẫn được
  `countResolveNeeded()` bỏ qua → **không trừ điểm khi phục hồi**; nếu toàn bộ phiên đến từ
  Lịch sử thì `renderClConfirm` **ẩn nút tra** và chỉ báo `calllogs.nothingToResolve`.
- `uploadCallLogExcel`: không tự `loadCallLogs()` nữa — nạp list bằng
  `loadCallLogs({ prompt: false })` rồi `renderClConfirm({total, inserted, errors})`. `loadCallLogs`
  nhận `opts.prompt` (`false` = bỏ hỏi tra). `renderClConfirm` hiện lưới thống kê
  (Tổng/Đã chèn/Lỗi), chi phí `K cell × cost = tổng · số dư`, disable nút khi không đủ điểm.
- Đổi tên nút/hàm: `openClUploadPicker` → `openClUploadModal`; `skipResolve` giờ đóng popup;
  `confirmClResolve`/`skipClResolve` cho 2 nút trong popup. CSS mới `.cl-topbar/.cl-up-*`,
  bỏ `.cl-tools*/.cl-prompt*`. i18n thêm
  `calllogs.loadExcel/uploadTitle/chooseFile/dropHint/confirmResolve/closeBtn/statTotal/statInserted/statErrors/nothingToResolve`
  (vi + en).

### Removed
- Banner phiên `#callSessionBanner` + thanh tổng kết `#callLogSummaryBar` khỏi HTML (thông tin
  phiên gọn trong `#clCurrentSession`). `updateCallSessionUi` giữ nguyên (no-op khi thiếu node).

### Tests
- `_uxtest.js`: nhóm mới `Popup nạp Excel (modal)` — assert không còn `<details id="clUploadTools">`,
  có `#clUploadModal` + 3 bước + dropzone + `#clUpStats/#clUpResolve/confirmClResolve`, CSS
  `.cl-topbar/.cl-up-*`, các hàm `openClUploadModal/closeClUploadModal/setClUpStep/confirmClResolve/
  skipClResolve/renderClConfirm`, `uploadCallLogExcel` gọi `loadCallLogs({ prompt: false })`,
  empty-state gọi `openClUploadModal`, i18n mới; assert `showResolvePrompt` mở popup bước confirm,
  `loadCallLogs` đọc `opts.prompt`; cập nhật assert bỏ banner/summary bar.

## [2.7.0] - 2026-10-13

### Added
- **Tab "Xem rút list": ước tính điểm + xác nhận trước khi tra (chống cháy tài khoản)**:
  sau khi nạp Excel, client **không tự động trừ điểm** nữa. Hàm `countResolveNeeded()`
  đếm số cell **duy nhất** cần tra (dedup theo `canonicalClientKey`, bỏ dòng đã có toạ độ,
  bỏ dòng mở từ Lịch sử, bỏ dòng thiếu mcc/lac/cellid) rồi `showResolvePrompt()` hiện hộp
  `#clResolvePrompt`: `N cell × cost điểm = tổng · số dư hiện tại` kèm 2 nút **Tra cứu ngay**
  (`startResolveFromPrompt`) / **Bỏ qua** (`skipResolve`). Không đủ điểm cho 1 lần tra thì nút
  bị **disable** + cảnh báo nạp thêm. Giá + số dư lấy từ `Auth.getCreditConfig()`
  (`/api/credits/config`, cache) và `Auth.getCreditBalance()/refreshCreditBalance()`.
- **Tab "Xem rút list": nhóm công cụ Nạp Excel thu gọn được**: khối chọn mạng + nút tải Excel +
  thanh tiến trình + kết quả upload + banner phiên + summary giờ nằm trong `<details
  id="clUploadTools">` (mở sẵn mặc định, caret `fa-chevron-down` xoay khi mở). `.cl-tools*`.
  Bấm **Tải Excel** (kể cả empty-state) gọi `openClUploadPicker()` — mở nhóm rồi mới mở hộp chọn
  file.
- **Trừ điểm một phần khi hết điểm giữa lô** (`credits.chargeLookupPartial`): thay vì hỏng cả lô,
  chỉ trừ **tối đa số điểm còn lại** (`affordable = min(requested, floor(balance/cost))`), phần
  vượt báo `insufficient:true`; số dư ≤ 0 thì `charged:0` và **không ghi bút toán**. Vẫn
  idempotent theo `(type, ref)` (`duplicate:true` khi retry cùng `uploadId`).
  `POST /api/cells/resolve-batch` dùng hàm này và trả `credit:{balance, charged, requested, cost,
  insufficient}`.
- **Thông báo kết quả trừ điểm sau khi tra** (`showResolveResult` → `#clCreditNotice`): hiện
  `Đã tra f/n cell — trừ c điểm` và khi hết điểm giữa lô thì `còn z cell chưa tra (hết điểm)` +
  link **Nạp thêm** → `/topup.html`. `resolveUnmatchedCells` tích luỹ `resp.credit` qua các vòng.
  i18n `calllogs.tools/resolveNeed/resolveBtn/skipBtn/notEnough/creditCharged/creditPartial/topupNow`
  (vi + en).
- `Auth.getCreditConfig()` (`public/auth.js`) — đọc + cache `/api/credits/config`.

### Tests
- `_credittest.js`: nhóm `chargeLookupPartial` (trừ 3/5 dư 3; dư 0 → charged 0, không bút toán;
  dư đủ → charged = requested; retry cùng ref → `duplicate` không trừ lại); wiring server dùng
  `chargeLookupPartial(userId, foundCount, batchId...)` + credit trả `requested/insufficient`.
- `_uxtest.js`: assert `<details id="clUploadTools">` (open, bọc upload/progress/result), CSS
  `.cl-tools/.cl-prompt/.cl-credit-notice`, `openClUploadPicker`, các hàm
  `countResolveNeeded/showResolvePrompt/startResolveFromPrompt/skipResolve/showResolveResult`,
  `loadCallLogs` gọi `showResolvePrompt` (không auto-resolve), `resolveUnmatchedCells` tích luỹ
  `resp.credit.charged` + `insufficient`, `Auth.getCreditConfig`, i18n keys mới (vi+en).
- `_batchcredit.test.js` (MỚI, runtime): boot server thật trên DB tạm — số dư 2 < 3 cell found →
  trừ đúng 2 + `insufficient:true` + 1 bút toán -2; hết điểm → pre-check 402 không đốt quota;
  dư ≥ found → trừ đủ `insufficient:false`; retry cùng `uploadId` → `charged:0` không trừ lần 2.

### Fixed
- **Tra cứu chuyển mạng giữ số hỏng với khách (lỗi "No token provided")**: hai route
  proxy VNTA `GET /api/tools/port-check/captcha` và `POST /api/tools/port-check/search`
  trước đây gắn `requireAuth`, nên tài khoản chưa đăng nhập gọi captcha bị
  **401 `No token provided`** → `loadCaptcha()` trong `public/tools/port-check.html`
  ném lỗi, ảnh captcha không bao giờ hiển thị. Trang `/tools/port-check.html` vốn mở
  cho cả khách (dropdown Công cụ ở `auth.js` hiện link vô điều kiện, và
  `_guesttrial.test.js` chốt "bỏ redirect login") nên server phải khớp: **bỏ
  `requireAuth`** ở cả hai route, thay bằng `captchaRateLimit` (bucket riêng
  120 request/5 phút/IP). Không đọc `req.user` ở đâu trong proxy nên không rơi
  chức năng nào; chặn lạm dụng dựa vào captcha + `sessionId` one-shot.
- **Link điều khoản ở phần đăng ký mở tab mới thay vì hiện trong popup**:
  `public/auth-popup.js` render `<a href="/terms.html" target="_blank">` → nhảy sang
  tab khác, mất ngữ cảnh form. Nay link gọi `AuthPopup.view('terms')`: thêm **view
  `terms`** ngay trong popup, nạp nội dung từ `/terms.html` rồi trích ruột
  `#termsCard` (một nguồn văn bản duy nhất, không chép lại vào JS), có nút
  "← Về đăng ký". CSS `.ap-terms` ăn biến theme của trang (`--text-*`,
  `--border-focus`, `--accent`) nên tự khớp **giao diện sáng/tối**.
- **Tab "Xem rút list": chip lọc trắng icon (SMS + gọi)**: bốn chip trong
  `#callLogFilterPanel` dùng icon **Pro-only** của Font Awesome Free
  (`fa-envelope-arrow-down/up`, `fa-phone-arrow-down-left/right`) nên render trống (ô
  vuông rỗng) trong bản Free 6.5.1 mà trang nạp. Nay đổi sang bộ **free**:
  `fa-comment-sms` (SMS) / `fa-phone` (gọi) + mũi tên nhỏ `fa-arrow-down`/`fa-arrow-up`
  (`.cl-chip-dir` ở góc phải) để vẫn phân biệt rõ Đến/Đi.
- **Tab "Xem rút list": lọc theo ngày không mở được bảng chọn**: cách cũ (nút gọi
  `input.showPicker()` trên `<input>` offscreen 1×1 `opacity:0`) bị trình duyệt chặn
  (`showPicker()` yêu cầu phần tử render được + transient activation) nên bấm không ra
  lịch. Hai ô `datetime-local` luôn hiện cũng chiếm chỗ. Nay thay bằng **2 ô from → to**
  (`#clDateFromField`/`#clDateToField`, icon `fa-calendar-days` + nhãn ngày `dd/mm`),
  trong đó `<input type="date">` **phủ khít toàn ô, trong suốt** (`opacity:0`,
  `inset:0`) nên bấm vào ô là bấm thẳng input → trình duyệt mở bảng chọn ngày native,
  không cần JS (bỏ hẳn `openCallLogDate`/`showPicker`). Giữ nguyên id
  `#dateFrom`/`#dateTo` để `getFilteredLogs`/`updateClFilterBadge` không đổi, kèm nút ✕
  xoá nhanh mỗi đầu (`clearCallLogDate`). `getFilteredLogs` so `dateTo` trọn ngày cuối
  (`<= 'YYYY-MM-DD 23:59:59'`) vì `timestamp` có kèm giờ.

### Changed
- **`public/terms.html` theo theme sáng/tối**: trước đây hardcode nền gradient tối
  (`#1a1a2e…#0f3460`) + chữ sáng nên khi hệ thống đang ở giao diện sáng thì trang
  vẫn tối. Nay thay bằng cặp biến `:root`/`[data-theme="light"]` +
  `[data-theme="dark"]` theo đúng palette `topup.html`/`version.html`, kèm 5 biến
  navbar chung (`--header-bg`, `--bg-surface`, `--bg-surface2`, `--bg-btn-primary`,
  `--border-focus`) để navbar ăn theo `data-theme`; thêm script đọc `localStorage
  'theme'` (dùng chung `app.js`/`auth.js`) lúc tải trang. Nội dung bọc trong
  `#termsCard`; nút "Đăng ký" của trang mở popup tại chỗ khi `AuthPopup` sẵn có.

### Tests
- `_authpopup.test.js`: thêm 6 assert (link điều khoản gọi `AuthPopup.view('terms')`
  và bỏ `target="_blank"`; có view `terms` trong `render()`; `termsHtml()`/`loadTerms()`;
  `loadTerms` nạp `/terms.html` + trích `#termsCard`; i18n đủ `termsTitle`/`termsBack`
  cho vi/en; CSS `.ap-terms` dùng biến theme).
- `_guesttrial.test.js`: thêm 2 assert chốt hai route VNTA công khai
  (`captchaRateLimit`, không `requireAuth`); thêm `terms.html` vào `THEMED_PAGES`.
- `_uxtest.js`: thêm assert cho panel bộ lọc — chip SMS/gọi dùng icon free
  (`fa-comment-sms`/`fa-phone` + `.cl-chip-dir`, không còn `fa-envelope-arrow-*`/
  `fa-phone-arrow-*`); `clearCallLogDate`/`syncClDateButtons`, so sánh `dateTo` trọn
  ngày; ô `#clDateFromField`/`#clDateToField` bọc `<input type="date">` trong suốt
  `.cl-date-native`, không còn `datetime-local`; CSS `.cl-date-*`/`.cl-chip-dir`; i18n
  `calllogs.dateFrom/dateTo`.

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

## [2.6.4] - 2026-10-13

### Changed
- **Popup đăng nhập/đăng ký gọn hơn, hết scrollbar** (`public/auth-popup.js`). Form dài
  (đăng ký: 5 ô + điều khoản) trước đây vượt `max-height:92vh` → thanh cuộn dọc trong
  `#apBody`. Nay nén khoảng cách + thay nhãn bằng placeholder:
  - **Bỏ 11 `<label class="ap-label">`** — mọi nhãn đã trùng y hệt `placeholder` của ô
    tương ứng nên xoá là an toàn. Giữ **accessibility** bằng `aria-label` + `title` trên
    từng input (screen reader vẫn đọc đúng tên ô).
  - **Thêm icon SVG inline** bên trái mỗi ô để nhận diện nhanh khi không còn nhãn:
    `user` (`apUser`), `mail` (`apEmail`), `lock` (`apPass`/`apPass2`), `shield`
    (`apCaptcha`), `key` (`apCode`). SVG `stroke="currentColor"` 17×17 nên tự ăn màu
    theme, không thêm thư viện icon nào. Helper `ic(name)` + `field(icon, innerHTML)`;
    wrapper `.ap-iw` (relative) + `.ap-ic` (absolute, `pointer-events:none`) + input
    `padding-left:36px`.
  - **Nén CSS**: `#authPopupBox` padding `22px 24px 24px` → `18px 22px 20px`;
    `.ap-field` margin-bottom `12px` → `9px`; `.ap-input` padding `10px 12px` → `9px 11px`;
    `.ap-tabs` margin `14px 0 16px` → `10px 0 12px`; `.ap-brand`/`.ap-sub`/`.ap-foot`/
    `.ap-btn`/`.ap-btn-ghost` giảm nhẹ. Thêm `.ap-msg:empty{display:none}` để khối thông
    báo rỗng không chiếm ~26px.
  - **Bỏ gutter scrollbar**: xoá `margin:0 -8px 0 0;padding-right:8px` trên `#apBody`;
    thanh cuộn (chỉ còn cần trên màn rất thấp) mặc định `transparent`, hiện khi hover
    (`#apBody:hover::-webkit-scrollbar-thumb`) nên không chiếm chỗ, không chồng viền bo góc.
  - Hành vi giữ nguyên: id ô nhập, `onclick` handler, canvas captcha (118×42), checkbox
    điều khoản và luồng login/register/verify/forgot/reset không đổi.

### Tests
- Thêm `_authpopup.test.js` (39 assert, static regex trên `public/auth-popup.js`): không
  còn `class="ap-label"`; có CSS `.ap-iw`/`.ap-ic` + lề trái input; ICON đủ 5 khoá
  `user/mail/lock/shield/key` và dùng `stroke="currentColor"`; đúng 12 lời gọi `field(`;
  ≥ 11 `aria-label` và ≥ 11 `title`; id input giữ nguyên; CSS nén đúng
  (`padding:18px 22px 20px`, `.ap-field{margin-bottom:9px}`, `.ap-input{padding:9px 11px}`,
  `.ap-msg:empty{display:none}`, không còn gutter, scrollbar ẩn/hover); 7 handler +
  canvas + checkbox điều khoản còn nguyên.

## [2.6.3] - 2026-10-13

### Fixed
- **`/version.html` không hiện lịch sử phiên bản, chỉ hiện version + ngày build rồi
  báo "Chưa có lịch sử phiên bản"** dù `CHANGELOG.md` có đủ dữ liệu. Nguyên nhân:
  `renderChangelog()` trong `public/version.js` gọi `fetch('/api/version/changelog')`
  **trần, không kèm token**, trong khi route server đăng ký
  `app.get('/api/version/changelog', requireAuth, requireAdmin, …)` → server trả
  **401 No token provided** → `res.ok === false` → `list` rỗng, fallback
  `cached().changelog` cũng rỗng (payload `/api/version` công khai **không chứa**
  `changelog`) → trang in nhầm "Chưa có lịch sử phiên bản". Phần đầu trang (số phiên
  bản, ngày build) vẫn hiện vì `/api/version` là route công khai. Nay:
  - Gọi qua **`Auth.fetch()`** — hàm này tự gắn `Authorization: Bearer <token>`
    (xem `public/auth.js`) — nên route admin trả 200 kèm danh sách changelog.
  - Tách **lỗi** khỏi **rỗng thật**: request thất bại (401/403/5xx/mạng) hiện
    `"Không tải được lịch sử phiên bản (HTTP <status>)."` thay vì che thành
    "Chưa có lịch sử phiên bản"; chỉ khi server trả 200 mà `changelog` rỗng mới hiện
    "Chưa có lịch sử phiên bản".
  - Fallback `fetch` trần chỉ dùng khi trang không nạp `auth.js` (vd test DOM giả).

### Tests
- `_version.test.js`: +3 assert — `renderChangelog` gọi `/api/version/changelog` qua
  `Auth.fetch`, nhánh chọn request kiểm tra `window.Auth && window.Auth.fetch`, và có
  tách thông báo lỗi HTTP (`loadError = 'HTTP ' + res.status`) khỏi nhánh "Chưa có
  lịch sử" (chống tái phát việc che lỗi 401 thành "rỗng").

## [2.6.2] - 2026-10-13

### Fixed
- **Sửa `CHANGELOG.md` xong mở `/version.html` vẫn thấy nội dung CŨ** (phải restart
  server mới thấy). Có **3 lớp cache** độc lập cùng giữ bản cũ, đã chặn cả 3:
  - **Cache RAM trong server** (nguyên nhân chính): `version.load()` chỉ đọc
    `CHANGELOG.md` **một lần lúc start**, giữ mãi trong biến `cache`. Sửa file sau đó
    không có tác dụng vì không code nào gọi `reload()`. Nay `load()` so **mtime** của
    `CHANGELOG.md` + `package.json` với lần nạp trước → file đổi là tự nạp lại ở lần
    gọi API kế tiếp, **không cần restart**.
  - **HTTP cache**: 2 route `GET /api/version` và `GET /api/version/changelog` không set
    `Cache-Control` → browser/proxy có thể giữ JSON cũ. Nay trả `Cache-Control: no-store`.
  - **Static cache**: `express.static` phục vụ `public/version.js` / `version.html` không
    kèm `Cache-Control`, mà 2 file này không có tên gắn hash → trình duyệt giữ bản JS/HTML
    cũ (renderer changelog vẫn là bản cũ nên không hiện bullet con). Nay `setHeaders`
    trong `express.static` ép `Cache-Control: no-cache` cho đúng 2 file này (vẫn cho
    `304` nếu chưa đổi), các asset khác giữ nguyên `max-age=0`.

### Tests
- `_version.test.js`: +3 assert — `load()` có so mtime (`loadedMtime` / `mtimeOf`),
  `express.static` ép `no-cache` cho `version.js`/`version.html`
  (`ALWAYS_REVALIDATE` + `setHeaders`), và 2 route version có `Cache-Control: no-store`.

## [2.6.1] - 2026-10-13

### Fixed
- **Trang `/version.html` (lịch sử phiên bản, chỉ admin) hiện nội dung CHANGELOG bị cụt**:
  `version.parseChangelog()` cũ cắt mỗi bullet ở **dòng đầu tiên** (regex `^[-*]\s+(.+?)\s*$`
  khớp từng dòng, không gộp dòng nối) — bullet viết nhiều dòng cho dễ đọc (đúng kiểu file
  CHANGELOG.md này) bị mất đuôi, và **bullet con** (thụt lề, vd `  - Thêm route ...`) bị đổ
  phẳng thành mục cùng cấp nên sai nghĩa. Nay parser:
  - Nối dòng tiếp nối vào bullet/bullet con đang mở (dùng `childIdx`, không dùng biến chuỗi
    rời — nếu không dòng nối của bullet con bị nuốt mất).
  - Nhận diện bullet con theo **thụt lề** (sâu hơn bullet cha) → gom vào `items[].children`.
  - Giữ nguyên dạng `string` cho bullet không có con → **không phá UI cũ** (admin panel,
    `renderChangelog` cũ vẫn chạy); bullet có con là object `{ text, children }`.
- `public/version.js`: `renderChangelog` render bullet con thành `<p class="ver-sub">` bên
  trong `<li>` (thay vì nhét thẳng string) và **escape HTML** phần text/version/date (trước
  đây chèn thô — CHANGELOG có `<`, `>` từ ví dụ code sẽ vỡ layout).
- `version.html`: thêm CSS `.ver-sub` (kẻ trái, chữ nhỏ hơn) để phân biệt bullet con với mục
  cùng cấp.

### Tests
- `_version.test.js`: +5 assert cho parser (gộp dòng nối, không dính bullet kế tiếp, gom
  bullet con + nối dòng của con, bullet cùng cấp sau bullet có con, và entry thật `2.6.0`
  phải có bullet `Fixed` dài > 100 ký tự — chống tái phát lỗi cụt).

## [2.6.0] - 2026-10-13

### Fixed
- **Đơn nạp kẹt `PENDING` dù khách đã trả tiền (không tự sang bước Hoàn tất)**. Nguyên nhân:
  điểm chỉ được cộng khi webhook payOS gọi vào `POST /api/payos/webhook`; nếu webhook chưa
  đăng ký / `public_base_url` chưa public thì payOS không gọi, còn client chỉ poll
  `GET /api/credits/topup/:code` — route này **chỉ đọc DB**, không hỏi payOS. Nay:
  - Thêm route user **`POST /api/credits/topup/:orderCode/sync`** (`requireAuth` +
    `topupSyncRateLimit` 30 lần/5 phút/user) đối soát đơn với payOS. Rủi ro được chặn vì
    điểm vẫn chỉ cộng khi payOS báo `PAID` và `topup.creditOrder()` idempotent theo `ledgerRef`.
  - Tách lõi đối soát thành helper `syncOrderFromPayos(order)` dùng chung cho route admin
    (`POST /api/admin/payments/:code/sync`) và route user.
  - Đơn đã ở trạng thái cuối (`PAID`/`CANCELLED`/…) trả về ngay, **không gọi payOS** và không
    hạ cấp trạng thái. payOS lỗi tạm thời → trả HTTP 200 kèm `synced:false` để nhịp poll của
    client không đỏ.
  - `topup.html`: poll vẫn 4 giây, nhưng cứ **5 nhịp (~20 giây)** thì gọi `/sync` khi đơn còn
    `PENDING`; nhảy về tab (`visibilitychange`) thì đối soát ngay. Bỏ nhánh thoát sớm
    `if (document.hidden) return;` trong `startPolling` (bug: interval chết hẳn khi tab bị ẩn
    lúc tạo đơn → quay lại tab không còn nhịp nào).

### Changed
- **Bước 3 thanh toán thiết kế lại** (`topup.html`): QR hiện sẵn trên trang nên **bỏ nút
  "Thanh toán"** cùng popup `#payModal` (và `payNow()`/`fillPayModal()`/`closePayModal()`).
  Thêm hộp số tiền nổi bật, hướng dẫn 3 bước (`.walkthrough`), dải tín hiệu tin cậy
  (`.pay-trust`), khung QR có badge trạng thái và dải trạng thái sống `#payLiveHint`.
  Đơn không dựng được ảnh QR → nhánh dự phòng `#payFallback` với link mở trang payOS.
- **Gộp "Hủy đơn" + "Đóng" thành 1 nút `Hủy đơn`** mở dialog `#cancelModal` với 2 lựa chọn
  rõ ràng: **Đóng (giữ đơn)** và **Huỷ đơn**; Esc/bấm nền mờ = giữ đơn. Bỏ `window.confirm()`
  của trình duyệt. Nhãn nút bước 2 đổi thành "Xem mã QR thanh toán".

### Tests
- `_topupflow.js`: +6 assert cho `/sync` (PENDING → 200 không cộng điểm, user khác → 403,
  đơn lạ → 404, không token → 401).
- `_creditwizard.test.js`: thay case popup bằng case dialog huỷ + nhánh dự phòng QR và
  `syncOrderStatus()` gọi đúng `/sync`.
- `_credittest.js`: assert tĩnh mới (không còn `#payModal`/`payNow`, có `#cancelModal`,
  `.walkthrough`, `.pay-trust`, `SYNC_EVERY`, poll không thoát khi tab ẩn).
- `_version.test.js`: khoá version `package-lock.json` khớp `package.json`.

## [2.5.0] - 2026-10-12

### Fixed
- **Popup thanh toán hiện QR thật (trước đây QR trống)**: payOS trả `qrCode` là **chuỗi
  EMVCo VietQR** (`0002010102...`) chứ không phải URL ảnh, nên guard cũ (`isImg`, đòi
  `http` + không `.html`) loại nó và popup không có gì để quét. Nay server dựng ảnh PNG
  bằng npm `qrcode` (`payos.buildQrImage()`, `{errorCorrectionLevel:'M', margin:1, width:320}`)
  rồi trả về client qua trường mới `qr_image` (data-URL) — `POST /api/credits/topup/create`
  lấy từ `data.qrImage`, `GET /api/credits/topup/:orderCode` dựng lại từ `qr_code` đã lưu
  (derive-on-read, **không cần migration DB**) nên đơn khôi phục qua `?order=`/F5 vẫn có QR.
  Client (`topup.html`) đổi sang đọc `qr_image` (`hasQrImage()` chỉ nhận `data:image/*`):
  có ảnh → hiện QR (`#payQr`/`#payModalQr`) và ẩn link payOS; không có ảnh → ẩn QR, hiện
  link **Mở trang thanh toán payOS**. Chuỗi rỗng, URL `http(s)`, và đường dẫn nội bộ
  (`/topup.html?...` ở test mode) đều cho `qr_image = null`.
- **Thêm dependency `qrcode@^1.5.4`** (thuần JS, không native) — render QR offline ở server,
  không gọi CDN/dịch vụ ngoài (vẫn thoả test cấm nhúng `payos-checkout` qua CDN).

### Tests
- `_payos.test.js`: section **13. buildQrImage** (7 assert — chuỗi VietQR → data-URL PNG,
  base64 > 200 ký tự, rỗng/`undefined`/link `http(s)` → `null`, 2 chuỗi khác nhau → 2 ảnh khác).
- `_topupflow.js`: +2 assert test mode `qr_image` rỗng ở cả `create` lẫn `GET` (không dựng ảnh
  từ link nội bộ).
- `_creditwizard.test.js`: fixture có `qr_image` data-URL; assert `#payQr`/`#payModalQr` hiện
  đúng ảnh + case `qr_image:''` (test mode) → ẩn QR và hiện link payOS.

## [2.4.0] - 2026-10-12

### Added
- **Trang nạp điểm riêng `public/topup.html`** — tách toàn bộ luồng nạp khỏi `credits.html`.
  Wizard **4 bước** có thanh tiến trình **(1) Số tiền → (2) Đơn nạp → (3) Thanh toán →
  (4) Hoàn tất**: bước 1 gồm **cả lưới gói nạp lẫn ô nhập số tiền tự chọn** (chọn gói = bấm thẻ,
  nhập tiền = gõ số / dùng nút số tiền nhanh rồi bấm **Tạo đơn nạp** — không còn bước riêng cho
  số tiền tự chọn), bước 2 xác nhận đơn, bước 3 **thẻ thanh toán với 4 nút** — **Quay lại** (giữ đơn,
  về bước 2), **Thanh toán** (mở popup QR), **Hủy đơn** (`POST /api/credits/topup/<code>/cancel`) và
  **Đóng** (rời luồng) — bước 4 hiển thị kết quả **tại chỗ** (số tiền · điểm · trạng thái · số dư mới)
  kèm nút **Nạp đơn khác** (reset về bước 1) và **Về trang điểm**. Bấm **Thanh toán** mở **popup QR**
  (VietQR + số tài khoản + nội dung CK, hoặc link mở trang payOS khi đơn không có QR) đè lên trang;
  popup vẫn poll đơn mỗi 4 giây, đóng bằng **Esc** / bấm nền mờ / nút **Đóng**, và tự đóng khi đơn
  chuyển `PAID` (hoặc bằng `closePayModal()` trong `showResult`). Điều hướng bằng **mũi tên Quay lại/Tiếp tục** ở mỗi bước hoặc **bấm mốc**
  trên thanh tiến trình (mốc 1–2 quay lại tự do; mốc 3 chỉ bấm được khi đơn đã `PAID`). Bước
  hiện tại ghi vào `?step=` (`history.replaceState`) nên F5/back/forward hoạt động; đơn đang dở
  lưu `sessionStorage['ct_topup_order']` để khôi phục khi tải lại. Deep-link `?order=<code>` vào
  thẳng bước thanh toán (đơn `PAID` → bước 4).
- **Nút “Nạp điểm” trên `credits.html`** (`#topupBtn` màu nhấn `--ok`, icon `fa-wallet`, nằm cạnh
  nút **Làm mới** trong `.balance-actions` — banner `.topup-cta` cũ đã bỏ) → `/topup.html`.
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
