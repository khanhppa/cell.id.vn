#!/usr/bin/env bash
# ============================================================================
# Cell.id.vn — cài GitHub Actions self-hosted runner TRONG LXC app
# ----------------------------------------------------------------------------
# Chạy một lần, bằng root, ngay trong container đang chạy app:
#
#   RUNNER_TOKEN=<registration-token> bash deploy/ci/install-runner.sh
#
# Lấy RUNNER_TOKEN: GitHub repo ▸ Settings ▸ Actions ▸ Runners ▸ New self-hosted
# runner ▸ copy token (hết hạn sau ~1 giờ; không lưu vào repo/không commit).
#
# Script idempotent: chạy lại chỉ cập nhật binary + cấu hình service.
# Không tạo/xoá dữ liệu app. Không đụng tới /opt/cell-tracker/shared.
# ============================================================================
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/khanhppa/cell.id.vn}"
RUNNER_USER="${RUNNER_USER:-ghrunner}"
RUNNER_ROOT="${RUNNER_ROOT:-/opt/actions-runner}"
RUNNER_LABELS="${RUNNER_LABELS:-celltracker-lxc}"
RUNNER_NAME="${RUNNER_NAME:-$(hostname -s)-lxc}"
RUNNER_TOKEN="${RUNNER_TOKEN:-}"
APP_ROOT="${APP_ROOT:-/opt/cell-tracker}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[warn] %s\033[0m\n' "$*" >&2; }
die()  { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "phải chạy bằng root (sudo bash $0)"
[[ -n "$RUNNER_TOKEN" ]] || die "thiếu RUNNER_TOKEN (Settings ▸ Actions ▸ Runners ▸ New self-hosted runner)"
command -v curl >/dev/null || die "thiếu curl (apt install curl)"
command -v tar  >/dev/null || die "thiếu tar"
command -v node >/dev/null || die "thiếu node — runner cần Node để chạy actions"
if ! id -u "$RUNNER_USER" >/dev/null 2>&1; then
  # User hệ thống chuyên cho runner, không đăng nhập được. Home = thư mục runner.
  say "Tạo user hệ thống '$RUNNER_USER'"
  useradd --system --create-home --home-dir "$RUNNER_ROOT" --shell /usr/sbin/nologin "$RUNNER_USER"
fi

# ---- 1. quyền cho runner ---------------------------------------------------
# Runner cần ĐỌC release và GHI artifact vào incoming. Không cho ghi shared/.
say "Chuẩn bị thư mục cho runner"
mkdir -p "$APP_ROOT/incoming"
chown -R "$RUNNER_USER:$RUNNER_USER" "$APP_ROOT/incoming"
chmod 750 "$APP_ROOT/incoming"

# ---- 2. tải runner ---------------------------------------------------------
say "Tải GitHub Actions runner ($RUNNER_ROOT)"
mkdir -p "$RUNNER_ROOT"
chown "$RUNNER_USER:$RUNNER_USER" "$RUNNER_ROOT"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) RUNNER_ARCH="x64" ;;
  aarch64|arm64) RUNNER_ARCH="arm64" ;;
  *) die "kiến trúc không hỗ trợ: $ARCH" ;;
