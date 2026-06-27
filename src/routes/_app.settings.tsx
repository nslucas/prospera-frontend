import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { BellRing, Save, Settings } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAsyncData, useAsyncMutation } from "@/hooks/use-async-data";
import { fetchAccounts, fetchCards, fetchCategories, fetchUserPreferences, updateUserPreferences } from "@/lib/queries";
import {
  canUsePushNotifications,
  ensurePushSubscription,
  getBrowserNotificationPermission,
  normalizeNotificationPreferences,
  normalizeUserPreferences,
  requestBrowserNotificationPermission,
} from "@/lib/notifications";
import type { MovementKind, NotificationPreferences, UserPreferences } from "@/lib/types";

const MOVEMENT_LABELS: Record<MovementKind, string> = {
  EXPENSE: "Despesa em conta",
  CARD_EXPENSE: "Compra no cartão",
  INCOME: "Receita",
  ADJUSTMENT: "Ajuste",
  TRANSFER: "Transferência",
  CARD_PAYMENT: "Pagamento de fatura",
};

const MOVEMENT_OPTIONS = Object.keys(MOVEMENT_LABELS) as MovementKind[];
const EMPTY_VALUE = "_none";

const FALLBACK_PREFERENCES: UserPreferences = {
  defaultMovementKind: "CARD_EXPENSE",
  defaultAccountId: null,
  defaultTargetAccountId: null,
  defaultCardId: null,
  defaultExpenseCategoryId: null,
  defaultIncomeCategoryId: null,
  defaultInstallmentCount: 1,
  notifications: normalizeNotificationPreferences(),
};

