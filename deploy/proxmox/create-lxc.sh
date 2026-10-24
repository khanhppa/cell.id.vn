#!/usr/bin/env bash
# ============================================================================
# Cell.id.vn — tạo LXC trên Proxmox VE (chạy trên NODE Proxmox, user root)
# ----------------------------------------------------------------------------
# Hỗ trợ cả DHCP và IP TĨNH. Khi chạy trong terminal, script sẽ HỎI IP nếu bạn
# chưa truyền tham số; khi chạy không tương tác (pipe/CI) mặc định là DHCP.
#
#   bash create-lxc.sh                         # hỏi tương tác (DHCP / IP tĩnh)
#   bash create-lxc.sh --ip 192.168.1.50/24 --gw 192.168.1.1
#   bash create-lxc.sh --ip 192.168.1.50/24 --gw 192.168.1.1 --dns "1.1.1.1 8.8.8.8"
#   bash create-lxc.sh --dhcp --yes            # không hỏi, dùng DHCP
#   CTID=120 CORES=4 MEMORY=4096 bash create-lxc.sh
#
# Script chỉ TẠO container + cài gói nền (Node 24, Nginx, build tools). Nó KHÔNG
# đụng tới container khác và không đổi cấu hình node Proxmox.
# Sau khi chạy: xem IP in ra ở cuối, rồi làm tiếp theo deploy/README.md.
# ============================================================================
set -euo pipefail
# Locale C: đảm bảo [0-9] chỉ khớp chữ số ASCII, awk/printf không bị dấu thập phân
# theo locale lạ. Nội dung tiếng Việt vẫn là byte UTF-8 nên hiển thị bình thường.
export LC_ALL=C

# ---- Giá trị mặc định (đặt qua biến môi trường hoặc tham số dòng lệnh) -----
CTID="${CTID:-}"
HOSTNAME_="${HOSTNAME_:-cell-tracker}"
STORAGE="${STORAGE:-local-lvm}"
TEMPLATE_STORAGE="${TEMPLATE_STORAGE:-local}"
BRIDGE="${BRIDGE:-vmbr0}"
VLAN="${VLAN:-}"
CORES="${CORES:-2}"
MEMORY="${MEMORY:-2048}"
SWAP="${SWAP:-512}"
DISK_GB="${DISK_GB:-16}"
CT_PASSWORD="${CT_PASSWORD:-}"
IP_MODE="${IP_MODE:-}"            # dhcp | static  (rỗng = hỏi nếu có terminal)
CT_IP="${CT_IP:-}"                # 192.168.1.50/24 hoặc 192.168.1.50
CT_GW="${CT_GW:-}"
CT_DNS="${CT_DNS:-1.1.1.1 8.8.8.8}"
ASSUME_YES="${ASSUME_YES:-0}"

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[warn] %s\033[0m\n' "$*" >&2; }
die()  { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

usage() {
  cat <<'USAGE'
Tạo LXC Debian 12 cho Cell.id.vn trên Proxmox VE.

Cách dùng:
  bash create-lxc.sh [tuỳ chọn]

Mạng:
  --ip <IP/CIDR>      IP tĩnh cho container, vd 192.168.1.50/24 (bắt buộc kèm --gw)
  --gw <IP>           Gateway của mạng, vd 192.168.1.1
  --dns "<IP...>"     DNS, vd "1.1.1.1 8.8.8.8" (mặc định: 1.1.1.1 8.8.8.8)
  --dhcp              Dùng DHCP (mặc định khi không truyền --ip và không có terminal)
  --vlan <1-4094>     Tag VLAN cho eth0

Tài nguyên (mặc định trong ngoặc):
  --ctid <100+>       Container ID            (tự lấy số trống)
  --hostname <tên>    Hostname                (cell-tracker)
  --cores <n>         vCPU                    (2)
  --memory <MB>       RAM                     (2048)
  --swap <MB>         Swap                    (512)
  --disk <GB>         Dung lượng đĩa          (16)
  --storage <id>      Storage đĩa             (local-lvm)
  --template-storage <id> Storage template    (local)
  --bridge <id>       Bridge mạng             (vmbr0)

Khác:
  --password <mk>     Mật khẩu root trong container (không đặt = không có mật khẩu)
  -y, --yes           Không hỏi xác nhận (dùng cho script tự động)
  -h, --help          Hiện trợ giúp

Ví dụ:
  bash create-lxc.sh --ip 192.168.1.50/24 --gw 192.168.1.1
  bash create-lxc.sh --dhcp -y
USAGE
}

# ---- Parse tham số ---------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --ip) CT_IP="${2:-}"; IP_MODE="static"; shift 2 ;;
    --gw) CT_GW="${2:-}"; shift 2 ;;
    --dns) CT_DNS="${2:-}"; shift 2 ;;
    --dhcp) IP_MODE="dhcp"; shift ;;
    --vlan) VLAN="${2:-}"; shift 2 ;;
    --ctid) CTID="${2:-}"; shift 2 ;;
    --hostname) HOSTNAME_="${2:-}"; shift 2 ;;
    --cores) CORES="${2:-}"; shift 2 ;;
    --memory) MEMORY="${2:-}"; shift 2 ;;
    --swap) SWAP="${2:-}"; shift 2 ;;
    --disk) DISK_GB="${2:-}"; shift 2 ;;
    --storage) STORAGE="${2:-}"; shift 2 ;;
    --template-storage) TEMPLATE_STORAGE="${2:-}"; shift 2 ;;
    --bridge) BRIDGE="${2:-}"; shift 2 ;;
    --password) CT_PASSWORD="${2:-}"; shift 2 ;;
    -y|--yes) ASSUME_YES=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "tham số không hợp lệ: $1  (dùng --help)" ;;
  esac
