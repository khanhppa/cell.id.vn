#!/usr/bin/env bash
# ============================================================================
# Cell.id.vn — deploy một bản release lên server (chạy TRONG container, bằng root)
# ----------------------------------------------------------------------------
#   bin/deploy-release.sh <đường-dẫn-zip> [version-tuỳ-chọn]
#
# Các bước (dừng ngay khi gặp lỗi):
#   1. Giải nén vào $APP_ROOT/releases/<thời-gian>-<version>
#   2. `npm ci --omit=dev` trong release mới (compile sqlite3/sharp nếu cần)
#   3. Chuyển symlink `current` sang bản mới (atomic)
#   4. restart service rồi GỌI /api/version để kiểm tra — sai version hoặc không
#      lên được ⇒ TỰ ĐỘNG quay về release trước và restart lại, exit 1.
#   5. Giữ 5 release gần nhất.
#
# Dữ liệu (DB, uploads) nằm ở $APP_ROOT/shared → KHÔNG bao giờ bị đụng tới ở đây.
# ============================================================================
set -euo pipefail

APP_NAME="cell-tracker"
APP_USER="celltracker"
APP_ROOT="${APP_ROOT:-/opt/cell-tracker}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-60}"   # giây

ZIP_PATH="${1:-}"
VERSION_ARG="${2:-}"

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[warn] %s\033[0m\n' "$*" >&2; }
die()  { printf '\033[1;31m[deploy] ERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "phải chạy bằng root"
[[ -n "$ZIP_PATH" && -f "$ZIP_PATH" ]] || die "không thấy file zip: '${ZIP_PATH}'"
id -u "$APP_USER" >/dev/null 2>&1 || die "chưa có user $APP_USER — chạy deploy/proxmox/bootstrap-app.sh trước"
[[ -f "$APP_ROOT/shared/.env" ]] || die "thiếu $APP_ROOT/shared/.env — chạy bootstrap-app.sh trước"
[[ -L "$APP_ROOT/current" || -d "$APP_ROOT/current" ]] || warn "chưa có release nào (lần deploy đầu)"

TS="$(date +%Y%m%d-%H%M%S)"

# Đọc version từ package.json trong zip mà không cần giải nén toàn bộ
VERSION="$VERSION_ARG"
if [[ -z "$VERSION" ]]; then
  VERSION="$(unzip -p "$ZIP_PATH" package.json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let v="0";try{v=String(JSON.parse(s).version||"0")}catch(e){};process.stdout.write(v)})' || echo 0)"
fi
REL_NAME="$TS-$VERSION"
NEW_REL="$APP_ROOT/releases/$REL_NAME"
PREV_REL="$(readlink -f "$APP_ROOT/current" 2>/dev/null || true)"

say "Deploy cell-tracker $VERSION  (release: $REL_NAME)"
[[ -n "$PREV_REL" ]] && echo "    release hiện tại: $PREV_REL"

# ---- 1. giải nén ----------------------------------------------------------
say "1/5 Giải nén"
mkdir -p "$APP_ROOT/releases"
STAGING="$(mktemp -d "$APP_ROOT/releases/.staging-XXXXXX")"
trap 'rm -rf "$STAGING"' EXIT
unzip -q "$ZIP_PATH" -d "$STAGING"
[[ -f "$STAGING/server.js" && -f "$STAGING/package.json" ]] || die "zip không đúng cấu trúc (thiếu server.js/package.json)"
mkdir -p "$STAGING/public" "$STAGING/bin"

# Script quản trị lấy bản mới nhất từ zip nếu có (để bản deploy sau dùng code mới)
for f in deploy-release.sh backup-db.sh; do
  [[ -f "$STAGING/bin/$f" ]] && install -m 755 -o root -g root "$STAGING/bin/$f" "$APP_ROOT/bin/$f"
done
chmod 755 "$APP_ROOT/bin"/*.sh 2>/dev/null || true

# ---- 2. cài dependencies --------------------------------------------------
say "2/5 npm ci --omit=dev (có thể mất 1-3 phút nếu phải compile sqlite3/sharp)"
cd "$STAGING"
export npm_config_update_notifier=false npm_config_fund=false npm_config_audit=false
if ! npm ci --omit=dev --no-audit --no-fund 2>&1 | tail -n 20; then
  echo
  die "npm ci thất bại — release cũ ($PREV_REL) GIỮ NGUYÊN, chưa restart gì."
fi
[[ -f "$STAGING/node_modules/sqlite3/lib/sqlite3.js" ]] || die "npm ci xong nhưng thiếu module sqlite3"
# Bỏ file log/DB lỡ nằm trong zip
rm -f "$STAGING"/*.log "$STAGING"/*.sqlite "$STAGING"/*.sqlite-* 2>/dev/null || true
rm -rf "$STAGING/uploads" "$STAGING/.certs" 2>/dev/null || true

# secrets: server đọc EnvironmentFile từ shared/.env. Không copy vào release.
chown -R "$APP_USER:$APP_USER" "$STAGING"
chmod -R o-rwx "$STAGING"

# ---- 3. chuyển symlink ----------------------------------------------------
say "3/5 Kích hoạt $REL_NAME"
mv "$STAGING" "$NEW_REL"
trap - EXIT
ln -sfn "$NEW_REL" "$APP_ROOT/current.tmp"
mv -Tf "$APP_ROOT/current.tmp" "$APP_ROOT/current"   # atomic rename
chown -h "$APP_USER:$APP_USER" "$APP_ROOT/current"

# ---- 4. restart + health gate --------------------------------------------
say "4/5 Restart service + kiểm tra /api/version"
systemctl reset-failed "$APP_NAME" >/dev/null 2>&1 || true
systemctl restart "$APP_NAME"

health_ok=0
deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
while [[ $(date +%s) -lt $deadline ]]; do
  body="$(curl -fsS --max-time 3 http://127.0.0.1:3000/api/version 2>/dev/null || true)"
  if [[ -n "$body" ]]; then
    got="$(printf '%s' "$body" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).version||""))}catch(e){}})' || true)"
    if [[ -n "$got" && "$got" == "$VERSION" ]]; then health_ok=1; break; fi
  fi
  systemctl is-active --quiet "$APP_NAME" || break
  sleep 2
done

if [[ $health_ok -ne 1 ]]; then
  printf '\n\033[1;31m[deploy] Health check THẤT BẠI — rollback\033[0m\n' >&2
  journalctl -u "$APP_NAME" -n 60 --no-pager >&2 || true
  if [[ -n "$PREV_REL" && -d "$PREV_REL" ]]; then
    ln -sfn "$PREV_REL" "$APP_ROOT/current.tmp"
    mv -Tf "$APP_ROOT/current.tmp" "$APP_ROOT/current"
    systemctl restart "$APP_NAME" || true
    echo "[deploy] Đã quay về: $PREV_REL" >&2
  else
    echo "[deploy] Không có release trước để quay về." >&2
  fi
  exit 1
fi
echo "    OK: /api/version = $VERSION"

# ---- 5. dọn release cũ ----------------------------------------------------
say "5/5 Giữ $KEEP_RELEASES release gần nhất"
mapfile -t ALL < <(ls -1dt "$APP_ROOT/releases"/*/ 2>/dev/null | sed 's:/$::')
idx=0
for d in "${ALL[@]}"; do
  idx=$((idx + 1))
  [[ $idx -le $KEEP_RELEASES ]] && continue
  [[ "$(readlink -f "$APP_ROOT/current")" == "$(readlink -f "$d")" ]] && continue
  rm -rf "$d"
done
ls -1dt "$APP_ROOT/releases"/*/ 2>/dev/null | sed 's/^/    /' | head -n "$KEEP_RELEASES" || true

say "Deploy xong: $VERSION"
echo "    Log: journalctl -u $APP_NAME -n 50 --no-pager"
