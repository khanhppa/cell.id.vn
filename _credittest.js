/**
 * Test hệ thống điểm tra cứu (credits.js + schema + wiring trong server.js).
 * Chạy: node _credittest.js
 *
 * Test HÀNH VI thật trên DB tạm (không đụng database.sqlite):
 *  - chargeLookup / topUp / adjust / grantSignupBonus
 *  - atomic chống double-spend (chạy song song 10 lần trừ khi chỉ có 3 điểm)
 *  - idempotency theo (type, ref)
 *  - ledger ↔ số dư luôn khớp (reconcile)
 * Và test WIRING (regex trên server.js / frontend) cho các route + UI.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`); }
}
function eq(name, actual, expected) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });
}

// ============================================================================
// PHẦN 1 — hành vi thật trên DB tạm
// ============================================================================
/** Patch fs + sqlite3 để mọi thao tác DB trong tiến trình này trỏ về DB tạm.
 * Phải gọi TRƯỚC khi require('./database'). */
function patchDbRedirect(realDbPath, tmpDb) {
  const realExistsSync = fs.existsSync;
  fs.existsSync = function (p) {
    if (typeof p === 'string' && path.resolve(p) === path.resolve(realDbPath)) return false;
    return realExistsSync.apply(this, arguments);
  };
  const Sqlite3 = require('sqlite3');
  const RealDatabase = Sqlite3.Database;
  function PatchedDatabase(file, ...rest) {
    if (typeof file === 'string' && path.resolve(file) === path.resolve(realDbPath)) file = tmpDb;
    return new RealDatabase(file, ...rest);
  }
  PatchedDatabase.prototype = RealDatabase.prototype;
  Sqlite3.Database = PatchedDatabase;
  // database.js dùng require('sqlite3').verbose() — verbose() trả object MỚI nên phải
  // vá luôn object đó; nếu không patch vô hiệu và test ghi thẳng vào DB thật.
  const RealVerbose = Sqlite3.verbose;
  Sqlite3.verbose = function () {
    const v = RealVerbose.apply(this, arguments);
    const orig = v.Database;
    function VDatabase(file, ...rest) {
      if (typeof file === 'string' && path.resolve(file) === path.resolve(realDbPath)) file = tmpDb;
      return new orig(file, ...rest);
    }
    VDatabase.prototype = orig.prototype;
    v.Database = VDatabase;
    return v;
  };
  return function unpatch() {
    fs.existsSync = realExistsSync;
    Sqlite3.Database = RealDatabase;
    Sqlite3.verbose = RealVerbose;
  };
}

const tmpDb = path.join(os.tmpdir(), `credit-test-${process.pid}-${Date.now()}.sqlite`);
const realDbPath = path.join(path.dirname(__dirname), 'database.sqlite');
const unpatch = patchDbRedirect(realDbPath, tmpDb);

let db, credits;
try {
  db = require('./database');
  credits = require('./credits');
} catch (e) {
  console.error('Không nạp được database/credits:', e.message);
  process.exit(1);
}

