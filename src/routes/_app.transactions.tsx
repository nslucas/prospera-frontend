import { useAsyncData, useAsyncMutation } from "@/hooks/use-async-data";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  HandCoins,
  Pencil,
  Plus,
  Search,
  Trash2,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import {
  fetchAccounts,
  fetchCardPayments,
  fetchCards,
  fetchCardStatement,
  fetchCategories,
  fetchConnections,
  fetchExpenses,
  fetchSettlementItems,
  fetchTransactions,
  fetchUserPreferences,
} from "@/lib/queries";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useFinanceUpdates } from "@/hooks/use-finance-updates";
import type {
  Account,
  Card as CreditCardRecord,
  CardPayment,
  CardStatement,
  Category,
  Connection,
  Expense,
  MovementKind,
  SettlementItem,
  Transaction,
  TransactionType,
  UserPreferences,
} from "@/lib/types";
import { cardPaymentTitle, transactionTitle } from "@/lib/movement-labels";
import {
  currentMonthYear,
  formatBRL,
  formatDate,
  formatDateTime,
  monthLabel,
  nowIsoDateTime,
  todayIsoDate,
} from "@/lib/format";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CurrencyAmountInput } from "@/components/currency-amount-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PeriodPicker, monthName } from "@/components/period-picker";
import { MovementEntryDialog } from "@/components/movement-entry-dialog";

type MovementItem =
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
    }
  | {
      kind: "settlement";
      id: number;
      title: string;
      amount: number;
      occurredAt: string;
      expenseId: number;
      direction: SettlementItem["direction"];
      status: SettlementItem["status"];
      counterpartyName: string;
    };

type MovementFilter = "ALL" | "INFLOW" | "OUTFLOW" | "CARD" | "TRANSFER" | "SETTLEMENT";

const MOVEMENT_FILTERS: Array<{ value: MovementFilter; label: string }> = [
  { value: "ALL", label: "Tudo" },
  { value: "INFLOW", label: "Entradas" },
  { value: "OUTFLOW", label: "Saídas" },
  { value: "CARD", label: "Cartões" },
  { value: "TRANSFER", label: "Transferências" },
  { value: "SETTLEMENT", label: "Acertos" },
];

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
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["title"],
        message: "Informe uma descrição",
      });
    }
    if (values.kind === "ADJUSTMENT" && values.amount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amount"],
        message: "Ajuste não pode ser zero",
      });
    }
    if (values.kind !== "ADJUSTMENT" && values.amount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amount"],
        message: "Valor deve ser > 0",
      });
    }
    if (values.kind === "CARD_EXPENSE") {
      if (!values.cardId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cardId"],
          message: "Selecione um cartão",
        });
      }
      if (!values.installmentCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["installmentCount"],
          message: "Informe as parcelas",
        });
      }
      if (values.shareEnabled) {
        if (!values.participantUserId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["participantUserId"],
            message: "Selecione uma conexão",
          });
        }
        if (!values.participantAmount || values.participantAmount <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["participantAmount"],
            message: "Valor da outra pessoa deve ser maior que zero",
          });
        }
        if (values.participantAmount && values.participantAmount > values.amount) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["participantAmount"],
            message: "Valor da outra pessoa não pode passar do total",
          });
        }
        const creatorAmount = roundMoney(values.amount - Number(values.participantAmount ?? 0));
        const participantAmount = roundMoney(Number(values.participantAmount ?? 0));
        if (roundMoney(creatorAmount + participantAmount) !== roundMoney(values.amount)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["participantAmount"],
            message: "A divisão precisa fechar com o valor total",
          });
        }
      }
      return;
    }
    if (values.kind === "TRANSFER") {
      if (!values.accountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["accountId"],
          message: "Selecione a conta de origem",
        });
      }
      if (!values.targetAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["targetAccountId"],
          message: "Selecione a conta de destino",
        });
      }
      if (
        values.accountId &&
        values.targetAccountId &&
        values.accountId === values.targetAccountId
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["targetAccountId"],
          message: "Destino deve ser diferente da origem",
        });
      }
      return;
    }
    if (values.kind === "CARD_PAYMENT") {
      if (!values.cardId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cardId"],
          message: "Selecione um cartão",
        });
      }
      if (!values.accountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["accountId"],
          message: "Selecione uma conta",
        });
      }
      if (!values.paymentMonth || !values.paymentYear) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paymentMonth"],
          message: "Selecione a fatura",
        });
      }
      return;
    }
    if (!values.accountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["accountId"],
        message: "Selecione uma conta",
      });
    }
  });
type Values = z.infer<typeof schema>;

