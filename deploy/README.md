# Triển khai Cell.id.vn (cell-tracker) lên Proxmox LXC — hướng dẫn vận hành

Tài liệu này mô tả cách chạy app **production trong 1 LXC** trên Proxmox VE, và cách
**cập nhật tính năng / sửa lỗi từ máy local rồi đóng gói, triển khai** mà không mất dữ liệu.

```
Máy dev (Windows)                         Proxmox node
┌───────────────────────┐                 ┌─────────────────────────────────────────┐
│ D:\Code\cell-tracker  │  ssh/scp        │ LXC "cell-tracker" (Debian 12)          │
│ deploy.ps1 ───────────┼───────────────▶ │  Nginx :80/:443  ──▶  127.0.0.1:3000    │
│  git archive → zip    │                 │  systemd: cell-tracker.service (Node)   │
└───────────────────────┘                 │  /opt/cell-tracker/                     │
                                          │    releases/<ts>-<ver>/   ← code        │
                                          │    current -> releases/...              │
                                          │    shared/database.sqlite ← dữ liệu     │
                                          │    shared/uploads/        ← dữ liệu     │
                                          │    shared/.env            ← secrets     │
                                          └─────────────────────────────────────────┘
```

Điểm quan trọng: **code** nằm trong `releases/` (bị thay mỗi lần deploy),
**dữ liệu** (`database.sqlite`, `uploads/`) nằm trong `shared/` và không bao giờ bị
ghi đè bởi deploy.

---

## 0. Yêu cầu

| Thành phần | Yêu cầu |
|---|---|
| Proxmox | PV E 7.x/8.x, còn chỗ trên storage LVM cho ~16GB |
| Máy dev | Windows + **PowerShell 7** (`pwsh`), `git`, OpenSSH (`ssh`, `scp` — có sẵn trong Windows) |
| Git | Repo phải **commit sạch** trước khi deploy (deploy lấy code từ `git HEAD`) |
| Node | Local v24.18.0 (khớp Node 24 cài trong LXC) |

> **Vì sao không Docker?** Repo là Node thuần, không có bước build frontend
> (`public/` phục vụ trực tiếp), và chỉ có 2 module native (`sqlite3`, `sharp`) —
> cài bằng apt toolchain là đủ. LXC giữ được snapshot/limt tài nguyên của Proxmox
> và không cần thêm tầng network/volume.

---

## 1. Tạo LXC (trên node Proxmox)

```bash
# trên node Proxmox, user root
bash deploy/proxmox/create-lxc.sh
# hoặc chọn CTID / tài nguyên:
CTID=120 CORES=4 MEMORY=4096 DISK_GB=24 bash deploy/proxmox/create-lxc.sh
```

Script làm: tải template Debian 12 → tạo CT unprivileged (`nesting=1`) → start →
cài `build-essential python3 sqlite3 nginx ufw logrotate` + Node 24 (NodeSource) →
đặt timezone `Asia/Ho_Chi_Minh` → giới hạn journald 500MB.
Cuối script in ra **IP của container** (vd `192.168.1.50`) và các bước tiếp theo.

Ghi chú:
- Script cố ý đặt `--onboot 0`; bật sau khi đã kiểm tra app chạy ổn:
  `pct set <CTID> --onboot 1`.
- Bật backup định kỳ cho container trong GUI: *Datacenter ▸ Backup ▸ Add* (giữ ≥7 bản).
- Không có `CT_PASSWORD` thì root trong CT không có mật khẩu → vào bằng
  `pct console <CTID>`, hoặc `pct exec <CTID> -- passwd root`.

## 2. Cấu hình app server (trong container)

```bash
# trên node Proxmox (không cần SSH vào container)
pct push <CTID> deploy/proxmox/bootstrap-app.sh /root/bootstrap-app.sh
pct exec <CTID> -- bash /root/bootstrap-app.sh

# khi đã có domain trỏ về IP container và port 80 mở:
pct exec <CTID> -- env DOMAIN=cell.example.vn EMAIL=admin@example.vn bash /root/bootstrap-app.sh
```

