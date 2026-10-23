# CI/CD triển khai Cell.id.vn lên Proxmox LXC (self-hosted runner)

Tài liệu này hướng dẫn dựng **pipeline CI/CD hoàn chỉnh, chạy trong mạng LAN**:

```
┌────────────────────────── Máy dev (Windows) ──────────────────────────┐
│  git commit → git push origin main                                     │
└───────────────────────────────┬────────────────────────────────────────┘
                                │ HTTPS 443
                                ▼
┌──────────────────────────── GitHub ────────────────────────────────────┐
│  Actions ▸ Deploy Production                                            │
│                                                                        │
│  Job "Build artifact"  (ubuntu-latest, GitHub cloud)                   │
│    checkout → setup Node 24 → npm ci → node --check → npm run smoke     │
│    → git archive HEAD → release-<ver>-<sha>.tar.gz + sha256            │
│    → upload-artifact                                                    │
│                              │ artifact                                │
│                              ▼                                          │
│  Job "Deploy to LXC"  (self-hosted, label celltracker-lxc)             │
│    download artifact → copy vào /opt/cell-tracker/incoming             │
│    → sudo bin/deploy-release.sh (npm ci, symlink, restart, health)      │
│    → curl /healthz + /api/version                                       │
└───────────────────────────────┬────────────────────────────────────────┘
                                │ runner poll HTTPS ra ngoài (không cần mở port vào LAN)
                                ▼
┌──────────────────────── Proxmox ▸ LXC "cell-tracker" (Debian 12) ──────┐
│  actions.runner.* service (user ghrunner)              Nginx :80/:443  │
│  /opt/cell-tracker/  releases/<ts>-<ver>  current → …   │              │
│                      shared/{database.sqlite,uploads,.env}             │
│  systemd: cell-tracker.service → Node 127.0.0.1:3000 ──┘               │
└────────────────────────────────────────────────────────────────────────┘
```

**Vì sao runner đặt trong LXC (không phải GitHub cloud)?**
Deploy cần `systemctl`, `chown`, đổi symlink và `npm ci` **tại máy chủ**. Runner
self-hosted nằm trong chính LXC nên làm được tất cả tại chỗ mà **không phải mở
SSH/port nào từ Internet vào LAN**. GitHub chỉ gửi job + artifact; runner tự kéo về.

**Đánh đổi**: runner cùng máy với app — nếu LXC hỏng hoàn toàn thì pipeline không
tự cứu được. Có đường dự phòng `deploy/deploy.ps1` (deploy tay qua SSH) — xem mục 10.

---

## 0. Điều kiện tiên quyết

| Thành phần | Yêu cầu / kiểm tra |
|---|---|
| LXC | Đã tạo + cấu hình bằng `deploy/proxmox/create-lxc.sh` và `deploy/proxmox/bootstrap-app.sh` (xem [README.md](README.md)) |
| Trong LXC | `node -v` ≥ 22, `curl`, `tar`, `build-essential`, `python3`, `sqlite3`, `systemctl` hoạt động, `nginx` đang chạy |
| Ra Internet | `curl -I https://api.github.com` trả 200 (runner cần 443 ra github.com) |
| GitHub | Quyền **Admin** repo `khanhppa/cell.id.vn` (để tạo runner token/environment) |
| Git | `git push` được lên `origin` (đã kiểm tra: `git ls-remote origin`) |
| Ứng dụng | Đã có `/opt/cell-tracker/shared/.env` (bootstrap sinh) và deploy thủ công 1 lần thành công |

> Thứ tự bắt buộc lần đầu: **bootstrap app → deploy tay 1 lần → cài runner → bật workflow**.
> Runner không tự tạo được `systemd`/Nginx/`.env` cho app.

---

## 1. Chuẩn bị app trên LXC (nếu chưa làm)

```bash
# trên node Proxmox
bash deploy/proxmox/create-lxc.sh              # tạo LXC + Node 24 + nginx + toolchain
pct push <CTID> deploy/proxmox/bootstrap-app.sh /root/bootstrap-app.sh
pct exec <CTID> -- bash /root/bootstrap-app.sh
pct exec <CTID> -- env DOMAIN=cell.example.vn EMAIL=admin@example.vn bash /root/bootstrap-app.sh
```

Kiểm tra trước khi làm CI/CD:

```bash
# trong LXC
systemctl status cell-tracker --no-pager
curl -fsS http://127.0.0.1:3000/healthz
curl -fsS https://<domain>/api/version
```

Nếu `/healthz` chưa 200 → dừng lại, xem mục 9 (Troubleshooting) của [README.md](README.md).

