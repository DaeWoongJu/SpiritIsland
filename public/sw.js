// 앱 설치(PWA)를 위한 최소 서비스 워커. 실시간 게임이므로 캐시하지 않고 항상 네트워크를 사용한다.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