Script (idempotent, chạy lại nhiều lần được):

1. Tạo user hệ thống `celltracker` (no-login) + `/opt/cell-tracker/{releases,shared/uploads,incoming,bin}`.
2. Tạo `shared/.env` với **secret ngẫu nhiên** (`JWT_SECRET`, `GUEST_SECRET`), chmod `600`.
   Nếu file đã có → **không ghi đè**, chỉ thêm khoá còn thiếu.
3. Cài `/etc/systemd/system/cell-tracker.service` (Restart=always, hardening:
   `ProtectSystem=full`, `PrivateTmp`, `NoNewPrivileges`, `ReadWritePaths` chỉ shared+releases).
4. Cấu hình Nginx reverse proxy (`client_max_body_size 220m`, `proxy_request_buffering off`,
   `X-Forwarded-Proto/Host`, giữ `Host`, `gzip`) → thay `default` site.
5. `ufw`: cho 22/80/443.
6. `/etc/cron.d/cell-tracker-backup`: backup CSDL 03:20 hằng ngày (trước OCID sync 03:30).
7. Có `DOMAIN` → `certbot --nginx` (HTTP-01, tự gia hạn qua `certbot.timer`).

## 3. Deploy lần đầu + chuyển dữ liệu từ local

Dữ liệu đang chạy ở local: `D:\Code\database.sqlite` (~61MB) và `D:\Code\cell-tracker\uploads\`.

```powershell
# 1) (Khuyến nghị) tạo bản sao nhất quán của DB đang dùng (an toàn cả khi app đang chạy)
sqlite3 D:\Code\database.sqlite ".backup 'D:\Code\database.seed-20261022.sqlite'"

# 2) từ gốc repo, deploy lần đầu kèm seed dữ liệu
pwsh ./deploy/deploy.ps1 -Target root@192.168.1.50 -FirstDeploy `
       -SeedDatabase D:\Code\database.seed-20261022.sqlite `
       -SeedUploads D:\Code\cell-tracker\uploads
```

Script: commit check → smoke test `_authtest.js` → `git archive HEAD` → zip →
scp → (lần đầu: chép DB/uploads vào `shared/`) → chạy `bin/deploy-release.sh`
trên server → kiểm tra `/api/version`.

Sau khi deploy xong:

1. Mở `https://<domain>/` (hoặc `http://<IP>/` nếu chưa có cert).
2. Đăng nhập admin → **Admin ▸ Cài đặt** đặt:
   - `public_base_url` = `https://<domain>`  ← dùng cho link kích hoạt email + returnUrl payOS.
     Không đặt thì app suy ra từ header `Host`; sau Nginx vẫn đúng, nhưng đặt tường minh an toàn hơn.
   - `payos_webhook_url` = `https://<domain>/api/payos/webhook`, rồi bấm đăng ký webhook bên payOS.
   - Cấu hình SMTP (nếu chưa) → gửi thử.
3. Đổi mật khẩu admin (nếu đang dùng mật khẩu dev).
4. Kiểm tra PWA trên điện thoại: mở `https://<domain>/m/` → "Thêm vào màn hình chính".
5. Bật khởi động cùng Proxmox: `pct set <CTID> --onboot 1`.

## 4. Cập nhật phiên bản (workflow hằng ngày)

```powershell
# sửa code ở local, chạy test tay nếu cần, rồi:
#  1. bump version trong package.json + thêm mục mới trong CHANGELOG.md
#  2. commit
git add -A; git commit -m "feat: ..."
#  3. deploy
pwsh ./deploy/deploy.ps1 -Target root@192.168.1.50
```

`deploy.ps1` sẽ:
1. Từ chối nếu working tree còn thay đổi chưa commit (`-AllowDirty` để bỏ qua — khi đó zip
   **chỉ chứa HEAD**, không chứa thay đổi chưa commit).
2. So version với `/api/version` trên server; trùng thì cảnh báo (`-AllowSameVersion` để bỏ qua).
3. Chạy `node _authtest.js` (smoke test) — `-SkipTests` để bỏ qua.
4. `git archive HEAD` → `dist/cell-tracker-<version>-<timestamp>.zip`
   (loại `node_modules`, test `_*`, `sample/`, `tests/`, `.env`, `uploads`, log — theo `.gitattributes`).
