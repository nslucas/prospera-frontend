import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { useAsyncData, useAsyncMutation } from "@/hooks/use-async-data";
import { notifyFinanceUpdated } from "@/hooks/use-finance-updates";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { currentMonthYear, formatBRL, monthLabel, nowIsoDateTime, todayIsoDate } from "@/lib/format";
import {
  fetchAccounts,
  fetchCards,
  fetchCategories,
  fetchConnections,
  fetchUserPreferences,
} from "@/lib/queries";
import type {
  Account,
  Card as CreditCardRecord,
  Category,
  Connection,
  Expense,
  MovementKind,
  SettlementItem,
  Transaction,
  TransactionType,
  UserPreferences,
} from "@/lib/types";
import { CurrencyAmountInput } from "@/components/currency-amount-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type MovementEntryEditingItem =
  | {
      kind: "transaction";
      id: number;
      title: string;
      description?: string | null;
      amount: number;
      occurredAt: string;
      type: TransactionType;
      accountId: number;
      categoryId?: number | null;
    }
  | {
      kind: "card-expense";
      id: number;
      title: string;
      amount: number;
      occurredAt: string;
      cardId?: number | null;
      categoryId?: number | null;
      installmentCount: number;
    }
  | {
      kind: "card-payment";
      id: number;
      title: string;
      amount: number;
      occurredAt: string;
      cardId: number;
      accountId: number;
      paymentMonth: number;
      paymentYear: number;
      transactionId?: number | null;
    };

interface MovementEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period?: { month: number; year: number };
  editing?: MovementEntryEditingItem | null;
  editingExpense?: Expense | null;
  editingShare?: SettlementItem | null;
  trigger?: React.ReactNode;
}

const schema = z
  .object({
    kind: z.enum(["INCOME", "EXPENSE", "CARD_EXPENSE", "ADJUSTMENT", "TRANSFER", "CARD_PAYMENT"]),
    title: z.string().optional(),
    amount: z.coerce.number(),
    occurredAt: z.string().min(1, "Informe a data"),
    accountId: z.coerce.number().int().optional(),
    targetAccountId: z.coerce.number().int().optional(),
    cardId: z.coerce.number().int().optional(),
    categoryId: z.coerce.number().int().optional(),
    installmentCount: z.coerce.number().int().positive("Parcelas deve ser > 0").optional(),
    shareEnabled: z.boolean().optional(),
    participantUserId: z.coerce.number().int().optional(),
    participantAmount: z.coerce.number().optional(),
    paymentMonth: z.coerce.number().int().min(1).max(12).optional(),
    paymentYear: z.coerce.number().int().min(2000).optional(),
  })
  .superRefine((values, ctx) => {
    const title = values.title?.trim();
    const requiresTitle =
      values.kind === "INCOME" ||
      values.kind === "EXPENSE" ||
      values.kind === "CARD_EXPENSE" ||
      values.kind === "ADJUSTMENT";

    if (requiresTitle && !title) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["title"], message: "Informe uma descrição" });
    }
    if (values.kind === "ADJUSTMENT" && values.amount === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amount"], message: "Ajuste não pode ser zero" });
    }
    if (values.kind !== "ADJUSTMENT" && values.amount <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amount"], message: "Valor deve ser > 0" });
    }
    if (values.kind === "CARD_EXPENSE") {
      if (!values.cardId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cardId"], message: "Selecione um cartão" });
      }
      if (!values.installmentCount) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["installmentCount"], message: "Informe as parcelas" });
      }
      if (values.shareEnabled) {
        if (!values.participantUserId) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["participantUserId"], message: "Selecione uma conexão" });
        }
        if (!values.participantAmount || values.participantAmount <= 0) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["participantAmount"], message: "Valor da outra pessoa deve ser maior que zero" });
        }
        if (values.participantAmount && values.participantAmount > values.amount) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["participantAmount"], message: "Valor da outra pessoa não pode passar do total" });
        }
        const creatorAmount = roundMoney(values.amount - Number(values.participantAmount ?? 0));
        const participantAmount = roundMoney(Number(values.participantAmount ?? 0));
        if (roundMoney(creatorAmount + participantAmount) !== roundMoney(values.amount)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["participantAmount"], message: "A divisão precisa fechar com o valor total" });
        }
      }
      return;
    }
    if (values.kind === "TRANSFER") {
      if (!values.accountId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["accountId"], message: "Selecione a conta de origem" });
      }
      if (!values.targetAccountId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["targetAccountId"], message: "Selecione a conta de destino" });
      }
      if (values.accountId && values.targetAccountId && values.accountId === values.targetAccountId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["targetAccountId"], message: "Destino deve ser diferente da origem" });
      }
      return;
    }
    if (values.kind === "CARD_PAYMENT") {
      if (!values.cardId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cardId"], message: "Selecione um cartão" });
      }
      if (!values.accountId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["accountId"], message: "Selecione uma conta" });
      }
      if (!values.paymentMonth || !values.paymentYear) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["paymentMonth"], message: "Selecione a fatura" });
      }
      return;
    }
    if (!values.accountId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["accountId"], message: "Selecione uma conta" });
    }
  });