done

# Cho phép bỏ qua kiểm tra root CHỈ khi chạy test cục bộ với lệnh giả (mock).
# Không dùng cho vận hành thật: `_CREATE_LXC_SKIP_ROOT_CHECK=1`.
if [[ "${_CREATE_LXC_SKIP_ROOT_CHECK:-0}" != "1" && $EUID -ne 0 ]]; then
  die "phải chạy bằng root trên node Proxmox"
fi
command -v pct >/dev/null || die "không thấy lệnh pct — đây có phải máy Proxmox VE?"

# Đặt CT_IP qua biến môi trường cũng được hiểu là muốn IP tĩnh (tương thích cách
# gọi cũ: CT_IP=192.168.1.50/24 CT_GW=… bash create-lxc.sh).
if [[ -n "$CT_IP" && -z "$IP_MODE" ]]; then
  IP_MODE="static"
fi

# ---- Helpers kiểm tra IP ---------------------------------------------------
is_ipv4() {
  local ip="$1" o
  [[ "$ip" =~ ^([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$ ]] || return 1
  for o in "${BASH_REMATCH[@]:1}"; do
    [[ "$o" =~ ^[0-9]+$ ]] || return 1
    (( 10#$o >= 0 && 10#$o <= 255 )) || return 1
  done
  return 0
}

ip_to_int() {
  local a b c d
  IFS=. read -r a b c d <<<"$1"
  echo $(( (10#$a << 24) + (10#$b << 16) + (10#$c << 8) + 10#$d ))
}

int_to_ip() {
  local n="$1"
  echo "$(( (n >> 24) & 255 )).$(( (n >> 16) & 255 )).$(( (n >> 8) & 255 )).$(( n & 255 ))"
}

# Tách "IP/CIDR" → in ra "IP TIỀN_TỐ"; tiền tố mặc định /24.
split_cidr() {
  local raw="$1" ip prefix
  if [[ "$raw" == */* ]]; then
    ip="${raw%%/*}"; prefix="${raw##*/}"
  else
    ip="$raw"; prefix=24
  fi
  is_ipv4 "$ip" || return 1
  [[ "$prefix" =~ ^[0-9]{1,2}$ ]] || return 1
  (( 10#$prefix >= 1 && 10#$prefix <= 32 )) || return 1
  echo "$ip $((10#$prefix))"
}

# Gateway có cùng subnet với IP không?
gw_in_subnet() {
  local ip="$1" prefix="$2" gw="$3"
  is_ipv4 "$gw" || return 1
  local mask=$(( prefix == 32 ? 0xFFFFFFFF : ((0xFFFFFFFF << (32 - prefix)) & 0xFFFFFFFF) ))
  (( ( $(ip_to_int "$ip") & mask ) == ( $(ip_to_int "$gw") & mask ) ))
}

# 192.168.1.50/24 → gợi ý 192.168.1.1
default_gw_for() {
  local ip="$1" prefix="$2"
  [[ "$prefix" -le 30 ]] || return 1   # /31, /32 không có gateway dùng được
  local mask=$(( (0xFFFFFFFF << (32 - prefix)) & 0xFFFFFFFF ))
  local net=$(( $(ip_to_int "$ip") & mask ))
  int_to_ip $(( net + 1 ))
}

validate_dns() {
  local d
  [[ -n "$1" ]] || return 1
  for d in $1; do
    if is_ipv4 "$d"; then continue; fi
    # Cho phép IPv6 (nameserver của LXC hỗ trợ) — chỉ kiểm tra ký tự.
    [[ "$d" == *:* && "$d" =~ ^[0-9a-fA-F:]+$ ]] || return 1
  done
  return 0
}

# ---- Hỏi cấu hình mạng nếu chưa có ----------------------------------------
need_prompt=0
[[ -z "$IP_MODE" ]] && need_prompt=1
[[ "$IP_MODE" == "static" && -z "$CT_IP" ]] && need_prompt=1

if [[ $need_prompt -eq 1 ]]; then
  if [[ -t 0 ]]; then
    echo
    echo "Cấu hình mạng cho container:"
    echo "  1) DHCP — tự động lấy IP từ router (mặc định)"
    echo "  2) IP tĩnh — nhập IP/CIDR, gateway và DNS"
    read -r -p "Chọn [1/2]: " choice || true
    case "${choice:-1}" in
      2) IP_MODE="static" ;;
      1|"") IP_MODE="dhcp" ;;
      *) die "lựa chọn không hợp lệ: $choice" ;;
    esac
  else
    IP_MODE="dhcp"
    warn "Không có terminal để hỏi — dùng DHCP (truyền --ip ... --gw ... nếu cần IP tĩnh)."
  fi
fi

if [[ "$IP_MODE" == "static" ]]; then
  if [[ -z "$CT_IP" ]]; then
    [[ -t 0 ]] || die "chế độ IP tĩnh cần --ip <IP/CIDR>"
    while true; do
      if ! read -r -p "IP tĩnh (vd 192.168.1.50/24): " CT_IP; then
        die "không đọc được IP (kết thúc nhập liệu)"
      fi
      if split_cidr "$CT_IP" >/dev/null; then break; fi
      warn "IP không hợp lệ — nhập dạng a.b.c.d/tiền-tố (1-32), vd 192.168.1.50/24"
    done
  fi
  parsed="$(split_cidr "$CT_IP")" || die "IP không hợp lệ: $CT_IP (dạng a.b.c.d hoặc a.b.c.d/tiền-tố)"
  read -r CT_IP_BASE CT_PREFIX <<<"$parsed"
  CT_IP="$CT_IP_BASE/$CT_PREFIX"
  if [[ "$CT_PREFIX" -ge 31 ]]; then
    die "IP /$CT_PREFIX không có gateway dùng được — chọn tiền tố ≤ 30 (vd /24)"
  fi
else
  CT_IP=""; CT_IP_BASE=""; CT_PREFIX=""
  if [[ -n "$CT_GW" ]]; then
    warn "--gw chỉ có tác dụng với IP tĩnh — bỏ qua (đang dùng DHCP)."
    CT_GW=""
  fi
fi

if [[ "$IP_MODE" == "static" ]]; then
  if [[ -z "$CT_GW" ]]; then
    local_gw="$(default_gw_for "$CT_IP_BASE" "$CT_PREFIX")" || die "không suy ra được gateway — truyền --gw <IP>"
    if [[ -t 0 ]]; then
      read -r -p "Gateway [$local_gw]: " CT_GW || true
      CT_GW="${CT_GW:-$local_gw}"
    else
      CT_GW="$local_gw"
      warn "Không có --gw — dùng gateway suy ra: $CT_GW"
    fi
  fi
  is_ipv4 "$CT_GW" || die "gateway không hợp lệ: $CT_GW"
  gw_in_subnet "$CT_IP_BASE" "$CT_PREFIX" "$CT_GW" \
    || die "gateway $CT_GW không cùng subnet với $CT_IP — kiểm tra lại"
fi

if [[ -z "$CT_DNS" ]]; then CT_DNS="1.1.1.1 8.8.8.8"; fi
validate_dns "$CT_DNS" || die "DNS không hợp lệ: $CT_DNS (phải là IP, cách nhau bởi dấu cách)"

if [[ -n "$VLAN" ]]; then
  [[ "$VLAN" =~ ^[0-9]{1,4}$ ]] && (( 10#$VLAN >= 1 && 10#$VLAN <= 4094 )) \
    || die "VLAN không hợp lệ: $VLAN (1-4094)"
fi

[[ "$CORES" =~ ^[0-9]+$ ]] && (( 10#$CORES >= 1 )) || die "số vCPU không hợp lệ: $CORES"
[[ "$MEMORY" =~ ^[0-9]+$ ]] && (( 10#$MEMORY >= 512 )) || die "RAM (MB) không hợp lệ: $MEMORY"
[[ "$SWAP" =~ ^[0-9]+$ ]] || die "swap (MB) không hợp lệ: $SWAP"
[[ "$DISK_GB" =~ ^[0-9]+$ ]] && (( 10#$DISK_GB >= 4 )) || die "dung lượng đĩa (GB) không hợp lệ: $DISK_GB"

# ---- Kiểm tra tài nguyên của node -----------------------------------------
if [[ -z "$CTID" ]]; then
  CTID="$(pvesh get /cluster/nextid)"
fi
[[ "$CTID" =~ ^[0-9]+$ ]] && (( 10#$CTID >= 100 )) || die "CTID không hợp lệ: $CTID"
if pct status "$CTID" >/dev/null 2>&1; then
  die "CT $CTID đã tồn tại — chọn số khác hoặc xoá CT cũ trước"
fi

pvesm status -storage "$STORAGE" >/dev/null 2>&1 \
  || die "storage '$STORAGE' không tồn tại (xem: pvesm status)"
pvesm status -storage "$TEMPLATE_STORAGE" >/dev/null 2>&1 \
  || die "storage template '$TEMPLATE_STORAGE' không tồn tại"

# `pvesm status` vẫn trả 0 với storage INACTIVE → kiểm tra cột Status.
storage_active() {
  local s="$1" st
  st="$(pvesm status -storage "$s" 2>/dev/null | awk 'NR==2 {print $3}')"
  [[ "$st" == "active" ]]
}
storage_active "$STORAGE" || die "storage '$STORAGE' đang inactive (xem: pvesm status)"
storage_active "$TEMPLATE_STORAGE" || die "storage '$TEMPLATE_STORAGE' đang inactive"

if command -v ip >/dev/null 2>&1 && ! ip link show "$BRIDGE" >/dev/null 2>&1; then
  warn "bridge '$BRIDGE' không thấy trên node — kiểm tra tên bridge (thường là vmbr0)"
fi

if [[ "$IP_MODE" == "static" ]] && command -v ping >/dev/null 2>&1; then
  if ping -c1 -W1 "$CT_IP_BASE" >/dev/null 2>&1; then
    warn "IP $CT_IP_BASE đang có thiết bị trả lời ping — có thể bị trùng IP!"
    if [[ "$ASSUME_YES" != "1" && -t 0 ]]; then
      read -r -p "Tiếp tục với IP này? [y/N]: " ans || true
      [[ "${ans:-N}" =~ ^[yY]([eE][sS])?$ ]] || die "đã huỷ."
    fi
  fi
fi

# ---- Mô tả mạng & xác nhận ------------------------------------------------
if [[ "$IP_MODE" == "static" ]]; then
  NET_DESC="IP tĩnh $CT_IP, gw $CT_GW"
  NET0="name=eth0,bridge=${BRIDGE},ip=${CT_IP},gw=${CT_GW}"
else
  NET_DESC="DHCP"
  NET0="name=eth0,bridge=${BRIDGE},ip=dhcp"
fi
[[ -n "$VLAN" ]] && NET0+=",tag=${VLAN}"
[[ -n "$VLAN" ]] && NET_DESC+=", VLAN $VLAN"

TMPL_DESC="tự tìm/tải Debian 12 trên '$TEMPLATE_STORAGE'"

echo
echo "Sẽ tạo container:"
printf '  %-14s %s\n' "CTID" "$CTID"
printf '  %-14s %s\n' "Hostname" "$HOSTNAME_"
printf '  %-14s %s\n' "Tài nguyên" "${CORES} vCPU / ${MEMORY} MB RAM / ${SWAP} MB swap / ${DISK_GB} GB đĩa"
printf '  %-14s %s\n' "Storage" "$STORAGE"
printf '  %-14s %s\n' "Mạng" "$NET_DESC (bridge $BRIDGE)"
printf '  %-14s %s\n' "DNS" "$CT_DNS"
printf '  %-14s %s\n' "Template" "$TMPL_DESC"
echo

if [[ "$ASSUME_YES" != "1" ]]; then
  if [[ -t 0 ]]; then
    read -r -p "Tiếp tục? [Y/n]: " ok || true
    [[ "${ok:-Y}" =~ ^[yY]([eE][sS])?$ ]] || die "đã huỷ."
  fi
fi

say "Proxmox host: $(hostname -s) — tạo CT $CTID ($HOSTNAME_)"

# ---- 1. Template Debian 12 (dùng lại nếu đã có) ----------------------------
EXISTING_TMPL="$(pvesm list "$TEMPLATE_STORAGE" --content vztmpl 2>/dev/null \
  | awk '$1 ~ /debian-12-standard/ {print $1}' | head -n1 || true)"
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
  --net0 "$NET0"
  --nameserver "$CT_DNS"
  --onboot 0
  --tags "cell-tracker,nodejs"
)
if [[ -n "$CT_PASSWORD" ]]; then
  pct create "${PCT_ARGS[@]}" --password "$CT_PASSWORD" --description "Cell.id.vn production"
else
  say "Không đặt CT_PASSWORD → tài khoản root trong CT sẽ không có mật khẩu."
  say "Sau khi tạo, chạy: pct exec $CTID -- passwd root   (hoặc dùng console)"
  pct create "${PCT_ARGS[@]}" --description "Cell.id.vn production"
fi

pct start "$CTID"

# ---- 3. Xác định IP sau khi container boot ---------------------------------
IP=""
if [[ "$IP_MODE" == "static" ]]; then
  IP="$CT_IP_BASE"
  say "Chờ container nhận IP tĩnh $IP…"
  for _ in $(seq 1 30); do
    if pct exec "$CTID" -- bash -c "ip -4 -o addr show eth0 2>/dev/null | grep -q '${IP}/'" 2>/dev/null; then
      break
    fi
    sleep 2
  done
  pct exec "$CTID" -- bash -c "ip -4 -o addr show eth0 2>/dev/null | grep -q '${IP}/'" 2>/dev/null \
    || warn "chưa thấy $IP trên eth0 — kiểm tra: pct exec $CTID -- ip -4 addr; pct exec $CTID -- ip route"
else
  say "Chờ container lấy IP qua DHCP…"
  for _ in $(seq 1 30); do
    IP="$(pct exec "$CTID" -- bash -c "ip -4 -o addr show eth0 2>/dev/null | awk '{print \$4}' | cut -d/ -f1")" || true
    # fallback: một số image tối giản không có `ip`, dùng hostname -I
    if [[ -z "$IP" ]]; then
      IP="$(pct exec "$CTID" -- bash -c "hostname -I 2>/dev/null | awk '{print \$1}'")" || true
    fi
    [[ -n "$IP" ]] && break
    sleep 2
  done
  [[ -n "$IP" ]] || die "container chưa lấy được IP qua DHCP — mở console: pct console $CTID"
fi
say "Container IP: ${IP:-chưa xác định}"
pct exec "$CTID" -- bash -c "ip -4 -o addr show eth0 2>/dev/null | awk '{print \"    \" \$4}'; ip route | grep default | sed 's/^/    /'" || true

# ---- 4. Cài gói nền trong container ---------------------------------------
say "Cập nhật apt + gói nền"
pct exec "$CTID" -- bash -c "export DEBIAN_FRONTEND=noninteractive; apt-get update -qq && apt-get upgrade -y -qq"

say "Cài công cụ build + nginx"
# build-essential/python3: sqlite3 và sharp phải compile (không có prebuilt cho mọi ABI)
# sudo: bắt buộc cho GitHub Actions runner gọi deploy script (deploy/ci/install-runner.sh).
pct exec "$CTID" -- bash -c "export DEBIAN_FRONTEND=noninteractive; apt-get install -y -qq --no-install-recommends \
  sudo curl ca-certificates gnupg git rsync unzip build-essential python3 sqlite3 nginx ufw logrotate"

say "Cài Node.js 24 (NodeSource)"
# Bản chính thức: https://deb.nodesource.com/setup_24.x
pct exec "$CTID" -- bash -c "curl -fsSL https://deb.nodesource.com/setup_24.x -o /tmp/nodesource_setup.sh && bash /tmp/nodesource_setup.sh"
pct exec "$CTID" -- bash -c "export DEBIAN_FRONTEND=noninteractive; apt-get install -y -qq nodejs && node -v && npm -v"

say "Múi giờ Asia/Ho_Chi_Minh"
pct exec "$CTID" -- bash -c "timedatectl set-timezone Asia/Ho_Chi_Minh || ln -sf /usr/share/zoneinfo/Asia/Ho_Chi_Minh /etc/localtime"

say "Giới hạn journald (500MB)"
# Không chặn quá trình cài nếu journald không restart được trong LXC.
pct exec "$CTID" -- bash -c "sed -i 's/^#\\?SystemMaxUse=.*/SystemMaxUse=500M/' /etc/systemd/journald.conf; systemctl restart systemd-journald || true"

say "Xong phần nền. Bước tiếp theo (xem deploy/README.md):"
cat <<EOF

  1) Tạo user + thư mục app, firewall, systemd, nginx:
       scp deploy/proxmox/bootstrap-app.sh root@${IP}:/root/
       ssh root@${IP} 'bash /root/bootstrap-app.sh'

  2) Deploy lần đầu (máy dev Windows, từ gốc repo):
       pwsh ./deploy/deploy.ps1 -Target root@${IP} -FirstDeploy

  3) CI/CD (tuỳ chọn) — xem deploy/CICD.md, cài runner TRONG container:
       scp deploy/ci/install-runner.sh deploy/ci/sudoers-celltracker root@${IP}:/tmp/
       ssh root@${IP} 'RUNNER_TOKEN=<token> bash /tmp/install-runner.sh'

  4) Bật khởi động cùng Proxmox khi đã kiểm tra ổn:
       pct set ${CTID} --onboot 1
       (nên bật backup định kỳ cho CT ${CTID} trong GUI: Datacenter ▸ Backup)

  Tài nguyên có thể đổi sau: pct set ${CTID} --cores 4 --memory 4096
EOF