---

## 2. Cấu hình repo trên GitHub (làm 1 lần)

1. **Bật Actions**: repo ▸ *Settings ▸ Actions ▸ General* → *Allow all actions* (hoặc giới hạn
   theo org policy). Workflow nằm trong `.github/workflows/`.
2. **Environment `production`** (dùng cho job deploy):
   *Settings ▸ Environments ▸ New environment* → tên `production`.
   Khuyến nghị bật **Required reviewers** = chính bạn → mỗi lần deploy phải bấm
   *Approve* (an toàn khi repo có nhiều người).
3. **Branch protection cho `main`**: *Settings ▸ Branches ▸ Add branch ruleset*
   - Require a pull request before merging (tuỳ quy mô)
   - Require status checks: chọn **CI / Check + smoke** (job của `ci.yml`)
   - Không cần require check của deploy (deploy chạy sau khi merge).
4. **Không đặt secret nào cho deploy**: pipeline không dùng SSH key/token — runner
   nằm trong LXC. (Chỉ cần token đăng ký runner ở bước 3, dùng một lần rồi hết hạn.)
5. *Tuỳ chọn*: tắt "Allow GitHub Actions to create pull requests" nếu không dùng.

---

## 3. Cài self-hosted runner (trong LXC)

### 3.1 Lấy registration token

GitHub ▸ repo ▸ *Settings ▸ Actions ▸ Runners ▸ New self-hosted runner* →
chọn **Linux / x64** → copy dòng lệnh có `--token XXXXX`.
Token **hết hạn sau khoảng 1 giờ** và **không được commit**.

### 3.2 Chạy script cài (đã có trong repo)

```bash
# trong LXC, từ bản clone repo (hoặc scp thư mục deploy/ci vào /tmp)
cd /opt/cell-tracker/current
sudo RUNNER_TOKEN=<token-vừa-copy> bash deploy/ci/install-runner.sh
```

Script làm gì:

| Bước | Chi tiết |
|---|---|
| User | Tạo user hệ thống `ghrunner` (không login, home `/opt/actions-runner`) nếu chưa có |
| Quyền | `chown ghrunner /opt/cell-tracker/incoming` (nơi nhận artifact), **không** cho ghi `shared/` |
| Tải runner | Lấy bản mới nhất từ `api.github.com/repos/actions/runner/releases/latest`, giải nén vào `/opt/actions-runner` |
| Đăng ký | `config.sh --url https://github.com/khanhppa/cell.id.vn --labels celltracker-lxc --unattended --replace --name <hostname>-lxc` |
| Service | `svc.sh install ghrunner` + `svc.sh start` → systemd `actions.runner.*`, tự chạy khi boot |
| Sudoers | Cài `/etc/sudoers.d/celltracker-ci` (mục 4), validate bằng `visudo -cf` |

Kiểm tra:

```bash
systemctl status 'actions.runner.*' --no-pager
journalctl -u 'actions.runner.*' -n 50 --no-pager
sudo -u ghrunner sudo -n -l          # phải thấy đúng 3 nhóm lệnh
```

GitHub ▸ *Settings ▸ Actions ▸ Runners*: runner hiện **Idle**, label `celltracker-lxc`.

### 3.3 Nếu không dùng script (cài tay)

```bash
sudo useradd --system --create-home --home-dir /opt/actions-runner --shell /usr/sbin/nologin ghrunner
sudo mkdir -p /opt/actions-runner /opt/cell-tracker/incoming
sudo chown -R ghrunner:ghrunner /opt/actions-runner /opt/cell-tracker/incoming
cd /opt/actions-runner
curl -fsSLO https://github.com/actions/runner/releases/latest/download/actions-runner-linux-x64-<VER>.tar.gz
sudo tar -xzf actions-runner-linux-x64-<VER>.tar.gz
sudo chown -R ghrunner:ghrunner .
sudo -u ghrunner ./config.sh --url https://github.com/khanhppa/cell.id.vn \
     --token <TOKEN> --labels celltracker-lxc --unattended --replace
sudo ./svc.sh install ghrunner && sudo ./svc.sh start
```

---

## 4. Quyền sudo tối thiểu

File mẫu: [`deploy/ci/sudoers-celltracker`](ci/sudoers-celltracker).

```bash
sudo sed 's/__RUNNER_USER__/ghrunner/g' deploy/ci/sudoers-celltracker \
  | sudo tee /etc/sudoers.d/celltracker-ci >/dev/null
sudo chmod 440 /etc/sudoers.d/celltracker-ci
sudo visudo -cf /etc/sudoers.d/celltracker-ci
```