5. scp lên `/opt/cell-tracker/incoming/`, rồi SSH chạy `bin/deploy-release.sh`:
   - giải nén vào `releases/<ts>-<ver>` (staging `mktemp -d` cùng filesystem → `mv` atomic),
   - `npm ci --omit=dev` (compile `sqlite3`/`sharp` nếu cần, ~1–3 phút lần đầu),
   - chuyển symlink `current` (atomic), `systemctl restart`,
   - **health gate**: poll `/api/version` tới 60s; sai version/như cũ → tự quay về release
     trước, restart, exit 1,
   - giữ 5 release gần nhất.

Tải ảnh hưởng: mỗi lần deploy app downtime ~2–5 giây (restart Node). Dữ liệu không bị ảnh hưởng.

### Checklist riêng khi sửa app di động `/m/`
`public/m/sw.js` cache app shell của PWA. Sửa `public/m/app.js` (hoặc `app.css`/`index.html`)
mà **không** đổi `CACHE_VERSION` thì máy người dùng vẫn chạy bản cũ (stale-while-revalidate).
→ Mỗi lần sửa asset trong `/m/`, tăng `CACHE_VERSION` (vd `cell-m-v8` → `cell-m-v9`).

## 5. Rollback thủ công

```bash
# trên node Proxmox
pct exec <CTID> -- ls -1dt /opt/cell-tracker/releases/*/
# chọn bản muốn quay lại rồi:
pct exec <CTID> -- bash -c 'ln -sfn /opt/cell-tracker/releases/<ts>-<ver> /opt/cell-tracker/current.tmp && mv -Tf /opt/cell-tracker/current.tmp /opt/cell-tracker/current && systemctl restart cell-tracker'
```

Deploy đã tự rollback khi health check fail; rollback tay chỉ cần khi phát hiện lỗi
logic sau khi đã "xanh".

## 6. Vận hành

| Việc | Lệnh (trong container) |
|---|---|
| Xem log | `journalctl -u cell-tracker -f --no-pager` |
| Trạng thái | `systemctl status cell-tracker --no-pager` |
| Restart | `systemctl restart cell-tracker` |
| Backup DB ngay | `sudo -u celltracker /opt/cell-tracker/bin/backup-db.sh` → `shared/backups/` |
| Kiểm tra DB | `sqlite3 /opt/cell-tracker/shared/database.sqlite 'PRAGMA integrity_check;'` |
| Xem `.env` | `cat /opt/cell-tracker/shared/.env` (chứa secret!) |

