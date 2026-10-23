// Sinh bộ icon PWA cho /m không cần thư viện vẽ: ghi PNG trực tiếp bằng zlib.
// Chạy 1 lần: node _makeicons.js  → public/m/icons/*.png
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 cho chunk PNG
const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filter none
    for (let x = 0; x < size; x++) {
      const s = (y * size + x) * 4;
      raw[rowStart + 1 + x * 4] = rgba[s];
      raw[rowStart + 2 + x * 4] = rgba[s + 1];
      raw[rowStart + 3 + x * 4] = rgba[s + 2];
      raw[rowStart + 4 + x * 4] = rgba[s + 3];
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// Vẽ 1 icon: nền gradient xanh + lưới sóng + chấm định vị, bo góc theo `radiusPct`
// (maskable cần nền phủ kín để an toàn vùng crop).
function drawIcon(size, { radiusPct = 0.22, paddingPct = 0.0 } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2, cy = size / 2;
  const r = size * radiusPct;
  const pad = size * paddingPct;
  // màu thương hiệu: #1a6cf0 → #0b3fa8
  const c1 = [26, 108, 240], c2 = [11, 63, 168];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // bo góc
      const inCornerX = Math.min(x, size - 1 - x);
      const inCornerY = Math.min(y, size - 1 - y);
      let cover = 1;
      if (radiusPct > 0 && (inCornerX < r && inCornerY < r)) {
        const dx = r - inCornerX, dy = r - inCornerY;
        const d = Math.sqrt(dx * dx + dy * dy);
        cover = Math.max(0, Math.min(1, (r - d) + 0.5));
      }
      if (cover <= 0) { buf[i + 3] = 0; continue; }
      // gradient chéo
      const t = (x / size) * 0.5 + (y / size) * 0.5;
      let rr = c1[0] + (c2[0] - c1[0]) * t;
      let gg = c1[1] + (c2[1] - c1[1]) * t;
      let bb = c1[2] + (c2[2] - c1[2]) * t;

      // 3 cung sóng ngang (biểu tượng cell/sóng) ở nửa dưới
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const inner = size * (0.10 + pad * 0.5);
      for (let k = 0; k < 3; k++) {
        const rr2 = inner + k * size * 0.085;
        const band = size * 0.028;
        if (Math.abs(dist - rr2) < band) {
          const ang = Math.atan2(dy, dx);
          // chỉ vẽ cung phía trên (giống sóng lan toả)
          if (ang > -Math.PI * 0.95 && ang < -Math.PI * 0.05) {
            rr = 255; gg = 255; bb = 255;
          }
        }
      }
      // chấm định vị ở tâm
      if (dist < size * 0.058) { rr = 255; gg = 255; bb = 255; }

      buf[i] = Math.round(rr);
      buf[i + 1] = Math.round(gg);
      buf[i + 2] = Math.round(bb);
      buf[i + 3] = Math.round(cover * 255);
    }
  }
  return png(size, buf);
}

const dir = path.join(__dirname, 'public', 'm', 'icons');
fs.mkdirSync(dir, { recursive: true });
const jobs = [
  ['icon-192.png', 192, { radiusPct: 0.22 }],
  ['icon-512.png', 512, { radiusPct: 0.22 }],
  ['icon-maskable-192.png', 192, { radiusPct: 0, paddingPct: 0.10 }],
  ['icon-maskable-512.png', 512, { radiusPct: 0, paddingPct: 0.10 }],
  ['apple-touch-icon.png', 180, { radiusPct: 0 }],
  ['favicon-64.png', 64, { radiusPct: 0.22 }]
];
for (const [name, size, opt] of jobs) {
  const out = path.join(dir, name);
  fs.writeFileSync(out, drawIcon(size, opt));
  console.log(name, fs.statSync(out).size + 'B');
}
