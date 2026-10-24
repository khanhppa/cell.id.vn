#!/usr/bin/env bash
# ============================================================================
# Cell.id.vn — cấu hình LXC thành "app server" (systemd + Nginx + thư mục dữ liệu)
# ----------------------------------------------------------------------------
# Chạy TRONG container, user root. Idempotent: chạy lại nhiều lần an toàn.
#
#   # 1) Đứng sau Nginx Proxy Manager (KHUYẾN NGHỊ khi đã có NPM):
#   TLS_MODE=npm DOMAIN=cell.id.vn bash bootstrap-app.sh
#
#   # 2) Không có domain / chỉ dùng IP nội bộ:
#   bash bootstrap-app.sh
#
#   # 3) Để CHÍNH container xin Let's Encrypt (port 80 phải trỏ thẳng vào LXC này):
#   TLS_MODE=self DOMAIN=cell.id.vn EMAIL=admin@example.vn bash bootstrap-app.sh
#
# TLS_MODE:
#   npm  — KHÔNG xin cert trong container; Nginx nội bộ chỉ nghe :80, NPM lo
#          HTTPS/redirect. Đặt PUBLIC_BASE_URL=https://$DOMAIN + TRUST_PROXY=2.
#   self — cài certbot, xin cert HTTP-01, bật :443 + redirect (như bản cũ).
#   none — chỉ HTTP, server_name = DOMAIN (nếu có) hoặc "_". Mặc định.
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
TLS_MODE="${TLS_MODE:-none}"          # none | npm | self

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[warn] %s\033[0m\n' "$*" >&2; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }
rand_hex() { openssl rand -hex 32; }

case "$TLS_MODE" in
  none|npm|self) ;;
  *) die "TLS_MODE không hợp lệ: '$TLS_MODE' (chỉ nhận: none | npm | self)" ;;
esac
if [[ "$TLS_MODE" != "none" && -z "$DOMAIN" ]]; then
  die "TLS_MODE=$TLS_MODE cần DOMAIN=<tên miền> (vd DOMAIN=cell.id.vn)"
fi
# In rõ chế độ ngay đầu để phát hiện chạy NHẦM BẢN SCRIPT CŨ trên server
# (bản cũ không hiểu TLS_MODE → vẫn chạy certbot và fail).
say "bootstrap-app.sh — TLS_MODE=$TLS_MODE${DOMAIN:+, DOMAIN=$DOMAIN}"

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
[ -f "$ENV_FILE" ] || {
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
}
[[ -f "$ENV_FILE" ]] || die "không tạo được $ENV_FILE"

# Thêm khoá nếu thiếu; KHÔNG ghi đè giá trị đã có (trừ khi dùng upsert_env).
add_missing() {
  local key="$1" value="$2"
  grep -qE "^${key}=" "$ENV_FILE" || printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
}
# Ghi đè/đặt giá trị (dùng cho cấu hình phụ thuộc TLS_MODE/DOMAIN).
upsert_env() {
  local key="$1" value="$2"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
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
add_missing PUBLIC_BASE_URL ""

# Đứng sau NPM: 2 hop proxy (NPM → nginx nội bộ) để req.ip là IP thật của client.
if [[ "$TLS_MODE" == "npm" ]]; then
  upsert_env TRUST_PROXY 2
  upsert_env PUBLIC_BASE_URL "https://$DOMAIN"
  say "TLS_MODE=npm: PUBLIC_BASE_URL=https://$DOMAIN, TRUST_PROXY=2"
elif [[ -n "$DOMAIN" ]]; then
  upsert_env PUBLIC_BASE_URL "https://$DOMAIN"
fi
chown "$APP_USER:$APP_USER" "$ENV_FILE"
chmod 600 "$ENV_FILE"

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
        # Host gốc được giữ nguyên để app dựng URL công khai (email, payOS returnUrl).
        # Khi đứng sau Nginx Proxy Manager, NPM gửi X-Forwarded-Proto=https và
        # X-Forwarded-Host=<domain> → phải chuyển tiếp giá trị ĐÓ, không dùng $scheme
        # (NPM→LXC là http nên $scheme sẽ làm app tưởng đang chạy http).
        # Host được NPM giữ nguyên (proxy_set_header Host $host) nên $host = domain.
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $cell_tracker_proto;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        # Service worker + PWA: không cache HTML của app ở proxy
        add_header Cache-Control "no-cache" always;
    }
}
NGINX

# Map "proto thật": request đến từ proxy phía trước (NPM) thì dùng header của nó,
# truy cập trực tiếp thì fallback $scheme. (Host dùng $host — NPM giữ nguyên Host.)
cat > /etc/nginx/conf.d/cell-tracker-forwarded.conf <<'NGINXMAP'
# Sinh bởi bootstrap-app.sh — dùng cho site cell-tracker.
map $http_x_forwarded_proto $cell_tracker_proto {
    default $http_x_forwarded_proto;
    ""      $scheme;
}
NGINXMAP

if [[ -n "$DOMAIN" ]]; then
  sed -i "s/server_name _;/server_name ${DOMAIN};/" "/etc/nginx/sites-available/$APP_NAME"
  say "server_name = $DOMAIN"
fi

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

