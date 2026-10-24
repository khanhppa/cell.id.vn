#!/usr/bin/env bash
# ============================================================================
# Cell.id.vn — cấu hình LXC thành "app server" (systemd + Nginx + thư mục dữ liệu)
# ----------------------------------------------------------------------------
# Chạy TRONG container, user root. Idempotent: chạy lại nhiều lần an toàn.
#
#   bash bootstrap-app.sh                          # không có domain, chỉ HTTP
#   DOMAIN=cell.example.vn EMAIL=admin@example.vn bash bootstrap-app.sh
#
# DOMAIN trống → Nginx chỉ nghe :80 (dùng tạm IP). Có DOMAIN → cài certbot và xin
# chứng chỉ Let's Encrypt (HTTP-01), bật :443 + redirect http→https.
#
# KHÔNG tự deploy code. Lần deploy đầu do máy dev chạy deploy/deploy.ps1
# (nó gọi bin/deploy-release.sh), sau đó script này khởi động service.
# ============================================================================
set -euo pipefail

APP_NAME="cell-tracker"
APP_USER="celltracker"
APP_ROOT="/opt/cell-tracker"
DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }
rand_hex() { openssl rand -hex 32; }

[[ $EUID -eq 0 ]] || die "phải chạy bằng root trong container"
command -v node >/dev/null || die "chưa có node — cài bằng deploy/proxmox/create-lxc.sh"
NODE_BIN="$(command -v node)"
NODE_MAJOR="$(node -v | sed 's/^v\([0-9]*\).*/\1/')"
[[ "$NODE_MAJOR" -ge 22 ]] || die "cần Node >= 22 (đang có $(node -v))"
command -v visudo >/dev/null || die "thiếu sudo/visudo (cần cho GitHub Actions runner) — chạy: apt-get install -y sudo"
command -v nginx >/dev/null || die "chưa có nginx — apt-get install -y nginx"
command -v sqlite3 >/dev/null || die "chưa có sqlite3 — apt-get install -y sqlite3"

# ---- 1. User hệ thống + cây thư mục ---------------------------------------
say "User hệ thống '$APP_USER' + cây thư mục $APP_ROOT"
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "$APP_ROOT" --shell /usr/sbin/nologin "$APP_USER"
fi
mkdir -p "$APP_ROOT"/{releases,shared/uploads,shared/uploads/tracker,shared/uploads/clf,incoming,bin}
# Code + runtime file do user app sở hữu; releases bị thay khi deploy nên chown sau mỗi lần.
chown -R "$APP_USER:$APP_USER" "$APP_ROOT"
chmod 755 "$APP_ROOT"
# Nếu đã cài GitHub Actions runner (deploy/ci/install-runner.sh) thì `incoming/`
# thuộc user runner — chown -R ở trên vừa lấy lại, trả về để CI ghi được artifact.
if id -u ghrunner >/dev/null 2>&1; then
  chown -R ghrunner:ghrunner "$APP_ROOT/incoming"
  chmod 750 "$APP_ROOT/incoming"
fi
# .env chứa secret → chỉ user app đọc được
[ -f "$APP_ROOT/shared/.env" ] && chown "$APP_USER:$APP_USER" "$APP_ROOT/shared/.env" && chmod 600 "$APP_ROOT/shared/.env"

# ---- 2. .env production (chỉ tạo khi chưa có) ----------------------------
ENV_FILE="$APP_ROOT/shared/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  say "Tạo $ENV_FILE với secret ngẫu nhiên"
  umask 077
  cat > "$ENV_FILE" <<ENVEOF
# Sinh tự động bởi deploy/proxmox/bootstrap-app.sh — sửa tay được, giữ chmod 600.
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
TRUST_PROXY=1
JWT_SECRET=$(rand_hex)
GUEST_SECRET=$(rand_hex)
DB_PATH=$APP_ROOT/shared/database.sqlite
UPLOAD_DIR=$APP_ROOT/shared/uploads
HTTPS_PORT=0
ENVEOF
  umask 022
  chown "$APP_USER:$APP_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
