import { useAsyncData, useAsyncMutation } from "@/hooks/use-async-data";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowDownRight, ArrowLeftRight, ArrowUpRight, CreditCard, Pencil, Plus, Trash2, WalletCards } from "lucide-react";
import { fetchAccounts, fetchCardPayments, fetchCards, fetchCardStatement, fetchCategories, fetchExpenses, fetchTransactions } from "@/lib/queries";
import { api } from "@/lib/api";
import type { CardPayment, CardStatement, Expense, Transaction, TransactionType } from "@/lib/types";
import { currentMonthYear, formatBRL, formatDate, formatDateTime, monthLabel, nowIsoDateTime, todayIsoDate } from "@/lib/format";
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
    paymentMonth: z.coerce.number().int().min(1).max(12).optional(),
    paymentYear: z.coerce.number().int().min(2000).optional(),
  })
  .superRefine((values, ctx) => {
    const title = values.title?.trim();
    const requiresTitle = values.kind === "INCOME" || values.kind === "EXPENSE" || values.kind === "CARD_EXPENSE" || values.kind === "ADJUSTMENT";

    if (requiresTitle && !title) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["title"], message: "Informe uma descricao" });
    }
    if (values.kind === "ADJUSTMENT" && values.amount === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amount"], message: "Ajuste nao pode ser zero" });
    }
    if (values.kind !== "ADJUSTMENT" && values.amount <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amount"], message: "Valor deve ser > 0" });
    }
    if (values.kind === "CARD_EXPENSE") {
      if (!values.cardId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cardId"], message: "Selecione um cartao" });
      }
      if (!values.installmentCount) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["installmentCount"], message: "Informe as parcelas" });
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
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cardId"], message: "Selecione um cartao" });
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
  const [{ month, year }, setPeriod] = useState(currentMonthYear);
  const cardStatementPeriod = nextMonthPeriod(month, year);
  const cardPaymentPeriods = uniquePeriods([
    { month, year },
    cardStatementPeriod,
  ]);
  const cardPaymentPeriodKey = cardPaymentPeriods.map((period) => `${period.month}-${period.year}`).join("|");
  const tx = useAsyncData(() => fetchTransactions({ month, year }), [month, year]);
  const accounts = useAsyncData(() => fetchAccounts(), []);
  const cards = useAsyncData(() => fetchCards(), []);
  const activeCards = (cards.data ?? []).filter((card) => card.active);
  const cardStatements = useAsyncData(
    () =>
      activeCards.length
        ? Promise.all(
            activeCards.map((card) =>
              fetchCardStatement(card.id, cardStatementPeriod.month, cardStatementPeriod.year).catch(() => null),
            ),
          )
        : Promise.resolve([]),
    [cards.data, cardStatementPeriod.month, cardStatementPeriod.year],
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
    [cards.data, cardPaymentPeriodKey],
  );
  const expenses = useAsyncData(() => fetchExpenses({}), []);
  const categories = useAsyncData(() => fetchCategories(), []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MovementItem | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: movementDefaults("EXPENSE", month, year),
  });
  const kind = form.watch("kind");
  const errors = form.formState.errors;

  const reloadFinanceData = () => {
    tx.reload();
    cardStatements.reload();
    cardPayments.reload();
    expenses.reload();
    accounts.reload();
    cards.reload();
    categories.reload();
  };

  const save = useAsyncMutation({
    mutationFn: (values: Values): Promise<unknown> => {
      if (values.kind === "CARD_EXPENSE") {
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
      toast.success(editing ? "Lancamento atualizado" : "Lancamento criado");
      reloadFinanceData();
      setOpen(false);
      setEditing(null);
      form.reset(movementDefaults("EXPENSE", month, year));
    },
    onError: (e) => toast.error(e.message),
  });

  const removeTransaction = useAsyncMutation({
    mutationFn: (id: number) => api(`/transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Lancamento removido");
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

  const monthOptions = useMonthOptions();
  const activeAccounts = (accounts.data ?? []).filter((account) => account.active);
  const showsCategory = kind === "INCOME" || kind === "EXPENSE" || kind === "CARD_EXPENSE";
  const filteredCategories = (categories.data ?? []).filter((category) => {
    if (!category.active || !showsCategory) return false;
    if (kind === "INCOME") return category.type === "INCOME";
    return category.type === "EXPENSE";
  });
  const accountName = (id: number) => accounts.data?.find((account) => account.id === id)?.name ?? `Conta #${id}`;
  const cardName = (id?: number | null) => cards.data?.find((card) => card.id === id)?.name ?? `Cartao #${id ?? ""}`;
  const expensesById = new Map((expenses.data ?? []).map((expense) => [expense.id, expense]));
  const items = mergeMovements(tx.data ?? [], cardStatements.data ?? [], expensesById, cardPayments.data ?? []);

  const openNew = () => {
    setEditing(null);
    form.reset(movementDefaults("EXPENSE", month, year));
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
      toast.info("Este tipo de lancamento nao tem endpoint de edicao na API.");
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
    });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground capitalize">{monthLabel(month, year)}</p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Movimentacoes</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={`${month}-${year}`}
            onValueChange={(value) => {
              const [m, y] = value.split("-").map(Number);
              setPeriod({ month: m, year: y });
            }}
          >
            <SelectTrigger className="w-40">
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
          <Dialog
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) setEditing(null);
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={openNew}>
                <Plus className="h-4 w-4" /> Novo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>{editing ? "Editar lancamento" : "Novo lancamento"}</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={form.handleSubmit(
                  (values) => save.mutate(values),
                  () => toast.error("Confira os campos obrigatorios antes de salvar."),
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
                        form.reset(movementDefaults(nextKind, month, year));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EXPENSE">Despesa em conta</SelectItem>
                        <SelectItem value="CARD_EXPENSE">Compra no cartao</SelectItem>
                        <SelectItem value="INCOME">Receita</SelectItem>
                        <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
                        <SelectItem value="TRANSFER">Transferencia</SelectItem>
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
                        <Label>Cartao</Label>
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
                        {!activeCards.length && <ResourceHint>Nenhum cartao ativo disponivel.</ResourceHint>}
                      </div>
                      <div className="space-y-1.5">
                        <Label>Parcelas</Label>
                        <Input type="number" min={1} {...form.register("installmentCount")} />
                        <FieldError message={errors.installmentCount?.message} />
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
                        {!activeAccounts.length && <ResourceHint>Nenhuma conta ativa disponivel.</ResourceHint>}
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
                        <Label>Cartao</Label>
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
                        {!activeCards.length && <ResourceHint>Nenhum cartao ativo disponivel.</ResourceHint>}
                      </div>
                      <div className="space-y-1.5">
                        <Label>Conta de pagamento</Label>
                        <AccountSelect
                          value={form.watch("accountId")}
                          accounts={activeAccounts}
                          onChange={(value) => form.setValue("accountId", value, { shouldDirty: true, shouldValidate: true })}
                        />
                        <FieldError message={errors.accountId?.message} />
                        {!activeAccounts.length && <ResourceHint>Nenhuma conta ativa disponivel.</ResourceHint>}
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
                      {!activeAccounts.length && <ResourceHint>Nenhuma conta ativa disponivel.</ResourceHint>}
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

      <Card>
        <CardContent className="p-0">
          {tx.isLoading || cardStatements.isLoading || expenses.isLoading || cardPayments.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando...</p>
          ) : !items.length ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum lancamento nesse mes.</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={movementKey(item)} className="flex items-center gap-3 p-4">
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${movementIconBackground(item)}`}>
                    {movementIcon(item)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{item.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {movementDate(item)} - {movementMeta(item, accountName, cardName)}
                    </div>
                  </div>
                  <div className={`text-sm font-semibold tabular-nums ${movementAmountClass(item)}`}>
                    {movementAmountPrefix(item)}
                    {formatBRL(Math.abs(item.amount))}
                  </div>
                  {(item.kind === "card-expense" || item.kind === "card-payment") && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                  {canDeleteMovement(item) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        if (item.kind === "card-expense") {
                          if (!confirm("A compra inteira sera removida, incluindo as demais parcelas. Continuar?")) return;
                          removeExpense.mutate(item.id);
                          return;
                        }
                        if (item.kind === "card-payment") {
                          if (!confirm("Remover este pagamento de fatura?")) return;
                          removeCardPayment.mutate({ cardId: item.cardId, paymentId: item.id });
                          return;
                        }
                        if (!confirm("Remover este lancamento?")) return;
                        removeTransaction.mutate(item.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
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
        title: transaction.description || labelType(transaction.type),
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
          occurredAt: installment.dueDate ?? statement.dueDate,
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
        title: payment.description || "Pagamento de fatura",
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
  return {
    kind,
    title: "",
    amount: 0,
    occurredAt: kind === "CARD_PAYMENT" ? todayIsoDate() : nowIsoDateTime(),
    installmentCount: 1,
    paymentMonth: month,
    paymentYear: year,
  };
}

function normalizeDateTime(value: string) {
  return value.includes("T") ? value : `${value}T00:00`;
}

function canDeleteMovement(item: MovementItem) {
  if (item.kind === "card-expense") return true;
  if (item.kind === "card-payment") return true;
  return item.type !== "CARD_PAYMENT";
}

function movementKey(item: MovementItem) {
  return item.kind === "card-expense" ? item.key : `${item.kind}-${item.id}`;
}

function movementDate(item: MovementItem) {
  if (item.kind === "card-payment") return item.occurredAt.includes("T") ? formatDateTime(item.occurredAt) : formatDate(item.occurredAt);
  return item.kind === "card-expense" ? formatDate(item.dueDate) : formatDateTime(item.occurredAt);
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
  if (item.type === "TRANSFER_IN") return `Transferencia recebida - ${accountName(item.accountId)}`;
  if (item.type === "TRANSFER_OUT") return `Transferencia enviada - ${accountName(item.accountId)}`;
  return accountName(item.accountId);
}

function nextMonthPeriod(month: number, year: number) {
  if (month === 12) return { month: 1, year: year + 1 };
  return { month: month + 1, year };
}

function uniquePeriods(periods: Array<{ month: number; year: number }>) {
  return Array.from(new Map(periods.map((period) => [`${period.month}-${period.year}`, period])).values());
}

function labelType(type: TransactionType): string {
  const map: Record<TransactionType, string> = {
    INCOME: "Receita",
    EXPENSE: "Despesa",
    TRANSFER_IN: "Transferencia recebida",
    TRANSFER_OUT: "Transferencia enviada",
    CARD_PAYMENT: "Pagamento de fatura",
    ADJUSTMENT: "Ajuste",
  };
  return map[type];
}

function useMonthOptions() {
  const now = new Date();
  const out: { key: string; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    out.push({ key: `${month}-${year}`, label: monthLabel(month, year) });
  }
  return out;
}
