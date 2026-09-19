/* service worker — הקניות שלנו */
const CACHE = 'kniot-v14';

/* כמה זמן מחכים לרשת לפני שמגישים מהמטמון.
   בסופר עם קליטה חלשה בקשה לא נכשלת מיד — היא תלויה עשר שניות ויותר,
   והאפליקציה נראית תקועה למרות שהיא שמורה במלואה על המכשיר. */
const NET_TIMEOUT = 2000;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(['./', './index.html', './manifest.webmanifest',
                           './icon-192.png', './apple-touch-icon.png']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function fetchWithTimeout(req, ms){
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then(
      r => { clearTimeout(timer); resolve(r); },
      e => { clearTimeout(timer); reject(e); }
    );
  });
}

function cacheIt(req, res){
  if(res && res.ok) caches.open(CACHE).then(c => c.put(req, res.clone())).catch(() => {});
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);

  // API של GitHub — תמיד רשת, בלי cache
  if (u.host === 'api.github.com' || u.host === 'gist.githubusercontent.com') return;
  if (u.origin !== location.origin) return;

  e.respondWith((async () => {
    try{
      // רשת קודם, אבל עם תקרת זמן — כך מקבלים עדכונים בבית בלי להיתקע בחנות
      const res = await fetchWithTimeout(e.request, NET_TIMEOUT);
      cacheIt(e.request, res);
      return res;
    }catch(err){
      const cached = await caches.match(e.request) || await caches.match('./index.html');
      if(cached){
        // ממשיכים להביא ברקע, כדי שהפתיחה הבאה כבר תהיה עדכנית
        fetch(e.request).then(late => cacheIt(e.request, late)).catch(() => {});
        return cached;
      }
      return fetch(e.request);   // אין מטמון — שיחכה לרשת
    }
  })());
});