export default function TransactionsPage() {
  const { user } = useAuth();
  const [{ month, year }, setPeriod] = useState(currentMonthYear);
  const cardStatementPeriod = nextMonthPeriod(month, year);
  const cardPaymentPeriods = uniquePeriods([{ month, year }, cardStatementPeriod]);
  const cardPaymentPeriodKey = cardPaymentPeriods
    .map((period) => `${period.month}-${period.year}`)
    .join("|");
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
              fetchCardStatement(
                card.id,
                cardStatementPeriod.month,
                cardStatementPeriod.year,
              ).catch(() => null),
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
                fetchCardPayments(card.id, period.month, period.year).catch(
                  () => [] as CardPayment[],
                ),
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
  const expenses = useAsyncData(() => fetchExpenses({}), [], {
    cacheKey: "expenses:all",
    staleMs: 60_000,
  });
  const categories = useAsyncData(() => fetchCategories(), [], {
    cacheKey: "categories",
    staleMs: 60_000,
  });
  const connections = useAsyncData(() => fetchConnections(), [], {
    cacheKey: "connections",
    staleMs: 60_000,
  });
  const settlementItems = useAsyncData(() => fetchSettlementItems(), [], {
    cacheKey: "settlement-items:all",
    staleMs: 30_000,
  });
  const preferences = useAsyncData(() => fetchUserPreferences(), [], {
    cacheKey: "user-preferences",
    staleMs: 60_000,
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MovementItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [flowDetailsOpen, setFlowDetailsOpen] = useState(false);
  const [movementFilter, setMovementFilter] = useState<MovementFilter>("ALL");
  const legacyDialogEnabled = false;

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
    const defaults = movementDefaults(nextKind, month, year, preferences.data, {
      accounts: accounts.data,
      cards: cards.data,
      categories: categories.data,
    });
    form.setValue("kind", nextKind, { shouldDirty: true, shouldValidate: true });

    if (nextKind === "CARD_PAYMENT" && occurredAt?.includes("T")) {
      form.setValue("occurredAt", occurredAt.slice(0, 10), {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    if (nextKind !== "CARD_PAYMENT" && occurredAt && !occurredAt.includes("T")) {
      form.setValue("occurredAt", `${occurredAt}T00:00`, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    if (nextKind === "CARD_EXPENSE" && !form.getValues("installmentCount")) {
      form.setValue("installmentCount", 1, { shouldDirty: true, shouldValidate: true });
    }
    if (nextKind === "CARD_EXPENSE") {
      form.setValue("cardId", defaults.cardId, { shouldDirty: true, shouldValidate: true });
      form.setValue("categoryId", defaults.categoryId, { shouldDirty: true, shouldValidate: true });
      form.setValue("installmentCount", defaults.installmentCount, {
        shouldDirty: true,
        shouldValidate: true,
      });
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
      form.setValue("targetAccountId", defaults.targetAccountId, {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue("categoryId", undefined, { shouldDirty: true, shouldValidate: true });
    }
    if (nextKind === "CARD_PAYMENT") {
      form.setValue("cardId", defaults.cardId, { shouldDirty: true, shouldValidate: true });
      form.setValue("accountId", defaults.accountId, { shouldDirty: true, shouldValidate: true });
      form.setValue("categoryId", undefined, { shouldDirty: true, shouldValidate: true });
      if (!form.getValues("paymentMonth")) {
        form.setValue("paymentMonth", cardStatementPeriod.month, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      if (!form.getValues("paymentYear")) {
        form.setValue("paymentYear", cardStatementPeriod.year, {
          shouldDirty: true,
          shouldValidate: true,
        });
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
  useFinanceUpdates(reloadFinanceData);

  const save = useAsyncMutation({
    mutationFn: (values: Values): Promise<unknown> => {
      if (values.kind === "CARD_EXPENSE") {
        const participantAmount = roundMoney(Number(values.participantAmount ?? 0));
        const creatorAmount = roundMoney(values.amount - participantAmount);
        return api<Expense>(
          editing?.kind === "card-expense" ? `/expenses/${editing.id}` : "/expenses",
          {
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
          },
        );
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
      reloadFinanceData();
      setOpen(false);
      setEditing(null);
      form.reset(
        movementDefaults(
          preferences.data?.defaultMovementKind ?? "CARD_EXPENSE",
          month,
          year,
          preferences.data,
          {
            accounts: accounts.data,
            cards: cards.data,
            categories: categories.data,
          },
        ),
      );
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
  const accountsById = useMemo(
    () => new Map((accounts.data ?? []).map((account) => [account.id, account])),
    [accounts.data],
  );
  const cardsById = useMemo(
    () => new Map((cards.data ?? []).map((card) => [card.id, card])),
    [cards.data],
  );
  const categoriesById = useMemo(
    () => new Map((categories.data ?? []).map((category) => [category.id, category])),
    [categories.data],
  );
  const accountName = useCallback(
    (id: number) => accountsById.get(id)?.name ?? `Conta #${id}`,
    [accountsById],
  );
  const cardName = useCallback(
    (id?: number | null) => cardsById.get(id ?? -1)?.name ?? `Cartão #${id ?? ""}`,
    [cardsById],
  );
  const categoryName = useCallback(
    (id?: number | null) =>
      id ? (categoriesById.get(id)?.name ?? `Categoria #${id}`) : "Sem categoria",
    [categoriesById],
  );
  const expensesById = useMemo(
    () => new Map((expenses.data ?? []).map((expense) => [expense.id, expense])),
    [expenses.data],
  );
  const settlementItemByExpenseId = useMemo(() => {
    const map = new Map<number, SettlementItem>();
    for (const item of settlementItems.data ?? []) {
      map.set(item.expenseId, item);
    }
    return map;
  }, [settlementItems.data]);
  const items = useMemo(
    () =>
      mergeMovements(
        tx.data ?? [],
        cardStatements.data ?? [],
        expensesById,
        cardPayments.data ?? [],
        settlementItems.data ?? [],
        month,
        year,
      ),
    [
      cardPayments.data,
      cardStatements.data,
      expensesById,
      month,
      settlementItems.data,
      tx.data,
      year,
    ],
  );
  const cashFlowTotals = useMemo(() => calculateCashFlowTotals(items), [items]);
  const statementSummaries = useMemo(
    () =>
      (cardStatements.data ?? []).filter((statement): statement is CardStatement =>
        Boolean(statement),
      ),
    [cardStatements.data],
  );
  const statementTotals = useMemo(
    () => calculateStatementTotals(statementSummaries),
    [statementSummaries],
  );
  const selectedPeriodLabel = `${monthName(month, year)} de ${year}`;
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const filteredItems = useMemo(() => {
    const normalizedSearchQuery = normalizeSearch(deferredSearchQuery);
    const searchedItems = normalizedSearchQuery
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

    return searchedItems.filter((item) => matchesMovementFilter(item, movementFilter));
  }, [accountName, cardName, categoryName, deferredSearchQuery, items, movementFilter]);
  const movementGroups = useMemo(() => groupMovementsByDay(filteredItems), [filteredItems]);
  const movementsLoading = tx.isLoading || cards.isLoading;
  const supplementalLoading =
    cardStatements.isLoading ||
    cardPayments.isLoading ||
    expenses.isLoading ||
    settlementItems.isLoading;
  const deleteMovement = (item: MovementItem) => {
    if (
      item.kind === "card-expense" &&
      settlementItemByExpenseId.get(item.id)?.status === "SETTLED"
    ) {
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
    if (item.kind === "card-expense")
      return "A compra inteira será removida, incluindo as demais parcelas.";
    if (item.kind === "card-payment") return "Este pagamento de fatura será removido.";
    return "Este lançamento será removido.";
  };

  const openNew = () => {
    const defaultKind = preferences.data?.defaultMovementKind ?? "CARD_EXPENSE";
    setEditing(null);
    form.reset(
      movementDefaults(defaultKind, month, year, preferences.data, {
        accounts: accounts.data,
        cards: cards.data,
        categories: categories.data,
      }),
    );
    setOpen(true);
  };

  const openEdit = (item: MovementItem) => {
    if (item.kind === "transaction" && isEditableTransactionType(item.type)) {
      setEditing(item);
      form.reset({
        ...movementDefaults(item.type, month, year),
        title: item.description?.trim() || item.title,
        amount: item.type === "ADJUSTMENT" ? item.amount : Math.abs(item.amount),
        occurredAt: item.occurredAt.slice(0, 16),
        accountId: item.accountId,
        categoryId: item.categoryId ?? undefined,
      });
      setOpen(true);
      return;
    }

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
    <div className="space-y-6">
      <div className="space-y-5">
        <header className="reveal-in flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              Extrato inteligente
            </p>
            <h1 className="font-display text-3xl font-extrabold leading-tight tracking-[-0.045em] md:text-[2.6rem]">
              Movimentações
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Acompanhe cada entrada, saída e compromisso sem perder o contexto.
            </p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
            <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none lg:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar no extrato"
                aria-label="Buscar movimentação"
                autoComplete="off"
                className="h-11 rounded-xl border-border bg-card pl-10 pr-10 text-sm shadow-sm"
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
            <MovementEntryDialog
              open={open}
              onOpenChange={(next) => {
                setOpen(next);
                if (!next) setEditing(null);
              }}
              period={{ month, year }}
              editing={
                editing?.kind === "transaction" ||
                editing?.kind === "card-expense" ||
                editing?.kind === "card-payment"
                  ? editing
                  : null
              }
              editingExpense={
                editing?.kind === "card-expense" ? expensesById.get(editing.id) : null
              }
              editingShare={
                editing?.kind === "card-expense" ? settlementItemByExpenseId.get(editing.id) : null
              }
              trigger={
                <Button
                  type="button"
                  onClick={openNew}
                  className="hidden h-11 sm:inline-flex sm:flex-none"
                >
                  <Plus className="h-4 w-4" /> Nova movimentação
                </Button>
              }
            />
            {legacyDialogEnabled && (
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
                          onChange={(value) =>
                            form.setValue("amount", value, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                        />
                        <FieldError message={errors.amount?.message} />
                      </div>
                      <div className="col-span-2 space-y-1.5">
                        <Label>
                          Descricao
                          {kind === "TRANSFER" || kind === "CARD_PAYMENT" ? " (opcional)" : ""}
                        </Label>
                        <Input
                          {...form.register("title")}
                          placeholder="ex: Mercado, salario, farmacia"
                        />
                        <FieldError message={errors.title?.message} />
                      </div>
                      <div className="col-span-2 space-y-1.5">
                        <Label>{kind === "CARD_PAYMENT" ? "Data do pagamento" : "Quando"}</Label>
                        <Input
                          type={kind === "CARD_PAYMENT" ? "date" : "datetime-local"}
                          {...form.register("occurredAt")}
                        />
                        <FieldError message={errors.occurredAt?.message} />
                      </div>

                      {kind === "CARD_EXPENSE" && (
                        <>
                          <div className="space-y-1.5">
                            <Label>Cartão</Label>
                            <Select
                              value={
                                form.watch("cardId") ? String(form.watch("cardId")) : undefined
                              }
                              disabled={editing?.kind === "card-payment"}
                              onValueChange={(value) =>
                                form.setValue("cardId", Number(value), {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                })
                              }
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
                            {!activeCards.length && (
                              <ResourceHint>Nenhum cartão ativo disponível.</ResourceHint>
                            )}
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
                                  form.setValue("shareEnabled", enabled, {
                                    shouldDirty: true,
                                    shouldValidate: true,
                                  });
                                  if (!enabled) {
                                    form.setValue("participantUserId", undefined, {
                                      shouldDirty: true,
                                      shouldValidate: true,
                                    });
                                    form.setValue("participantAmount", undefined, {
                                      shouldDirty: true,
                                      shouldValidate: true,
                                    });
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
                                    value={
                                      form.watch("participantUserId")
                                        ? String(form.watch("participantUserId"))
                                        : undefined
                                    }
                                    onValueChange={(value) =>
                                      form.setValue("participantUserId", Number(value), {
                                        shouldDirty: true,
                                        shouldValidate: true,
                                      })
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
                                  {!activeConnections.length && (
                                    <ResourceHint>Nenhuma conexão aceita disponível.</ResourceHint>
                                  )}
                                </div>
                                <div className="space-y-1.5">
                                  <Label>Valor da outra pessoa</Label>
                                  <CurrencyAmountInput
                                    value={form.watch("participantAmount")}
                                    onChange={(value) =>
                                      form.setValue("participantAmount", value, {
                                        shouldDirty: true,
                                        shouldValidate: true,
                                      })
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
                              onChange={(value) =>
                                form.setValue("accountId", value, {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                })
                              }
                            />
                            <FieldError message={errors.accountId?.message} />
                            {!activeAccounts.length && (
                              <ResourceHint>Nenhuma conta ativa disponível.</ResourceHint>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label>Conta de destino</Label>
                            <AccountSelect
                              value={form.watch("targetAccountId")}
                              accounts={activeAccounts.filter(
                                (account) => account.id !== form.watch("accountId"),
                              )}
                              onChange={(value) =>
                                form.setValue("targetAccountId", value, {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                })
                              }
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
                              value={
                                form.watch("cardId") ? String(form.watch("cardId")) : undefined
                              }
                              onValueChange={(value) =>
                                form.setValue("cardId", Number(value), {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                })
                              }
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
                            {!activeCards.length && (
                              <ResourceHint>Nenhum cartão ativo disponível.</ResourceHint>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label>Conta de pagamento</Label>
                            <AccountSelect
                              value={form.watch("accountId")}
                              accounts={activeAccounts}
                              onChange={(value) =>
                                form.setValue("accountId", value, {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                })
                              }
                            />
                            <FieldError message={errors.accountId?.message} />
                            {!activeAccounts.length && (
                              <ResourceHint>Nenhuma conta ativa disponível.</ResourceHint>
                            )}
                          </div>
                          <div className="col-span-2 space-y-1.5">
                            <Label>Fatura</Label>
                            <Select
                              value={`${form.watch("paymentMonth") ?? month}-${form.watch("paymentYear") ?? year}`}
                              onValueChange={(value) => {
                                const [paymentMonth, paymentYear] = value.split("-").map(Number);
                                form.setValue("paymentMonth", paymentMonth, {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                });
                                form.setValue("paymentYear", paymentYear, {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                });
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
                            onChange={(value) =>
                              form.setValue("accountId", value, {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }
                          />
                          <FieldError message={errors.accountId?.message} />
                          {!activeAccounts.length && (
                            <ResourceHint>Nenhuma conta ativa disponível.</ResourceHint>
                          )}
                        </div>
                      )}

                      {showsCategory && (
                        <div className="space-y-1.5">
                          <Label>Categoria</Label>
                          <Select
                            value={
                              form.watch("categoryId") ? String(form.watch("categoryId")) : "_none"
                            }
                            onValueChange={(value) =>
                              form.setValue(
                                "categoryId",
                                value === "_none" ? undefined : Number(value),
                                { shouldDirty: true },
                              )
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
            )}
          </div>
        </header>

        <div className="grid grid-cols-[3rem_minmax(0,1fr)_3rem] items-center gap-2 rounded-[1.25rem] border border-border/80 bg-card p-2 shadow-[0_10px_35px_rgba(20,36,30,0.045)] sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <Button
            type="button"
            variant="ghost"
            className="h-11 justify-center rounded-xl px-0 text-muted-foreground hover:text-foreground sm:justify-start sm:px-2 md:px-3"
            onClick={() => setPeriod(previousPeriod)}
            aria-label={`Ir para ${monthName(previousPeriod.month, previousPeriod.year)}`}
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="hidden truncate text-base font-medium sm:inline md:text-sm">
              {monthName(previousPeriod.month, previousPeriod.year)}
            </span>
          </Button>

          <PeriodPicker
            month={month}
            year={year}
            onChange={setPeriod}
            className="w-full min-w-0 px-3"
          />

          <Button
            type="button"
            variant="ghost"
            className="h-11 justify-center rounded-xl px-0 text-muted-foreground hover:text-foreground sm:justify-end sm:px-2 md:px-3"
            onClick={() => setPeriod(nextPeriod)}
            aria-label={`Ir para ${monthName(nextPeriod.month, nextPeriod.year)}`}
          >
            <span className="hidden truncate text-base font-medium sm:inline md:text-sm">
              {monthName(nextPeriod.month, nextPeriod.year)}
            </span>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <Collapsible
          open={flowDetailsOpen}
          onOpenChange={setFlowDetailsOpen}
          className="overflow-hidden rounded-[1.5rem] border border-border/80 bg-card shadow-[0_10px_35px_rgba(20,36,30,0.045)]"
        >
          <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent text-primary">
                  <ArrowLeftRight className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    Fluxo de caixa
                  </p>
                  <h2 className="mt-0.5 truncate text-base font-bold tracking-tight">
                    Resumo de {selectedPeriodLabel}
                  </h2>
                </div>
              </div>

              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
                  aria-label={
                    flowDetailsOpen
                      ? "Ocultar detalhes do fluxo mensal"
                      : "Ver detalhes do fluxo mensal"
                  }
                >
                  {flowDetailsOpen ? "Fechar" : "Detalhes"}
                  <ChevronDown
                    className={`transition-transform duration-200 ${flowDetailsOpen ? "rotate-180" : ""}`}
                  />
                </Button>
              </CollapsibleTrigger>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
              <div className="col-span-2 bg-muted/65 p-4 sm:col-span-1">
                <p className="text-[10px] font-semibold text-muted-foreground">Saldo do mês</p>
                <p
                  className={`mt-1 truncate font-display text-xl font-extrabold tracking-[-0.035em] tabular-nums ${
                    cashFlowTotals.net >= 0 ? "text-[var(--success)]" : "text-destructive"
                  }`}
                >
                  {formatSignedBRL(cashFlowTotals.net)}
                </p>
              </div>
              <FlowMetric label="Entradas" value={cashFlowTotals.inflow} tone="positive" />
              <FlowMetric label="Saídas da conta" value={cashFlowTotals.accountOutflow} />
              <FlowMetric
                label="Compras no cartão"
                value={cashFlowTotals.cardPurchases}
                tone="card"
              />
            </div>
          </div>

          <CollapsibleContent>
            <div className="border-t border-border bg-muted/30 p-5 sm:p-6">
              <div className="grid gap-4 md:grid-cols-[minmax(8rem,1.1fr)_minmax(0,1.7fr)_minmax(12rem,1.2fr)] md:items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">Fluxo do mês</p>
                  </div>
                  <p className="mt-0.5 truncate text-2xl font-semibold tabular-nums">
                    {formatBRL(cashFlowTotals.net)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">Entradas</p>
                    <p className="truncate font-semibold tabular-nums text-[var(--success)]">
                      {formatBRL(cashFlowTotals.inflow)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">Saídas conta</p>
                    <p className="truncate font-semibold tabular-nums">
                      {formatBRL(cashFlowTotals.accountOutflow)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">Cartão</p>
                    <p className="truncate font-semibold tabular-nums text-primary">
                      {formatBRL(cashFlowTotals.cardPurchases)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">Acertos</p>
                    <p
                      className={`truncate font-semibold tabular-nums ${cashFlowTotals.settlementsNet > 0 ? "text-[var(--success)]" : ""}`}
                    >
                      {formatSignedBRL(cashFlowTotals.settlementsNet)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">Aberto</p>
                    <p className="truncate font-semibold tabular-nums">
                      {formatBRL(statementTotals.remaining)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card px-3 py-2 text-sm">
                  <div className="col-span-2 min-w-0">
                    <p className="text-[11px] text-muted-foreground">Fatura</p>
                    <p className="truncate font-semibold capitalize">
                      {monthName(cardStatementPeriod.month, cardStatementPeriod.year)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">Total</p>
                    <p className="truncate font-semibold tabular-nums text-primary">
                      {formatBRL(statementTotals.total)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">Pago</p>
                    <p className="truncate font-semibold tabular-nums">
                      {formatBRL(statementTotals.paid)}
                    </p>
                  </div>
                </div>
              </div>

              {cardStatements.isLoading && !statementSummaries.length ? (
                <p className="mt-2 text-xs text-muted-foreground">Carregando faturas...</p>
              ) : statementSummaries.length ? (
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {statementSummaries.map((statement) => (
                    <div
                      key={`${statement.cardId}-${statement.month}-${statement.year}`}
                      className="flex min-w-40 items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{statement.cardName}</p>
                        <p className="truncate text-muted-foreground">
                          Vence {formatDate(statement.dueDate)}
                        </p>
                      </div>
                      <p className="shrink-0 font-semibold tabular-nums">
                        {formatBRL(statement.remainingAmount)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Histórico
          </p>
          <h2 className="mt-1 font-display text-2xl font-extrabold tracking-[-0.035em]">
            Extrato do mês
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {filteredItems.length} movimentaç{filteredItems.length === 1 ? "ão" : "ões"}
            {movementFilter !== "ALL" || searchQuery ? " neste recorte" : " no período"}
          </p>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          {MOVEMENT_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setMovementFilter(filter.value)}
              className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
                movementFilter === filter.value
                  ? "border-[#0b2e24] bg-[#0b2e24] text-[#c9ff5b] shadow-sm dark:border-[#c9ff5b]"
                  : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {movementsLoading ? (
            <div className="space-y-3 p-5 sm:p-6">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="h-16 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : !items.length ? (
            <div className="grid min-h-[18rem] place-items-center p-6 text-center">
              <div>
                <p className="text-xl font-semibold tracking-tight">
                  {supplementalLoading
                    ? "Carregando faturas e pagamentos..."
                    : "Nenhum lançamento no período"}
                </p>
                {!supplementalLoading && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Toque em <span className="font-semibold text-primary">+</span> para adicionar um
                    lançamento.
                  </p>
                )}
              </div>
            </div>
          ) : !filteredItems.length ? (
            <div className="grid min-h-[16rem] place-items-center p-6 text-center">
              <div>
                <p className="text-xl font-semibold tracking-tight">Nenhum lançamento encontrado</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Tente buscar por descrição, conta, cartão, data ou valor.
                </p>
              </div>
            </div>
          ) : (
            <>
              {supplementalLoading && (
                <div className="border-b border-border bg-muted/40 px-5 py-2.5 text-xs text-muted-foreground">
                  Atualizando faturas e pagamentos...
                </div>
              )}
              <div className="divide-y divide-border/80">
                {movementGroups.map((group) => (
                  <section key={group.key}>
                    <div className="flex items-center justify-between bg-muted/35 px-4 py-2.5 sm:px-6">
                      <div className="flex items-baseline gap-2">
                        <h3 className="text-xs font-bold text-foreground">{group.label}</h3>
                        <span className="text-[10px] text-muted-foreground">
                          {group.items.length} {group.items.length === 1 ? "item" : "itens"}
                        </span>
                      </div>
                      <span
                        className={`text-[11px] font-bold tabular-nums ${
                          group.net > 0 ? "text-[var(--success)]" : "text-muted-foreground"
                        }`}
                      >
                        {formatSignedBRL(group.net)}
                      </span>
                    </div>
                    <ul className="divide-y divide-border/60 px-3 sm:px-4">
                      {group.items.map((item) => {
                        const sharedItem =
                          item.kind === "card-expense"
                            ? settlementItemByExpenseId.get(item.id)
                            : undefined;
                        const isSettledSharedExpense = sharedItem?.status === "SETTLED";
                        const category = movementCategoryName(item, categoryName);
                        return (
                          <li
                            key={movementKey(item)}
                            className="group grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 py-3.5 sm:grid-cols-[2.75rem_minmax(0,1fr)_auto] sm:items-center sm:gap-y-0 sm:py-4"
                          >
                            <div
                              className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${movementIconBackground(item)}`}
                            >
                              {movementIcon(item)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex min-w-0 items-center gap-2">
                                <p className="min-w-0 break-words text-sm font-semibold leading-snug sm:truncate">
                                  {item.title}
                                </p>
                                {sharedItem && (
                                  <span className="hidden shrink-0 items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[9px] font-bold text-primary sm:inline-flex">
                                    <UsersRound className="h-3 w-3" />
                                    {isSettledSharedExpense ? "Quitada" : "Dividida"}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-relaxed text-muted-foreground sm:flex-nowrap">
                                {movementTimeLabel(item) && (
                                  <span className="shrink-0">{movementTimeLabel(item)}</span>
                                )}
                                {movementTimeLabel(item) && <span aria-hidden="true">·</span>}
                                <span className="min-w-0 break-words sm:truncate">
                                  {movementMeta(item, accountName, cardName)}
                                </span>
                                {category && category !== "Sem categoria" && (
                                  <>
                                    <span className="hidden sm:inline" aria-hidden="true">
                                      ·
                                    </span>
                                    <span className="hidden shrink-0 sm:inline">{category}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="col-start-2 flex min-w-0 items-center justify-between gap-2 sm:col-start-3 sm:row-start-1 sm:justify-end">
                              <div className="text-right">
                                <p
                                  className={`whitespace-nowrap text-sm font-bold tabular-nums sm:text-[15px] ${movementAmountClass(item)}`}
                                >
                                  {movementAmountPrefix(item)}
                                  {formatBRL(Math.abs(item.amount))}
                                </p>
                                <p className="mt-0.5 hidden text-[10px] text-muted-foreground sm:block">
                                  {movementKindLabel(item)}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center sm:opacity-0 sm:transition sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                                {canEditMovement(item, sharedItem) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Editar ${item.title}`}
                                    className="h-8 w-8 rounded-xl"
                                    onClick={() => openEdit(item)}
                                  >
                                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
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
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      aria-label={`Remover ${item.title}`}
                                      className="h-8 w-8 rounded-xl"
                                    >
                                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                                    </Button>
                                  </ConfirmAction>
                                )}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FlowMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "positive" | "card";
}) {
  return (
    <div className="min-w-0 bg-card p-4 last:col-span-2 sm:last:col-span-1">
      <p className="truncate text-[10px] font-semibold text-muted-foreground">{label}</p>
      <p
        className={`mt-1 truncate text-sm font-bold tabular-nums ${
          tone === "positive"
            ? "text-[var(--success)]"
            : tone === "card"
              ? "text-[#df5a48] dark:text-[#ff9a8a]"
              : "text-foreground"
        }`}
      >
        {formatBRL(value)}
      </p>
    </div>
  );
}

function matchesMovementFilter(item: MovementItem, filter: MovementFilter) {
  if (filter === "ALL") return true;
  if (filter === "INFLOW") return isPositiveMovement(item);
  if (filter === "OUTFLOW") return !isPositiveMovement(item);
  if (filter === "CARD") {
    return (
      item.kind === "card-expense" ||
      item.kind === "card-payment" ||
      (item.kind === "transaction" && item.type === "CARD_PAYMENT")
    );
  }
  if (filter === "TRANSFER") {
    return (
      item.kind === "transaction" && (item.type === "TRANSFER_IN" || item.type === "TRANSFER_OUT")
    );
  }
  return item.kind === "settlement";
}

function groupMovementsByDay(items: MovementItem[]) {
  const groups = new Map<
    string,
    { key: string; label: string; net: number; items: MovementItem[] }
  >();

  for (const item of items) {
    const key = item.occurredAt.slice(0, 10);
    const group = groups.get(key) ?? {
      key,
      label: movementDayLabel(key),
      net: 0,
      items: [],
    };
    group.items.push(item);
    group.net = roundMoney(
      group.net + (isPositiveMovement(item) ? Math.abs(item.amount) : -Math.abs(item.amount)),
    );
    groups.set(key, group);
  }

  return Array.from(groups.values());
}

function movementDayLabel(value: string) {
  const date = new Date(`${value}T12:00:00`);
  const today = new Date();
  const todayKey = localDateKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (value === todayKey) return "Hoje";
  if (value === localDateKey(yesterday)) return "Ontem";

  const label = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "short",
  })
    .format(date)
    .replace(".", "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function movementTimeLabel(item: MovementItem) {
  if (!item.occurredAt.includes("T")) return "";
  const date = new Date(item.occurredAt);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function movementKindLabel(item: MovementItem) {
  if (item.kind === "card-expense") return "Compra no cartão";
  if (item.kind === "card-payment") return "Pagamento de fatura";
  if (item.kind === "settlement") return "Acerto compartilhado";
  if (item.type === "INCOME") return "Receita";
  if (item.type === "EXPENSE") return "Despesa";
  if (item.type === "ADJUSTMENT") return "Ajuste";
  if (item.type === "TRANSFER_IN" || item.type === "TRANSFER_OUT") return "Transferência";
  return "Movimentação";
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
    <Select
      value={value ? String(value) : undefined}
      onValueChange={(next) => onChange(Number(next))}
    >
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
  settlementItems: SettlementItem[],
  month: number,
  year: number,
): MovementItem[] {
  const transactionsById = new Map(
    transactions.map((transaction) => [transaction.id, transaction]),
  );
  const uniqueCardPayments = Array.from(
    new Map(cardPayments.map((payment) => [`${payment.cardId}-${payment.id}`, payment])).values(),
  );
  const resolvedPaymentTransactionIds = new Set(
    uniqueCardPayments
      .map((payment) => payment.transactionId)
      .filter((transactionId): transactionId is number => typeof transactionId === "number"),
  );

  return [
    ...transactions
      .filter(
        (transaction) =>
          transaction.type !== "CARD_PAYMENT" || !resolvedPaymentTransactionIds.has(transaction.id),
      )
      .map((transaction): MovementItem => ({
        kind: "transaction",
        id: transaction.id,
        title: transactionTitle(transaction),
        description: transaction.description,
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
        const totalInstallments =
          installment.totalInstallments ??
          expense?.installmentCount ??
          installment.installmentNumber;
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
      const paymentTransaction = payment.transactionId
        ? transactionsById.get(payment.transactionId)
        : undefined;
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
    ...settlementItems
      .filter((item) => {
        const occurredAt = settlementOccurredAt(item);
        return Boolean(occurredAt) && isInMonth(occurredAt, month, year);
      })
      .map((item): MovementItem => ({
        kind: "settlement",
        id: item.shareId,
        title: settlementMovementTitle(item),
        amount: item.participantAmount,
        occurredAt: settlementOccurredAt(item) ?? item.createdAt,
        expenseId: item.expenseId,
        direction: item.direction,
        status: item.status,
        counterpartyName: settlementCounterpartyName(item),
      })),
  ].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}

function calculateCashFlowTotals(items: MovementItem[]) {
  const totals = items.reduce(
    (totals, item) => {
      const amount = Math.abs(Number(item.amount));

      if (item.kind === "card-expense") {
        totals.cardPurchases += amount;
        return totals;
      }

      if (item.kind === "card-payment") {
        totals.accountOutflow += amount;
        return totals;
      }

      if (item.kind === "settlement") {
        if (isPositiveMovement(item)) {
          totals.settlementsInflow += amount;
        } else {
          totals.settlementsOutflow += amount;
        }
        return totals;
      }

      if (isPositiveMovement(item)) {
        totals.inflow += amount;
        return totals;
      }

      totals.accountOutflow += amount;
      return totals;
    },
    { inflow: 0, accountOutflow: 0, cardPurchases: 0, settlementsInflow: 0, settlementsOutflow: 0 },
  );

  return {
    inflow: roundMoney(totals.inflow),
    accountOutflow: roundMoney(totals.accountOutflow),
    cardPurchases: roundMoney(totals.cardPurchases),
    settlementsNet: roundMoney(totals.settlementsInflow - totals.settlementsOutflow),
    net: roundMoney(
      totals.inflow - totals.accountOutflow + totals.settlementsInflow - totals.settlementsOutflow,
    ),
  };
}

function calculateStatementTotals(statements: CardStatement[]) {
  return statements.reduce(
    (totals, statement) => {
      totals.total += Number(statement.totalAmount);
      totals.paid += Number(statement.paidAmount);
      totals.remaining += Number(statement.remainingAmount);
      return totals;
    },
    { total: 0, paid: 0, remaining: 0 },
  );
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
  const defaultTargetAccountId = validActiveId(
    preferences?.defaultTargetAccountId,
    resources.accounts,
  );
  const defaultCardId = validActiveId(preferences?.defaultCardId, resources.cards);
  const defaultExpenseCategoryId = validCategoryId(
    preferences?.defaultExpenseCategoryId,
    resources.categories,
    "EXPENSE",
  );
  const defaultIncomeCategoryId = validCategoryId(
    preferences?.defaultIncomeCategoryId,
    resources.categories,
    "INCOME",
  );
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

function validActiveId<T extends { id: number; active: boolean }>(
  id: number | null | undefined,
  items?: T[],
) {
  if (!id || !items?.some((item) => item.id === id && item.active)) return undefined;
  return id;
}

function validCategoryId(
  id: number | null | undefined,
  categories: Category[] | undefined,
  type: "INCOME" | "EXPENSE",
) {
  if (
    !id ||
    !categories?.some((category) => category.id === id && category.active && category.type === type)
  ) {
    return undefined;
  }
  return id;
}

function roundMoney(value: number) {
  return Math.round(Number(value) * 100) / 100;
}

function formatSignedBRL(value: number) {
  if (value === 0) return formatBRL(0);
  return `${value > 0 ? "+" : "-"}${formatBRL(Math.abs(value))}`;
}

function normalizeDateTime(value: string) {
  return value.includes("T") ? value : `${value}T00:00`;
}

function canEditMovement(item: MovementItem, sharedItem?: SettlementItem) {
  if (item.kind === "card-expense") return sharedItem?.status !== "SETTLED";
  if (item.kind === "card-payment") return true;
  if (item.kind === "transaction") return isEditableTransactionType(item.type);
  return false;
}

function isEditableTransactionType(
  type: TransactionType,
): type is Extract<MovementKind, "INCOME" | "EXPENSE" | "ADJUSTMENT"> {
  return type === "INCOME" || type === "EXPENSE" || type === "ADJUSTMENT";
}

function canDeleteMovement(item: MovementItem, sharedItem?: SettlementItem) {
  if (sharedItem?.status === "SETTLED") return false;
  if (item.kind === "settlement") return false;
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
  if (item.kind === "settlement") return `settlement-${item.id}`;
  return item.kind === "card-expense" ? item.key : `${item.kind}-${item.id}`;
}

function movementDate(item: MovementItem) {
  if (item.kind === "card-payment")
    return item.occurredAt.includes("T")
      ? formatDateTime(item.occurredAt)
      : formatDate(item.occurredAt);
  if (item.kind === "card-expense")
    return item.occurredAt.includes("T")
      ? formatDateTime(item.occurredAt)
      : formatDate(item.occurredAt);
  if (item.kind === "settlement")
    return item.occurredAt.includes("T")
      ? formatDateTime(item.occurredAt)
      : formatDate(item.occurredAt);
  return formatDateTime(item.occurredAt);
}

function isInflow(type: TransactionType) {
  return type === "INCOME" || type === "TRANSFER_IN";
}

function isPositiveMovement(item: MovementItem) {
  if (item.kind === "card-expense" || item.kind === "card-payment") return false;
  if (item.kind === "settlement") return item.direction === "OWES_YOU";
  return isInflow(item.type) || (item.type === "ADJUSTMENT" && item.amount > 0);
}

function movementAmountPrefix(item: MovementItem) {
  return isPositiveMovement(item) ? "+" : "-";
}

function movementAmountClass(item: MovementItem) {
  return isPositiveMovement(item) ? "text-[var(--success)]" : "text-foreground";
}

function movementIconBackground(item: MovementItem) {
  return isPositiveMovement(item)
    ? "bg-[color-mix(in_oklab,var(--success)_15%,transparent)]"
    : "bg-accent";
}

function movementIcon(item: MovementItem) {
  if (item.kind === "card-expense") return <CreditCard className="h-4 w-4 text-primary" />;
  if (item.kind === "card-payment") return <WalletCards className="h-4 w-4 text-primary" />;
  if (item.kind === "settlement")
    return (
      <HandCoins
        className={`h-4 w-4 ${isPositiveMovement(item) ? "text-[var(--success)]" : "text-primary"}`}
      />
    );
  if (item.type === "CARD_PAYMENT") return <WalletCards className="h-4 w-4 text-primary" />;
  if (item.type === "TRANSFER_IN" || item.type === "TRANSFER_OUT")
    return <ArrowLeftRight className="h-4 w-4 text-primary" />;
  if (isPositiveMovement(item)) return <ArrowDownRight className="h-4 w-4 text-[var(--success)]" />;
  return <ArrowUpRight className="h-4 w-4 text-primary" />;
}

function movementMeta(
  item: MovementItem,
  accountName: (id: number) => string,
  cardName: (id?: number | null) => string,
) {
  if (item.kind === "card-expense") {
    return `${cardName(item.cardId)} - parcela ${item.installmentNumber}/${item.installmentCount} - fatura ${monthLabel(item.statementMonth, item.statementYear)}`;
  }
  if (item.kind === "card-payment") return `Pagamento de fatura - ${accountName(item.accountId)}`;
  if (item.kind === "settlement") return settlementMovementMeta(item);
  if (item.type === "CARD_PAYMENT") return `Pagamento de fatura - ${accountName(item.accountId)}`;
  if (item.type === "TRANSFER_IN") return `Transferência recebida - ${accountName(item.accountId)}`;
  if (item.type === "TRANSFER_OUT") return `Transferência enviada - ${accountName(item.accountId)}`;
  return accountName(item.accountId);
}

function movementCategoryName(item: MovementItem, categoryName: (id?: number | null) => string) {
  if (item.kind === "card-payment" || item.kind === "settlement") return "";
  return categoryName(item.categoryId);
}

function settlementOccurredAt(item: SettlementItem) {
  return item.status === "SETTLED" ? (item.settledAt ?? item.createdAt) : item.createdAt;
}

function settlementMovementTitle(item: SettlementItem) {
  if (item.status === "OPEN") {
    return `${item.direction === "OWES_YOU" ? "Acerto a receber" : "Acerto a pagar"}: ${item.expenseName}`;
  }
  return `${item.direction === "OWES_YOU" ? "Acerto recebido" : "Acerto pago"}: ${item.expenseName}`;
}

function settlementCounterpartyName(item: SettlementItem) {
  return item.direction === "OWES_YOU" ? item.participantName : item.creatorName;
}

function settlementMovementMeta(item: Extract<MovementItem, { kind: "settlement" }>) {
  if (item.status === "SETTLED") {
    return item.direction === "OWES_YOU"
      ? `Acerto recebido - ${item.counterpartyName}`
      : `Acerto pago - ${item.counterpartyName}`;
  }
  if (item.direction === "OWES_YOU") {
    return `Acerto a receber - ${item.counterpartyName}`;
  }
  return `Acerto a pagar - ${item.counterpartyName}`;
}

function isInMonth(iso: string, month: number, year: number): boolean {
  const match = /^(\d{4})-(\d{2})/.exec(iso);
  if (!match) return false;
  return Number(match[1]) === year && Number(match[2]) === month;
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
  return Array.from(
    new Map(periods.map((period) => [`${period.month}-${period.year}`, period])).values(),
  );
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
