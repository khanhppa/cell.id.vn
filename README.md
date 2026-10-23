# Cell.id.vn — Cell Tracker

Website tra cứu Cell ID / lịch sử cuộc gọi & SMS, bản web + PWA `/m/`, chạy trên
Node.js + Express + SQLite. Có hệ thống tài khoản, điểm/credit, nạp tiền payOS,
API key cho tích hợp, và các công cụ phụ (eNB↔ECI, bẫy địa chỉ IP, tra nhà mạng).

## Yêu cầu

- Node.js **≥ 22** (khuyến nghị 24 — xem `.nvmrc`)
- Build tools cho `sqlite3`/`sharp` khi `npm ci` (Linux: `build-essential python3`)
- SQLite (file DB, không cần server riêng)

## Chạy local

```bash
npm ci
cp .env.example .env        # sửa JWT_SECRET, DB_PATH… (xem chú thích trong file)
npm start                   # http://localhost:3000
npm run dev                 # tự reload khi sửa file
npm run smoke               # boot thử + /healthz (dùng trước khi commit)
```

DB mặc định nằm ở **thư mục cha của repo** (`../database.sqlite`) để tương thích
dữ liệu dev sẵn có. Đặt `DB_PATH` nếu muốn vị trí khác.

## Cấu trúc

```
server.js            # toàn bộ route HTTP (Express)
database.js          # mở SQLite + migration schema
public/              # frontend tĩnh: index.html, app.js, admin, /m/ (PWA), tools/
bin/smoke.js         # smoke test boot + /healthz (local & CI)
bin/deploy-release.sh# nhận release trên server (npm ci, symlink, health gate, rollback)
bin/backup-db.sh     # backup SQLite an toàn khi đang chạy
deploy/              # hạ tầng: tạo LXC, bootstrap, deploy tay, CI/CD
scripts/             # công cụ vận hành một lần (audit/cleanup DB)
API.md               # tài liệu API cho tích hợp
CHANGELOG.md         # lịch sử thay đổi (nguồn cho /api/version)
```

## Tài liệu

| Tài liệu | Nội dung |
|---|---|
| [API.md](API.md) | Xác thực, endpoint, mã lỗi, ví dụ tích hợp |
| [deploy/README.md](deploy/README.md) | Triển khai production lên **Proxmox LXC** (thủ công): tạo CT, bootstrap, seed dữ liệu, vận hành, rollback, backup |
| [deploy/CICD.md](deploy/CICD.md) | **CI/CD**: GitHub Actions + self-hosted runner trong LXC, workflow, sudoers, troubleshooting |
| [scripts/README.md](scripts/README.md) | Công cụ rà soát/dọn DB (chạy tay) |
| [CHANGELOG.md](CHANGELOG.md) | Lịch sử phiên bản |

## Health check

- `GET /healthz` — public, truy vấn SQLite (`SELECT 1`), trả
  `{ok, version, uptime}`; DB lỗi → `503`. Dùng cho uptime monitor & CI/CD.
- `GET /api/version` — version hiện tại (đọc `package.json` + `CHANGELOG.md`).

## Ghi chú vận hành

- **Chỉ chạy 1 instance**: `node-cron` (đồng bộ OpenCellID, dọn log) và SQLite không
  chịu được nhiều process cùng ghi. Deploy = restart tuần tự, không blue-green.
- Dữ liệu runtime (`database.sqlite`, `uploads/`) nên đặt **ngoài** thư mục code
  (`DB_PATH`, `UPLOAD_DIR`) để deploy không xoá mất.
- Production **bắt buộc** `JWT_SECRET` khác giá trị mặc định — thiếu thì server dừng
  với log `FATAL` (tránh ai cũng ký được token admin).
- Trang web nạp Leaflet/Font Awesome/JSZip từ CDN công khai; client cần Internet.

## Bản quyền

Nội bộ — xem `public/terms.html`.
