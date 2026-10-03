// 앱 설치(PWA)용 서비스 워커.
// 실시간 게임이므로 게임 파일은 캐시하지 않고 항상 서버에서 받는다.
// 단, 서버가 꺼져 있어 페이지를 열 수 없으면 "서버가 꺼져 있습니다" 안내 화면을 보여 준다.
const CACHE = 'si-offline-v2';
const OFFLINE_FILES = ['offline.html', 'icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(OFFLINE_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('offline.html')));
    return;
  }
  const url = new URL(req.url);
  if (url.origin === location.origin && url.pathname.endsWith('/icons/icon-192.png')) {
    e.respondWith(fetch(req).catch(() => caches.match('icons/icon-192.png')));
  }
});
