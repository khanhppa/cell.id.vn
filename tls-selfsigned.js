/* ==========================================================================
   tls-selfsigned.js — sinh chứng chỉ TLS tự ký cho LAN, KHÔNG cần OpenSSL
   --------------------------------------------------------------------------
   PWA chỉ hoạt động trong "secure context": HTTPS, hoặc localhost/127.0.0.1.
   Mở `http://192.168.x.x:3000/m/` bằng điện thoại là HTTP thường → trình duyệt
   không đăng ký service worker và không bắn `beforeinstallprompt`, nên KHÔNG
   cài được app. File này tạo chứng chỉ tự ký cho địa chỉ LAN để bật HTTPS cho
   việc thử trên điện thoại thật.

   Chỉ dùng `node:crypto` + mã hoá DER tối thiểu (không thêm thư viện ngoài).

   Cách dùng:
     const tls = require('./tls-selfsigned');
     const cred = tls.ensureCert({ dir: '.certs', hosts: ['192.168.31.88', 'localhost', '127.0.0.1'] });
     require('https').createServer({ key: cred.key, cert: cred.cert }, app).listen(3443);

   Lưu ý: chứng chỉ tự ký KHÔNG được tin cậy mặc định — điện thoại sẽ cảnh báo
   một lần, cần bấm "Nâng cao → Tiếp tục" (Chrome Android) hoặc cài profile
   (iOS). Chỉ nên dùng cho mạng nội bộ khi phát triển/thử nghiệm.
   ========================================================================== */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// Mã hoá DER tối thiểu
// ---------------------------------------------------------------------------
function derLen(n) {
  if (n < 0x80) return Buffer.from([n]);
  const bytes = [];
  while (n > 0) { bytes.unshift(n & 0xff); n >>= 8; }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function tlv(tag, content) {
  const body = Buffer.isBuffer(content) ? content : Buffer.from(content);
  return Buffer.concat([Buffer.from([tag]), derLen(body.length), body]);
}

const seq = (...items) => tlv(0x30, Buffer.concat(items));
const set = (...items) => tlv(0x31, Buffer.concat(items));
const nul = () => Buffer.from([0x05, 0x00]);
const octet = (buf) => tlv(0x04, buf);
const bool = (v) => tlv(0x01, Buffer.from([v ? 0xff : 0x00]));
const utf8 = (s) => tlv(0x0c, Buffer.from(s, 'utf8'));
const bitString = (buf, unused) => tlv(0x03, Buffer.concat([Buffer.from([unused || 0]), buf]));
const explicit = (n, buf) => tlv(0xa0 + n, buf);
const ctxPrim = (n, buf) => tlv(0x80 + n, buf);

/** OID dạng chuỗi "2.5.4.3" → DER. */
function oid(str) {
  const parts = str.split('.').map(Number);
  const out = [40 * parts[0] + parts[1]];
  for (let i = 2; i < parts.length; i++) {
    let v = parts[i];
    const stack = [v & 0x7f];
    v >>= 7;
    while (v > 0) { stack.unshift((v & 0x7f) | 0x80); v >>= 7; }
    out.push(...stack);
  }
  return tlv(0x06, Buffer.from(out));
}

/** Chuỗi thời gian "YYMMDDHHMMSSZ" (UTCTime) — đủ dùng tới 2049. */
function utcTime(date) {
  const p = (n) => String(n).padStart(2, '0');
  const s = p(date.getUTCFullYear() % 100) + p(date.getUTCMonth() + 1) + p(date.getUTCDate()) +
    p(date.getUTCHours()) + p(date.getUTCMinutes()) + p(date.getUTCSeconds()) + 'Z';
  return tlv(0x17, Buffer.from(s, 'ascii'));
}

/** INTEGER dương (bỏ byte 0 thừa ở đầu). */
function int(buf) {
  let i = 0;
  while (i < buf.length - 1 && buf[i] === 0) i++;
  let b = buf.subarray(i);
  if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0]), b]);
  return tlv(0x02, b);
}

// OID
const OID = {
  commonName: '2.5.4.3',
  organization: '2.5.4.10',
  organizationalUnit: '2.5.4.11',
  country: '2.5.4.6',
  subjectAltName: '2.5.29.17',
  basicConstraints: '2.5.29.19',
  keyUsage: '2.5.29.15',
  extKeyUsage: '2.5.29.37',
  subjectKeyId: '2.5.29.14',
  authorityKeyId: '2.5.29.35',
  sha256WithRSA: '1.2.840.113549.1.1.11',
  rsaEncryption: '1.2.840.113549.1.1.1',
  serverAuth: '1.3.6.1.5.5.7.3.1',
  clientAuth: '1.3.6.1.5.5.7.3.2'
};

function isIP(h) { return /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || /^[0-9a-f:]+$/i.test(h); }

function ipToBuffer(ip) {
  if (ip.indexOf(':') === -1) return Buffer.from(ip.split('.').map(Number));
  // IPv6 đầy đủ
  const halves = ip.split('::');
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length > 1 && halves[1] ? halves[1].split(':') : [];
  const fill = new Array(8 - head.length - tail.length).fill('0');
  const groups = [...head, ...fill, ...tail];
  const buf = Buffer.alloc(16);
  groups.forEach((g, i) => buf.writeUInt16BE(parseInt(g || '0', 16), i * 2));
  return buf;
}

