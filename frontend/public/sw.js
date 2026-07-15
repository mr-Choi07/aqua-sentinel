// 어장지킴이 서비스 워커 — 홈 화면 설치(PWA) + 웹 푸시 알림 수신용.
// 오프라인 캐싱은 하지 않는다: 이 앱은 실시간 관측치가 핵심이라, 캐시된 낡은
// 데이터를 보여주는 것이 아무것도 안 보여주는 것보다 위험할 수 있기 때문이다.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "어장지킴이", body: "새 알림이 있어요.", url: "/" };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/pwa-192.png",
      badge: "/pwa-192.png",
      data: { url: payload.url || "/" },
      requireInteraction: true, // 고수온 경보는 스와이프로 놓치면 안 되는 정보라 유지
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
