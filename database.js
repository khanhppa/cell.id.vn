const path = require('path');
const fs = require('fs');

// Vị trí file DB.
//  • DB_PATH (production): trỏ ra thư mục dữ liệu riêng, ngoài mọi release code,
//    vd /opt/cell-tracker/shared/database.sqlite → deploy bản mới KHÔNG xoá dữ liệu.
//  • Không đặt: giữ hành vi cũ = thư mục CHA của repo (local là D:\Code\database.sqlite)
//    để script test và DB dev sẵn có không phải đổi gì.
const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(path.dirname(__dirname), 'database.sqlite');

// Thư mục chứa DB phải tồn tại trước khi mở (sqlite3 báo SQLITE_CANTOPEN nếu thiếu).
try { fs.mkdirSync(path.dirname(dbPath), { recursive: true }); } catch (e) { /* để sqlite báo lỗi nếu thật sự không ghi được */ }

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Legacy `history` table is superseded by `lookup_history` (below). Drop it.
  db.run(`DROP TABLE IF EXISTS history`);

  // Generic key/value settings (admin-configurable).
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Full audit of cell lookups (single + batch), replacing the old `history`.
  db.run(`CREATE TABLE IF NOT EXISTS lookup_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    mode TEXT,
    mcc TEXT,
    mnc TEXT,
    lac TEXT,
    cellid TEXT,
    sector TEXT,
    lat REAL,
    lng REAL,
    range REAL,
    source TEXT,
    found INTEGER DEFAULT 0,
    batch_id TEXT,
    radio TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  // RAT (GSM/CDMA/UMTS/LTE/NR/NB-IoT) cho từng lần tra — dùng để tô màu + chữ cái
  // giữa marker trên bản đồ. Nguồn: CSV/CLF upload, OpenCellID API, hoặc suy luận.
  db.run(`ALTER TABLE lookup_history ADD COLUMN radio TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error('lookup_history.radio column:', err.message);
  });
  // Một lần upload file tra cứu = 1 nhóm batch. Giữ metadata (tên file, số cell)
  // để lịch sử hiển thị 1 dòng cho mỗi lần upload thay vì lặp N dòng.
  db.run(`CREATE TABLE IF NOT EXISTS lookup_batches (
    batch_id TEXT PRIMARY KEY,
    user_id INTEGER,
    file_name TEXT,
    mode TEXT DEFAULT 'batch',
    cell_count INTEGER DEFAULT 0,
    found_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  // Một lần upload Excel rút list (call log) = 1 phiên. Chỉ giữ metadata
  // (tên file, mạng, số bản ghi) — KHÔNG lưu nội dung file. Bản ghi đã nằm
  // trong call_logs (gắn batch_id) nên xem lại được mà không cần file gốc.
  db.run(`CREATE TABLE IF NOT EXISTS call_log_batches (
    batch_id TEXT PRIMARY KEY,
    user_id INTEGER,
    file_name TEXT,
    network TEXT,
    row_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  // Toạ độ của cell ĐÃ TRẢ PHÍ trong phiên (JSON array) — để mở lại phiên ở máy/tab
  // khác vẫn thấy kết quả, không phải tra & trừ điểm lần nữa. Chỉ ghi cell
  // state=found (kèm lat/lng); cell chưa trả phí không bao giờ được lưu ở đây.
  db.run(`ALTER TABLE call_log_batches ADD COLUMN resolved_cells TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error('call_log_batches.resolved_cells column:', err.message);
  });
  // Số CELL của file (khác `row_count` = số DÒNG cuộc gọi). Phiên chỉ chứa toạ độ
  // đã tra nên `call_logs` có thể rỗng → giữ số cell trong metadata để tab "Xem rút
  // list" vẫn hiện đúng "đã tra x/y" và tiến trình.
  db.run(`ALTER TABLE call_log_batches ADD COLUMN cell_count INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error('call_log_batches.cell_count column:', err.message);
  });
  // DANH SÁCH CELL đầy đủ của phiên (JSON array) — gồm cả cell CHƯA tra.
  //
  // Luồng "Tra cứu danh sách Excel" không lưu call_logs từng dòng (chỉ ghi
  // lookup_history cho cell đã tra) ⇒ mở lại phiên chỉ dựng được các cell ĐÃ TRA,
  // còn cell chưa tra biến mất; nếu chưa tra cell nào thì báo "Không tìm thấy phiên".
  // Cột này giữ nguyên danh sách cell của file để mở lại đủ, đúng thứ tự.
  // CHỈ chứa định danh cell (mcc/mnc/lac/cellid/sector/radio/rowCount) — KHÔNG
  // chứa toạ độ, nên không rò kết quả chưa trả phí.
  db.run(`ALTER TABLE call_log_batches ADD COLUMN session_cells TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error('call_log_batches.session_cells column:', err.message);
  });
  // ==========================================================================
  // Credit system — mỗi lần tra cứu THÀNH CÔNG trừ `credit_cost_per_lookup`.
  // Số dư nằm ở users.credit_balance (cache); `credit_transactions` là ledger
  // append-only, luôn thoả: SUM(amount) == users.credit_balance (đối soát được).
  // KHÔNG bao giờ UPDATE/DELETE row trong credit_transactions — sai thì ghi
  // bút toán đảo (type='correction') để giữ nguyên vết.
  // ==========================================================================
  db.run(`ALTER TABLE users ADD COLUMN credit_balance REAL NOT NULL DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error('users.credit_balance column:', err.message);
  });

  db.run(`CREATE TABLE IF NOT EXISTS credit_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    balance_after REAL NOT NULL,
    type TEXT NOT NULL,
    ref TEXT,
    note TEXT,
    admin_id INTEGER,
    admin_ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  // Chống ghi trùng bút toán khi client retry (cùng user + type + ref chỉ 1 row).
  // Partial index: các bút toán không có ref vẫn được ghi nhiều lần.
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_tx_idem
    ON credit_transactions(user_id, type, ref) WHERE ref IS NOT NULL`);

  // ==========================================================================
  // payOS top-up — gói nạp điểm (admin cấu hình) + đơn thanh toán.
  // `payment_orders` là bản ghi NGOẠI LAI (đối chiếu với payOS), KHÔNG phải
  // ledger điểm: việc cộng điểm thật vẫn đi qua credit_transactions với
  // type='payment' + ref='payos:<orderCode>'. Idempotent nhờ unique index
  // idx_credit_tx_idem, nên webhook retry không cộng 2 lần.
  // `topup_packages` soft-delete (active=0) để giữ được lịch sử đơn cũ.
  // ==========================================================================
  db.run(`CREATE TABLE IF NOT EXISTS topup_packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT,
    amount_vnd INTEGER NOT NULL,
    credits REAL NOT NULL,
    sort_order INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS payment_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_code INTEGER UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    package_id INTEGER,
    amount_vnd INTEGER NOT NULL,
    credits REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    payment_link_id TEXT,
    checkout_url TEXT,
    qr_code TEXT,
    description TEXT,
    paid_at DATETIME,
    transaction_ref TEXT,
    client_ip TEXT,
    user_agent TEXT,
    raw_webhook TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON payment_orders(user_id, created_at DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status, created_at DESC)`);
  // Hạn thanh toán (payOS trả khi tạo link; fallback created_at + 15 phút). Dùng để
  // đếm ngược trên trang nạp và tự đánh dấu EXPIRED khi quá hạn.
  db.run(`ALTER TABLE payment_orders ADD COLUMN expires_at DATETIME`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error('payment_orders.expires_at column:', err.message);
  });
  // Số tiền payOS báo ĐÃ THU (webhook `data.amount` / API `amountPaid`). Giữ riêng
  // để đối soát: đơn có thể UNDERPAID (chuyển thiếu) — khi đó KHÔNG cộng điểm và
  // admin cần thấy chênh lệch, thay vì chỉ có raw_webhook JSON.
  db.run(`ALTER TABLE payment_orders ADD COLUMN amount_paid INTEGER`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error('payment_orders.amount_paid column:', err.message);
  });

  // ==========================================================================
  // Email + kích hoạt tài khoản.
  //  - users.email: đăng nhập/quên mật khẩu nhận link về đây. Partial unique
  //    index (WHERE email IS NOT NULL) vì user cũ chưa có email — nhiều NULL
  //    vẫn hợp lệ trong SQLite.
  //  - users.status: 'pending' (chờ kích hoạt email) / 'active' / 'disabled'.
  //  - users.email_verified: 0/1. User cũ được backfill = 1 để KHÔNG bị chặn
  //    đăng nhập sau khi nâng cấp (họ chưa từng có bước xác thực email).
  // ==========================================================================
  for (const [col, ddl] of [
    ['email', 'TEXT'],
    ['email_verified', 'INTEGER DEFAULT 0'],
    ['terms_accepted_at', 'DATETIME'],
  ]) {
    db.run(`ALTER TABLE users ADD COLUMN ${col} ${ddl}`, (err) => {
      if (err && !err.message.includes('duplicate column')) console.error(`users.${col} column:`, err.message);
    });
  }
  // users.status đã có từ schema gốc; thêm lại cho DB tạo trước khi có cột này.
  db.run(`ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error('users.status column:', err.message);
  });
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL`);
  // Backfill 1 lần: mọi user hiện có coi như đã xác thực (không có email để gửi).
  db.run(`UPDATE users SET email_verified = 1 WHERE email_verified IS NULL OR (email IS NULL AND email_verified = 0)`, (err) => {
    if (err) console.error('users.email_verified backfill:', err.message);
  });

  // Mã xác nhận (6 số) + token dùng cho link trong email. Gộp 2 mục đích:
  //  - purpose='verify': kích hoạt tài khoản sau khi đăng ký.
  //  - purpose='reset' : đặt lại mật khẩu khi quên.
  // One-shot: dùng xong set used_at; quá hạn hoặc sai quá 5 lần thì huỷ.
  db.run(`CREATE TABLE IF NOT EXISTS email_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    email TEXT,
    purpose TEXT NOT NULL DEFAULT 'verify',
    code TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    attempts INTEGER DEFAULT 0,
    used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_email_verif_user ON email_verifications(user_id, purpose)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_email_verif_token ON email_verifications(token)`);

  // Guest trial — 1 lượt tra cứu miễn phí (dữ liệu nội bộ) cho người chưa có tài khoản.
  // Định danh bằng fingerprint(ip + user-agent) vì guest không có token.
  // Không FK tới users: đây là dữ liệu marketing/upsell, không phải ledger điểm.
  db.run(`CREATE TABLE IF NOT EXISTS guest_trials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guest_key TEXT UNIQUE NOT NULL,
    ip TEXT,
    user_agent TEXT,
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    mcc TEXT, mnc TEXT, lac TEXT, cellid TEXT, sector TEXT,
    found INTEGER DEFAULT 0
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_guest_trials_key ON guest_trials(guest_key)`);
  // Phương án A — khoá kép chống lách incognito / đổi User-Agent:
  //  - guest_net_key: sha256(ipPrefix + uaFamily) → bản ghi thứ 2 khi khách xoá cookie.
  //  - client_id: id do server phát (cookie HttpOnly, ký HMAC) — client không tự chế được.
  //  - expires_at: hết hạn sau 30 ngày để IP dùng chung (NAT/4G) không bị khoá vĩnh viễn.
  for (const [col, ddl] of [
    ['guest_net_key', 'TEXT'],
    ['client_id', 'TEXT'],
    ['ua_family', 'TEXT'],
    ['expires_at', 'DATETIME'],
  ]) {
    db.run(`ALTER TABLE guest_trials ADD COLUMN ${col} ${ddl}`, (err) => {
      if (err && !err.message.includes('duplicate column')) console.error(`guest_trials.${col} column:`, err.message);
    });
  }
  db.run(`CREATE INDEX IF NOT EXISTS idx_guest_trials_net ON guest_trials(guest_net_key)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_guest_trials_client ON guest_trials(client_id)`);

  // User-drawn map annotations (polygon / rectangle / marker / distance polyline).
  db.run(`CREATE TABLE IF NOT EXISTS annotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT,
    label TEXT,
    geojson TEXT,
    distance REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);



  db.run(`CREATE TABLE IF NOT EXISTS cells (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mcc TEXT,
    mnc TEXT,
    lac TEXT,
    cellid TEXT,
    lat REAL,
    lng REAL,
    range REAL DEFAULT 0,
    description TEXT,
    address TEXT,
    city TEXT,
    source TEXT,
    user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  // RAT của cell (GSM/CDMA/UMTS/LTE/NR/NB-IoT). Có trong OpenCellID CSV (`radio`) và
  // trong response API OpenCellID; trước đây bị bỏ khi lưu vào `cells`.
  db.run(`ALTER TABLE cells ADD COLUMN radio TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error('cells.radio column:', err.message);
  });

  db.run(`CREATE TABLE IF NOT EXISTS data_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'opencellid',
    base_url TEXT DEFAULT '',
    api_key TEXT DEFAULT '',
    username TEXT DEFAULT '',
    password TEXT DEFAULT '',
    mcc TEXT DEFAULT '',
    mnc TEXT DEFAULT '',
    lac TEXT DEFAULT '',
    max_cells INTEGER DEFAULT 100,
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`ALTER TABLE data_sources ADD COLUMN priority INTEGER DEFAULT 100`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error('priority column:', err.message);
  });

  db.run(`CREATE TABLE IF NOT EXISTS call_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    network TEXT,
    phone_number TEXT,
    action_type TEXT,
    timestamp TEXT,
    contact_number TEXT,
    duration TEXT,
    mcc TEXT,
    mnc TEXT,
    lac TEXT,
    cellid TEXT,
    cell_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    filename TEXT,
    original_name TEXT,
    type TEXT,
    total INTEGER DEFAULT 0,
    inserted INTEGER DEFAULT 0,
    updated INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    errors TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS ip_tracker (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('url', 'image')),
    name TEXT DEFAULT '',
    redirect_url TEXT DEFAULT '',
    image_path TEXT,
    image_name TEXT,
    token TEXT UNIQUE NOT NULL,
    og_title TEXT DEFAULT '',
    og_description TEXT DEFAULT '',
    og_image TEXT DEFAULT '',
    og_image_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS ip_tracker_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracker_id INTEGER NOT NULL,
    ip TEXT,
    wan_ip TEXT,
    user_agent TEXT,
    headers TEXT,
    query_params TEXT,
    visitor_id TEXT,
    referer TEXT,
    country TEXT,
    region TEXT,
    city TEXT,
    geo_json TEXT,
    client_json TEXT,
    event TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tracker_id) REFERENCES ip_tracker(id) ON DELETE CASCADE
  )`);

  // Fix: add wan_ip column if missing on existing DB
  db.run(`ALTER TABLE ip_tracker_logs ADD COLUMN wan_ip TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding wan_ip column:', err.message);
    }
  });

  // ==========================================================================
  // Bẫy địa chỉ IP — bổ sung (idempotent, chạy trên DB cũ vẫn được)
  //
  //   ip_tracker.og_image_path : ảnh OG do người dùng TẢI LÊN (để trống thì dùng
  //                              `og_image` là URL dán tay).
  //   ip_tracker_logs.visitor_id / referer / country / region / city / geo_json
  //     : dữ liệu thu được lúc victim mở link. `geo_json` là bản đầy đủ (ASN, ISP,
  //       toạ độ, proxy/hosting…) do phần tra cứu IP chạy NỀN điền vào sau, nên
  //       cột phải NULL-able và KHÔNG được đọc là "không có dữ liệu".
  // ==========================================================================
  const trackerColumns = [
    ['ip_tracker', 'og_image_path', 'TEXT'],
    ['ip_tracker_logs', 'visitor_id', 'TEXT'],
    ['ip_tracker_logs', 'referer', 'TEXT'],
    ['ip_tracker_logs', 'country', 'TEXT'],
    ['ip_tracker_logs', 'region', 'TEXT'],
    ['ip_tracker_logs', 'city', 'TEXT'],
    ['ip_tracker_logs', 'geo_json', 'TEXT'],
    ['ip_tracker_logs', 'client_json', 'TEXT'],
    ['ip_tracker_logs', 'event', 'TEXT']
  ];
  for (const [table, column, type] of trackerColumns) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error(`Error adding ${table}.${column} column:`, err.message);
      }
    });
  }
  db.run(`CREATE INDEX IF NOT EXISTS idx_ip_tracker_logs_visitor ON ip_tracker_logs(visitor_id)`);

  // Fix: add status column to existing users
  db.run(`ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding status column:', err.message);
    }
  });

  // Fix: add cells extra columns on existing DB
  db.run(`ALTER TABLE cells ADD COLUMN range REAL DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding range column:', err.message);
    }
  });
  db.run(`ALTER TABLE cells ADD COLUMN description TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding description column:', err.message);
    }
  });
  db.run(`ALTER TABLE cells ADD COLUMN user_id INTEGER`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding user_id column:', err.message);
    }
  });

  // Fix: add user_id column to existing call_logs table
  db.run(`ALTER TABLE call_logs ADD COLUMN user_id INTEGER`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding call_logs user_id column:', err.message);
    }
  });

  // Fix: add enb_id / sector columns (short cell ID conversions) to existing call_logs table
  db.run(`ALTER TABLE call_logs ADD COLUMN enb_id TEXT DEFAULT ''`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding call_logs enb_id column:', err.message);
    }
  });
  db.run(`ALTER TABLE call_logs ADD COLUMN sector TEXT DEFAULT ''`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding call_logs sector column:', err.message);
    }
  });

  // Fix: add batch_id column — mỗi lần upload Excel = 1 batch_id, để user xoá
  // theo từng lần upload (nút xoá nhóm) thay vì chỉ xoá được toàn bộ.
  db.run(`ALTER TABLE call_logs ADD COLUMN batch_id TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding call_logs batch_id column:', err.message);
    }
  });

  // Fix: add og columns if missing on existing DB
  db.run(`ALTER TABLE ip_tracker ADD COLUMN og_title TEXT DEFAULT ''`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding og_title column:', err.message);
    }
  });
  db.run(`ALTER TABLE ip_tracker ADD COLUMN og_description TEXT DEFAULT ''`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding og_description column:', err.message);
    }
  });
  db.run(`ALTER TABLE ip_tracker ADD COLUMN og_image TEXT DEFAULT ''`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding og_image column:', err.message);
    }
  });

  // Create indexes
  // Dedupe then add UNIQUE so bulk INSERT OR IGNORE is fast & skips dupes in one statement.
  // Drop any pre-existing NON-unique index of the same name first — CREATE UNIQUE ... IF NOT EXISTS
  // would otherwise be a silent no-op because the name is already taken.
  db.run(`DELETE FROM cells WHERE id NOT IN (SELECT MIN(id) FROM cells GROUP BY mcc, mnc, lac, cellid)`);
  db.run(`DROP INDEX IF EXISTS idx_cells_lookup`, () => {
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_cells_lookup ON cells(mcc, mnc, lac, cellid)`, (err) => {
      if (err) console.error('idx_cells_lookup (unique) warning:', err.message);
    });
  });
  db.run(`CREATE INDEX IF NOT EXISTS idx_cells_lookup_nonunique ON cells(lat)`);
  // Đếm/dọn cells cũng như ghép phiên hay lọc theo batch_id (thiếu index = full scan).
  db.run(`CREATE INDEX IF NOT EXISTS idx_call_log_batches_batch ON call_log_batches(batch_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_lookup_history_user_batch ON lookup_history(user_id, batch_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_call_logs_user ON call_logs(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_call_logs_batch ON call_logs(user_id, batch_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ip_tracker_token ON ip_tracker(token)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ip_tracker_user ON ip_tracker(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ip_tracker_logs_tracker ON ip_tracker_logs(tracker_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_lookup_history_user ON lookup_history(user_id, created_at DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_lookup_history_batch ON lookup_history(batch_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_lookup_batches_user ON lookup_batches(user_id, created_at DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_call_log_batches_user ON call_log_batches(user_id, created_at DESC)`);
  // Backfill metadata cho các phiên upload rút list ghi trước khi có bảng
  // call_log_batches (idempotent nhờ INSERT OR IGNORE — chạy lại vẫn an toàn).
  db.run(`INSERT OR IGNORE INTO call_log_batches
      (batch_id, user_id, file_name, network, row_count, created_at)
    SELECT batch_id, user_id, NULL, MAX(network), COUNT(*), MIN(created_at)
    FROM call_logs
    WHERE batch_id IS NOT NULL AND batch_id <> ''
    GROUP BY batch_id, user_id`);
  // Phiên cũ chưa có số cell → lấy số cell duy nhất của batch (chỉ chạy 1 lần cho
  // dòng còn 0, nên không ghi đè giá trị client đã gửi).
  db.run(`UPDATE call_log_batches
    SET cell_count = (SELECT COUNT(*) FROM (
        SELECT 1 FROM call_logs c
        WHERE c.batch_id = call_log_batches.batch_id AND c.user_id = call_log_batches.user_id
        GROUP BY ifnull(c.mcc,'') || '-' || ifnull(c.mnc,'') || '-' || ifnull(c.lac,'') || '-' || ifnull(c.cellid,'')
      ))
    WHERE ifnull(cell_count, 0) = 0`);
  // Backfill metadata cho các batch đã ghi trước khi có bảng lookup_batches
  // (idempotent nhờ INSERT OR IGNORE — chạy lại mỗi lần khởi động vẫn an toàn).
  db.run(`INSERT OR IGNORE INTO lookup_batches
      (batch_id, user_id, file_name, mode, cell_count, found_count, created_at)
    SELECT batch_id, user_id, NULL, 'batch', COUNT(*), SUM(found), MIN(created_at)
    FROM lookup_history
    WHERE mode = 'batch' AND batch_id IS NOT NULL AND batch_id <> ''
    GROUP BY batch_id, user_id`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_annotations_user ON annotations(user_id, created_at DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON credit_transactions(user_id, created_at DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_credit_tx_type ON credit_transactions(type, created_at DESC)`);

  // Dashboard admin gom số liệu theo NGÀY trên toàn bảng (không lọc user):
  // thiếu index created_at thì mỗi lần mở Dashboard là full scan.
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_lookup_history_created ON lookup_history(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_lookup_batches_created ON lookup_batches(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_payment_orders_paid ON payment_orders(status, paid_at)`);



  // Seed default settings (only when missing — never overwrite admin changes).
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('max_online_resolve', '50')`);
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('max_google_per_batch', '10')`);
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('lookup_history_retention_days', '90')`);

  // Bật/đóng website (chế độ bảo trì). Mặc định MỞ để deploy không khoá site.
  // Message rỗng = dùng thông báo mặc định trong site-status.js.
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('site_open', '1')`);
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('site_closed_message', '')`);

  // Credit system settings. `credit_enabled` mặc định TẮT (0) để không khoá
  // toàn bộ user hiện có (ai cũng 0 điểm) ngay khi deploy — admin bật sau khi
  // đã nạp điểm. `credit_signup_bonus` = điểm tặng khi tạo tài khoản.
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('credit_enabled', '0')`);
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('credit_cost_per_lookup', '1')`);
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('credit_signup_bonus', '5')`);
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('credit_allow_negative', '0')`);

  // payOS gateway settings. TẮT mặc định — admin nhập credential rồi bật.
  // `payos_base_url` cho phép trỏ sang môi trường sandbox của payOS khi test.
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('payos_enabled', '0')`);
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('payos_client_id', '')`);
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('payos_api_key', '')`);
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('payos_checksum_key', '')`);
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('payos_base_url', '')`);
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('payos_webhook_url', '')`);
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('payos_test_mode', '0')`);
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('public_base_url', '')`);
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('topup_min_vnd', '10000')`);
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('topup_max_vnd', '5000000')`);
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('topup_vnd_per_credit', '1000')`);

  // Seed 3 gói nạp mặc định khi bảng còn rỗng (1000đ = 1 điểm).
  db.get(`SELECT COUNT(*) AS c FROM topup_packages`, [], (err, row) => {
    if (err || (row && row.c > 0)) return;
    db.run(`INSERT INTO topup_packages (label, amount_vnd, credits, sort_order, active) VALUES
      ('Gói 10.000đ', 10000, 10, 10, 1),
      ('Gói 20.000đ', 20000, 20, 20, 1),
      ('Gói 50.000đ', 50000, 50, 30, 1)`);
  });
  // Mọi user tạo trước khi có cột credit_balance đều bắt đầu từ 0 (không hồi tố bonus).
  db.run(`UPDATE users SET credit_balance = 0 WHERE credit_balance IS NULL`);

  // Automatic OpenCellID sync jobs (VN / MCC 452 by default, daily at 03:00).
  db.run(`CREATE TABLE IF NOT EXISTS sync_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER,
    cron_expr TEXT DEFAULT '0 3 * * *',
    scope TEXT DEFAULT 'mcc',
    mcc_list TEXT DEFAULT '452',
    enabled INTEGER DEFAULT 1,
    last_run DATETIME,
    last_status TEXT,
    last_message TEXT,
    last_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // ==========================================================================
  // cells_audit — lịch sử SỬA/XÓA row trong bảng `cells` từ trang admin.
  // Append-only: KHÔNG bao giờ UPDATE/DELETE row trong bảng này, để luôn dựng
  // lại được trạng thái cũ của một cell (old_json → new_json).
  // ==========================================================================
  db.run(`CREATE TABLE IF NOT EXISTS cells_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cell_id INTEGER,
    action TEXT NOT NULL,
    old_json TEXT,
    new_json TEXT,
    user_id INTEGER,
    username TEXT,
    ip TEXT,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_cells_audit_cell ON cells_audit(cell_id, created_at DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_cells_audit_user ON cells_audit(user_id, created_at DESC)`);

  // ==========================================================================
  // Public API (v1) — cho ứng dụng / website khác gọi tra cứu cell.
  //
  // `api_keys` = CỔNG KẾT NỐI, KHÔNG gắn tài khoản. Key chỉ chứng minh "ứng dụng
  // ngoài được phép gọi máy chủ" và chịu hạn mức riêng. Danh tính người dùng —
  // và do đó điểm bị trừ — đến từ JWT lấy qua POST /api/v1/login.
  //   require_user = 1 (mặc định) → key MỘT MÌNH không tra cứu được, request phải
  //                                 gửi kèm cả key lẫn JWT.
  //   require_user = 0            → chỉ dùng được endpoint công khai (health...).
  //
  // Server KHÔNG lưu key dạng thô — chỉ lưu SHA-256 (`key_hash`) để lộ DB cũng
  // không dùng lại được key. `key_prefix` giữ 12 ký tự đầu để admin nhận ra key
  // trong danh sách; KHÔNG đủ để dựng lại key.
  //
  // `revoked_at` khác `enabled`: enabled=0 là admin tạm tắt (bật lại được),
  // revoked_at là thu hồi vĩnh viễn (không bật lại được, phải tạo key mới).
  //
  // `user_id` là cột CŨ (key từng gắn 1 chủ sở hữu). Giữ lại cho dữ liệu lịch sử
  // nhưng KHÔNG còn dùng để xác thực hay trừ điểm — đã cho phép NULL.
  // ==========================================================================
  db.run(`CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    scopes TEXT DEFAULT 'lookup,account',
    rate_limit_per_min INTEGER DEFAULT 60,
    rate_limit_per_day INTEGER DEFAULT 5000,
    enabled INTEGER DEFAULT 1,
    require_user INTEGER DEFAULT 1,
    last_used_at DATETIME,
    expires_at DATETIME,
    revoked_at DATETIME,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)`);

  // Migration cho DB đã tạo bảng từ bản trước (lúc đó api_keys gắn user cố định).
  // SQLite không bỏ được NOT NULL / FK bằng ALTER, và bảng mới chưa có dữ liệu
  // thật nên dựng lại bảng là cách sạch nhất.
  migrateApiKeysToOwnerless();

  // Nhật ký từng request API — phục vụ tab "API" trong admin (đếm lỗi, theo dõi
  // abuse, xem app nào đang gọi). Ghi bất đồng bộ, KHÔNG chặn response.
  // KHÔNG bao giờ ghi key thô vào đây, chỉ ghi api_key_id.
  // `user_id` ở đây KHÁC api_keys: nó là tài khoản đã đăng nhập qua JWT trong
  // request đó (nguồn bị trừ điểm), không phải "chủ key".
  db.run(`CREATE TABLE IF NOT EXISTS api_request_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key_id INTEGER,
    user_id INTEGER,
    method TEXT,
    path TEXT,
    status INTEGER,
    duration_ms INTEGER,
    cells INTEGER DEFAULT 0,
    charged REAL DEFAULT 0,
    ip TEXT,
    user_agent TEXT,
    error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_api_logs_key ON api_request_logs(api_key_id, created_at DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_api_logs_created ON api_request_logs(created_at DESC)`);

  // ==========================================================================
  // IP LOOKUP — tra cứu địa chỉ IP qua nhiều nguồn (DB-IP, IPinfo Lite, ipwho.is…).
  //
  // `ip_lookup_sources` là danh mục NGUỒN (1 row / 1 loại), admin bật/tắt, sắp
  // ưu tiên, nhập API key. KHÔNG dùng chung bảng `data_sources` với cell: hai
  // nghiệp vụ khác nhau, gộp sẽ làm tab "Nguồn dữ liệu Online" (cell) vỡ khi
  // seed/đổi type.
  //
  // `ip_lookup_cache` giữ kết quả ĐÃ CHUẨN HOÁ theo (ip, nguồn) để nguồn free
  // (ip-api.com 45 req/phút, DB-IP free) không bị đốt quota khi cùng một IP được
  // tra nhiều lần. Khoá UNIQUE (normalized, source_type) → 1 row / cặp, ghi bằng
  // UPSERT (`ON CONFLICT DO UPDATE`).
  //
  // `ip_lookup_logs` là nhật ký từng lượt tra (user hoặc guest) — KHÔNG lưu dữ
  // liệu vị trí, chỉ IP bị tra + danh sách nguồn + thời gian, để admin đối soát
  // và tính hạn mức ngày.
  //
  // `ip_guest_trials` đếm lượt tra MIỄN PHÍ của khách theo IP chuẩn hoá (1 lượt
  // / IP / ngày, giống tinh thần guest_trials của cell nhưng không gắn cookie —
  // khách thường tra IP của chính mình nên khoá theo IP là đủ và không cần JS
  // phía client).
  // ==========================================================================
  db.run(`CREATE TABLE IF NOT EXISTS ip_lookup_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    base_url TEXT DEFAULT '',
    api_key TEXT DEFAULT '',
    plan TEXT DEFAULT 'lite',
    enabled INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 100,
    timeout_ms INTEGER DEFAULT 10000,
    cache_days INTEGER DEFAULT 7,
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS ip_lookup_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL,
    normalized TEXT NOT NULL,
    source_type TEXT NOT NULL,
    data_json TEXT,
    ok INTEGER DEFAULT 1,
    error TEXT,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(normalized, source_type)
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ip_lookup_cache_norm ON ip_lookup_cache(normalized)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ip_lookup_cache_fetched ON ip_lookup_cache(fetched_at)`);

  db.run(`CREATE TABLE IF NOT EXISTS ip_lookup_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    ip TEXT,
    normalized TEXT,
    source_types TEXT,
    status INTEGER,
    duration_ms INTEGER,
    cache_hits INTEGER DEFAULT 0,
    error TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ip_lookup_logs_norm ON ip_lookup_logs(normalized, created_at DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ip_lookup_logs_user ON ip_lookup_logs(user_id, created_at DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ip_lookup_logs_created ON ip_lookup_logs(created_at DESC)`);

  db.run(`CREATE TABLE IF NOT EXISTS ip_guest_trials (
    normalized_ip TEXT PRIMARY KEY,
    ip TEXT,
    count INTEGER DEFAULT 0,
    first_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Cấu hình tra cứu IP. Public bật mặc định nhưng CHỈ nguồn không cần key;
  // hạn mức khách mặc định 1 lượt/IP/ngày. Console (tra server IP) mặc định TẮT
  // để không ai chạy được máy chủ như một open proxy đốt quota nguồn free.
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('ip_lookup_public_enabled', '1')`);
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('ip_lookup_public_guest_daily', '1')`);
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('ip_lookup_user_daily', '50')`);
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('ip_lookup_console_enabled', '0')`);
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('ip_lookup_console_per_day', '1000')`);
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('ip_lookup_day_cutoff_hour', '2')`);
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('ip_lookup_log_retention_days', '30')`);

  // Backfill MCC on existing OpenCellID sources, then seed a default VN sync job.
  db.run(`UPDATE data_sources SET mcc = '452' WHERE type = 'opencellid' AND (mcc IS NULL OR mcc = '')`);
  db.get(`SELECT COUNT(*) AS c FROM sync_jobs`, [], (err, row) => {
    if (err || (row && row.c > 0)) return;
    db.get(`SELECT id FROM data_sources WHERE type = 'opencellid' ORDER BY id LIMIT 1`, [], (err2, src) => {
      const sourceId = src ? src.id : null;
      db.run(`INSERT INTO sync_jobs (source_id, cron_expr, scope, mcc_list, enabled) VALUES (?, ?, ?, ?, 1)`,
        [sourceId, '0 3 * * *', 'mcc', '452'], () => {});
    });
  });
});

/**
 * Chuyển `api_keys` từ mô hình CŨ (mỗi key gắn 1 user cố định) sang mô hình MỚI
 * (key là cổng kết nối, không gắn tài khoản; thêm cột `require_user`).
 *
 * SQLite không bỏ được NOT NULL / FOREIGN KEY bằng ALTER TABLE, nên nếu bảng còn
 * `user_id NOT NULL` thì dựng bảng mới rồi chép dữ liệu sang. `user_id` được đặt
 * NULL cho mọi key vì key không còn thuộc tài khoản nào — log cũ vẫn giữ
 * `api_request_logs.user_id` để đối chiếu lịch sử.
 *
 * Idempotent: chạy lại khi bảng đã đúng mô hình thì không làm gì.
 */
function migrateApiKeysToOwnerless() {
  db.all(`PRAGMA table_info(api_keys)`, [], (err, cols) => {
    if (err || !cols || !cols.length) return;
    const byName = {};
    for (const c of cols) byName[c.name] = c;
    const userIdCol = byName.user_id;
    const needsRebuild = !!userIdCol && Number(userIdCol.notnull) === 1;
    const needsRequireUser = !byName.require_user;

    if (!needsRebuild && !needsRequireUser) return; // đã đúng mô hình mới

    if (!needsRebuild) {
      // Chỉ thiếu cột → ALTER là đủ, không mất dữ liệu.
      db.run(`ALTER TABLE api_keys ADD COLUMN require_user INTEGER DEFAULT 1`, (e) => {
        if (e) console.error('api_keys migration (add require_user):', e.message);
        else console.log('api_keys migration: added require_user column');
      });
      return;
    }

    // Thiếu cột hoặc user_id còn NOT NULL → dựng bảng mới, chép dữ liệu, đổi tên.
    console.log('api_keys migration: rebuilding table (key is no longer tied to an account)');
    db.serialize(() => {
      db.run(`CREATE TABLE api_keys_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        name TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        key_hash TEXT NOT NULL UNIQUE,
        scopes TEXT DEFAULT 'lookup,account',
        rate_limit_per_min INTEGER DEFAULT 60,
        rate_limit_per_day INTEGER DEFAULT 5000,
        enabled INTEGER DEFAULT 1,
        require_user INTEGER DEFAULT 1,
        last_used_at DATETIME,
        expires_at DATETIME,
        revoked_at DATETIME,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      // Chép nguyên key đang có (giữ id để api_request_logs.api_key_id còn khớp),
      // nhưng bỏ liên kết tài khoản.
      const requireUserExpr = byName.require_user ? 'COALESCE(require_user, 1)' : '1';
      db.run(`INSERT INTO api_keys_new
        (id, user_id, name, key_prefix, key_hash, scopes, rate_limit_per_min,
         rate_limit_per_day, enabled, require_user, last_used_at, expires_at,
         revoked_at, created_by, created_at)
        SELECT id, NULL, name, key_prefix, key_hash, scopes, rate_limit_per_min,
               rate_limit_per_day, enabled, ${requireUserExpr}, last_used_at, expires_at,
               revoked_at, created_by, created_at
        FROM api_keys`, function (e) {
        if (e) { console.error('api_keys migration (copy rows):', e.message); return; }
        const copied = this.changes;
        db.run(`DROP TABLE api_keys`, (e2) => {
          if (e2) return console.error('api_keys migration (drop old):', e2.message);
          db.run(`ALTER TABLE api_keys_new RENAME TO api_keys`, (e3) => {
            if (e3) return console.error('api_keys migration (rename):', e3.message);
            db.run(`CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)`);
            console.log(`api_keys migration: done (${copied} key(s) kept, owner link removed)`);
          });
        });
      });
    });
  });
}

