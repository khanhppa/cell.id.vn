/**
 * scripts/make-logo-assets.js — tạo ảnh logo nhỏ cho topbar ứng dụng di động (/m/)
 * từ logo gốc của website:
 *
 *   • public/img/logo-white.png (chữ trắng, dùng cho theme tối)
 *       → public/m/img/logo-topbar-dark.png
 *   • public/img/logo.png       (chữ xanh, dùng cho theme sáng)
 *       → public/m/img/logo-topbar-light.png
 *
 * Vì sao cần bản nhỏ: logo gốc 1063×450 (172 KB bản RGBA / 21 KB bản palette) trong khi
 * topbar chỉ hiển thị khung 76×32 CSS px. Tải nguyên ảnh gốc cho một góc nhỏ như vậy là
 * lãng phí băng thông trên 3G/4G, nên script trim viền trong suốt rồi xuất bản **3x**
 * (228×96) để vẫn nét trên màn hình Retina, chỉ ~3–7 KB mỗi tệp.
 *
 * CSS tương ứng (public/m/app.css):
 *   .topbar-logo                  → background-image: url('/m/img/logo-topbar-dark.png')
 *   html[data-theme="light"] ...  → background-image: url('/m/img/logo-topbar-light.png')
 *
 * Chạy lại khi logo gốc thay đổi:
 *   node scripts/make-logo-assets.js
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const W = 228; // 76 CSS px × 3
const H = 96;  // 32 CSS px × 3

const JOBS = [
  { src: 'public/img/logo-white.png', out: 'public/m/img/logo-topbar-dark.png', note: 'theme tối (chữ trắng)' },
  { src: 'public/img/logo.png', out: 'public/m/img/logo-topbar-light.png', note: 'theme sáng (chữ xanh)' }
];

(async () => {
  fs.mkdirSync(path.join(ROOT, 'public', 'm', 'img'), { recursive: true });

  for (const job of JOBS) {
    const srcPath = path.join(ROOT, job.src);
    if (!fs.existsSync(srcPath)) {
      console.error('Thiếu ảnh gốc:', job.src);
      process.exitCode = 1;
      continue;
    }
    const buf = await sharp(srcPath)
      .trim({ threshold: 8 })          // bỏ viền trong suốt quanh logo
      .resize(W, H, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9, palette: true, quality: 90 })
      .toBuffer();

    const outPath = path.join(ROOT, job.out);
    fs.writeFileSync(outPath, buf);
    const meta = await sharp(buf).metadata();
    console.log(
      job.out.padEnd(40),
      (meta.width + 'x' + meta.height).padEnd(10),
      ((buf.length / 1024).toFixed(1) + ' KB').padEnd(9),
      '←', job.src, '(' + job.note + ')'
    );
  }
})().catch((e) => { console.error('LỖI:', e.message); process.exit(1); });