Backup có 2 lớp: **vzdump của Proxmox** (toàn bộ container) + **`.backup` SQLite hằng ngày**
(`shared/backups/database-*.sqlite`, giữ 14 bản, đặt trước job OCID sync 03:30).
Muốn backup ra ngoài container: `pct pull <CTID> /opt/cell-tracker/shared/backups/... D:\backup\`.

## 7. Cấu hình bằng biến môi trường (`.env`)

Xem `.env.example` để có danh sách đầy đủ. Bản production do `bootstrap-app.sh` sinh:

| Biến | Giá trị prod | Ghi chú |
|---|---|---|
| `NODE_ENV` | `production` | bắt buộc có `JWT_SECRET` khác default, cookie guest thêm `Secure` |
| `PORT` | `3000` | |
| `HOST` | `127.0.0.1` | chỉ Nginx gọi được; bỏ trống = nghe mọi interface (local) |
| `TRUST_PROXY` | `1` | tin `X-Forwarded-*` → link email/payOS ra đúng `https` |
| `JWT_SECRET` | ngẫu nhiên | thiếu/để default ⇒ server **dừng**, ghi `FATAL` |
| `GUEST_SECRET` | ngẫu nhiên | thiếu ⇒ key đổi mỗi lần restart |
| `DB_PATH` | `/opt/cell-tracker/shared/database.sqlite` | bỏ trống = thư mục cha repo (hành vi cũ cho local) |
| `UPLOAD_DIR` | `/opt/cell-tracker/shared/uploads` | bỏ trống = `<repo>/uploads` |
| `HTTPS_PORT` | `0` | LAN dev dùng cert tự ký; prod để 0 (TLS ở Nginx) |

Sửa `.env` xong phải `systemctl restart cell-tracker`.

## 8. Sự cố thường gặp

| Triệu chứng | Nguyên nhân / cách xử lý |
|---|---|
| `systemctl status` = `activating (auto-restart)`, log `FATAL: JWT_SECRET` | Chưa đặt `JWT_SECRET` trong `shared/.env`. Sinh: `openssl rand -hex 32`. |
| Deploy fail ở `npm ci` (`gyp ERR!`, thiếu compiler) | Thiếu `build-essential python3` → `apt install -y build-essential python3` rồi deploy lại. |
| Deploy fail "Health check THẤT BẠI" | Xem 60 dòng log ngay trên output; app tự quay về bản trước. Thường do migration DB hoặc lỗi cú pháp mới. |
| Upload file lớn bị 413 | `client_max_body_size` trong Nginx (đang 220m) hoặc giới hạn của app. |
| Link email / payOS trỏ về `http://...` hoặc IP nội bộ | Thiếu `TRUST_PROXY=1` hoặc chưa đặt `public_base_url` trong Admin. |
| Điện thoại vẫn thấy UI cũ sau deploy | `CACHE_VERSION` trong `public/m/sw.js` chưa đổi. |
| `EADDRINUSE` khi start | Còn process cũ: `ss -lptn 'sport = :3000'`, hoặc instance thứ 2 — **không được chạy 2 instance** (cron sync/retention và SQLite sẽ tranh nhau). |
| Certbot fail | DNS chưa trỏ về IP container, hoặc port 80 bị chặn (kiểm tra router/port-forward, `ufw status`). |
| DB ở sai chỗ sau lần chạy đầu | `DB_PATH` chưa đặt ⇒ DB rơi về thư mục cha repo. Đặt lại trong `.env` rồi chuyển file vào `shared/`. |

## 9. Giới hạn đã biết của bản production hiện tại

- Trang web nạp Leaflet/leaflet-draw/markercluster/locatecontrol, Font Awesome và JSZip
  từ **CDN công khai** (unpkg/jsdelivr/cdnjs) → client cần Internet ra ngoài. Nếu cần chạy
  nội bộ hoàn toàn: tải các asset này vào `public/vendor/` và sửa `public/*.html` (chưa làm ở v1).
- Không chạy được 2 bản song song (blue-green) vì cron + SQLite trong cùng process.
- Chỉ deploy từ `git HEAD` — thay đổi chưa commit không lên server (trừ khi commit).
- `.env` nằm trên server; xoá container là mất secret → sao lưu cùng vzdump.

## 10. File trong thư mục này

| File | Ở đâu | Vai trò |
|---|---|---|
| `deploy/proxmox/create-lxc.sh` | node Proxmox | tạo + cài LXC |
| `deploy/proxmox/bootstrap-app.sh` | trong LXC | systemd + Nginx + `.env` + ufw + cron backup + certbot |
| `deploy/deploy.ps1` | máy dev | đóng gói & đẩy bản mới |
| `bin/deploy-release.sh` | trong LXC (`/opt/cell-tracker/bin`) | nhận release: cài deps, switch symlink, restart, health check, rollback |
| `bin/backup-db.sh` | trong LXC | backup SQLite an toàn khi app đang chạy |
| `.env.example` | repo | danh sách biến môi trường |

> Ghi chú kỹ thuật: `deploy/deploy.ps1` **không** dùng chữ tiếng Việt có dấu, vì một số
> parser PowerShell coi ký tự gạch ngang trong `Đ/đ` và dấu nháy thông minh `“ ” ‘ ’` là
> dấu kết thúc chuỗi → lỗi parse không rõ nguyên nhân. Comment tiếng Việt có dấu nằm trong
> README này.
