/**
 * Backfill `cells.radio` cho các row cũ (radio IS NULL) bằng inferRadio.
 * Idempotent: chỉ chạm row null. Chạy 1 lần sau khi migrate cột radio.
 *
 * Lưu ý: inferRadio nay trả '' khi không đủ căn cứ phân biệt GSM/LTE (không đoán
 * bừa). Các row như vậy sẽ được ghi nhãn rõ ràng là 'UNKNOWN' để lần chạy sau
 * không xử lại, và để nhìn thấy ngay trong `distribution`.
 *
 * Cách chạy: node backfill-radio.js
 */
const db = require('./database');
const { inferRadio } = require('./radio-util');

const CHUNK = 5000;

function countNull() {
  return new Promise((res, rej) => {
    db.get('SELECT COUNT(*) c FROM cells WHERE radio IS NULL OR radio = \'\'', [], (e, r) => e ? rej(e) : res(r.c));
  });
}

function nextChunk() {
  return new Promise((res, rej) => {
    db.all('SELECT id, cellid, lac FROM cells WHERE (radio IS NULL OR radio = \'\') LIMIT ?', [CHUNK], (e, r) => e ? rej(e) : res(r));
  });
}

function applyChunk(rows) {
  return new Promise((res, rej) => {
    // Nhóm theo giá trị radio suy ra để chỉ cần vài UPDATE.
    // `inferRadio` trả '' khi mơ hồ (id ngắn, không rõ RAT) → ghi 'UNKNOWN' thay vì
    // đoán 'GSM' như trước (chính cái đoán đó làm cell LTE bị đánh dấu sai).
    const groups = new Map();
    for (const r of rows) {
      const radio = inferRadio(r.cellid, null, null) || 'UNKNOWN';
      if (!groups.has(radio)) groups.set(radio, []);
      groups.get(radio).push(r.id);
    }
    const run = (ids, radio) => new Promise((ok, bad) => {
      if (!ids.length) return ok();
      const ph = ids.map(() => '?').join(',');
      db.run(`UPDATE cells SET radio = ? WHERE id IN (${ph})`, [radio, ...ids], (e) => e ? bad(e) : ok());
    });
    // Song song theo từng nhóm: mỗi bút toán là 1 câu UPDATE độc lập, không lồng nhau.
    Promise.all([...groups].map(([radio, ids]) => run(ids, radio)))
      .then(() => res(rows.length))
      .catch(rej);
  });
}

(async () => {
  let total = await countNull();
  console.log(`rows needing backfill: ${total}`);
  let done = 0;
  while (done < total) {
    const rows = await nextChunk();
    if (!rows.length) break;
    await applyChunk(rows);
    done += rows.length;
    console.log(`  -> ${done}/${total}`);
  }
  db.all('SELECT radio, COUNT(*) c FROM cells GROUP BY radio', [], (e, r) => {
    console.log('distribution:', e ? e.message : JSON.stringify(r));
    process.exit(0);
  });
})();
