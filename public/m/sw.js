/* ==========================================================================
   Cell.id.vn Ã¢â‚¬â€ Service worker cho Ã¡Â»Â©ng dÃ¡Â»Â¥ng di Ã„â€˜Ã¡Â»â„¢ng (/m/)
   --------------------------------------------------------------------------
   NguyÃƒÂªn tÃ¡ÂºÂ¯c:
     Ã¢â‚¬Â¢ KHÃƒâ€NG cache /api/*  Ã¢â€ â€™ dÃ¡Â»Â¯ liÃ¡Â»â€¡u tÃƒÂ i khoÃ¡ÂºÂ£n/Ã„â€˜iÃ¡Â»Æ’m/toÃ¡ÂºÂ¡ Ã„â€˜Ã¡Â»â„¢ luÃƒÂ´n tÃ†Â°Ã†Â¡i, khÃƒÂ´ng lÃ¡Â»â„¢
       dÃ¡Â»Â¯ liÃ¡Â»â€¡u cÃ¡Â»Â§a phiÃƒÂªn trÃ†Â°Ã¡Â»â€ºc khi Ã„â€˜Ã„Æ’ng xuÃ¡ÂºÂ¥t.
     Ã¢â‚¬Â¢ KHÃƒâ€NG cache request cross-origin (Font Awesome CDN) Ã¢â€ â€™ Ã„â€˜Ã¡Â»Æ’ trÃƒÂ¬nh duyÃ¡Â»â€¡t tÃ¡Â»Â± lo.
     Ã¢â‚¬Â¢ Ã„ÂiÃ¡Â»Âu hÃ†Â°Ã¡Â»â€ºng (mÃ¡Â»Å¸ app): network-first, mÃ¡ÂºÂ¥t mÃ¡ÂºÂ¡ng mÃ¡Â»â€ºi rÃ†Â¡i vÃ¡Â»Â cache/trang offline.
     Ã¢â‚¬Â¢ TÃƒÂ i nguyÃƒÂªn tÃ„Â©nh cÃ¡Â»Â§a /m/: stale-while-revalidate (mÃ¡Â»Å¸ tÃ¡Â»Â©c thÃƒÂ¬, cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t ngÃ¡ÂºÂ§m).
   Ã„ÂÃ¡Â»â€¢i CACHE_VERSION mÃ¡Â»â€”i khi sÃ¡Â»Â­a app.css/app.js Ã„â€˜Ã¡Â»Æ’ client nhÃ¡ÂºÂ­n bÃ¡ÂºÂ£n mÃ¡Â»â€ºi.
   ========================================================================== */
const CACHE_VERSION = 'cell-m-v17';
const CACHE_NAME = CACHE_VERSION;

// TÃƒÂ i nguyÃƒÂªn tÃ¡Â»â€˜i thiÃ¡Â»Æ’u Ã„â€˜Ã¡Â»Æ’ app mÃ¡Â»Å¸ Ã„â€˜Ã†Â°Ã¡Â»Â£c khi mÃ¡ÂºÂ¥t mÃ¡ÂºÂ¡ng.
const PRECACHE = [
  '/m/',
  '/m/offline.html',
  '/m/app.css',
  '/m/app.js',
  '/m/manifest.webmanifest',
  '/auth.js',
  '/m/icons/icon-192.png',
  '/m/icons/favicon-64.png',
  // Logo topbar (bản nhỏ 3x, vài KB) — topbar có ở mọi màn hình nên cần sẵn offline.
  '/m/img/logo-topbar-dark.png',
  '/m/img/logo-topbar-light.png',
  '/img/logo.png',
  '/img/logo-white.png',
  '/img/favicon-32.png',
  '/img/favicon-64.png',
  '/img/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // ThÃƒÂªm TUÃ¡ÂºÂ¦N TÃ¡Â»Â° (khÃƒÂ´ng Promise.all): khi trÃƒÂ¬nh duyÃ¡Â»â€¡t cÃƒÂ i SW lÃ¡ÂºÂ§n Ã„â€˜Ã¡ÂºÂ§u nÃƒÂ³ cÃƒÂ³ thÃ¡Â»Æ’
    // huÃ¡Â»Â· cÃƒÂ¡c request song song khÃƒÂ´ng cÃ¡ÂºÂ§n thiÃ¡ÂºÂ¿t, lÃƒÂ m cache thiÃ¡ÂºÂ¿u file (Ã„â€˜ÃƒÂ£ gÃ¡ÂºÂ·p:
    // app.js + auth.js khÃƒÂ´ng vÃƒÂ o cache dÃƒÂ¹ server trÃ¡ÂºÂ£ 200). TuÃ¡ÂºÂ§n tÃ¡Â»Â± + chÃ¡Â»Â xong mÃ¡Â»â€ºi
    // skipWaiting bÃ¡ÂºÂ£o Ã„â€˜Ã¡ÂºÂ£m precache Ã„â€˜Ã¡ÂºÂ§y Ã„â€˜Ã¡Â»Â§ trÃ†Â°Ã¡Â»â€ºc khi SW nhÃ¡ÂºÂ­n request.
    const failed = [];
    for (const url of PRECACHE) {
      try {
        const res = await fetch(new Request(url, { cache: 'reload' }));
        if (!res || !res.ok) { failed.push(url + ':' + (res ? res.status : 'noresponse')); continue; }
        await cache.put(url, res);
      } catch (e) {
        failed.push(url + ':' + (e && e.message));
      }
    }
    if (failed.length) console.warn('[sw] precache thiÃ¡ÂºÂ¿u:', failed.join(', '));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => k !== CACHE_NAME && k.indexOf('cell-m-') === 0)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isBypassed(url, request) {
  if (request.method !== 'GET') return true;
  if (url.origin !== self.location.origin) return true;
  // API: luÃƒÂ´n ra mÃ¡ÂºÂ¡ng, khÃƒÂ´ng cache.
  if (url.pathname.indexOf('/api/') === 0) return true;
  // CÃƒÂ¡c route khÃƒÂ´ng phÃ¡ÂºÂ£i tÃƒÂ i nguyÃƒÂªn tÃ„Â©nh cÃ¡Â»Â§a app di Ã„â€˜Ã¡Â»â„¢ng.
  if (url.pathname === '/r/' || url.pathname.indexOf('/r/') === 0) return true;
  if (url.pathname.indexOf('/i/') === 0) return true;
  if (url.pathname.indexOf('/d/') === 0) return true;
  return false;
}