Cho phép **đúng** 3 nhóm:

| Lệnh | Vì sao cần |
|---|---|
| `/opt/cell-tracker/bin/deploy-release.sh *` | toàn bộ quy trình deploy (npm ci, chown, symlink, restart) |
| `/usr/bin/systemctl {restart,is-active,reset-failed,status} cell-tracker` | chẩn đoán khi job lỗi |
| `/usr/bin/journalctl -u cell-tracker *` | in log service khi health gate fail |

**Không** cấp `ALL=(ALL)`; **không** cho runner ghi trực tiếp `shared/` (DB, uploads, `.env`).

> Rủi ro còn lại: wildcard cho artifact path — runner có thể đưa bất kỳ file nào vào
> script. Giảm thiểu bằng: runner chỉ phục vụ repo này, không chạy workflow
> `pull_request` trên self-hosted, và bật *Required reviewers* cho environment.

---

## 5. Hai workflow

### 5.1 `.github/workflows/ci.yml` — kiểm tra, không deploy

Trigger: `pull_request`, `push` mọi nhánh **trừ** `main`, `workflow_dispatch`.
Runner: `ubuntu-latest` (cloud, không chạm LAN).

| Bước | Bắt lỗi gì |
|---|---|
| `npm ci --omit=dev` | lockfile lệch, dependency mất, native build hỏng |
| `node --check` mọi `*.js` phía server | lỗi cú pháp trước khi merge |
| `npm run smoke` | server không boot, `/healthz` fail, thiếu `public/`, SIGTERM treo |
| `Verify deploy artifact is clean` | artifact còn `.env`, log, `tests/`, `scripts/`, `_*`, `node_modules`… |

### 5.2 `.github/workflows/deploy.yml` — build + deploy

Trigger: `push` vào `main`, hoặc bấm tay *Actions ▸ Deploy Production ▸ Run workflow*.
`concurrency: production-deploy` + `cancel-in-progress: false` → **không bao giờ 2 deploy
song song** (SQLite + node-cron không chịu được 2 instance), các lần push dồn sẽ xếp hàng.

**Job `build`** (ubuntu-latest): như CI, rồi:

```bash
VERSION=$(node -p "require('./package.json').version")
git archive --format=tar.gz -o release-$VERSION-<sha>.tar.gz HEAD
sha256sum release-*.tar.gz
```

`git archive` tôn trọng `.gitattributes` → artifact **không** chứa `deploy/`, `scripts/`,
`.github/`, `README.md`, `API.md`, `.env*`, log, `uploads/`, `dist/`. Upload bằng
`actions/upload-artifact@v4` (giữ 14 ngày).

**Job `deploy`** (`runs-on: [self-hosted, linux, celltracker-lxc]`, `environment: production`):

1. `download-artifact` → `$RUNNER_TEMP/release/`
2. `install -m 640` artifact vào `/opt/cell-tracker/incoming/` (thuộc `ghrunner`)
3. `sudo -n /opt/cell-tracker/bin/deploy-release.sh <artifact> <version>`
4. `curl /healthz` + `/api/version`, đối chiếu version với job build
5. `if: failure()` → in `journalctl`, `systemctl status`, 5 release gần nhất, `current`

`deploy-release.sh` (chạy root) thực hiện — và **tự rollback** nếu bước 4 fail:

```
staging (mktemp trong releases/) → npm ci --omit=dev
→ mv thành releases/<ts>-<ver> → ln -sfn current.tmp → mv -Tf current (atomic)
→ systemctl restart cell-tracker
→ poll /healthz tới 60s, so version
   ├─ OK  → giữ 5 release gần nhất
   └─ FAIL→ trỏ current về release trước, restart, exit 1 (job đỏ)
```

---

## 6. Deploy lần đầu qua CI/CD

1. Chắc chắn app đã bootstrap + `.env` đủ (`JWT_SECRET`, `DB_PATH`, `UPLOAD_DIR`,
   `TRUST_PROXY=1`, `HOST=127.0.0.1`).
