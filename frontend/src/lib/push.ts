import { fetchVapidPublicKey, subscribePush } from "../api";

export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// 브라우저 Push API는 공개키를 base64 문자열이 아니라 Uint8Array로 요구한다.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** 알림 권한을 요청하고, 현재 선택된 어장·어종으로 푸시를 구독한다. */
export async function subscribeToStationAlerts(sta_cde: string, species: string): Promise<void> {
  if (!isPushSupported()) {
    throw new Error("이 브라우저는 알림 기능을 지원하지 않아요.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("알림 권한이 허용되지 않았어요.");
  }

  const registration = await navigator.serviceWorker.ready;
  const { key } = await fetchVapidPublicKey();

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    });
  }

  const raw = subscription.toJSON();
  if (!raw.endpoint || !raw.keys?.p256dh || !raw.keys?.auth) {
    throw new Error("구독 정보를 만들지 못했어요.");
  }

  await subscribePush({
    sta_cde,
    species,
    endpoint: raw.endpoint,
    p256dh: raw.keys.p256dh,
    auth: raw.keys.auth,
  });
}