type Values = z.infer<typeof schema>;

export function MovementEntryDialog({
  open,
  onOpenChange,
  period,
  editing,
  editingExpense,
  editingShare,
  trigger,
}: MovementEntryDialogProps) {
  const { user } = useAuth();
  const defaultPeriod = currentMonthYear();
  const month = period?.month ?? defaultPeriod.month;
  const year = period?.year ?? defaultPeriod.year;
  const accounts = useAsyncData(() => fetchAccounts(), [], { cacheKey: "accounts" });
  const cards = useAsyncData(() => fetchCards(), [], { cacheKey: "cards" });
  const categories = useAsyncData(() => fetchCategories(), [], { cacheKey: "categories", staleMs: 60_000 });
  const connections = useAsyncData(() => fetchConnections(), [], { cacheKey: "connections", staleMs: 60_000 });
  const preferences = useAsyncData(() => fetchUserPreferences(), [], { cacheKey: "user-preferences", staleMs: 60_000 });
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: movementDefaults("CARD_EXPENSE", month, year),
  });
  const previousOpenRef = React.useRef(open);

  const kind = form.watch("kind");
  const shareEnabled = form.watch("shareEnabled");
  const participantAmount = Number(form.watch("participantAmount") ?? 0);
  const creatorShareAmount = roundMoney(Number(form.watch("amount") ?? 0) - participantAmount);
  const errors = form.formState.errors;
  const activeAccounts = (accounts.data ?? []).filter((account) => account.active);
  const activeCards = (cards.data ?? []).filter((card) => card.active);
  const activeConnections = connections.data ?? [];
  const showsCategory = kind === "INCOME" || kind === "EXPENSE" || kind === "CARD_EXPENSE";
  const filteredCategories = (categories.data ?? []).filter((category) => {
    if (!category.active || !showsCategory) return false;
    if (kind === "INCOME") return category.type === "INCOME";
    return category.type === "EXPENSE";
  });
  const monthOptions = useMonthOptions(month, year);

  React.useEffect(() => {
    const justOpened = open && !previousOpenRef.current;
    previousOpenRef.current = open;
    if (!justOpened) return;

    if (!editing) {
      const defaultKind = preferences.data?.defaultMovementKind ?? "CARD_EXPENSE";
      form.reset(
        movementDefaults(defaultKind, month, year, preferences.data, {
          accounts: accounts.data,
          cards: cards.data,
          categories: categories.data,
        }),
      );
      return;
    }

    if (editing.kind === "transaction" && isEditableTransactionType(editing.type)) {
      form.reset({
        ...movementDefaults(editing.type, month, year),
        title: editing.description?.trim() || editing.title,
        amount: editing.type === "ADJUSTMENT" ? editing.amount : Math.abs(editing.amount),
        occurredAt: editing.occurredAt.slice(0, 16),
        accountId: editing.accountId,
        categoryId: editing.categoryId ?? undefined,
      });
      return;
    }

    if (editing.kind === "card-payment") {
      form.reset({
        ...movementDefaults("CARD_PAYMENT", month, year),
        title: editing.title,
        amount: editing.amount,
        occurredAt: editing.occurredAt.slice(0, 10),
        accountId: editing.accountId,
        cardId: editing.cardId,
        paymentMonth: editing.paymentMonth,
        paymentYear: editing.paymentYear,
      });
      return;
    }

    if (editing.kind === "card-expense") {
      const expense = editingExpense;
      form.reset({
        ...movementDefaults("CARD_EXPENSE", month, year),
        title: expense?.name ?? editing.title,
        amount: expense?.amount ?? editing.amount,
        occurredAt: (expense?.purchaseDate ?? editing.occurredAt).slice(0, 16),
        cardId: expense?.cardId ?? editing.cardId ?? undefined,
        categoryId: expense?.categoryId ?? editing.categoryId ?? undefined,
        installmentCount: expense?.installmentCount ?? editing.installmentCount,
        shareEnabled: !!editingShare,
        participantUserId: editingShare?.participantUserId,
        participantAmount: editingShare?.participantAmount,
      });
    }
  }, [accounts.data, cards.data, categories.data, editing, editingExpense, editingShare, form, month, open, preferences.data, year]);

  const switchMovementKind = (nextKind: MovementKind) => {
    const occurredAt = form.getValues("occurredAt");
    const defaults = movementDefaults(nextKind, month, year, preferences.data, {
      accounts: accounts.data,
      cards: cards.data,
      categories: categories.data,
    });
    form.setValue("kind", nextKind, { shouldDirty: true, shouldValidate: true });

    if (nextKind === "CARD_PAYMENT" && occurredAt?.includes("T")) {
      form.setValue("occurredAt", occurredAt.slice(0, 10), { shouldDirty: true, shouldValidate: true });
    }
    if (nextKind !== "CARD_PAYMENT" && occurredAt && !occurredAt.includes("T")) {
      form.setValue("occurredAt", `${occurredAt}T00:00`, { shouldDirty: true, shouldValidate: true });
    }
    if (nextKind === "CARD_EXPENSE" && !form.getValues("installmentCount")) {
      form.setValue("installmentCount", 1, { shouldDirty: true, shouldValidate: true });
    }
    if (nextKind === "CARD_EXPENSE") {
      form.setValue("cardId", defaults.cardId, { shouldDirty: true, shouldValidate: true });
      form.setValue("categoryId", defaults.categoryId, { shouldDirty: true, shouldValidate: true });
      form.setValue("installmentCount", defaults.installmentCount, { shouldDirty: true, shouldValidate: true });
    }
    if (nextKind === "EXPENSE" || nextKind === "INCOME") {
      form.setValue("accountId", defaults.accountId, { shouldDirty: true, shouldValidate: true });
      form.setValue("categoryId", defaults.categoryId, { shouldDirty: true, shouldValidate: true });
    }
    if (nextKind === "ADJUSTMENT") {
      form.setValue("accountId", defaults.accountId, { shouldDirty: true, shouldValidate: true });
      form.setValue("categoryId", undefined, { shouldDirty: true, shouldValidate: true });
    }
    if (nextKind === "TRANSFER") {
      form.setValue("accountId", defaults.accountId, { shouldDirty: true, shouldValidate: true });
      form.setValue("targetAccountId", defaults.targetAccountId, { shouldDirty: true, shouldValidate: true });
      form.setValue("categoryId", undefined, { shouldDirty: true, shouldValidate: true });
    }
    if (nextKind === "CARD_PAYMENT") {
      form.setValue("cardId", defaults.cardId, { shouldDirty: true, shouldValidate: true });
      form.setValue("accountId", defaults.accountId, { shouldDirty: true, shouldValidate: true });
      form.setValue("categoryId", undefined, { shouldDirty: true, shouldValidate: true });
      if (!form.getValues("paymentMonth")) {
        form.setValue("paymentMonth", nextMonthPeriod(month, year).month, { shouldDirty: true, shouldValidate: true });
      }
      if (!form.getValues("paymentYear")) {
        form.setValue("paymentYear", nextMonthPeriod(month, year).year, { shouldDirty: true, shouldValidate: true });
      }
    }
  };

  const save = useAsyncMutation({
    mutationFn: (values: Values): Promise<unknown> => {
      if (values.kind === "CARD_EXPENSE") {
        const participantAmount = roundMoney(Number(values.participantAmount ?? 0));
        const creatorAmount = roundMoney(values.amount - participantAmount);
        return api<Expense>(editing?.kind === "card-expense" ? `/expenses/${editing.id}` : "/expenses", {
          method: editing?.kind === "card-expense" ? "PUT" : "POST",
          body: {
            name: values.title?.trim(),
            amount: values.amount,
            installmentCount: values.installmentCount || 1,
            purchaseDate: normalizeDateTime(values.occurredAt),
            description: null,
            cardId: values.cardId,
            categoryId: values.categoryId || null,
            share: values.shareEnabled
              ? {
                  participantUserId: values.participantUserId,
                  creatorAmount,
                  participantAmount,
                }
              : undefined,
          },
        });
      }

      if (values.kind === "TRANSFER") {
        return api(`/accounts/${values.accountId}/transfers`, {
          method: "POST",
          body: {
            targetAccountId: values.targetAccountId,
            amount: values.amount,
            occurredAt: normalizeDateTime(values.occurredAt),
            description: values.title?.trim() || null,
          },
        });
      }

      if (values.kind === "CARD_PAYMENT") {
        const paymentId = editing?.kind === "card-payment" ? editing.id : null;
        const cardId = editing?.kind === "card-payment" ? editing.cardId : values.cardId;

        return api(`/cards/${cardId}/payments${paymentId ? `/${paymentId}` : ""}`, {
          method: paymentId ? "PUT" : "POST",
          body: {
            accountId: values.accountId,
            month: values.paymentMonth,
            year: values.paymentYear,
            amount: values.amount,
            paymentDate: values.occurredAt.slice(0, 10),
            description: values.title?.trim() || null,
          },
        });
      }

      const transactionId = editing?.kind === "transaction" ? editing.id : null;
      return api<Transaction>(transactionId ? `/transactions/${transactionId}` : "/transactions", {
        method: transactionId ? "PUT" : "POST",
        body: {
          type: values.kind,
          amount: values.amount,
          occurredAt: normalizeDateTime(values.occurredAt),
          description: values.title?.trim(),
          accountId: values.accountId,
          categoryId: values.kind === "ADJUSTMENT" ? null : values.categoryId || null,
        },
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Lançamento atualizado" : "Lançamento criado");
      notifyFinanceUpdated();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(
            (values) => save.mutate(values),
            () => toast.error("Confira os campos obrigatórios antes de salvar."),
          )}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={kind}
                disabled={!!editing}
                onValueChange={(value) => {
                  const nextKind = value as MovementKind;
                  switchMovementKind(nextKind);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPENSE">Despesa em conta</SelectItem>
                  <SelectItem value="CARD_EXPENSE">Compra no cartão</SelectItem>
                  <SelectItem value="INCOME">Receita</SelectItem>
                  <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
                  <SelectItem value="TRANSFER">Transferência</SelectItem>
                  <SelectItem value="CARD_PAYMENT">Pagamento de fatura</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor</Label>
              <CurrencyAmountInput
                value={form.watch("amount")}
                onChange={(value) => form.setValue("amount", value, { shouldDirty: true, shouldValidate: true })}
              />
              <FieldError message={errors.amount?.message} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Descrição{kind === "TRANSFER" || kind === "CARD_PAYMENT" ? " (opcional)" : ""}</Label>
              <Input {...form.register("title")} placeholder="ex: Mercado, salário, farmácia" />
              <FieldError message={errors.title?.message} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>{kind === "CARD_PAYMENT" ? "Data do pagamento" : "Quando"}</Label>
              <Input type={kind === "CARD_PAYMENT" ? "date" : "datetime-local"} {...form.register("occurredAt")} />
              <FieldError message={errors.occurredAt?.message} />
            </div>

            {kind === "CARD_EXPENSE" && (
              <>
                <div className="space-y-1.5">
                  <Label>Cartão</Label>
                  <Select
                    value={form.watch("cardId") ? String(form.watch("cardId")) : undefined}
                    onValueChange={(value) => form.setValue("cardId", Number(value), { shouldDirty: true, shouldValidate: true })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeCards.map((card) => (
                        <SelectItem key={card.id} value={String(card.id)}>
                          {card.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError message={errors.cardId?.message} />
                  {!activeCards.length && <ResourceHint>Nenhum cartão ativo disponível.</ResourceHint>}
                </div>
                <div className="space-y-1.5">
                  <Label>Parcelas</Label>
                  <Input type="number" min={1} {...form.register("installmentCount")} />
                  <FieldError message={errors.installmentCount?.message} />
                </div>
                <div className="col-span-2 rounded-lg border bg-muted/20 p-3">
                  <label className="flex cursor-pointer items-start gap-3">
                    <Checkbox
                      checked={!!shareEnabled}
                      onCheckedChange={(checked) => {
                        const enabled = checked === true;
                        form.setValue("shareEnabled", enabled, { shouldDirty: true, shouldValidate: true });
                        if (!enabled) {
                          form.setValue("participantUserId", undefined, { shouldDirty: true, shouldValidate: true });
                          form.setValue("participantAmount", undefined, { shouldDirty: true, shouldValidate: true });
                        }
                      }}
                    />
                    <span>
                      <span className="block text-sm font-medium">Dividir compra</span>
                      <span className="block text-xs text-muted-foreground">
                        A compra fica no seu cartão e a outra pessoa aparece em Acertos.
                      </span>
                    </span>
                  </label>

                  {shareEnabled && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Conexão</Label>
                        <Select
                          value={form.watch("participantUserId") ? String(form.watch("participantUserId")) : undefined}
                          onValueChange={(value) =>
                            form.setValue("participantUserId", Number(value), { shouldDirty: true, shouldValidate: true })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeConnections.map((connection) => {
                              const person = getConnectionPerson(connection, user?.id);
                              return (
                                <SelectItem key={connection.id} value={String(person.id)}>
                                  {person.name}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <FieldError message={errors.participantUserId?.message} />
                        {!activeConnections.length && <ResourceHint>Nenhuma conexão aceita disponível.</ResourceHint>}
                      </div>
                      <div className="space-y-1.5">
                        <Label>Valor da outra pessoa</Label>
                        <CurrencyAmountInput
                          value={form.watch("participantAmount")}
                          onChange={(value) => form.setValue("participantAmount", value, { shouldDirty: true, shouldValidate: true })}
                        />
                        <FieldError message={errors.participantAmount?.message} />
                        <p className="text-xs text-muted-foreground">
                          Sua parte: {formatBRL(Math.max(0, creatorShareAmount))}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {kind === "TRANSFER" && (
              <>
                <div className="space-y-1.5">
                  <Label>Conta de origem</Label>
                  <AccountSelect
                    value={form.watch("accountId")}
                    accounts={activeAccounts}
                    onChange={(value) => form.setValue("accountId", value, { shouldDirty: true, shouldValidate: true })}
                  />
                  <FieldError message={errors.accountId?.message} />
                  {!activeAccounts.length && <ResourceHint>Nenhuma conta ativa disponível.</ResourceHint>}
                </div>
                <div className="space-y-1.5">
                  <Label>Conta de destino</Label>
                  <AccountSelect
                    value={form.watch("targetAccountId")}
                    accounts={activeAccounts.filter((account) => account.id !== form.watch("accountId"))}
                    onChange={(value) => form.setValue("targetAccountId", value, { shouldDirty: true, shouldValidate: true })}
                  />
                  <FieldError message={errors.targetAccountId?.message} />
                </div>
              </>
            )}

            {kind === "CARD_PAYMENT" && (
              <>
                <div className="space-y-1.5">
                  <Label>Cartão</Label>
                  <Select
                    value={form.watch("cardId") ? String(form.watch("cardId")) : undefined}
                    onValueChange={(value) => form.setValue("cardId", Number(value), { shouldDirty: true, shouldValidate: true })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeCards.map((card) => (
                        <SelectItem key={card.id} value={String(card.id)}>
                          {card.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError message={errors.cardId?.message} />
                  {!activeCards.length && <ResourceHint>Nenhum cartão ativo disponível.</ResourceHint>}
                </div>
                <div className="space-y-1.5">
                  <Label>Conta de pagamento</Label>
                  <AccountSelect
                    value={form.watch("accountId")}
                    accounts={activeAccounts}
                    onChange={(value) => form.setValue("accountId", value, { shouldDirty: true, shouldValidate: true })}
                  />
                  <FieldError message={errors.accountId?.message} />
                  {!activeAccounts.length && <ResourceHint>Nenhuma conta ativa disponível.</ResourceHint>}
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Fatura</Label>
                  <Select
                    value={`${form.watch("paymentMonth") ?? month}-${form.watch("paymentYear") ?? year}`}
                    onValueChange={(value) => {
                      const [paymentMonth, paymentYear] = value.split("-").map(Number);
                      form.setValue("paymentMonth", paymentMonth, { shouldDirty: true, shouldValidate: true });
                      form.setValue("paymentYear", paymentYear, { shouldDirty: true, shouldValidate: true });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map((option) => (
                        <SelectItem key={option.key} value={option.key}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError message={errors.paymentMonth?.message} />
                </div>
              </>
            )}

            {(kind === "INCOME" || kind === "EXPENSE" || kind === "ADJUSTMENT") && (
              <div className="space-y-1.5">
                <Label>Conta</Label>
                <AccountSelect
                  value={form.watch("accountId")}
                  accounts={activeAccounts}
                  onChange={(value) => form.setValue("accountId", value, { shouldDirty: true, shouldValidate: true })}
                />
                <FieldError message={errors.accountId?.message} />
                {!activeAccounts.length && <ResourceHint>Nenhuma conta ativa disponível.</ResourceHint>}
              </div>
            )}

            {showsCategory && (
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select
                  value={form.watch("categoryId") ? String(form.watch("categoryId")) : "_none"}
                  onValueChange={(value) =>
                    form.setValue("categoryId", value === "_none" ? undefined : Number(value), { shouldDirty: true })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Sem categoria</SelectItem>
                    {filteredCategories.map((category) => (
                      <SelectItem key={category.id} value={String(category.id)}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={save.isPending}
              className="h-11 w-full rounded-2xl shadow-[0_14px_34px_rgba(24,201,87,0.24)] sm:w-auto sm:min-w-32"
            >
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AccountSelect({
  value,
  accounts,
  onChange,
}: {
  value?: number;
  accounts: Array<{ id: number; name: string }>;
  onChange: (value: number) => void;
}) {
  return (
    <Select value={value ? String(value) : undefined} onValueChange={(next) => onChange(Number(next))}>
      <SelectTrigger>
        <SelectValue placeholder="Selecione" />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((account) => (
          <SelectItem key={account.id} value={String(account.id)}>
            {account.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

function ResourceHint({ children }: { children: string }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function movementDefaults(
  kind: MovementKind,
  month: number,
  year: number,
  preferences?: UserPreferences | null,
  resources: { accounts?: Account[]; cards?: CreditCardRecord[]; categories?: Category[] } = {},
): Values {
  const paymentPeriod = kind === "CARD_PAYMENT" ? nextMonthPeriod(month, year) : { month, year };
  const defaultAccountId = validActiveId(preferences?.defaultAccountId, resources.accounts);
  const defaultTargetAccountId = validActiveId(preferences?.defaultTargetAccountId, resources.accounts);
  const defaultCardId = validActiveId(preferences?.defaultCardId, resources.cards);
  const defaultExpenseCategoryId = validCategoryId(preferences?.defaultExpenseCategoryId, resources.categories, "EXPENSE");
  const defaultIncomeCategoryId = validCategoryId(preferences?.defaultIncomeCategoryId, resources.categories, "INCOME");
  const defaults: Values = {
    kind,
    title: "",
    amount: 0,
    occurredAt: kind === "CARD_PAYMENT" ? todayIsoDate() : nowIsoDateTime(),
    installmentCount: Math.max(1, preferences?.defaultInstallmentCount ?? 1),
    shareEnabled: false,
    paymentMonth: paymentPeriod.month,
    paymentYear: paymentPeriod.year,
  };

  if (kind === "EXPENSE") {
    defaults.accountId = defaultAccountId;
    defaults.categoryId = defaultExpenseCategoryId;
  }
  if (kind === "CARD_EXPENSE") {
    defaults.cardId = defaultCardId;
    defaults.categoryId = defaultExpenseCategoryId;
  }
  if (kind === "INCOME") {
    defaults.accountId = defaultAccountId;
    defaults.categoryId = defaultIncomeCategoryId;
  }
  if (kind === "ADJUSTMENT") {
    defaults.accountId = defaultAccountId;
  }
  if (kind === "TRANSFER") {
    defaults.accountId = defaultAccountId;
    defaults.targetAccountId = defaultTargetAccountId;
  }
  if (kind === "CARD_PAYMENT") {
    defaults.accountId = defaultAccountId;
    defaults.cardId = defaultCardId;
  }

  return defaults;
}

function validActiveId<T extends { id: number; active: boolean }>(id: number | null | undefined, items?: T[]) {
  if (!id || !items?.some((item) => item.id === id && item.active)) return undefined;
  return id;
}

function validCategoryId(id: number | null | undefined, categories: Category[] | undefined, type: "INCOME" | "EXPENSE") {
  if (!id || !categories?.some((category) => category.id === id && category.active && category.type === type)) {
    return undefined;
  }
  return id;
}

function roundMoney(value: number) {
  return Math.round(Number(value) * 100) / 100;
}

function normalizeDateTime(value: string) {
  return value.includes("T") ? value : `${value}T00:00`;
}

function isEditableTransactionType(type: TransactionType): type is Extract<MovementKind, "INCOME" | "EXPENSE" | "ADJUSTMENT"> {
  return type === "INCOME" || type === "EXPENSE" || type === "ADJUSTMENT";
}

function getConnectionPerson(connection: Connection, currentUserId?: number) {
  if (connection.requesterUserId === currentUserId) {
    return { id: connection.targetUserId, name: connection.targetName };
  }
  return { id: connection.requesterUserId, name: connection.requesterName };
}

function nextMonthPeriod(month: number, year: number) {
  if (month === 12) return { month: 1, year: year + 1 };
  return { month: month + 1, year };
}

function useMonthOptions(selectedMonth: number, selectedYear: number) {
  const out: { key: string; label: string }[] = [];
  for (let offset = -6; offset < 18; offset += 1) {
    const date = new Date(selectedYear, selectedMonth - 1 - offset, 1);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    out.push({ key: `${month}-${year}`, label: monthLabel(month, year) });
  }
  return out;
}
