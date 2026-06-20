import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, CreditCard, Pencil, Plus, Trash2 } from "lucide-react";
import { accountsQuery, cardsQuery, categoriesQuery, expensesQuery, transactionsQuery } from "@/lib/queries";
import { api, ApiError } from "@/lib/api";
import type { Expense, Transaction, TransactionType } from "@/lib/types";
import { currentMonthYear, formatBRL, formatDateTime, monthLabel, nowIsoDateTime } from "@/lib/format";
import { invalidateFinanceQueries } from "@/lib/query-invalidation";
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

export const Route = createFileRoute("/_app/transactions")({
  component: TransactionsPage,
});

type MovementKind = "INCOME" | "EXPENSE" | "CARD_EXPENSE" | "ADJUSTMENT";
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
      id: number;
      title: string;
      amount: number;
      occurredAt: string;
      cardId?: number | null;
      categoryId?: number | null;
      installmentCount: number;
    };

const schema = z
  .object({
    kind: z.enum(["INCOME", "EXPENSE", "CARD_EXPENSE", "ADJUSTMENT"]),
    title: z.string().min(1, "Informe uma descricao"),
    amount: z.coerce.number(),
    occurredAt: z.string().min(1, "Informe a data"),
    accountId: z.coerce.number().int().optional(),
    cardId: z.coerce.number().int().optional(),
    categoryId: z.coerce.number().int().optional(),
    installmentCount: z.coerce.number().int().positive("Parcelas deve ser > 0").optional(),
  })
  .superRefine((values, ctx) => {
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
    } else if (!values.accountId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["accountId"], message: "Selecione uma conta" });
    }
  });
type Values = z.infer<typeof schema>;