esac
LATEST_JSON="$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest)"
TAG="$(printf '%s' "$LATEST_JSON" | grep -o '"tag_name": *"[^"]*"' | head -n1 | cut -d'"' -f4)"
[[ -n "$TAG" ]] || die "không đọc được bản runner mới nhất từ api.github.com"
TARBALL="actions-runner-linux-${RUNNER_ARCH}-${TAG#v}.tar.gz"
cd "$RUNNER_ROOT"
if [[ ! -f "$TARBALL" ]]; then
  curl -fsSL -o "$TARBALL" "https://github.com/actions/runner/releases/download/${TAG}/${TARBALL}"
fi
tar -xzf "$TARBALL"
chown -R "$RUNNER_USER:$RUNNER_USER" "$RUNNER_ROOT"
chmod +x "$RUNNER_ROOT"/bin/* "$RUNNER_ROOT"/externals/node*/bin/node 2>/dev/null || true
say "Runner $TAG ($RUNNER_ARCH) đã giải nén"

# ---- 3. cấu hình runner ----------------------------------------------------
# `--replace`: chạy lại không lỗi "already configured".
say "Cấu hình runner cho $REPO_URL"
sudo -u "$RUNNER_USER" "$RUNNER_ROOT/config.sh" \
  --url "$REPO_URL" \
  --token "$RUNNER_TOKEN" \
  --name "$RUNNER_NAME" \
  --labels "$RUNNER_LABELS" \
  --work "$RUNNER_ROOT/_work" \
  --unattended \
  --replace

# ---- 4. cài service (systemd) ---------------------------------------------
say "Cài service systemd cho runner"
"$RUNNER_ROOT/svc.sh" install "$RUNNER_USER"
"$RUNNER_ROOT/svc.sh" start
systemctl --no-pager --full status "actions.runner.*" | sed 's/^/    /' | head -n 12 || true

# ---- 5. sudoers ------------------------------------------------------------
# Ưu tiên file mẫu cạnh script (khi chạy từ repo). Nếu script được copy lẻ vào /tmp
# (artifact deploy KHÔNG chứa deploy/), tự sinh đúng nội dung tối thiểu — nhờ vậy
# cài runner vẫn chạy được chỉ với 1 file.
SUDOERS_TMP="$(mktemp)"
if [[ -f "$SCRIPT_DIR/sudoers-celltracker" ]]; then
  say "Cài sudoers từ $SCRIPT_DIR/sudoers-celltracker"
  sed "s/__RUNNER_USER__/$RUNNER_USER/g" "$SCRIPT_DIR/sudoers-celltracker" > "$SUDOERS_TMP"
else
  warn "Không thấy sudoers-celltracker cạnh script — dùng nội dung mặc định"
  cat > "$SUDOERS_TMP" <<SUDOERS
Defaults:$RUNNER_USER !requiretty
Defaults:$RUNNER_USER secure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

$RUNNER_USER ALL=(root) NOPASSWD: /opt/cell-tracker/bin/deploy-release.sh *
$RUNNER_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart cell-tracker, \\
                                  /usr/bin/systemctl is-active cell-tracker, \\
                                  /usr/bin/systemctl reset-failed cell-tracker, \\
                                  /usr/bin/systemctl status cell-tracker, \\
                                  /bin/systemctl restart cell-tracker, \\
                                  /bin/systemctl is-active cell-tracker, \\
                                  /bin/systemctl reset-failed cell-tracker, \\
                                  /bin/systemctl status cell-tracker
$RUNNER_USER ALL=(root) NOPASSWD: /usr/bin/journalctl -u cell-tracker *, \\
                                  /bin/journalctl -u cell-tracker *
SUDOERS
fi
install -m 440 -o root -g root "$SUDOERS_TMP" /etc/sudoers.d/celltracker-ci
rm -f "$SUDOERS_TMP"
visudo -cf /etc/sudoers.d/celltracker-ci

# ---- 6. kiểm tra -----------------------------------------------------------
say "Kiểm tra quyền"
sudo -u "$RUNNER_USER" sudo -n -l 2>/dev/null | sed 's/^/    /' | head -n 12 \
  || warn "Runner chưa có quyền sudo — kiểm tra /etc/sudoers.d/celltracker-ci"

cat <<EOF

Xong. Kiểm tra:
  systemctl status 'actions.runner.*' --no-pager
  journalctl -u 'actions.runner.*' -n 50 --no-pager
  tail -f $RUNNER_ROOT/_diag/Runner_*.log

Runner hiện trong GitHub: Settings ▸ Actions ▸ Runners (label: $RUNNER_LABELS).
Chạy thử: Actions ▸ Deploy Production ▸ Run workflow.

Nếu runner báo offline: kiểm tra container có ra được github.com:443
  curl -I https://api.github.com
EOF