2. Nếu muốn chuyển dữ liệu từ máy dev:
   ```powershell
   sqlite3 D:\Code\database.sqlite ".backup 'D:\Code\database.seed.sqlite'"
   pwsh ./deploy/deploy.ps1 -Target root@<IP> -FirstDeploy `
        -SeedDatabase D:\Code\database.seed.sqlite -SeedUploads D:\Code\cell-tracker\uploads -SkipTests
   ```
   (deploy tay lần đầu để seed DB; các lần sau dùng CI/CD.)
3. Vào *Actions ▸ Deploy Production ▸ Run workflow* (nhánh `main`) → *Run*.
4. Nếu có *Required reviewers*: bấm **Review deployments ▸ Approve**.
5. Theo dõi job `Deploy to LXC`; kết thúc phải thấy:
   ```
   OK: 2.10.0 khỏe, uptime 2s
   ```
6. Kiểm tra ngoài: `https://<domain>/`, `/m/`, `/healthz`.

> **Bắt buộc đổi version mỗi lần deploy**: `deploy-release.sh` so version trong
> `/healthz` với version trong artifact; trùng version vẫn deploy được nhưng bạn sẽ
> không phân biệt được "đã lên bản mới" hay chưa. Quy ước: sửa `package.json` +
> `CHANGELOG.md` trong cùng commit.

---

## 7. Quy trình hằng ngày

```powershell
# 1) code + test tay
npm run smoke

# 2) bump version + CHANGELOG
#    package.json: "version": "2.10.0" → "2.10.1"
#    CHANGELOG.md : thêm mục ## [2.10.1] - YYYY-MM-DD

# 3) commit + push
git add -A
git commit -m "fix: ..."
git push origin main
```

Sau push:

| Nơi xem | Kỳ vọng |
|---|---|
| Actions ▸ Deploy Production | `build` xanh → (approve nếu có) → `deploy` xanh |
| `https://<domain>/api/version` | đúng version vừa bump |
| `https://<domain>/healthz` | `{"ok":true,"version":"…"}` |
| `systemctl status cell-tracker` | `active (running)`, restart gần nhất vừa xong |

**Deploy nhánh khác / hotfix**: mở PR → CI chạy (không deploy) → merge vào `main` → deploy.

**Sửa `public/m/*`**: nhớ tăng `CACHE_VERSION` trong `public/m/sw.js`, nếu không
người dùng vẫn thấy bản cũ (stale-while-revalidate).

---

## 8. Rollback

### 8.1 Tự động (đã có)
Health gate fail ⇒ job đỏ, `current` đã quay về release trước, service restart lại.
Không cần làm gì thêm; xem log job để biết lỗi.

### 8.2 Thủ công (khi bản mới "xanh" nhưng sai nghiệp vụ)

```bash
# trong LXC
ls -1dt /opt/cell-tracker/releases/*/ | head -n 5
sudo ln -sfn /opt/cell-tracker/releases/<ts>-<ver-cu> /opt/cell-tracker/current.tmp
sudo mv -Tf /opt/cell-tracker/current.tmp /opt/cell-tracker/current
sudo systemctl restart cell-tracker
curl -fsS http://127.0.0.1:3000/healthz
```

Hoặc **revert trên Git** rồi push — CI/CD deploy lại bản cũ một cách sạch sẽ
(khuyến nghị, vì `current` sẽ khớp với `main`).

Dữ liệu (`shared/database.sqlite`, `shared/uploads`) **không** bị rollback theo code.
Nếu bản lỗi đã ghi DB sai: khôi phục từ `shared/backups/database-*.sqlite` (xem mục 6
của [README.md](README.md)) — backup chạy 03:20 hằng ngày.

---

## 9. Troubleshooting

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Job `deploy` **Queued** mãi | Không có runner online / sai label | `systemctl status 'actions.runner.*'`; kiểm tra label `celltracker-lxc` |
| Runner **Offline** | LXC mất mạng ra github.com, hoặc token/version cũ | `curl -I https://api.github.com`; xem `_diag/Runner_*.log`; `svc.sh stop/start` |
| `sudo: a password is required` | Thiếu/sai `/etc/sudoers.d/celltracker-ci` | `sudo -u ghrunner sudo -n -l`; `visudo -cf` lại file |
| `npm ci` fail (`gyp ERR!`) | Thiếu compiler trong LXC | `apt install -y build-essential python3`, chạy lại job |
| `Health check THẤT BẠI` | App không boot, DB hỏng, version sai | Đọc 60 dòng `journalctl` ngay trong log job; sửa rồi push lại |
| `artifact không đúng cấu trúc` | `git archive` sai prefix / artifact hỏng | Kiểm tra job `build`; tải artifact về xem `tar -tzf` |
| `/healthz` 503 `db_unavailable` | `DB_PATH` sai, file DB không đọc được, ổ đầy | `ls -l /opt/cell-tracker/shared/`, `df -h`, `sqlite3 … 'PRAGMA integrity_check;'` |
| Deploy xong nhưng version không đổi | Quên bump `package.json`; hoặc job deploy bị skip | Kiểm tra job có chạy không; bump version |
| Hai deploy chồng nhau | Đã có `concurrency`, nhưng nếu bấm cả `deploy.ps1` tay | Chỉ dùng một đường; CI/CD tự xếp hàng |
| Job fail vì `actions/download-artifact` | Artifact hết hạn (14 ngày) hoặc tên đổi | Chạy lại `build` rồi `deploy` |
| Cert hết hạn | `certbot.timer` bị tắt | `systemctl status certbot.timer`; `certbot renew --dry-run` |

