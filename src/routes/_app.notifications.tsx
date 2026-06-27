import { useMemo } from "react";
import { BellRing, CheckCheck, Inbox, ReceiptText, UsersRound, WalletCards } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAsyncData, useAsyncMutation } from "@/hooks/use-async-data";
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/notifications";
import { formatDateTime } from "@/lib/format";
import type { AppNotification, NotificationCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORY_META: Record<NotificationCategory, { label: string; icon: typeof UsersRound }> = {
  CONNECTION_REQUEST: { label: "Conexões", icon: UsersRound },
  SHARED_EXPENSE: { label: "Acertos", icon: ReceiptText },
  FINANCIAL_DIGEST: { label: "Alertas", icon: WalletCards },
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const notifications = useAsyncData(() => fetchNotifications({ limit: 50 }), [], {
    cacheKey: "notifications:latest",
  });
  const unreadCount = useMemo(
    () => (notifications.data ?? []).filter((notification) => !notification.readAt).length,
    [notifications.data],
  );

  const readOne = useAsyncMutation({
    mutationFn: (notification: AppNotification) =>
      notification.readAt ? Promise.resolve(notification) : markNotificationRead(notification.id),
    onSuccess: (_, notification) => {
      window.dispatchEvent(new Event("prospera:notifications-updated"));
      navigate(notification.url || "/notifications");
    },
    onError: (error) => toast.error(error.message),
  });

  const readAll = useAsyncMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      notifications.reload();
      window.dispatchEvent(new Event("prospera:notifications-updated"));
      toast.success("Notificações marcadas como lidas");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Notificações</h1>
          <p className="text-sm text-muted-foreground">
            Solicitações, despesas compartilhadas e resumos financeiros importantes.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => readAll.mutate(undefined)}
          disabled={!unreadCount || readAll.isPending}
        >
          <CheckCheck className="h-4 w-4" />
          Marcar lidas
        </Button>
      </div>

      {notifications.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : notifications.error ? (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar notificações agora.
            </p>
          </CardContent>
        </Card>
      ) : !notifications.data?.length ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Inbox className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhuma notificação por enquanto.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.data.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              isPending={readOne.isPending}
              onOpen={() => readOne.mutate(notification)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationCard({
  notification,
  isPending,
  onOpen,
}: {
  notification: AppNotification;
  isPending: boolean;
  onOpen: () => void;
}) {
  const meta = CATEGORY_META[notification.category] ?? { label: "Notificação", icon: BellRing };
  const Icon = meta.icon;
  const isUnread = !notification.readAt;

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={onOpen}
      className="block w-full text-left disabled:cursor-wait disabled:opacity-70"
    >
      <Card
        className={cn(
          "transition-colors hover:border-primary/30 hover:bg-accent/35",
          isUnread && "border-primary/40 bg-accent/25",
        )}
      >
        <CardContent className="flex items-start gap-3 p-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={isUnread ? "default" : "outline"}>{isUnread ? "Nova" : "Lida"}</Badge>
              <Badge variant="secondary">{meta.label}</Badge>
            </div>
            <p className="mt-2 font-medium">{notification.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {formatDateTime(notification.createdAt)}
            </p>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}
