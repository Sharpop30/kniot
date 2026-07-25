/* service worker — הקניות שלנו */
const CACHE = 'kniot-v6';
const CDN_CACHE = 'kniot-cdn-v1';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(['./', './index.html', './manifest.webmanifest', './icon-192.png']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(
      ks.filter(k => k !== CACHE && k !== CDN_CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);

  // API של GitHub — תמיד רשת, בלי cache
  if (u.host === 'api.github.com' || u.host === 'gist.githubusercontent.com') return;

  // קבצי האפליקציה — רשת קודם (כדי לקבל עדכונים), נפילה ל-cache באופליין
  if (u.origin === location.origin) {
    e.respondWith(
      fetch(e.request).then(r => {
        const clone = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return r;
      }).catch(() =>
        caches.match(e.request).then(r => r || caches.match('./index.html'))
      )
    );
    return;
  }

  // ספריות CDN (OCR, PDF) — cache קודם, הן לא משתנות
  if (/cdnjs\.cloudflare\.com|jsdelivr\.net|tessdata/.test(u.host)) {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CDN_CACHE).then(c => c.put(e.request, clone));
        return res;
      }))
    );
  }
});