# ---- 9. Hướng dẫn còn lại ------------------------------------------------
say "Bước thủ công còn lại"
cat <<EOF

  • Deploy lần đầu (chạy trên MÁY DEV):
       pwsh ./deploy/deploy.ps1 -Target root@<IP-CONTAINER-VAY> -FirstDeploy

  • Sau khi đăng nhập được trang Admin, kiểm tra/đặt:
       public_base_url = https://<domain>
     (.env đã có PUBLIC_BASE_URL=$DOMAIN nên thường không cần; app đọc env trước DB)
       payos_webhook_url = https://<domain>/api/payos/webhook

  • Bật khởi động cùng Proxmox:  pct set <CTID> --onboot 1   (trên node Proxmox)

  Xem log: journalctl -u $APP_NAME -f --no-pager
  Trạng thái: systemctl status $APP_NAME --no-pager
EOF

# ---- 10. TLS -----------------------------------------------------------------
case "$TLS_MODE" in
  self)
    say "Xin chứng chỉ Let's Encrypt cho $DOMAIN (TLS_MODE=self)"
    # Cảnh báo sớm: HTTP-01 chỉ hoạt động khi domain trỏ THẲNG vào container này.
    resolved="$(getent ahosts "$DOMAIN" 2>/dev/null | awk '{print $1}' | sort -u | tr '\n' ' ' || true)"
    [[ -n "$resolved" ]] && echo "    $DOMAIN → $resolved"
    if printf '%s\n' $resolved | grep -qE '^(104\.(1[6-9]|2[0-7])\.|172\.6[7-9]\.|2606:4700:)'; then
      warn "$DOMAIN đang đi qua Cloudflare/CDN — Let's Encrypt HTTP-01 sẽ KHÔNG xác thực được từ container này."
      warn "Dùng TLS_MODE=npm (NPM xin cert bằng DNS-01/Origin Cert), hoặc tạm tắt proxy (grey cloud) khi xin cert."
    fi
    apt-get install -y -qq certbot python3-certbot-nginx
    cert_ok=0
    if [[ -n "$EMAIL" ]]; then
      certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect && cert_ok=1
    else
      certbot --nginx -d "$DOMAIN" --register-unsafely-without-email --non-interactive --agree-tos --redirect && cert_ok=1
    fi
    if [[ $cert_ok -eq 1 ]]; then
      systemctl list-timers 'certbot.timer' --no-pager | sed 's/^/    /' || true
    else
      # KHÔNG abort: app vẫn chạy được qua HTTP; certbot thường fail vì port 80
      # đang do Nginx Proxy Manager giữ hoặc DNS chưa trỏ về LXC này.
      warn "certbot thất bại — app vẫn chạy HTTP bình thường."
      warn "Nếu bạn dùng Nginx Proxy Manager: chạy lại với TLS_MODE=npm DOMAIN=$DOMAIN."
      warn "Nếu không: kiểm tra DNS A → IP container này và port 80 đã mở/forward đúng chưa."
      # certbot --nginx có thể đã sửa site trước khi fail → nạp lại cấu hình sạch.
      nginx -t && systemctl reload nginx || true
    fi
    ;;
  npm)
    say "TLS_MODE=npm — KHÔNG xin cert trong container"
    cat <<EOF

  Nginx nội bộ đang nghe HTTP :80 (không redirect, không 443). Làm trên Nginx Proxy Manager:

    1) Hosts ▸ Proxy Hosts ▸ Add Proxy Host
       Domain Names      : $DOMAIN
       Scheme            : http
       Forward Hostname  : <IP CỦA CONTAINER NÀY>   (xem: hostname -I)
       Forward Port      : 80
       Websockets Support: ON
       Block Common Exploits: ON (tuỳ chọn)

    2) Tab Advanced (custom Nginx) — upload Excel tới 200MB:
       client_max_body_size 220m;
       proxy_request_buffering off;
       proxy_read_timeout 300s;
       proxy_send_timeout 300s;

    3) Tab SSL:
       SSL Certificate   : Request a new SSL Certificate (Let's Encrypt)
       Force SSL         : ON
       HTTP/2 Support    : ON
       HSTS Enabled      : tuỳ chọn

    4) DNS: bản ghi A của $DOMAIN → IP công khai; router forward 80/443 → IP của NPM
       (KHÔNG forward vào container này).

    5) Kiểm tra từ ngoài:  curl -I https://$DOMAIN/healthz

  Nếu dùng ufw/Proxmox firewall: chỉ cho IP của NPM truy cập container này port 80.
EOF
    ;;
  none)
    echo
    if [[ -n "$DOMAIN" ]]; then
      echo "  Nginx nội bộ: HTTP :80, server_name=$DOMAIN (chưa bật HTTPS trong container)."
      echo "  Muốn container tự xin cert: chạy lại với TLS_MODE=self DOMAIN=$DOMAIN EMAIL=..."
    else
      echo "  Nginx nội bộ: HTTP :80 (server_name _), chưa có domain/HTTPS."
      echo "  Đứng sau Nginx Proxy Manager: chạy lại với TLS_MODE=npm DOMAIN=<domain>."
      echo "  Muốn container tự xin cert: TLS_MODE=self DOMAIN=<domain> EMAIL=<email>."
    fi
    ;;
esac