export default function SettingsPage() {
  const preferences = useAsyncData(() => fetchUserPreferences(), [], {
    cacheKey: "user-preferences",
    staleMs: 60_000,
  });
  const accounts = useAsyncData(() => fetchAccounts(), [], { cacheKey: "accounts", staleMs: 60_000 });
  const cards = useAsyncData(() => fetchCards(), [], { cacheKey: "cards", staleMs: 60_000 });
  const categories = useAsyncData(() => fetchCategories(), [], { cacheKey: "categories", staleMs: 60_000 });
  const [form, setForm] = useState<UserPreferences>(FALLBACK_PREFERENCES);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() =>
    getBrowserNotificationPermission(),
  );

  const activeAccounts = useMemo(() => (accounts.data ?? []).filter((account) => account.active), [accounts.data]);
  const activeCards = useMemo(() => (cards.data ?? []).filter((card) => card.active), [cards.data]);
  const expenseCategories = useMemo(
    () => (categories.data ?? []).filter((category) => category.active && category.type === "EXPENSE"),
    [categories.data],
  );
  const incomeCategories = useMemo(
    () => (categories.data ?? []).filter((category) => category.active && category.type === "INCOME"),
    [categories.data],
  );

  useEffect(() => {
    if (preferences.data) setForm(normalizeUserPreferences(preferences.data));
  }, [preferences.data]);

  const save = useAsyncMutation({
    mutationFn: () =>
      updateUserPreferences(normalizeUserPreferences({
        ...form,
        defaultInstallmentCount: Math.max(1, Number(form.defaultInstallmentCount || 1)),
        notifications: normalizeNotificationPreferences(form.notifications),
      })),
    onSuccess: (saved) => {
      setForm(saved);
      preferences.reload();
      toast.success("Preferências salvas");
    },
    onError: (error) => toast.error(error.message),
  });

  async function enablePushNotifications() {
    if (!canUsePushNotifications()) {
      setPermission("unsupported");
      toast.error("Este navegador não oferece suporte a notificações push.");
      return;
    }

    const nextPermission = await requestBrowserNotificationPermission();
    setPermission(nextPermission);

    if (nextPermission !== "granted") {
      toast.error("Permissão de notificação não concedida.");
      return;
    }

    try {
      await ensurePushSubscription();
      toast.success("Notificações ativadas neste dispositivo");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível ativar notificações.");
    }
  }

  const isLoading = preferences.isLoading || accounts.isLoading || cards.isLoading || categories.isLoading;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Conta</p>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">Configurações</h1>
        </div>
        <Button type="button" onClick={() => save.mutate(undefined)} disabled={save.isPending || isLoading}>
          <Save className="h-4 w-4" /> Salvar
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Preferências de movimentação</h2>
              <p className="text-sm text-muted-foreground">Defaults usados ao criar um novo lançamento.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tipo padrão">
              <Select
                value={form.defaultMovementKind}
                onValueChange={(value) => setForm((current) => ({ ...current, defaultMovementKind: value as MovementKind }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOVEMENT_OPTIONS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {MOVEMENT_LABELS[kind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Parcelas padrão">
              <Input
                type="number"
                min={1}
                value={form.defaultInstallmentCount}
                onChange={(event) =>
                  setForm((current) => ({ ...current, defaultInstallmentCount: Number(event.target.value) || 1 }))
                }
              />
            </Field>

            <Field label="Conta padrão">
              <IdSelect
                value={form.defaultAccountId}
                placeholder="Sem conta padrão"
                items={activeAccounts.map((account) => ({ id: account.id, label: account.name }))}
                onChange={(value) => setForm((current) => ({ ...current, defaultAccountId: value }))}
              />
            </Field>

            <Field label="Conta destino">
              <IdSelect
                value={form.defaultTargetAccountId}
                placeholder="Sem conta destino"
                items={activeAccounts.map((account) => ({ id: account.id, label: account.name }))}
                onChange={(value) => setForm((current) => ({ ...current, defaultTargetAccountId: value }))}
              />
            </Field>

            <Field label="Cartão padrão">
              <IdSelect
                value={form.defaultCardId}
                placeholder="Sem cartão padrão"
                items={activeCards.map((card) => ({ id: card.id, label: card.name }))}
                onChange={(value) => setForm((current) => ({ ...current, defaultCardId: value }))}
              />
            </Field>

            <Field label="Categoria de despesa">
              <IdSelect
                value={form.defaultExpenseCategoryId}
                placeholder="Sem categoria"
                items={expenseCategories.map((category) => ({ id: category.id, label: category.name }))}
                onChange={(value) => setForm((current) => ({ ...current, defaultExpenseCategoryId: value }))}
              />
            </Field>

            <Field label="Categoria de receita">
              <IdSelect
                value={form.defaultIncomeCategoryId}
                placeholder="Sem categoria"
                items={incomeCategories.map((category) => ({ id: category.id, label: category.name }))}
                onChange={(value) => setForm((current) => ({ ...current, defaultIncomeCategoryId: value }))}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <BellRing className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Notificações</h2>
                <p className="text-sm text-muted-foreground">
                  Escolha quais avisos aparecem no app e podem ser enviados por push.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={enablePushNotifications}
              disabled={permission === "granted"}
            >
              <BellRing className="h-4 w-4" />
              {permissionStatusLabel(permission)}
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <NotificationToggle
              title="Solicitações"
              description="Novos pedidos de conexão."
              checked={normalizeNotificationPreferences(form.notifications).connectionRequests}
              onCheckedChange={(checked) => updateNotificationPreference(setForm, "connectionRequests", checked)}
            />
            <NotificationToggle
              title="Despesas compartilhadas"
              description="Novos acertos em que você participa."
              checked={normalizeNotificationPreferences(form.notifications).sharedExpenses}
              onCheckedChange={(checked) => updateNotificationPreference(setForm, "sharedExpenses", checked)}
            />
            <NotificationToggle
              title="Resumo financeiro"
              description="Digest diário de alertas importantes."
              checked={normalizeNotificationPreferences(form.notifications).financialDigest}
              onCheckedChange={(checked) => updateNotificationPreference(setForm, "financialDigest", checked)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationToggle({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-28 items-start justify-between gap-4 rounded-lg border p-4">
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function updateNotificationPreference(
  setForm: Dispatch<SetStateAction<UserPreferences>>,
  key: keyof NotificationPreferences,
  value: boolean,
) {
  setForm((current) => ({
    ...current,
    notifications: {
      ...normalizeNotificationPreferences(current.notifications),
      [key]: value,
    },
  }));
}

function permissionStatusLabel(permission: NotificationPermission | "unsupported") {
  if (permission === "granted") return "Ativado";
  if (permission === "denied") return "Bloqueado";
  if (permission === "unsupported") return "Indisponível";
  return "Ativar push";
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function IdSelect({
  value,
  placeholder,
  items,
  onChange,
}: {
  value?: number | null;
  placeholder: string;
  items: Array<{ id: number; label: string }>;
  onChange: (value: number | null) => void;
}) {
  return (
    <Select
      value={value ? String(value) : EMPTY_VALUE}
      onValueChange={(next) => onChange(next === EMPTY_VALUE ? null : Number(next))}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={EMPTY_VALUE}>{placeholder}</SelectItem>
        {items.map((item) => (
          <SelectItem key={item.id} value={String(item.id)}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
