const http = require('http');
const fs = require('fs');

const req = (path, method, headers, body) => new Promise((resolve, reject) => {
  const r = http.request({ host: 'localhost', port: 3000, path, method, headers }, s => {
    let b = '';
    s.on('data', c => b += c);
    s.on('end', () => resolve({ status: s.statusCode, body: b }));
  });
  r.on('error', reject);
  r.setTimeout(120000, () => r.destroy(new Error('timeout')));
  if (body) r.write(body);
  r.end();
});

(async () => {
  // login
  const login = await req('/api/login', 'POST', { 'Content-Type': 'application/json' },
    JSON.stringify({ username: 'admin', password: 'admin123' }));
  console.log('login', login.status);
  const token = JSON.parse(login.body).token;

  // build multipart zip upload
  const file = fs.readFileSync('uploads/big_test.zip');
  const boundary = '----WebKitFormBoundary7MA4YWxk';
  const pre = Buffer.from(
    '--' + boundary + '\r\n' +
    'Content-Disposition: form-data; name="file"; filename="big_test.zip"\r\n' +
    'Content-Type: application/zip\r\n\r\n');
  const post = Buffer.from('\r\n--' + boundary + '--\r\n');
  const body = Buffer.concat([pre, file, post]);

  const r = await req('/api/upload/cells', 'POST', {
    'Content-Type': 'multipart/form-data; boundary=' + boundary,
    'Authorization': 'Bearer ' + token,
    'Content-Length': body.length
  }, body);
  console.log('upload', r.status);
  console.log(r.body.slice(0, 600));
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
