# scripts/ — công cụ vận hành một lần (KHÔNG chạy trong server)

Các script ở đây **không** phải một phần của ứng dụng đang chạy: server.js không
`require` file nào trong thư mục này. Chúng dùng khi cần rà soát/sửa dữ liệu thủ công.
Thư mục này bị loại khỏi artifact deploy (xem `.gitattributes`).

> **Luôn backup trước khi ghi**: các script có `--apply` sẽ ghi vào `cells`.
> Chạy `/opt/cell-tracker/bin/backup-db.sh` (production) hoặc
> `sqlite3 <db> ".backup <db>.backup-$(date +%s)"` (local) trước.

## Biến môi trường

| Biến | Ý nghĩa |
|---|---|
| `DB_PATH` | Đường dẫn file SQLite. Không đặt → thư mục CHA của repo (giữ hành vi cũ khi dev local). Trên server: `/opt/cell-tracker/shared/database.sqlite`. |

## Danh sách

| Script | Ghi DB? | Mục đích |
|---|---|---|
| `audit-cells.js` | Không (READ-ONLY) | Rà soát bảng `cells`: toạ độ rác, cellid trùng nhiều RAT, cellid dài bị gán GSM. Xuất `audit-cells-report.txt` ở gốc repo. |
| `cleanup-online-cells.js` | Có, chỉ với `--apply` | Xoá/sửa đúng các row sai đã duyệt (dry-run mặc định). Tự backup DB + ghi `cells_audit`. |
| `backfill-radio.js` | Có | Điền `cells.radio` cho row cũ bằng `inferRadio` (idempotent, chỉ chạm row NULL/rỗng). |
| `purge-admin-logs.js` | Có | Xoá `call_logs` + `annotations` của admin (user_id=1) — script một lần, xoá sau khi dùng. |

## Cách chạy

```bash
# local (DB ở thư mục cha repo)
node scripts/audit-cells.js

# production (LXC)
DB_PATH=/opt/cell-tracker/shared/database.sqlite node /opt/cell-tracker/current/scripts/audit-cells.js
```

`deploy-release.sh` không chép `scripts/` vào release (bị `export-ignore`), nên trên
server hãy chạy trực tiếp từ bản clone hoặc chép tạm script vào `/tmp` rồi xoá.