/**
 * Seed danh mục nguồn tra cứu IP (`ip_lookup_sources`).
 *
 * Chạy MỘT lần sau khi bảng đã được tạo (cùng lý do với migrateApiKeysToOwnerless:
 * `db.run` bên trong block trên chỉ xếp vào hàng đợi serialize, chưa chắc đã chạy
 * xong khi module export). Danh sách loại nguồn là hằng ở `ip-lookup.js` —
 * hàm này chỉ GHI khi thiếu, không bao giờ ghi đè cấu hình admin (key, priority,
 * enabled). Backfill priority chỉ cho row còn ở mặc định 100.
 *
 * Idempotent: gọi lại không sinh row thừa nhờ cột `type` UNIQUE + INSERT ... bỏ qua.
 */
let ipSeedRetried = false;

function seedIpLookupSources() {
  // Nạp TRỄ: ip-lookup.js cũng require('./database'). Nếu ip-lookup.js là module
  // được nạp TRƯỚC (test, script rời) thì lúc này nó còn đang chạy và
  // `require('./ip-lookup')` trả về object rỗng → chưa có SOURCE_DEFAULTS.
  // Thử lại 1 lần ở lượt event loop kế tiếp (khi ip-lookup.js đã chạy xong);
  // vẫn thiếu thì bỏ qua — lần khởi động sau sẽ seed.
  let catalog = null;
  try { catalog = require('./ip-lookup').SOURCE_DEFAULTS; } catch (e) { catalog = null; }
  if (!catalog) {
    if (!ipSeedRetried) { ipSeedRetried = true; setImmediate(seedIpLookupSources); }
    else console.error('ip_lookup_sources seed: ip-lookup.SOURCE_DEFAULTS unavailable — skipped');
    return;
  }
  for (const [type, def] of Object.entries(catalog)) {
    db.run(`INSERT OR IGNORE INTO ip_lookup_sources (type, name, base_url, api_key, plan, enabled, priority, timeout_ms, cache_days, notes)
            VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?)`,
      [type, def.name, def.baseUrl || '', def.plan || 'lite', def.enabledDefault ? 1 : 0,
        def.priority, def.timeoutMs, def.cacheDays, def.notes || ''], (err) => {
        if (err) return console.error(`ip_lookup_sources seed (${type}):`, err.message);
      });
    db.run(`UPDATE ip_lookup_sources SET priority = ? WHERE type = ? AND priority = 100`, [def.priority, type], () => {});
  }
}
// Cho phép module khác (admin-dashboard.js) lấy dung lượng file DB mà không phải
// lặp lại logic chọn đường dẫn. `db.filename` là đường dẫn THẬT đã mở (test có
// thể patch sang DB tạm), nên ưu tiên nó.
db.dbPath = (typeof db.filename === 'string' && db.filename) ? db.filename : dbPath;

module.exports = db;

// Seed SAU khi đã gán module.exports: ip-lookup.js require('./database') và giữ
// tham chiếu tới object `db` — nếu seed trước khi export, nó nhận `{}` rỗng
// (circular dependency) rồi mọi truy vấn sau đó ném "db.all is not a function".
seedIpLookupSources();