function sanExtension(hosts) {
  const entries = hosts.map((h) => {
    if (isIP(h)) return tlv(0x87, ipToBuffer(h));       // iPAddress [7]
    return tlv(0x82, Buffer.from(h, 'ascii'));          // dNSName   [2]
  });
  return seq(...entries);
}

function extension(id, value, critical) {
  return critical
    ? seq(oid(id), bool(true), octet(value))
    : seq(oid(id), octet(value));
}

function name(cn) {
  return seq(
    set(seq(oid(OID.country), utf8('VN'))),
    set(seq(oid(OID.organization), utf8('Cell.id.vn (local dev)'))),
    set(seq(oid(OID.organizationalUnit), utf8('LAN test'))),
    set(seq(oid(OID.commonName), utf8(cn)))
  );
}

/**
 * Tạo chứng chỉ tự ký.
 * @returns {{key: string, cert: string, hosts: string[]}}
 */
function generate(opts) {
  const hosts = (opts && opts.hosts) || ['localhost', '127.0.0.1'];
  const days = (opts && opts.days) || 825;
  const cn = (opts && opts.commonName) || hosts[0] || 'localhost';

  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  const serial = crypto.randomBytes(16);
  serial[0] &= 0x7f; // INTEGER dương

  const now = new Date();
  const notBefore = new Date(now.getTime() - 60 * 1000);
  const notAfter = new Date(now.getTime() + days * 24 * 3600 * 1000);

  const spkiDer = publicKey; // đã là DER
  const keyId = crypto.createHash('sha1').update(spkiDer).digest();

  // keyUsage: digitalSignature + keyEncipherment (bit 0 và bit 2)
  const keyUsage = bitString(Buffer.from([0xa0]), 5);

  const exts = [
    extension(OID.basicConstraints, seq(bool(true)), true),
    extension(OID.keyUsage, keyUsage, true),
    extension(OID.extKeyUsage, seq(oid(OID.serverAuth), oid(OID.clientAuth))),
    extension(OID.subjectKeyId, octet(keyId)),
    extension(OID.authorityKeyId, seq(ctxPrim(0, keyId))),
    extension(OID.subjectAltName, sanExtension(hosts))
  ];

  const tbs = seq(
    explicit(0, int(Buffer.from([2]))),          // v3
    int(serial),
    seq(oid(OID.sha256WithRSA), nul()),          // signature AlgorithmIdentifier
    name(cn),                                    // issuer
    seq(utcTime(notBefore), utcTime(notAfter)),  // validity
    name(cn),                                    // subject
    spkiDer,                                     // subjectPublicKeyInfo (đã là SEQUENCE)
    explicit(3, seq(...exts))                    // extensions [3]
  );

  const signature = crypto.sign('sha256', tbs, privateKey);
  const certDer = seq(tbs, seq(oid(OID.sha256WithRSA), nul()), bitString(signature));

  const b64 = certDer.toString('base64').match(/.{1,64}/g).join('\n');
  const certPem = '-----BEGIN CERTIFICATE-----\n' + b64 + '\n-----END CERTIFICATE-----\n';

  return { key: privateKey, cert: certPem, hosts };
}

/** Các địa chỉ IPv4 của máy (để đưa vào SAN). */
function lanAddresses() {
  const out = [];
  const ifaces = os.networkInterfaces();
  Object.keys(ifaces).forEach((name) => {
    (ifaces[name] || []).forEach((a) => {
      if (a.family === 'IPv4' && !a.internal) out.push(a.address);
    });
  });
  return out;
}

/**
 * Bảo đảm có cặp cert/key trên đĩa. Nếu đã có và còn hạn (+ còn phủ đủ host) thì
 * dùng lại; ngược lại sinh mới.
 * @param {{dir?: string, hosts?: string[], days?: number, force?: boolean}} opts
 * @returns {{key: string, cert: string, hosts: string[], path: {key: string, cert: string}, generated: boolean}}
 */
function ensureCert(opts) {
  const o = opts || {};
  const dir = path.resolve(o.dir || path.join(__dirname, '.certs'));
  const hosts = (o.hosts && o.hosts.length ? o.hosts : ['localhost', '127.0.0.1', ...lanAddresses()])
    .filter(Boolean);
  const keyPath = path.join(dir, 'lan-key.pem');
  const certPath = path.join(dir, 'lan-cert.pem');
  const metaPath = path.join(dir, 'lan-cert.json');

  if (!o.force && fs.existsSync(keyPath) && fs.existsSync(certPath) && fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      const x = new crypto.X509Certificate(fs.readFileSync(certPath));
      const stillValid = new Date(x.validTo).getTime() > Date.now() + 24 * 3600 * 1000;
      const covered = hosts.every((h) => (meta.hosts || []).indexOf(h) !== -1);
      if (stillValid && covered) {
        return {
          key: fs.readFileSync(keyPath, 'utf8'),
          cert: fs.readFileSync(certPath, 'utf8'),
          hosts: meta.hosts, path: { key: keyPath, cert: certPath }, generated: false
        };
      }
    } catch (e) { /* hỏng → sinh lại */ }
  }

  const made = generate({ hosts, days: o.days });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(keyPath, made.key, { mode: 0o600 });
  fs.writeFileSync(certPath, made.cert);
  fs.writeFileSync(metaPath, JSON.stringify({
    hosts: made.hosts, createdAt: new Date().toISOString(), days: o.days || 825
  }, null, 2));

  return { key: made.key, cert: made.cert, hosts: made.hosts, path: { key: keyPath, cert: certPath }, generated: true };
}

module.exports = { generate, ensureCert, lanAddresses };