function TransactionsPage() {
  const qc = useQueryClient();
  const [{ month, year }, setPeriod] = useState(currentMonthYear);
  const tx = useQuery(transactionsQuery({ month, year }));
  const expenses = useQuery(expensesQuery({ month, year }));
  const accounts = useQuery(accountsQuery());
  const cards = useQuery(cardsQuery());
  const categories = useQuery(categoriesQuery());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MovementItem | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { kind: "EXPENSE", occurredAt: nowIsoDateTime(), installmentCount: 1 },
  });
  const kind = form.watch("kind");

  const save = useMutation({
    mutationFn: (values: Values) => {
      if (values.kind === "CARD_EXPENSE") {
        return api<Expense>(editing?.kind === "card-expense" ? `/expenses/${editing.id}` : "/expenses", {
          method: editing?.kind === "card-expense" ? "PUT" : "POST",
          body: {
            name: values.title,
            amount: values.amount,
            installmentCount: values.installmentCount || 1,
            purchaseDate: values.occurredAt,
            description: null,
            cardId: values.cardId,
            categoryId: values.categoryId || null,
          },
        });
      }

      return api<Transaction>("/transactions", {
        method: "POST",
        body: {
          type: values.kind,
          amount: values.amount,
          occurredAt: values.occurredAt,
          description: values.title,
          accountId: values.accountId,
          categoryId: values.kind === "ADJUSTMENT" ? null : values.categoryId || null,
        },
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Lancamento atualizado" : "Lancamento criado");
      invalidateFinanceQueries(qc);
      setOpen(false);
      setEditing(null);
      form.reset({ kind: "EXPENSE", occurredAt: nowIsoDateTime(), installmentCount: 1 });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const removeTransaction = useMutation({
    mutationFn: (id: number) => api(`/transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Lancamento removido");
      invalidateFinanceQueries(qc);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const removeExpense = useMutation({
    mutationFn: (id: number) => api(`/expenses/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Compra removida");
      invalidateFinanceQueries(qc);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const monthOptions = useMonthOptions();
  const activeAccounts = (accounts.data ?? []).filter((account) => account.active);
  const activeCards = (cards.data ?? []).filter((card) => card.active);
  const filteredCategories = (categories.data ?? []).filter((category) => {
    if (!category.active || kind === "ADJUSTMENT") return false;
    if (kind === "INCOME") return category.type === "INCOME";
    return category.type === "EXPENSE";
  });
  const accountName = (id: number) => accounts.data?.find((account) => account.id === id)?.name ?? `Conta #${id}`;
  const cardName = (id?: number | null) => cards.data?.find((card) => card.id === id)?.name ?? `Cartao #${id ?? ""}`;
  const items = mergeMovements(tx.data ?? [], expenses.data ?? []);

  const openNew = () => {
    setEditing(null);
    form.reset({ kind: "EXPENSE", occurredAt: nowIsoDateTime(), installmentCount: 1 });
    setOpen(true);
  };

  const openEdit = (item: MovementItem) => {
    if (item.kind !== "card-expense") {
      toast.info("Este tipo de lancamento nao tem endpoint de edicao na API.");
      return;
    }
    setEditing(item);
    form.reset({
      kind: "CARD_EXPENSE",
      title: item.title,
      amount: item.amount,
      occurredAt: item.occurredAt.slice(0, 16),
      cardId: item.cardId ?? undefined,
      categoryId: item.categoryId ?? undefined,
      installmentCount: item.installmentCount,
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
            <DialogContent>
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
                        form.setValue("kind", value as MovementKind, { shouldDirty: true, shouldValidate: true });
                        form.setValue("categoryId", undefined);
                        form.setValue("accountId", undefined);
                        form.setValue("cardId", undefined);
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
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Valor</Label>
                    <Input type="number" step="0.01" {...form.register("amount")} />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label>Descricao</Label>
                    <Input {...form.register("title")} placeholder="ex: Mercado, salario, farmacia" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label>Quando</Label>
                    <Input type="datetime-local" {...form.register("occurredAt")} />
                  </div>
                  {kind === "CARD_EXPENSE" ? (
                    <>
                      <div className="space-y-1.5">
                        <Label>Cartao</Label>
                        <Select
                          value={form.watch("cardId") ? String(form.watch("cardId")) : undefined}
                          onValueChange={(value) => form.setValue("cardId", Number(value), { shouldValidate: true })}
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
                      </div>
                      <div className="space-y-1.5">
                        <Label>Parcelas</Label>
                        <Input type="number" min={1} {...form.register("installmentCount")} />
                      </div>
                    </>
                  ) : (
                    <div className="space-y-1.5">
                      <Label>Conta</Label>
                      <Select
                        value={form.watch("accountId") ? String(form.watch("accountId")) : undefined}
                        onValueChange={(value) => form.setValue("accountId", Number(value), { shouldValidate: true })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeAccounts.map((account) => (
                            <SelectItem key={account.id} value={String(account.id)}>
                              {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {kind !== "ADJUSTMENT" && (
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
          {tx.isLoading || expenses.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando...</p>
          ) : !items.length ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum lancamento nesse mes.</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={`${item.kind}-${item.id}`} className="flex items-center gap-3 p-4">
                  <div
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                      item.kind === "transaction" && isInflow(item.type)
                        ? "bg-[color-mix(in_oklab,var(--success)_15%,transparent)]"
                        : "bg-accent"
                    }`}
                  >
                    {item.kind === "card-expense" ? (
                      <CreditCard className="h-4 w-4 text-primary" />
                    ) : isInflow(item.type) ? (
                      <ArrowDownRight className="h-4 w-4 text-[var(--success)]" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{item.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(item.occurredAt)} -{" "}
                      {item.kind === "card-expense" ? `${cardName(item.cardId)} - ${item.installmentCount}x` : accountName(item.accountId)}
                    </div>
                  </div>
                  <div
                    className={`text-sm font-semibold tabular-nums ${
                      item.kind === "transaction" && isInflow(item.type) ? "text-[var(--success)]" : "text-foreground"
                    }`}
                  >
                    {item.kind === "transaction" && isInflow(item.type) ? "+" : "-"}
                    {formatBRL(Math.abs(item.amount))}
                  </div>
                  {item.kind === "card-expense" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(item)}
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                  {(item.kind === "card-expense" || item.type !== "CARD_PAYMENT") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        if (!confirm("Remover este lancamento?")) return;
                        if (item.kind === "card-expense") removeExpense.mutate(item.id);
                        else removeTransaction.mutate(item.id);
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

function mergeMovements(transactions: Transaction[], expenses: Expense[]): MovementItem[] {
  return [
    ...transactions.map((transaction): MovementItem => ({
      kind: "transaction",
      id: transaction.id,
      title: transaction.description || labelType(transaction.type),
      amount: transaction.amount,
      occurredAt: transaction.occurredAt,
      type: transaction.type,
      accountId: transaction.accountId,
      categoryId: transaction.categoryId,
    })),
    ...expenses.map((expense): MovementItem => ({
      kind: "card-expense",
      id: expense.id,
      title: expense.name,
      amount: expense.amount,
      occurredAt: expense.purchaseDate,
      cardId: expense.cardId,
      categoryId: expense.categoryId,
      installmentCount: expense.installmentCount,
    })),
  ].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}

function isInflow(type: TransactionType) {
  return type === "INCOME" || type === "TRANSFER_IN";
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