else
  say "$ENV_FILE đã có — giữ nguyên (không ghi đè secret)"
  # Bảo đảm có các khoá tối thiểu nếu file cũ thiếu (chỉ THÊM, không sửa giá trị đang có).
  add_missing() {
    local key="$1" value="$2"
    grep -qE "^${key}=" "$ENV_FILE" || printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  }
  add_missing NODE_ENV production

  add_missing PORT 3000
  add_missing HOST 127.0.0.1
  add_missing TRUST_PROXY 1
  add_missing JWT_SECRET "$(rand_hex)"
  add_missing GUEST_SECRET "$(rand_hex)"
  add_missing DB_PATH "$APP_ROOT/shared/database.sqlite"
  add_missing UPLOAD_DIR "$APP_ROOT/shared/uploads"
  add_missing HTTPS_PORT 0
  chmod 600 "$ENV_FILE"
fi

# ---- 3. Quản lý release: bin/deploy-release.sh + bin/backup-db.sh ---------
# Hai script này cũng nằm trong repo (bin/), nhưng bản chạy trên server được chép
# ra shared để deployment không phụ thuộc vào release hiện tại (nếu release hỏng
# thì script rollback vẫn còn).
for f in deploy-release.sh backup-db.sh; do
  if [[ -f "/tmp/setup-bin/$f" ]]; then
    install -m 755 -o root -g root "/tmp/setup-bin/$f" "$APP_ROOT/bin/$f"
  elif [[ ! -f "$APP_ROOT/bin/$f" ]]; then
    echo "CẢNH BÁO: thiếu $f — deploy.ps1 sẽ tự đẩy file này khi chạy." >&2
  fi
done

# ---- 4. systemd unit ------------------------------------------------------
say "systemd: /etc/systemd/system/$APP_NAME.service"
cat > "/etc/systemd/system/$APP_NAME.service" <<UNIT
[Unit]
Description=Cell.id.vn (cell-tracker) — Node production
Documentation=https://github.com/khanhppa/cell.id.vn#readme
After=network-online.target
Wants=network-online.target
# Chặn vòng restart vô hạn khi cấu hình sai (sửa .env → systemctl reset-failed)
StartLimitIntervalSec=300
StartLimitBurst=10

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_ROOT/current
EnvironmentFile=$APP_ROOT/shared/.env
ExecStart=$NODE_BIN server.js
Restart=always
RestartSec=3
# Thoát do FATAL (vd thiếu JWT_SECRET) vẫn restart, nhưng StartLimit dừng lại sau 10 lần.
KillSignal=SIGTERM
TimeoutStopSec=30
# Node/SQLite dùng nhiều file descriptor khi upload Excel lớn
LimitNOFILE=65535
# Ghi log ra journald (xem: journalctl -u $APP_NAME -f)
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$APP_NAME

# --- Gia cố bảo mật ---
NoNewPrivileges=yes
ProtectSystem=full
ProtectHome=yes
PrivateTmp=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes
RestrictNamespaces=yes
LockPersonality=yes
# Chỉ thư mục dữ liệu + thư mục code của release hiện tại là ghi được
ReadWritePaths=$APP_ROOT/shared $APP_ROOT/releases

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable "$APP_NAME.service" >/dev/null

# ---- 5. logrotate cho journal đã dùng journald; nginx tự cài rotate sẵn ---

# ---- 6. Nginx reverse proxy ---------------------------------------------
say "Nginx: /etc/nginx/sites-available/$APP_NAME"
cat > "/etc/nginx/sites-available/$APP_NAME" <<'NGINX'
# Cell.id.vn — reverse proxy tới Node (127.0.0.1:3000)
# `proxy_request_buffering off` + timeout dài: upload Excel lớn (app nhận body tới 200MB)
# không bị Nginx ghi hết ra đĩa trước rồi mới chuyển.
upstream cell_tracker_app {
    server 127.0.0.1:3000;
    keepalive 16;
}

