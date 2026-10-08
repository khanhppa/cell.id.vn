const http = require('http');
const post = (path, body, token) => new Promise((resolve, reject) => {
  const req = http.request('http://localhost:3000' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': 'Bearer ' + token } : {}) }
  }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => resolve({ status: r.statusCode, body: d }));
  });
  req.on('error', reject);
  req.setTimeout(120000, () => { req.destroy(new Error('timeout')); });
  req.end(JSON.stringify(body));
});

(async () => {
  const login = await post('/api/login', { username: 'admin', password: 'admin123' }, null);
  console.log('login', login.status);
  const t = JSON.parse(login.body).token;

  // 1) LARGE chunk: 20000 rows → old 100kb limit would 413; 200mb ok.
  const start = await post('/api/upload/cells/start', {}, t);
  const sid = JSON.parse(start.body).sessionId;
  const rows = [];
  for (let i = 0; i < 20000; i++) rows.push({ mcc: '452', mnc: '02', lac: '999', cellid: 'BIG' + i, lat: 10 + i * 0.0001, lon: 106 + i * 0.0001 });
  console.log('payload bytes ~', JSON.stringify({ sessionId: sid, rows }).length);
  const c1 = await post('/api/upload/cells/chunk', { sessionId: sid, rows }, t);
  console.log('big chunk', c1.status, c1.body.slice(0, 200));
  const f1 = await post('/api/upload/cells/finish', { sessionId: sid }, t);
  console.log('finish', f1.status, f1.body);

  // 2) ALL-invalid chunk → previously hung (respond never called). Must respond now.
  const start2 = await post('/api/upload/cells/start', {}, t);
  const sid2 = JSON.parse(start2.body).sessionId;
  const badRows = [
    { mcc: '', mnc: '02', lac: '1', cellid: 'x', lat: 10, lon: 106 },
    { mcc: '452', mnc: '', lac: '1', cellid: 'x', lat: 10, lon: 106 },
    { mcc: '452', mnc: '02', lac: '', cellid: 'x', lat: 10, lon: 106 }
  ];
  const c2 = await post('/api/upload/cells/chunk', { sessionId: sid2, rows: badRows }, t);
  console.log('all-invalid chunk', c2.status, c2.body);
  const f2 = await post('/api/upload/cells/finish', { sessionId: sid2 }, t);
  console.log('finish2', f2.status, f2.body);

  // 3) Mixed valid+invalid with mnc edge
  const start3 = await post('/api/upload/cells/start', {}, t);
  const sid3 = JSON.parse(start3.body).sessionId;
  const mixed = [
    { mcc: '452', mnc: 'edge1', lac: '5', cellid: '111', lat: 10.1, lon: 106.1 },
    { mcc: '452', mnc: '02', lac: '5', cellid: '222', lat: 10.2, lon: 106.2 },
    { mcc: '452', mnc: '02', lac: '', cellid: '333', lat: 10.3, lon: 106.3 },
    { mcc: '452', mnc: '02', lac: '5', cellid: '', lat: 10.4, lon: 106.4 }
  ];
  const c3 = await post('/api/upload/cells/chunk', { sessionId: sid3, rows: mixed }, t);
  console.log('mixed', c3.status, c3.body);
  const f3 = await post('/api/upload/cells/finish', { sessionId: sid3 }, t);
  console.log('finish3', f3.status, f3.body);
})();