function isSameAppAsset(url) {
  if (url.pathname === '/auth.js') return true;
  // Logo + favicon dÃƒÂ¹ng chung vÃ¡Â»â€ºi bÃ¡ÂºÂ£n desktop (mÃƒÂ n hÃƒÂ¬nh Ã„â€˜Ã„Æ’ng nhÃ¡ÂºÂ­p / tab TÃƒÂ i khoÃ¡ÂºÂ£n).
  if (url.pathname.indexOf('/img/') === 0) return true;
  if (url.pathname === '/m' || url.pathname.indexOf('/m/') === 0) return true;
  return false;
}

// Network-first cho Ã„â€˜iÃ¡Â»Âu hÃ†Â°Ã¡Â»â€ºng: Ã†Â°u tiÃƒÂªn bÃ¡ÂºÂ£n mÃ¡Â»â€ºi, mÃ¡ÂºÂ¥t mÃ¡ÂºÂ¡ng mÃ¡Â»â€ºi dÃƒÂ¹ng cache.
async function handleNavigate(request) {
  try {
    const fresh = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    // ChÃ¡Â»â€° ghi Ã„â€˜ÃƒÂ¨ app shell khi Ã„â€˜iÃ¡Â»Âu hÃ†Â°Ã¡Â»â€ºng vÃƒÂ o chÃƒÂ­nh app (khÃƒÂ´ng ghi Ã„â€˜ÃƒÂ¨
    // /m/offline.html bÃ¡ÂºÂ±ng HTML cÃ¡Â»Â§a app).
    const p = new URL(request.url).pathname;
    if (p === '/m/' || p === '/m/index.html') cache.put('/m/', fresh.clone()).catch(() => {});
    return fresh;
  } catch (e) {
    const cache = await caches.open(CACHE_NAME);
    // 1) Ã„ÂÃƒÂºng URL Ã„â€˜ÃƒÂ£ precache (vd. /m/ hoÃ¡ÂºÂ·c /m/offline.html).
    const exact = await cache.match(request);
    if (exact) return exact;
    // 2) MÃ¡Â»Âi Ã„â€˜Ã†Â°Ã¡Â»Âng dÃ¡ÂºÂ«n khÃƒÂ¡c trong app Ã¢â€ â€™ app shell (app lÃƒÂ  1 trang duy nhÃ¡ÂºÂ¥t).
    const shell = await cache.match('/m/') || await cache.match('/m/index.html');
    if (shell) return shell;
    return (await cache.match('/m/offline.html')) ||
      new Response('KhÃƒÂ´ng cÃƒÂ³ kÃ¡ÂºÂ¿t nÃ¡Â»â€˜i mÃ¡ÂºÂ¡ng.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
  }
}

// Stale-while-revalidate cho tÃƒÂ i nguyÃƒÂªn tÃ„Â©nh.
async function handleAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request).then((res) => {
    // ChÃ¡Â»â€° cache response 200 cÃƒÂ¹ng origin (trÃƒÂ¡nh cache lÃ¡Â»â€”i/redirect).
    if (res && res.status === 200 && res.type === 'basic') {
      cache.put(request, res.clone()).catch(() => {});
    }
    return res;
  }).catch(() => null);
  return cached || network || Response.error();
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  let url;
  try { url = new URL(request.url); } catch (e) { return; }

  if (isBypassed(url, request)) return; // Ã„â€˜Ã¡Â»Æ’ trÃƒÂ¬nh duyÃ¡Â»â€¡t xÃ¡Â»Â­ lÃƒÂ½ nhÃ†Â° bÃƒÂ¬nh thÃ†Â°Ã¡Â»Âng

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigate(request));
    return;
  }

  if (isSameAppAsset(url)) {
    event.respondWith(handleAsset(request));
  }
});

// Cho phÃƒÂ©p trang gÃ¡Â»Âi skipWaiting ngay khi cÃƒÂ³ bÃ¡ÂºÂ£n mÃ¡Â»â€ºi (khÃƒÂ´ng bÃ¡ÂºÂ¯t buÃ¡Â»â„¢c).
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