server {
    listen 80;
    listen [::]:80;
    server_name _;

    # Body tối đa: khớp giới hạn express.json({limit:'200mb'}) + file upload
    client_max_body_size 220m;
    client_body_timeout 300s;

    # Nén văn bản — app.js/index.html khá lớn
    gzip on;
    gzip_comp_level 5;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css application/javascript application/json application/manifest+json image/svg+xml;
    gzip_vary on;

    # Endpoint chuyển đổi/upload chạy lâu
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    proxy_request_buffering off;

    location / {
        proxy_pass http://cell_tracker_app;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        # Host gốc được giữ nguyên để app dựng URL công khai (email, payOS returnUrl)
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        # Service worker + PWA: không cache HTML của app ở proxy
        add_header Cache-Control "no-cache" always;
    }
}
NGINX

ln -sf "/etc/nginx/sites-available/$APP_NAME" "/etc/nginx/sites-enabled/$APP_NAME"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx >/dev/null
systemctl restart nginx

# ---- 7. Firewall ---------------------------------------------------------
# ufw trong LXC unprivileged có thể KHÔNG khởi tạo được iptables (tuỳ kernel/host
# cấm NET_ADMIN). Đây không phải lỗi chí mạng → cảnh báo và đi tiếp, tránh làm
# hỏng cả quá trình bootstrap sau khi systemd/nginx đã cấu hình xong.
say "ufw: cho SSH + HTTP/HTTPS (bỏ qua nếu LXC không cho phép iptables)"
if command -v ufw >/dev/null 2>&1; then
  if ufw allow 22/tcp >/dev/null 2>&1 \
     && ufw allow 80/tcp >/dev/null 2>&1 \
     && ufw allow 443/tcp >/dev/null 2>&1 \
     && ufw --force enable >/dev/null 2>&1; then
    ufw status verbose | sed 's/^/    /' || true
  else
    warn "ufw không bật được trong LXC này — hãy giới hạn cổng ở Proxmox firewall/router."
    warn "Bỏ qua ufw, tiếp tục cấu hình app."
  fi
else
  warn "không có ufw — bỏ qua (giới hạn cổng ở Proxmox firewall/router)."
fi

# ---- 8. Cron: backup DB hằng ngày ---------------------------------------
say "Cron backup DB (03:20 hằng ngày, giữ 14 bản)"
cat > /etc/cron.d/cell-tracker-backup <<CRON
# Backup CSDL trước khi job OpenCellID sync (03:30) chạy
20 3 * * * $APP_USER $APP_ROOT/bin/backup-db.sh >/dev/null 2>&1
CRON
chmod 644 /etc/cron.d/cell-tracker-backup

# ---- 9. .env: nhắc public_base_url -------------------------------------
say "Bước thủ công còn lại"
cat <<EOF

  • Deploy lần đầu (chạy trên MÁY DEV):
       ./deploy/deploy.ps1 -Target root@<IP-CONTAINER-VAY> -FirstDeploy

  • Sau khi đăng nhập được vào trang Admin, đặt:
       public_base_url = https://<domain>
     (mailer.js + payos.js dùng để dựng link kích hoạt và returnUrl/webhook)
       payos_webhook_url = https://<domain>/api/payos/webhook

  • Bật khởi động cùng Proxmox:  pct set <CTID> --onboot 1   (trên node Proxmox)

  Xem log: journalctl -u $APP_NAME -f --no-pager
  Trạng thái: systemctl status $APP_NAME --no-pager
EOF

if [[ -n "$DOMAIN" ]]; then
  say "Xin chứng chỉ Let's Encrypt cho $DOMAIN"
  apt-get install -y -qq certbot python3-certbot-nginx
  sed -i "s/server_name _;/server_name ${DOMAIN};/" "/etc/nginx/sites-available/$APP_NAME"
  nginx -t && systemctl reload nginx
  if [[ -n "$EMAIL" ]]; then
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect || die "certbot thất bại (DNS đã trỏ về IP này chưa? port 80 mở chưa?)"
  else
    certbot --nginx -d "$DOMAIN" --register-unsafely-without-email --non-interactive --agree-tos --redirect || die "certbot thất bại (DNS đã trỏ về IP này chưa? port 80 mở chưa?)"
  fi
  systemctl list-timers 'certbot.timer' --no-pager | sed 's/^/    /'
else
  echo
  echo "  (Chưa có HTTPS vì DOMAIN trống. Khi có domain: chạy lại với DOMAIN=... EMAIL=... )"
fi
