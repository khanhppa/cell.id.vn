#!/usr/bin/env bash
# ============================================================================
# Cell.id.vn — backup CSDL SQLite (chạy trong container; cron 03:20 hằng ngày)
# ----------------------------------------------------------------------------
#   bin/backup-db.sh [số-bản-giữ-lại]        (mặc định 14)
#
# Dùng `sqlite3 .backup` (API online-backup của SQLite) nên AN TOÀN khi app đang
# chạy: không copy file đang ghi WAL (copy thô có thể ra DB hỏng / lệch trang).
# ============================================================================
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/cell-tracker}"
KEEP="${1:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"

# Đọc DB_PATH từ .env (nếu có), fallback theo layout mặc định
ENV_FILE="$APP_ROOT/shared/.env"
DB_PATH="$APP_ROOT/shared/database.sqlite"
if [[ -f "$ENV_FILE" ]]; then
  from_env="$(grep -E '^DB_PATH=' "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '\r"')"
  from_env="${from_env%\'}"
  [[ -n "${from_env:-}" ]] && DB_PATH="$from_env"
fi
[[ -f "$DB_PATH" ]] || { echo "backup-db: không thấy DB tại $DB_PATH" >&2; exit 1; }

BACKUP_DIR="$APP_ROOT/shared/backups"
mkdir -p "$BACKUP_DIR"
OUT="$BACKUP_DIR/database-$STAMP.sqlite"

sqlite3 "$DB_PATH" ".timeout 10000" ".backup '$OUT'"
sqlite3 "$OUT" "PRAGMA integrity_check;" > /dev/null || { echo "backup-db: integrity_check thất bại ($OUT)" >&2; exit 1; }
chmod 600 "$OUT"

# Giữ KEEP bản mới nhất
ls -1t "$BACKUP_DIR"/database-*.sqlite 2>/dev/null | tail -n "+$((KEEP + 1))" | while read -r old; do
  rm -f "$old"
done

echo "backup: $OUT ($(du -h "$OUT" | cut -f1))"