Lệnh chẩn đoán nhanh trong LXC:

```bash
systemctl status cell-tracker --no-pager
journalctl -u cell-tracker -n 100 --no-pager
curl -i http://127.0.0.1:3000/healthz
ss -lptn 'sport = :3000'
ls -l /opt/cell-tracker/current /opt/cell-tracker/releases/
tail -n 50 /opt/cell-tracker/shared/backups/../*.log 2>/dev/null || true
```

---

## 10. Đường dự phòng khi runner/CI hỏng

Vẫn deploy được từ máy dev bằng SSH (cùng artifact, cùng script, cùng rollback):

```powershell
pwsh ./deploy/deploy.ps1 -Target root@<IP>            # có smoke test
pwsh ./deploy/deploy.ps1 -Target root@<IP> -SkipTests # khi chỉ sửa docs
```

Hoặc deploy tay hoàn toàn trên LXC:

```bash
cd /tmp && git clone --depth 1 https://github.com/khanhppa/cell.id.vn.git src
cd src && git archive --format=tar.gz -o /tmp/release.tar.gz HEAD
sudo /opt/cell-tracker/bin/deploy-release.sh /tmp/release.tar.gz
```

---

## 11. Bảo mật — checklist

- [ ] Runner chỉ đăng ký cho **repo này** (không dùng org runner dùng chung).
- [ ] **Không** chạy `pull_request` từ fork trên self-hosted runner
      (`deploy.yml` chỉ chạy `push` vào `main` + dispatch).
- [ ] Environment `production` có **Required reviewers**.
- [ ] Sudoers chỉ đúng 3 nhóm lệnh, file `440`, `visudo -cf` pass.
- [ ] `.env` chỉ tồn tại trên server (`/opt/cell-tracker/shared/.env`, mode `600`),
      không bao giờ nằm trong artifact (CI có bước verify).
- [ ] `JWT_SECRET`/`GUEST_SECRET` sinh bằng `openssl rand -hex 32`; nghi lộ → đổi
      trong `.env` + `systemctl restart cell-tracker` (mọi token cũ mất hiệu lực).
- [ ] Backup: vzdump hằng ngày + `bin/backup-db.sh` 03:20 (giữ 14 bản).
- [ ] Bật `pct set <CTID> --onboot 1` sau khi pipeline chạy ổn định.

---

## 12. Phương án thay thế (khi không muốn GitHub Actions)

| Cách | Ưu | Nhược |
|---|---|---|
| `act` trên máy dev | Chạy đúng file workflow, không cần runner | `act` không giả lập đầy đủ artifact/environment; vẫn cần SSH sang LXC |
| Bare repo trên Proxmox + `post-receive` | Thuần LAN, không phụ thuộc GitHub | Không có UI/log/artifact, phải tự viết hook, khó review |
| GitLab CI self-hosted (cùng LXC) | UI đầy đủ | Thêm dịch vụ + RAM cho LXC 2GB |

Với quy mô hiện tại (1 LXC, 1 người vận hành), GitHub Actions + runner trong LXC là
cân bằng tốt nhất giữa "có CI/CD thật" và "không mở cổng vào LAN".

---

## 13. Checklist lần đầu (in ra dán cạnh màn hình)

```
[ ] LXC đã bootstrap, app chạy, /healthz = 200
[ ] GitHub: Actions bật, environment "production", branch protection cho main
[ ] Runner token lấy từ Settings ▸ Actions ▸ Runners
[ ] install-runner.sh chạy xong, runner Idle, label celltracker-lxc
[ ] sudoers cài + visudo -cf pass
[ ] deploy tay lần đầu (seed DB nếu cần) — app phục vụ được
[ ] Run workflow "Deploy Production" → build xanh, deploy xanh
[ ] /api/version = version trong package.json
[ ] Thử rollback: deploy bản cố tình lỗi → job đỏ, current quay về bản trước
[ ] pct set <CTID> --onboot 1
```