function sqlRun(sql, params = []) {
  return new Promise((res, rej) => db.run(sql, params, function (err) { err ? rej(err) : res(this); }));
}
function sqlGet(sql, params = []) {
  return new Promise((res, rej) => db.get(sql, params, (err, row) => err ? rej(err) : res(row)));
}
function sqlAll(sql, params = []) {
  return new Promise((res, rej) => db.all(sql, params, (err, rows) => err ? rej(err) : res(rows || [])));
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function makeUser(username) {
  const r = await sqlRun('INSERT INTO users (username, password) VALUES (?, ?)', [username, 'x']);
  return r.lastID;
}
async function setSetting(k, v) {
  await sqlRun('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [k, String(v)]);
}

// Cấp điểm khởi tạo cho test bằng 1 transaction: 1 bút toán dương rồi trừ dần.
// (Số dư = tổng ledger luôn đúng; không phụ thuộc tổng các lần trừ.)
async function seedBalance(userId, amount) {
  const sqlite3 = require('sqlite3');
  const raw = new sqlite3.Database(tmpDb);
  const seed = `seed:${userId}`;
  await new Promise((res, rej) => {
    raw.serialize(() => {
      raw.run('BEGIN IMMEDIATE', (e) => e && rej(e));
      raw.run('INSERT INTO credit_transactions (user_id, amount, balance_after, type, ref, note) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, amount, amount, 'test_topup', seed, 'test seed'], (e) => e && rej(e));
      raw.run('UPDATE users SET credit_balance = ? WHERE id = ?', [amount, userId], (e) => e && rej(e));
      raw.run('COMMIT', (e) => e ? rej(e) : res());
    });
  });
  await new Promise((res, rej) => raw.close((e) => e ? rej(e) : res()));
}

async function main() {
  // Chờ schema (database.js tạo bảng async).
  await sleep(500);

  console.log('\n== Schema ==');
  const userCols = await sqlAll('PRAGMA table_info(users)');
  ok('users có cột credit_balance', userCols.some(c => c.name === 'credit_balance'));
  const txCols = await sqlAll('PRAGMA table_info(credit_transactions)');
  const txNames = txCols.map(c => c.name);
  ok('credit_transactions tồn tại', txCols.length > 0);
  for (const c of ['id', 'user_id', 'amount', 'balance_after', 'type', 'ref', 'note', 'admin_id', 'admin_ip', 'created_at']) {
    ok(`credit_transactions có cột ${c}`, txNames.includes(c));
  }
  const idx = await sqlAll("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='credit_transactions'");
  const idxNames = idx.map(i => i.name);
  ok('có index idx_credit_tx_user', idxNames.includes('idx_credit_tx_user'));
  ok('có index idx_credit_tx_type', idxNames.includes('idx_credit_tx_type'));
  ok('có UNIQUE partial index chống trùng', idxNames.includes('idx_credit_tx_idem'));

  const seeded = await sqlAll("SELECT key, value FROM settings WHERE key LIKE 'credit%'");
  const seedMap = Object.fromEntries(seeded.map(s => [s.key, s.value]));
  eq('seed credit_enabled = 0 (mặc định TẮT)', seedMap.credit_enabled, '0');
  eq('seed credit_cost_per_lookup = 1', seedMap.credit_cost_per_lookup, '1');
  eq('seed credit_signup_bonus = 5', seedMap.credit_signup_bonus, '5');
  eq('seed credit_allow_negative = 0', seedMap.credit_allow_negative, '0');

  console.log('\n== normalizeAmount ==');
  eq('nhận số', credits.normalizeAmount(5), 5);
  eq('nhận chuỗi có khoảng trắng', credits.normalizeAmount(' 2.5 '), 2.5);
  eq('chấp nhận âm', credits.normalizeAmount(-3), -3);
  eq('làm tròn 4 chữ số', credits.normalizeAmount(1.00004), 1);
  eq('từ chối chữ', credits.normalizeAmount('abc'), null);
  eq('từ chối Infinity', credits.normalizeAmount(Infinity), null);
  eq('từ chối quá lớn', credits.normalizeAmount(1e9), null);

  console.log('\n== credit_enabled=0: chargeLookup bỏ qua ==');
  const uOff = await makeUser('off_user');
  await setSetting('credit_enabled', '0');
  const offCharge = await credits.chargeLookup(uOff, 3, 'off:ref', 'test');
  ok('enabled=0 thì skipped', offCharge.skipped === true);
  eq('số dư không đổi', await credits.getBalance(uOff), 0);
  eq('không có bút toán nào', (await credits.listTransactions(uOff)).length, 0);

  console.log('\n== signup bonus ==');
  await setSetting('credit_enabled', '1');
  const u1 = await makeUser('alice');
  const b1 = await credits.grantSignupBonus(u1);
  ok('grant thành công', b1.ok === true);
  eq('số dư = 5', b1.balance, 5);
  const b1again = await credits.grantSignupBonus(u1);
  ok('gọi lần 2 là duplicate (idempotent)', b1again.duplicate === true);
  eq('số dư vẫn 5', await credits.getBalance(u1), 5);
  const tx1 = await credits.listTransactions(u1);
  eq('chỉ 1 bút toán signup_bonus', tx1.filter(t => t.type === 'signup_bonus').length, 1);
  eq('ref = signup:<id>', tx1[0].ref, `signup:${u1}`);
  eq('balance_after ghi đúng', tx1[0].balance_after, 5);

  console.log('\n== chargeLookup ==');
  const c1 = await credits.chargeLookup(u1, 1, 'batch:aaa', 'tra 1 cell');
  ok('trừ 1 điểm thành công', c1.ok === true);
  eq('số dư 5 → 4', c1.balance, 4);
  const c1dup = await credits.chargeLookup(u1, 1, 'batch:aaa', 'retry cùng batch');
  ok('cùng ref thì duplicate, không trừ lại', c1dup.duplicate === true);
  eq('số dư vẫn 4', c1dup.balance, 4);

  const c2 = await credits.chargeLookup(u1, 3, 'batch:bbb', 'tra 3 cell');
  eq('trừ gộp 3 điểm: 4 → 1', c2.balance, 1);
  eq('số dư = 1', await credits.getBalance(u1), 1);

  // Tiêu nốt điểm cuối (1 → 0) là HỢP LỆ: chỉ chặn khi số dư không đủ cho lần trừ.
  const cLast = await credits.chargeLookup(u1, 1, 'batch:last', 'dùng điểm cuối');
  ok('tiêu điểm cuối cùng thành công', cLast.ok === true);
  eq('số dư 1 → 0', cLast.balance, 0);

  const c3 = await credits.chargeLookup(u1, 1, 'batch:ccc', 'đã hết điểm');
  ok('hết điểm → ok=false', c3.ok === false);
  eq('lý do insufficient', c3.reason, 'insufficient');
  eq('số dư giữ nguyên 0', await credits.getBalance(u1), 0);
  eq('không ghi bút toán thất bại', (await credits.listTransactions(u1)).filter(t => t.ref === 'batch:ccc').length, 0);

  eq('miss count=0 → skipped, không trừ', (await credits.chargeLookup(u1, 0, 'batch:ddd', 'miss')).skipped, true);
  eq('số dư vẫn 0', await credits.getBalance(u1), 0);
  // Nạp lại để các test sau có dữ liệu.
  const refill = await credits.topUp(u1, 1, { adminId: 1, note: 'nạp lại cho test' });
  eq('nạp lại 1 → dư 1', refill.balance, 1);

  console.log('\n== atomic: 10 request song song, chỉ có 3 điểm ==');
  const u2 = await makeUser('bob');
  await seedBalance(u2, 3);
  eq('số dư ban đầu 3', await credits.getBalance(u2), 3);
  const par = await Promise.all(Array.from({ length: 10 }, (_, i) =>
    credits.chargeLookup(u2, 1, `par:${i}`, 'song song').catch(e => ({ ok: false, reason: 'exception:' + e.message }))
  ));
  const okCount = par.filter(r => r.ok).length;
  eq('chỉ đúng 3 request thành công', okCount, 3);
  eq('7 request bị chặn insufficient', par.filter(r => r.reason === 'insufficient').length, 7);
  eq('số dư cuối = 0 (không âm)', await credits.getBalance(u2), 0);
  const lookups = await sqlAll("SELECT COUNT(*) AS c FROM credit_transactions WHERE user_id = ? AND type = 'lookup'", [u2]);
  eq('đúng 3 bút toán lookup được ghi', lookups[0].c, 3);

  console.log('\n== topUp / adjust ==');
  const u3 = await makeUser('carol');
  eq('topUp số âm bị từ chối', (await credits.topUp(u3, -5)).ok, false);
  eq('topUp 0 bị từ chối', (await credits.topUp(u3, 0)).ok, false);
  const t1 = await credits.topUp(u3, 10, { adminId: 1, adminIp: '127.0.0.1', note: 'nạp 10' });
  eq('topUp 10 → dư 10', t1.balance, 10);
  const txT = (await credits.listTransactions(u3))[0];
  eq('bút toán lưu type admin_topup', txT.type, 'admin_topup');
  eq('bút toán lưu admin_id', txT.admin_id, 1);
  const txIp = await sqlGet('SELECT admin_ip FROM credit_transactions WHERE id = ?', [txT.id]);
  eq('bút toán lưu admin_ip', txIp.admin_ip, '127.0.0.1');

  eq('adjust thiếu note bị từ chối', (await credits.adjust(u3, -5, { adminId: 1 })).reason, 'note_required');
  const a1 = await credits.adjust(u3, -4, { adminId: 1, note: 'sửa sai' });
  eq('adjust -4 → dư 6', a1.balance, 6);
  const a2 = await credits.adjust(u3, -100, { adminId: 1, note: 'trừ quá' });
  eq('adjust âm quá số dư bị chặn (allow_negative=0)', a2.ok, false);
  eq('số dư vẫn 6', await credits.getBalance(u3), 6);

  await setSetting('credit_allow_negative', '1');
  const a3 = await credits.adjust(u3, -100, { adminId: 1, note: 'cho phép âm' });
  eq('allow_negative=1 → trừ xuống âm được', a3.balance, -94);
  await setSetting('credit_allow_negative', '0');

  console.log('\n== phân quyền dữ liệu ==');
  const allTx = await credits.listAllTransactions({ userId: u1 });
  ok('listAllTransactions lọc được theo user', allTx.length > 0 && allTx.every(r => r.user_id === u1));
  const limTx = await credits.listTransactions(u1, { limit: 1 });
  eq('listTransactions tôn trọng limit', limTx.length, 1);

  console.log('\n== reconcile ==');
  const rc = await credits.reconcile();
  ok('ledger khớp số dư toàn DB', rc.ok === true, rc.mismatched);
  eq('không có user lệch', rc.mismatched.length, 0);

  const sums = await sqlAll(`SELECT u.id, u.credit_balance AS bal,
      COALESCE((SELECT SUM(amount) FROM credit_transactions t WHERE t.user_id = u.id), 0) AS led
      FROM users u`);
  ok('mọi user: SUM(amount) == credit_balance', sums.every(s => Math.abs(s.bal - s.led) < 1e-6));
  const nonzero = sums.filter(s => s.led !== 0);
  ok('có nhiều user có bút toán (test thực sự chạy)', nonzero.length >= 2, nonzero.length);

  console.log('\n== listUserCredits ==');
  const luc = await credits.listUserCredits();
  const u1row = luc.find(u => u.id === u1);
  eq('listUserCredits trả số dư u1', u1row.balance, 1);
  eq('listUserCredits trả tổng đã dùng u1 = 5', u1row.used, 5);

  // ==========================================================================
  // PHẦN 2 — wiring server.js
  // ==========================================================================
  console.log('\n== Wiring server.js ==');
  const srvSrc = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  ok('require ./credits', /require\('\.\/credits'\)/.test(srvSrc));
  ok('route GET /api/credits/config (public)', /app\.get\('\/api\/credits\/config'/.test(srvSrc));
  ok('route GET /api/credits/balance', /app\.get\('\/api\/credits\/balance',\s*requireAuth/.test(srvSrc));
  ok('route GET /api/credits/transactions', /app\.get\('\/api\/credits\/transactions',\s*requireAuth/.test(srvSrc));
  ok('route GET /api/admin/credits/users', /app\.get\('\/api\/admin\/credits\/users',\s*requireAuth,\s*requireAdmin/.test(srvSrc));
  ok('route GET /api/admin/credits/transactions', /app\.get\('\/api\/admin\/credits\/transactions',\s*requireAuth,\s*requireAdmin/.test(srvSrc));
  ok('route POST /api/admin/credits/topup', /app\.post\('\/api\/admin\/credits\/topup',\s*requireAuth,\s*requireAdmin/.test(srvSrc));
  ok('route POST /api/admin/credits/adjust', /app\.post\('\/api\/admin\/credits\/adjust',\s*requireAuth,\s*requireAdmin/.test(srvSrc));
  ok('route GET /api/admin/credits/reconcile', /app\.get\('\/api\/admin\/credits\/reconcile',\s*requireAuth,\s*requireAdmin/.test(srvSrc));
  ok('rate limit cho route tiền', /creditAdminRateLimit/.test(srvSrc));

  ok('resolve yêu cầu đăng nhập', /app\.get\('\/api\/cells\/resolve',\s*requireAuth/.test(srvSrc));
  ok('resolve charge sau khi có kết quả', /chargeLookup\(userId, 1, chargeRef/.test(srvSrc));
  ok('resolve trả 402 khi hết điểm', /402/.test(srvSrc) && /Không đủ điểm/.test(srvSrc));
  ok('batch pre-check điểm trước khi tra online', /creditOn && creditCost > 0[\s\S]{0,300}insufficient/.test(srvSrc));
  ok('batch charge theo foundCount', /chargeLookup\(userId, foundCount, batchId/.test(srvSrc));
  ok('foundCount = số cell found', /const foundCount = historyItems\.filter\(h => h\.found\)\.length/.test(srvSrc));

  ok('register cấp signup bonus', /\/api\/register'[\s\S]{0,1500}grantSignupBonus/.test(srvSrc));
  ok('POST /api/users cấp điểm khởi tạo', /app\.post\('\/api\/users'[\s\S]{0,900}applyUserInitialCredit\(userId, req\)/.test(srvSrc));
  ok('POST /api/admin/users cấp điểm khởi tạo', /app\.post\('\/api\/admin\/users'[\s\S]{0,900}applyUserInitialCredit\(userId, req\)/.test(srvSrc));
  ok('helper applyUserInitialCredit tồn tại', /async function applyUserInitialCredit\(userId, req\)/.test(srvSrc));
  ok('/api/me trả credit_balance', /credit_balance FROM users WHERE id = \?/.test(srvSrc));

  // ==== KHOÁ SỬA ĐIỂM: admin chỉ được NẠP THÊM ====
  // helper credits.adjust() vẫn phải còn (dùng cho bút toán khởi tạo/correction hợp lệ),
  // nhưng biên HTTP /api/admin/credits/adjust chỉ nhận amount > 0.
  ok('credits.adjust vẫn tồn tại (không chặn ở tầng helper)',
    fs.readFileSync(path.join(__dirname, 'credits.js'), 'utf8').includes('adjust'));
  ok('POST /api/admin/credits/adjust chặn amount <= 0',
    /app\.post\('\/api\/admin\/credits\/adjust'[\s\S]{0,900}Number\(amount\) <= 0/.test(srvSrc));
  ok('POST /api/admin/credits/adjust trả reason topup_only',
    /app\.post\('\/api\/admin\/credits\/adjust'[\s\S]{0,900}topup_only/.test(srvSrc));
  ok('user-create KHÔNG nhận credit từ body',
    !/const \{ username, password, role, status, credit \} = req\.body;/.test(srvSrc));
  ok('admin user-create KHÔNG nhận credit từ body',
    !/const \{ username, password, role \} = req\.body;[\s\S]{0,200}credit/.test(srvSrc));
  ok('applyUserInitialCredit KHÔNG nhận tham số credit',
    !/applyUserInitialCredit\(userId, credit, req\)/.test(srvSrc));
  ok('applyUserInitialCredit còn gọi grantSignupBonus',
    /async function applyUserInitialCredit[\s\S]{0,300}grantSignupBonus/.test(srvSrc));

  ok('SETTING_KEYS có credit_enabled', /SETTING_KEYS\s*=\s*\[[^\]]*'credit_enabled'/.test(srvSrc));
  ok('SETTING_KEYS có credit_cost_per_lookup', /SETTING_KEYS\s*=\s*\[[^\]]*'credit_cost_per_lookup'/.test(srvSrc));
  ok('SETTING_KEYS có credit_signup_bonus', /SETTING_KEYS\s*=\s*\[[^\]]*'credit_signup_bonus'/.test(srvSrc));
  ok('SETTING_KEYS có credit_allow_negative', /SETTING_KEYS\s*=\s*\[[^\]]*'credit_allow_negative'/.test(srvSrc));
  ok('setting boolean được chuẩn hoá', /BOOL_SETTING_KEYS/.test(srvSrc));

  // Regression: PUT /api/settings từng ghi từng key ngay trong vòng lặp validate,
  // nên 1 key lỗi ở giữa → key trước đó đã ghi nhưng response là 400, và ô số bỏ
  // trống bị coi là lỗi → checkbox credit_enabled trông như "không lưu được".
  ok('PUT /api/settings validate hết rồi mới ghi (gom vào updates)',
    /const updates = \[\][\s\S]{0,2000}updates\.push\(\[k, v\]\)[\s\S]{0,300}for \(const \[k, v\] of updates\)/.test(srvSrc));
  ok('PUT /api/settings bỏ qua ô trống thay vì 400',
    /if \(v === ''\) continue;/.test(srvSrc));
  ok('admin.js không gửi ô số rỗng',
    /if \(creditCost !== ''\) settings\.credit_cost_per_lookup = creditCost;/.test(
      fs.readFileSync(path.join(__dirname, 'public', 'admin.js'), 'utf8')));
  ok('admin.js hoàn tác UI khi lưu lỗi', /catch\(e => \{ showToast\(e\.message, 'error'\); loadSettings\(\); \}\)/.test(
    fs.readFileSync(path.join(__dirname, 'public', 'admin.js'), 'utf8')));

  console.log('\n== Wiring frontend ==');
  const authSrc = fs.readFileSync(path.join(__dirname, 'public', 'auth.js'), 'utf8');
  ok('auth.js có getCreditBalance', /getCreditBalance\(\)/.test(authSrc));
  ok('auth.js có setCreditBalance', /setCreditBalance\(balance\)/.test(authSrc));
  ok('auth.js refreshCreditBalance gọi API', /refreshCreditBalance[\s\S]{0,400}\/api\/credits\/balance/.test(authSrc));
  ok('navbar có badge credit', /creditBadgeCommon/.test(authSrc));
  ok('có window.updateCreditBadge', /window\.updateCreditBadge = function/.test(authSrc));

  const appSrc = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');
  ok('app.js xử lý 402', /r\.status === 402/.test(appSrc));
  ok('app.js cập nhật số dư từ response', /Auth\.setCreditBalance\(data\.credit\.balance\)/.test(appSrc));
  ok('app.js hiện thông báo hết điểm + link credits.html', /e\.code === 402[\s\S]{0,300}credits\.html/.test(appSrc));

  const creditsHtml = fs.readFileSync(path.join(__dirname, 'public', 'credits.html'), 'utf8');
  ok('credits.html nạp auth.js', /<script src="auth\.js"><\/script>/.test(creditsHtml));
  ok('credits.html gọi /api/credits/balance', /\/api\/credits\/balance/.test(creditsHtml));
  ok('credits.html gọi /api/credits/transactions', /\/api\/credits\/transactions/.test(creditsHtml));
  ok('credits.html chuyển hướng khi chưa login', /login\.html/.test(creditsHtml));

  // Regression: credits.html từng dùng <div id="navbar"> nhưng Auth.initNavbar()
  // chỉ query '.header' / '.topbar' / '.navbar' (theo CLASS) → không khớp →
  // header = null → return sớm → cả navbar biến mất. Phải dùng class như mọi
  // trang khác (index.html dùng .header, các trang tools + admin dùng .navbar).
  ok('credits.html có element navbar đúng selector của Auth.initNavbar',
    /<(?:nav|div|header)[^>]*class="[^"]*\b(?:navbar|header|topbar)\b[^"]*"[^>]*>\s*<\/(?:nav|div|header)>/.test(creditsHtml));
  ok('credits.html KHÔNG dùng id="navbar" (initNavbar query theo class)',
    !/id="navbar"/.test(creditsHtml));
  ok('credits.html gọi Auth.initNavbar()', /Auth\.initNavbar\(\)/.test(creditsHtml));
  // Navbar là position:fixed, cao 48px → container phải chừa chỗ, nếu không sẽ bị đè.
  ok('credits.html container chừa chỗ cho navbar fixed (padding-top >= 48px)',
    /\.container\s*\{[^}]*padding:\s*(\d+)px/.test(creditsHtml) &&
    Number(/\.container\s*\{[^}]*padding:\s*(\d+)px/.exec(creditsHtml)[1]) >= 48);

  const adminHtml = fs.readFileSync(path.join(__dirname, 'public', 'admin.html'), 'utf8');
  // Gộp menu: credits nằm trong section-users, celldb nằm trong section-cells.
  ok('admin.html KHÔNG còn sidebar mục credits riêng', !/data-section="credits"/.test(adminHtml));
  ok('admin.html KHÔNG còn section-credits', !/id="section-credits"/.test(adminHtml));
  ok('admin.html KHÔNG còn sidebar mục celldb riêng', !/data-section="celldb"/.test(adminHtml));
  ok('admin.html KHÔNG còn section-celldb', !/id="section-celldb"/.test(adminHtml));
  ok('admin.html còn section-users', /id="section-users"/.test(adminHtml));
  ok('admin.html còn section-cells', /id="section-cells"/.test(adminHtml));
  ok('admin.html có bảng user trong section-users', /userTableBody/.test(adminHtml));
  ok('admin.html KHÔNG còn bảng điểm riêng', !/creditUsersBody/.test(adminHtml));
  ok('admin.html có checkbox credit_enabled', /id="setCreditEnabled"/.test(adminHtml));
  ok('admin.html có ô credit_cost_per_lookup', /id="setCreditCost"/.test(adminHtml));
  ok('admin.html có ô credit_signup_bonus', /id="setCreditSignupBonus"/.test(adminHtml));
  ok('admin.html có ô credit_allow_negative', /id="setCreditAllowNegative"/.test(adminHtml));
  ok('admin.html có modal credit', /id="creditModal"/.test(adminHtml));
  ok('admin.html KHÔNG còn ô điểm ban đầu khi tạo user', !/id="userFormCredit"/.test(adminHtml));
  ok('admin.html có bảng CSDL cells gộp trong section-cells', /id="cdbBody"/.test(adminHtml));
  ok('admin.html có modal sửa cell', /id="cdbEditModal"/.test(adminHtml));

  const adminSrc = fs.readFileSync(path.join(__dirname, 'public', 'admin.js'), 'utf8');

  // Regression: saveSettings từng gọi Auth.fetch KHÔNG kèm Content-Type →
  // express.json() bỏ qua parse → req.body = {} → server validate 0 key, ghi 0
  // key nhưng vẫn trả 200 {success:true} → toggle credit_enabled trông như
  // "không lưu được" (bật xong reload lại về TẮT). Phải có header JSON.
  {
    const saveSettingsSrc = adminSrc.slice(adminSrc.indexOf('function saveSettings'),
      adminSrc.indexOf('function saveSettings') + 3500);
    ok('saveSettings gửi Content-Type application/json',
      /fetch\('\/api\/settings'[\s\S]{0,400}headers:\s*\{\s*'Content-Type':\s*'application\/json'\s*\}/.test(
        saveSettingsSrc));
    ok('saveSettings báo trạng thái BẬT/TẮT sau khi lưu',
      /\(on \? 'BẬT' : 'TẮT'\)/.test(saveSettingsSrc));
  }

  // PUT body không có Content-Type phải KHÔNG được coi là thành công giả.
  ok('PUT /api/settings đọc req.body (cần express.json)',
    /app\.put\('\/api\/settings'[\s\S]{0,300}req\.body/.test(srvSrc));

  console.log('\n== Toggle switch UI ==');
  ok('admin.html có toggle switch cho credit_enabled',
    /class="toggle-switch"[\s\S]{0,220}id="setCreditEnabled"/.test(adminHtml));
  ok('admin.html có toggle switch cho credit_allow_negative',
    /class="toggle-switch"[\s\S]{0,220}id="setCreditAllowNegative"/.test(adminHtml));
  ok('admin.html định nghĩa .toggle-track đổi màu khi checked',
    /\.toggle-switch input:checked \+ \.toggle-track/.test(adminHtml));
  ok('admin.html không còn checkbox credit dạng inline cũ',
    !/type="checkbox" id="setCreditEnabled" style="width:auto"/.test(adminHtml) &&
    !/type="checkbox" id="setCreditAllowNegative" style="width:auto"/.test(adminHtml));

  ok('admin.js có loadCreditUsers', /function loadCreditUsers/.test(adminSrc));
  ok('admin.js có loadCreditTx', /function loadCreditTx/.test(adminSrc));
  ok('admin.js có openCreditModal', /window\.openCreditModal = function/.test(adminSrc));
  ok('admin.js có submitCreditModal', /window\.submitCreditModal = async function/.test(adminSrc));
  ok('admin.js có runReconcile', /window\.runReconcile = async function/.test(adminSrc));
  ok('admin.js lưu credit settings', /credit_enabled:/.test(adminSrc));
  ok('admin.js hiển thị số dư trong bảng user', /u\.balance|credit_balance/.test(adminSrc));
  // Chỉ còn NẠP THÊM: modal luôn gọi /api/admin/credits/topup, không còn /adjust.
  ok('credit modal chỉ gọi /api/admin/credits/topup', /\/api\/admin\/credits\/topup/.test(adminSrc));
  ok('credit modal KHÔNG còn gọi endpoint /adjust', !/credits\/adjust/.test(adminSrc));
  ok('credit modal KHÔNG còn chế độ adjust', !/mode === 'adjust'/.test(adminSrc));
  ok('admin.js KHÔNG còn ô điểm ban đầu', !/userFormCredit/.test(adminSrc));
  ok('saveUser KHÔNG gửi credit khi tạo mới', !/credit !== '' \? \{ credit \}/.test(adminSrc));
  ok('admin.js có renderUsersTable (bảng gộp)', /function renderUsersTable\(\)/.test(adminSrc));
  ok('admin.js KHÔNG còn loadUsers', !/function loadUsers\(/.test(adminSrc));
  ok('loadCreditUsers đổ vào userTableBody', /function loadCreditUsers\(\)[\s\S]{0,400}userTableBody/.test(adminSrc));
  ok('switchSection users nạp cả credits', /name === 'users'\)\s*\{[^}]*loadCreditUsers\(\)[^}]*loadCreditTx\(\)/.test(adminSrc));
  ok('switchSection cells nạp cả CSDL cells', /name === 'cells'\)\s*\{[^}]*cdbLoadMeta\(\)[^}]*cdbSearch\(\)[^}]*cdbLoadAudit\(1\)/.test(adminSrc));
  ok('admin.js KHÔNG còn nhánh celldb riêng', !/name === 'celldb'/.test(adminSrc));
  ok('admin.js KHÔNG còn nhánh credits riêng', !/name === 'credits'/.test(adminSrc));

  // ==========================================================================
  console.log(`\n${pass} passed, ${fail} failed\n`);
  try { db.close(); } catch (e) {}
  for (const f of [tmpDb, tmpDb + '-journal', tmpDb + '-wal', tmpDb + '-shm']) {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) {}
  }
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('LỖI TEST:', e); process.exit(1); });
