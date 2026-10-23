#!/usr/bin/env bash
# ============================================================================
# Cell.id.vn — tạo LXC trên Proxmox VE (chạy trên NODE Proxmox, user root)
# ----------------------------------------------------------------------------
#   bash create-lxc.sh                 # mặc định: CTID trống, Debian 12, 2 vCPU/2GB/16GB
#   CTID=120 bash create-lxc.sh
#
# Script chỉ TẠO container + cài gói nền (Node 24, Nginx, build tools). Nó KHÔNG
# đụng tới container khác và không đổi cấu hình node Proxmox.
# Sau khi chạy: xem IP in ra ở cuối, rồi làm tiếp theo deploy/README.md (bootstrap-app.sh).
# ============================================================================
set -euo pipefail

CTID="${CTID:-$(pvesh get /cluster/nextid)}"
HOSTNAME_="${HOSTNAME_:-cell-tracker}"
STORAGE="${STORAGE:-local-lvm}"
BRIDGE="${BRIDGE:-vmbr0}"
CORES="${CORES:-2}"
MEMORY="${MEMORY:-2048}"
SWAP="${SWAP:-512}"
DISK_GB="${DISK_GB:-16}"
CT_PASSWORD="${CT_PASSWORD:-}"
NODE="${NODE:-$(hostname -s)}"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "phải chạy bằng root trên node Proxmox"
command -v pct >/dev/null || die "không thấy lệnh pct — đây có phải máy Proxmox VE?"

say "Proxmox host: $NODE — tạo CT $CTID ($HOSTNAME_)"

# ---- 1. Template Debian 12 (dùng lại nếu đã có) ----------------------------
TEMPLATE_STORAGE="${TEMPLATE_STORAGE:-local}"
EXISTING_TMPL="$(pvesm list "$TEMPLATE_STORAGE" --content vztmpl 2>/dev/null | awk '$1 ~ /debian-12-standard/ {print $1}' | head -n1 || true)"
if [[ -z "$EXISTING_TMPL" ]]; then
  say "Tải template Debian 12 vào storage '$TEMPLATE_STORAGE'"
  pveam update >/dev/null
  AVAIL="$(pveam available --section system | awk '/debian-12-standard/ {print $2}' | tail -n1)"
  [[ -n "$AVAIL" ]] || die "không tìm thấy template debian-12-standard"
  pveam download "$TEMPLATE_STORAGE" "$AVAIL"
  EXISTING_TMPL="$TEMPLATE_STORAGE:vztmpl/$AVAIL"
fi
say "Dùng template: $EXISTING_TMPL"

# ---- 2. Tạo container ------------------------------------------------------
# unprivileged=1: mặc định an toàn của Proxmox. nesting=1 để systemd/dịch vụ trong
# container hoạt động bình thường trên nhân host.
say "Tạo container (không bật 'Start on boot' — bật sau khi app đã chạy ổn)"
PCT_ARGS=(
  "$CTID" "$EXISTING_TMPL"
  --hostname "$HOSTNAME_"
  --cores "$CORES" --memory "$MEMORY" --swap "$SWAP"
  --rootfs "${STORAGE}:${DISK_GB}"
  --unprivileged 1
  --features nesting=1
  --net0 "name=eth0,bridge=${BRIDGE},ip=dhcp"
  --onboot 0
  --tags "cell-tracker,nodejs"
)
if [[ -n "$CT_PASSWORD" ]]; then
  pct create "${PCT_ARGS[@]}" --password "$CT_PASSWORD" --description "Cell.id.vn production"
else
  say "Không đặt CT_PASSWORD → tài khoản root trong CT sẽ không có mật khẩu."
  say "Sau khi tạo, chạy trên node: pct exec $CTID -- passwd root   (hoặc dùng console)"
  pct create "${PCT_ARGS[@]}" --description "Cell.id.vn production"
fi

pct start "$CTID"

say "Chờ container lấy IP qua DHCP…"
IP=""
for _ in $(seq 1 30); do
  IP="$(pct exec "$CTID" -- bash -c "ip -4 -o addr show eth0 2>/dev/null | awk '{print \$4}' | cut -d/ -f1")" || true
  [[ -n "$IP" ]] && break
  sleep 2
done
[[ -n "$IP" ]] || die "container chưa lấy được IP — mở console: pct console $CTID"
say "Container IP: $IP"

# ---- 3. Cài gói nền trong container ---------------------------------------
say "Cập nhật apt + gói nền"
pct exec "$CTID" -- bash -c "export DEBIAN_FRONTEND=noninteractive; apt-get update -qq && apt-get upgrade -y -qq"

say "Cài công cụ build + nginx"
# build-essential/python3: sqlite3 và sharp phải compile (không có prebuilt cho mọi ABI)
pct exec "$CTID" -- bash -c "export DEBIAN_FRONTEND=noninteractive; apt-get install -y -qq --no-install-recommends \
  curl ca-certificates gnupg git rsync unzip build-essential python3 sqlite3 nginx ufw logrotate"

say "Cài Node.js 24 (NodeSource)"
# Bản chính thức: https://deb.nodesource.com/setup_24.x
pct exec "$CTID" -- bash -c "curl -fsSL https://deb.nodesource.com/setup_24.x -o /tmp/nodesource_setup.sh && bash /tmp/nodesource_setup.sh"
pct exec "$CTID" -- bash -c "export DEBIAN_FRONTEND=noninteractive; apt-get install -y -qq nodejs && node -v && npm -v"

say "Múi giờ Asia/Ho_Chi_Minh"
pct exec "$CTID" -- bash -c "timedatectl set-timezone Asia/Ho_Chi_Minh || ln -sf /usr/share/zoneinfo/Asia/Ho_Chi_Minh /etc/localtime"

say "Giới hạn journald (500MB)"
pct exec "$CTID" -- bash -c "sed -i 's/^#\\?SystemMaxUse=.*/SystemMaxUse=500M/' /etc/systemd/journald.conf && systemctl restart systemd-journald"

say "Xong phần nền. Bước tiếp theo (xem deploy/README.md):"
cat <<EOF

  1) Tạo user + thư mục app, firewall:
       scp deploy/proxmox/bootstrap-app.sh root@${IP}:/root/
       ssh root@${IP} 'bash /root/bootstrap-app.sh'
     (bootstrap-app.sh phải chạy SAU lần deploy đầu, vì nó tạo systemd+nginx)

  2) Trên máy dev (Windows PowerShell 7), từ gốc repo:
       ./deploy/deploy.ps1 -Target root@${IP} -FirstDeploy

  3) Bật khởi động cùng Proxmox khi đã kiểm tra ổn:
       pct set ${CTID} --onboot 1
       (nên bật backup định kỳ cho CT ${CTID} trong GUI: Datacenter ▸ Backup)

  Tài nguyên có thể đổi sau: pct set ${CTID} --cores 4 --memory 4096
EOF
