import { useAsyncData, useAsyncMutation } from "@/hooks/use-async-data";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Pencil,
  Plus,
  Search,
  Trash2,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { fetchAccounts, fetchCardPayments, fetchCards, fetchCardStatement, fetchCategories, fetchConnections, fetchExpenses, fetchSettlementItems, fetchTransactions } from "@/lib/queries";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { CardPayment, CardStatement, Connection, Expense, SettlementItem, Transaction, TransactionType } from "@/lib/types";
import { cardPaymentTitle, transactionTitle } from "@/lib/movement-labels";
import { currentMonthYear, formatBRL, formatDate, formatDateTime, monthLabel, nowIsoDateTime, todayIsoDate } from "@/lib/format";
import { ConfirmAction } from "@/components/confirm-action";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyAmountInput } from "@/components/currency-amount-input";
import { Checkbox } from "@/components/ui/checkbox";
import { PeriodPicker, monthName } from "@/components/period-picker";

type MovementKind = "INCOME" | "EXPENSE" | "CARD_EXPENSE" | "ADJUSTMENT" | "TRANSFER" | "CARD_PAYMENT";
type MovementItem =
  | {
      kind: "transaction";
      id: number;
      title: string;
      amount: number;
      occurredAt: string;
      type: TransactionType;
      accountId: number;
      categoryId?: number | null;
    }
  | {
      kind: "card-expense";
      key: string;
      id: number;
      title: string;
      amount: number;
      occurredAt: string;
      cardId?: number | null;
      categoryId?: number | null;
      installmentCount: number;
      installmentNumber: number;
      dueDate?: string | null;
      statementMonth: number;
      statementYear: number;
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
    const requiresTitle = values.kind === "INCOME" || values.kind === "EXPENSE" || values.kind === "CARD_EXPENSE" || values.kind === "ADJUSTMENT";

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

export default function TransactionsPage() {
  const { user } = useAuth();
  const [{ month, year }, setPeriod] = useState(currentMonthYear);
  const cardStatementPeriod = nextMonthPeriod(month, year);
  const cardPaymentPeriods = uniquePeriods([
    { month, year },
    cardStatementPeriod,
  ]);
  const cardPaymentPeriodKey = cardPaymentPeriods.map((period) => `${period.month}-${period.year}`).join("|");
  const tx = useAsyncData(() => fetchTransactions({ month, year }), [month, year], {
    cacheKey: `transactions:${month}:${year}`,
  });
  const accounts = useAsyncData(() => fetchAccounts(), [], { cacheKey: "accounts" });
  const cards = useAsyncData(() => fetchCards(), [], { cacheKey: "cards" });
  const activeCards = (cards.data ?? []).filter((card) => card.active);
  const activeCardsKey = activeCards.map((card) => card.id).join("|");
  const cardsReady = !cards.isLoading && Boolean(cards.data);
  const cardStatements = useAsyncData(
    () =>
      activeCards.length
        ? Promise.all(
            activeCards.map((card) =>
              fetchCardStatement(card.id, cardStatementPeriod.month, cardStatementPeriod.year).catch(() => null),
            ),
          )
        : Promise.resolve([]),
    [activeCardsKey, cardStatementPeriod.month, cardStatementPeriod.year],
    {
      enabled: cardsReady,
      initialData: [],
      cacheKey: `transaction-card-statements:${activeCardsKey}:${cardStatementPeriod.month}:${cardStatementPeriod.year}`,
    },
  );
  const cardPayments = useAsyncData(
    () =>
      activeCards.length
        ? Promise.all(
            activeCards.flatMap((card) =>
              cardPaymentPeriods.map((period) =>
                fetchCardPayments(card.id, period.month, period.year).catch(() => [] as CardPayment[]),
              ),
            ),
          ).then((paymentGroups) => paymentGroups.flat())
        : Promise.resolve([]),
    [activeCardsKey, cardPaymentPeriodKey],
    {
      enabled: cardsReady,
      initialData: [],
      cacheKey: `transaction-card-payments:${activeCardsKey}:${cardPaymentPeriodKey}`,
    },
  );
  const expenses = useAsyncData(() => fetchExpenses({}), [], { cacheKey: "expenses:all", staleMs: 60_000 });
  const categories = useAsyncData(() => fetchCategories(), [], { cacheKey: "categories", staleMs: 60_000 });
  const connections = useAsyncData(() => fetchConnections(), [], { cacheKey: "connections", staleMs: 60_000 });
  const settlementItems = useAsyncData(() => fetchSettlementItems(), [], { cacheKey: "settlement-items", staleMs: 30_000 });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MovementItem | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: movementDefaults("CARD_EXPENSE", month, year),
  });
  const kind = form.watch("kind");
  const shareEnabled = form.watch("shareEnabled");
  const participantAmount = Number(form.watch("participantAmount") ?? 0);
  const creatorShareAmount = roundMoney(Number(form.watch("amount") ?? 0) - participantAmount);
  const errors = form.formState.errors;

  const switchMovementKind = (nextKind: MovementKind) => {
    const occurredAt = form.getValues("occurredAt");
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
    if (nextKind === "CARD_PAYMENT") {
      if (!form.getValues("paymentMonth")) {
        form.setValue("paymentMonth", cardStatementPeriod.month, { shouldDirty: true, shouldValidate: true });
      }
      if (!form.getValues("paymentYear")) {
        form.setValue("paymentYear", cardStatementPeriod.year, { shouldDirty: true, shouldValidate: true });
      }
    }
  };

  const reloadFinanceData = () => {
    tx.reload();
    cardStatements.reload();
    cardPayments.reload();
    expenses.reload();
    accounts.reload();
    cards.reload();
    categories.reload();
    settlementItems.reload();
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

      return api<Transaction>("/transactions", {
        method: "POST",
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
      reloadFinanceData();
      setOpen(false);
      setEditing(null);
      form.reset(movementDefaults("CARD_EXPENSE", month, year));
    },
    onError: (e) => toast.error(e.message),
  });

  const removeTransaction = useAsyncMutation({
    mutationFn: (id: number) => api(`/transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Lançamento removido");
      reloadFinanceData();
    },
    onError: (e) => toast.error(e.message),
  });

  const removeExpense = useAsyncMutation({
    mutationFn: (id: number) => api(`/expenses/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Compra removida");
      reloadFinanceData();
    },
    onError: (e) => toast.error(e.message),
  });

  const removeCardPayment = useAsyncMutation({
    mutationFn: ({ cardId, paymentId }: { cardId: number; paymentId: number }) =>
      api(`/cards/${cardId}/payments/${paymentId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Pagamento removido");
      reloadFinanceData();
    },
    onError: (e) => toast.error(e.message),
  });

  const monthOptions = useMonthOptions(month, year);
  const previousPeriod = addMonthsToPeriod(month, year, -1);
  const nextPeriod = addMonthsToPeriod(month, year, 1);
  const activeAccounts = (accounts.data ?? []).filter((account) => account.active);
  const activeConnections = connections.data ?? [];
  const showsCategory = kind === "INCOME" || kind === "EXPENSE" || kind === "CARD_EXPENSE";
  const filteredCategories = (categories.data ?? []).filter((category) => {
    if (!category.active || !showsCategory) return false;
    if (kind === "INCOME") return category.type === "INCOME";
    return category.type === "EXPENSE";
  });
  const accountName = (id: number) => accounts.data?.find((account) => account.id === id)?.name ?? `Conta #${id}`;
  const cardName = (id?: number | null) => cards.data?.find((card) => card.id === id)?.name ?? `Cartão #${id ?? ""}`;
  const categoryName = (id?: number | null) => {
    if (!id) return "Sem categoria";
    return categories.data?.find((category) => category.id === id)?.name ?? `Categoria #${id}`;
  };
  const expensesById = new Map((expenses.data ?? []).map((expense) => [expense.id, expense]));
  const settlementItemByExpenseId = useMemo(() => {
    const map = new Map<number, SettlementItem>();
    for (const item of settlementItems.data ?? []) {
      map.set(item.expenseId, item);
    }
    return map;
  }, [settlementItems.data]);
  const items = mergeMovements(tx.data ?? [], cardStatements.data ?? [], expensesById, cardPayments.data ?? []);
  const normalizedSearchQuery = normalizeSearch(searchQuery);
  const filteredItems = normalizedSearchQuery
    ? items.filter((item) =>
        normalizeSearch(
          [
            item.title,
            movementDate(item),
            movementMeta(item, accountName, cardName),
            movementCategoryName(item, categoryName),
            formatBRL(Math.abs(item.amount)),
            item.kind,
          ].join(" "),
        ).includes(normalizedSearchQuery),
      )
    : items;
  const movementsLoading = tx.isLoading || cards.isLoading;
  const supplementalLoading = cardStatements.isLoading || cardPayments.isLoading || expenses.isLoading;
  const deleteMovement = (item: MovementItem) => {
    if (item.kind === "card-expense" && settlementItemByExpenseId.get(item.id)?.status === "SETTLED") {
      toast.error("Compras compartilhadas já quitadas não podem ser removidas.");
      return;
    }
    if (item.kind === "card-expense") {
      removeExpense.mutate(item.id);
      return;
    }
    if (item.kind === "card-payment") {
      removeCardPayment.mutate({ cardId: item.cardId, paymentId: item.id });
      return;
    }
    removeTransaction.mutate(item.id);
  };
  const deleteMovementTitle = (item: MovementItem) => {
    if (item.kind === "card-expense") return "Remover compra?";
    if (item.kind === "card-payment") return "Remover pagamento?";
    return "Remover lançamento?";
  };
  const deleteMovementDescription = (item: MovementItem) => {
    if (item.kind === "card-expense") return "A compra inteira será removida, incluindo as demais parcelas.";
    if (item.kind === "card-payment") return "Este pagamento de fatura será removido.";
    return "Este lançamento será removido.";
  };

  const openNew = () => {
    setEditing(null);
    form.reset(movementDefaults("CARD_EXPENSE", month, year));
    setOpen(true);
  };

  const openEdit = (item: MovementItem) => {
    if (item.kind === "card-payment") {
      setEditing(item);
      form.reset({
        ...movementDefaults("CARD_PAYMENT", month, year),
        title: item.title,
        amount: item.amount,
        occurredAt: item.occurredAt.slice(0, 10),
        accountId: item.accountId,
        cardId: item.cardId,
        paymentMonth: item.paymentMonth,
        paymentYear: item.paymentYear,
      });
      setOpen(true);
      return;
    }
    if (item.kind !== "card-expense") {
      toast.info("Este tipo de lançamento não tem endpoint de edição na API.");
      return;
    }
    const sharedItem = settlementItemByExpenseId.get(item.id);
    if (sharedItem?.status === "SETTLED") {
      toast.error("Compras compartilhadas já quitadas não podem ser editadas.");
      return;
    }
    const expense = expensesById.get(item.id);
    if (!expense) {
      toast.info("Aguarde o carregamento da compra completa para editar.");
      return;
    }
    setEditing(item);
    form.reset({
      ...movementDefaults("CARD_EXPENSE", month, year),
      title: expense.name,
      amount: expense.amount,
      occurredAt: expense.purchaseDate.slice(0, 16),
      cardId: expense.cardId ?? undefined,
      categoryId: expense.categoryId ?? undefined,
      installmentCount: expense.installmentCount,
      shareEnabled: !!sharedItem,
      participantUserId: sharedItem?.participantUserId,
      participantAmount: sharedItem?.participantAmount,
    });
    setOpen(true);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-sm text-muted-foreground capitalize">{monthLabel(month, year)}</p>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">Todos os lançamentos</h1>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
            <Button
              type="button"
              variant={searchOpen ? "secondary" : "ghost"}
              size="icon"
              aria-label={searchOpen ? "Fechar busca" : "Buscar movimentação"}
              aria-pressed={searchOpen}
              className="h-10 w-10 rounded-2xl"
              onClick={() => {
                setSearchOpen((open) => !open);
                if (searchOpen) setSearchQuery("");
              }}
            >
              <Search className="h-5 w-5" />
            </Button>
            <Dialog
              open={open}
              onOpenChange={(next) => {
                setOpen(next);
                if (!next) setEditing(null);
              }}
            >
            <DialogTrigger asChild>
              <Button onClick={openNew} className="flex-1 sm:flex-none">
                <Plus className="h-4 w-4" /> Novo
              </Button>
            </DialogTrigger>
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
                    <Label>Descricao{kind === "TRANSFER" || kind === "CARD_PAYMENT" ? " (opcional)" : ""}</Label>
                    <Input {...form.register("title")} placeholder="ex: Mercado, salario, farmacia" />
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
                          disabled={editing?.kind === "card-payment"}
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
                                onChange={(value) =>
                                  form.setValue("participantAmount", value, { shouldDirty: true, shouldValidate: true })
                                }
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
                  <Button type="submit" disabled={save.isPending}>
                    {save.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {searchOpen && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar por descrição, categoria, conta, cartão, data ou valor"
              className="h-12 rounded-2xl bg-card pl-10 pr-10 text-base shadow-sm md:text-sm"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-[3rem_minmax(0,1fr)_3rem] items-center gap-2 rounded-2xl bg-card/80 p-2 shadow-sm ring-1 ring-border/70 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <Button
            type="button"
            variant="ghost"
            className="h-12 justify-center rounded-xl px-0 text-muted-foreground hover:text-foreground sm:justify-start sm:px-2 md:px-3"
            onClick={() => setPeriod(previousPeriod)}
            aria-label={`Ir para ${monthName(previousPeriod.month, previousPeriod.year)}`}
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="hidden truncate text-base font-medium sm:inline md:text-sm">{monthName(previousPeriod.month, previousPeriod.year)}</span>
          </Button>

          <PeriodPicker month={month} year={year} onChange={setPeriod} className="w-full min-w-0 px-3" />

          <Button
            type="button"
            variant="ghost"
            className="h-12 justify-center rounded-xl px-0 text-muted-foreground hover:text-foreground sm:justify-end sm:px-2 md:px-3"
            onClick={() => setPeriod(nextPeriod)}
            aria-label={`Ir para ${monthName(nextPeriod.month, nextPeriod.year)}`}
          >
            <span className="hidden truncate text-base font-medium sm:inline md:text-sm">{monthName(nextPeriod.month, nextPeriod.year)}</span>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {movementsLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando...</p>
          ) : !items.length ? (
            <div className="grid min-h-[18rem] place-items-center p-6 text-center">
              <div>
                <p className="text-xl font-semibold tracking-tight">
                  {supplementalLoading ? "Carregando faturas e pagamentos..." : "Nenhum lançamento no período"}
                </p>
                {!supplementalLoading && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Toque em <span className="font-semibold text-primary">+</span> para adicionar um lançamento.
                  </p>
                )}
              </div>
            </div>
          ) : !filteredItems.length ? (
            <div className="grid min-h-[16rem] place-items-center p-6 text-center">
              <div>
                <p className="text-xl font-semibold tracking-tight">Nenhum lançamento encontrado</p>
                <p className="mt-2 text-sm text-muted-foreground">Tente buscar por descrição, conta, cartão, data ou valor.</p>
              </div>
            </div>
          ) : (
            <>
              {supplementalLoading && (
                <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
                  Atualizando faturas e pagamentos...
                </div>
              )}
              <ul className="divide-y divide-border">
              {filteredItems.map((item) => {
                const sharedItem = item.kind === "card-expense" ? settlementItemByExpenseId.get(item.id) : undefined;
                const isSettledSharedExpense = sharedItem?.status === "SETTLED";
                return (
                  <li key={movementKey(item)} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 gap-y-2 p-4 sm:flex sm:items-center sm:gap-3">
                    <div className={`grid h-9 w-9 shrink-0 place-items-center self-start rounded-full sm:self-center ${movementIconBackground(item)}`}>
                      {movementIcon(item)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <div className="min-w-0 max-w-full flex-1 break-words text-sm font-medium leading-snug sm:truncate">{item.title}</div>
                        {sharedItem && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            <UsersRound className="h-3 w-3" />
                            {isSettledSharedExpense ? "Quitada" : "Dividida"}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs leading-relaxed text-muted-foreground sm:truncate">
                        {movementDate(item)} - {movementMeta(item, accountName, cardName)}
                      </div>
                    </div>
                    <div className="col-start-2 flex min-w-0 items-center justify-between gap-3 sm:col-start-auto sm:shrink-0 sm:justify-end">
                      <div className={`shrink-0 whitespace-nowrap text-base font-semibold tabular-nums sm:text-sm ${movementAmountClass(item)}`}>
                        {movementAmountPrefix(item)}
                        {formatBRL(Math.abs(item.amount))}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {(item.kind === "card-expense" || item.kind === "card-payment") && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                        {canDeleteMovement(item, sharedItem) && (
                          <ConfirmAction
                            title={deleteMovementTitle(item)}
                            description={deleteMovementDescription(item)}
                            confirmLabel="Remover"
                            destructive
                            onConfirm={() => deleteMovement(item)}
                          >
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </ConfirmAction>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
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

function mergeMovements(
  transactions: Transaction[],
  statements: Array<CardStatement | null>,
  expensesById: Map<number, Expense>,
  cardPayments: CardPayment[],
): MovementItem[] {
  const transactionsById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const uniqueCardPayments = Array.from(new Map(cardPayments.map((payment) => [`${payment.cardId}-${payment.id}`, payment])).values());
  const resolvedPaymentTransactionIds = new Set(
    uniqueCardPayments
      .map((payment) => payment.transactionId)
      .filter((transactionId): transactionId is number => typeof transactionId === "number"),
  );

  return [
    ...transactions
      .filter((transaction) => transaction.type !== "CARD_PAYMENT" || !resolvedPaymentTransactionIds.has(transaction.id))
      .map((transaction): MovementItem => ({
        kind: "transaction",
        id: transaction.id,
        title: transactionTitle(transaction),
        amount: transaction.amount,
        occurredAt: transaction.occurredAt,
        type: transaction.type,
        accountId: transaction.accountId,
        categoryId: transaction.categoryId,
      })),
    ...statements.flatMap((statement) => {
      if (!statement) return [];
      return statement.installments.map((installment): MovementItem => {
        const expense = expensesById.get(installment.expenseId);
        const totalInstallments = installment.totalInstallments ?? expense?.installmentCount ?? installment.installmentNumber;
        return {
          kind: "card-expense",
          key: `card-expense-${statement.cardId}-${installment.expenseId}-${installment.installmentNumber}-${statement.month}-${statement.year}`,
          id: installment.expenseId,
          title: installment.expenseName,
          amount: installment.amount,
          occurredAt: expense?.purchaseDate ?? installment.dueDate ?? statement.dueDate,
          cardId: installment.cardId ?? statement.cardId,
          categoryId: expense?.categoryId,
          installmentCount: totalInstallments,
          installmentNumber: installment.installmentNumber,
          dueDate: installment.dueDate ?? statement.dueDate,
          statementMonth: statement.month,
          statementYear: statement.year,
        };
      });
    }),
    ...uniqueCardPayments.map((payment): MovementItem => {
      const paymentTransaction = payment.transactionId ? transactionsById.get(payment.transactionId) : undefined;
      return {
        kind: "card-payment",
        id: payment.id,
        title: cardPaymentTitle(payment.description),
        amount: payment.amount,
        occurredAt: paymentTransaction?.occurredAt ?? payment.paymentDate,
        cardId: payment.cardId,
        accountId: payment.accountId,
        paymentMonth: payment.month,
        paymentYear: payment.year,
        transactionId: payment.transactionId,
      };
    }),
  ].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}

function movementDefaults(kind: MovementKind, month: number, year: number): Values {
  const paymentPeriod = kind === "CARD_PAYMENT" ? nextMonthPeriod(month, year) : { month, year };
  return {
    kind,
    title: "",
    amount: 0,
    occurredAt: kind === "CARD_PAYMENT" ? todayIsoDate() : nowIsoDateTime(),
    installmentCount: 1,
    shareEnabled: false,
    paymentMonth: paymentPeriod.month,
    paymentYear: paymentPeriod.year,
  };
}

function roundMoney(value: number) {
  return Math.round(Number(value) * 100) / 100;
}

function normalizeDateTime(value: string) {
  return value.includes("T") ? value : `${value}T00:00`;
}

function canDeleteMovement(item: MovementItem, sharedItem?: SettlementItem) {
  if (sharedItem?.status === "SETTLED") return false;
  if (item.kind === "card-expense") return true;
  if (item.kind === "card-payment") return true;
  return item.type !== "CARD_PAYMENT";
}

function getConnectionPerson(connection: Connection, currentUserId?: number) {
  if (connection.requesterUserId === currentUserId) {
    return { id: connection.targetUserId, name: connection.targetName };
  }
  return { id: connection.requesterUserId, name: connection.requesterName };
}

function movementKey(item: MovementItem) {
  return item.kind === "card-expense" ? item.key : `${item.kind}-${item.id}`;
}

function movementDate(item: MovementItem) {
  if (item.kind === "card-payment") return item.occurredAt.includes("T") ? formatDateTime(item.occurredAt) : formatDate(item.occurredAt);
  if (item.kind === "card-expense") return item.occurredAt.includes("T") ? formatDateTime(item.occurredAt) : formatDate(item.occurredAt);
  return formatDateTime(item.occurredAt);
}

function isInflow(type: TransactionType) {
  return type === "INCOME" || type === "TRANSFER_IN";
}

function isPositiveMovement(item: MovementItem) {
  if (item.kind === "card-expense" || item.kind === "card-payment") return false;
  return isInflow(item.type) || (item.type === "ADJUSTMENT" && item.amount > 0);
}

function movementAmountPrefix(item: MovementItem) {
  return isPositiveMovement(item) ? "+" : "-";
}

function movementAmountClass(item: MovementItem) {
  return isPositiveMovement(item) ? "text-[var(--success)]" : "text-foreground";
}

function movementIconBackground(item: MovementItem) {
  return isPositiveMovement(item) ? "bg-[color-mix(in_oklab,var(--success)_15%,transparent)]" : "bg-accent";
}

function movementIcon(item: MovementItem) {
  if (item.kind === "card-expense") return <CreditCard className="h-4 w-4 text-primary" />;
  if (item.kind === "card-payment") return <WalletCards className="h-4 w-4 text-primary" />;
  if (item.type === "CARD_PAYMENT") return <WalletCards className="h-4 w-4 text-primary" />;
  if (item.type === "TRANSFER_IN" || item.type === "TRANSFER_OUT") return <ArrowLeftRight className="h-4 w-4 text-primary" />;
  if (isPositiveMovement(item)) return <ArrowDownRight className="h-4 w-4 text-[var(--success)]" />;
  return <ArrowUpRight className="h-4 w-4 text-primary" />;
}

function movementMeta(item: MovementItem, accountName: (id: number) => string, cardName: (id?: number | null) => string) {
  if (item.kind === "card-expense") {
    return `${cardName(item.cardId)} - parcela ${item.installmentNumber}/${item.installmentCount} - fatura ${monthLabel(item.statementMonth, item.statementYear)}`;
  }
  if (item.kind === "card-payment") return `Pagamento de fatura - ${accountName(item.accountId)}`;
  if (item.type === "CARD_PAYMENT") return `Pagamento de fatura - ${accountName(item.accountId)}`;
  if (item.type === "TRANSFER_IN") return `Transferência recebida - ${accountName(item.accountId)}`;
  if (item.type === "TRANSFER_OUT") return `Transferência enviada - ${accountName(item.accountId)}`;
  return accountName(item.accountId);
}

function movementCategoryName(item: MovementItem, categoryName: (id?: number | null) => string) {
  if (item.kind === "card-payment") return "";
  return categoryName(item.categoryId);
}

function nextMonthPeriod(month: number, year: number) {
  if (month === 12) return { month: 1, year: year + 1 };
  return { month: month + 1, year };
}

function addMonthsToPeriod(month: number, year: number, amount: number) {
  const date = new Date(year, month - 1 + amount, 1);
  return { month: date.getMonth() + 1, year: date.getFullYear() };
}

function uniquePeriods(periods: Array<{ month: number; year: number }>) {
  return Array.from(new Map(periods.map((period) => [`${period.month}-${period.year}`, period])).values());
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

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
