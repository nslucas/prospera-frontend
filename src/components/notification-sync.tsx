import { useEffect } from "react";

import { useAuth } from "@/lib/auth";
import { ensurePushSubscription, getBrowserNotificationPermission } from "@/lib/notifications";

export function NotificationSync() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user || getBrowserNotificationPermission() !== "granted") return;

    ensurePushSubscription().catch((error) => {
      console.warn("Push notification subscription sync failed", error);
    });
  }, [loading, user]);

  return null;
}
