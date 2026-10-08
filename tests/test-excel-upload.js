const http = require('http');
const fs = require('fs');
const path = require('path');

function postMultipart(url, token, filePath, fields) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Date.now();
    const fileName = path.basename(filePath);
    const fileData = fs.readFileSync(filePath);

    let body = '';
    for (const [k, v] of Object.entries(fields || {})) {
      body += `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`;
    }
    const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`;
    const fileTail = `\r\n--${boundary}--\r\n`;

    const headerBuf = Buffer.from(body + fileHeader, 'utf-8');
    const tailBuf = Buffer.from(fileTail, 'utf-8');
    const fullBody = Buffer.concat([headerBuf, fileData, tailBuf]);

    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': fullBody.length,
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      }
    }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => resolve({ status: r.statusCode, body: d }));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('timeout')));
    req.end(fullBody);
  });
}

function postJSON(url, body, token) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      }
    }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => resolve({ status: r.statusCode, body: d }));
    });
    req.on('error', reject);
    req.end(data);
  });
}

(async () => {
  // Login
  const login = await postJSON('http://localhost:3000/api/login', { username: 'admin', password: 'admin123' });
  console.log('login', login.status);
  const token = JSON.parse(login.body).token;

  // Test Mobifone
  console.log('\n=== Mobifone.xlsx ===');
  const mob = await postMultipart('http://localhost:3000/api/call-logs/upload', token, 'sample/Mobifone.xlsx', { network: 'auto' });
  console.log('status:', mob.status);
  const mobData = JSON.parse(mob.body);
  console.log('result:', JSON.stringify(mobData, null, 2));

  // Test Viettel
  console.log('\n=== Viettel.xlsx ===');
  const vt = await postMultipart('http://localhost:3000/api/call-logs/upload', token, 'sample/Viettel.xlsx', { network: 'auto' });
  console.log('status:', vt.status);
  const vtData = JSON.parse(vt.body);
  console.log('result:', JSON.stringify(vtData, null, 2));
})();