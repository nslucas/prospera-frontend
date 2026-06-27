import { api } from "@/lib/api";
import type { AppNotification, NotificationPreferences, UserPreferences } from "@/lib/types";

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  connectionRequests: true,
  sharedExpenses: true,
  financialDigest: true,
};

export function normalizeNotificationPreferences(
  preferences?: NotificationPreferences | null,
): NotificationPreferences {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(preferences ?? {}),
  };
}

export function normalizeUserPreferences(preferences: UserPreferences): UserPreferences {
  return {
    ...preferences,
    notifications: normalizeNotificationPreferences(preferences.notifications),
  };
}

export function fetchNotifications(params: { limit?: number; unreadOnly?: boolean } = {}) {
  return api<AppNotification[]>("/notifications", {
    skipSessionExpiredRedirect: true,
    query: {
      limit: params.limit,
      unreadOnly: params.unreadOnly === undefined ? undefined : String(params.unreadOnly),
    },
  });
}

export function fetchUnreadNotificationCount() {
  return api<{ count: number }>("/notifications/unread-count", { skipSessionExpiredRedirect: true });
}

export function markNotificationRead(id: number) {
  return api<AppNotification>(`/notifications/${id}/read`, {
    method: "PATCH",
    skipSessionExpiredRedirect: true,
  });
}

export function markAllNotificationsRead() {
  return api<void>("/notifications/read-all", {
    method: "POST",
    skipSessionExpiredRedirect: true,
  });
}

export function fetchVapidPublicKey() {
  return api<{ publicKey: string }>("/push/vapid-public-key", { skipSessionExpiredRedirect: true });
}

export function savePushSubscription(subscription: PushSubscriptionJSON) {
  return api<void>("/push/subscriptions", {
    method: "POST",
    body: subscription,
    skipSessionExpiredRedirect: true,
  });
}

export function deletePushSubscription(endpoint: string) {
  return api<void>("/push/subscriptions/unsubscribe", {
    method: "POST",
    body: { endpoint },
    skipSessionExpiredRedirect: true,
  });
}

export function canUsePushNotifications() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export function getBrowserNotificationPermission(): NotificationPermission | "unsupported" {
  if (!canUsePushNotifications()) return "unsupported";
  return Notification.permission;
}

export async function requestBrowserNotificationPermission() {
  if (!canUsePushNotifications()) return "unsupported" as const;
  return Notification.requestPermission();
}

export async function ensurePushSubscription() {
  if (!canUsePushNotifications() || Notification.permission !== "granted") return null;

  const registration = await getReadyServiceWorkerRegistration();
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    await savePushSubscription(existing.toJSON());
    return existing;
  }

  const { publicKey } = await fetchVapidPublicKey();
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  await savePushSubscription(subscription.toJSON());
  return subscription;
}

export async function unsubscribePushNotifications() {
  if (!canUsePushNotifications()) return;

  const registration = await getReadyServiceWorkerRegistration();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const { endpoint } = subscription;
  await subscription.unsubscribe();
  await deletePushSubscription(endpoint);
}

async function getReadyServiceWorkerRegistration() {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return navigator.serviceWorker.ready;

  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
