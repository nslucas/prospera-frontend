import { useAsyncData, useAsyncMutation } from "@/hooks/use-async-data";
import { useFinanceUpdates } from "@/hooks/use-finance-updates";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CreditCard as CardIcon, Pencil, Plus, Trash2, WalletCards } from "lucide-react";
import {
  fetchAccounts,
  fetchCardStatement,
  fetchCardSummary,
  fetchCards,
  fetchExpenses,
} from "@/lib/queries";
import { api } from "@/lib/api";
import { getBankBrand as getSharedBankBrand } from "@/lib/bank-brand";
import { cardStatementStatusLabel } from "@/lib/card-labels";
import type { Account, Card as CardType, Expense } from "@/lib/types";
import { currentMonthYear, formatBRL, formatDate, todayIsoDate } from "@/lib/format";
import { ConfirmAction } from "@/components/confirm-action";
import { PeriodPicker } from "@/components/period-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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

const schema = z.object({
  bankName: z.string().min(1, "Informe o banco"),
  name: z.string().min(1, "Informe o apelido"),
  network: z.string().optional(),
  lastFourDigits: z
    .string()
    .regex(/^\d{4}$/, "4 digitos")
    .optional()
    .or(z.literal("")),
  creditLimit: z.coerce.number().positive("Limite deve ser > 0"),
  closingDay: z.coerce.number().int().min(1).max(31),
  dueDay: z.coerce.number().int().min(1).max(31),
});
type Values = z.infer<typeof schema>;

const paymentSchema = z.object({
  accountId: z.coerce.number().int().positive("Selecione uma conta"),
  amount: z.coerce.number().positive("Valor deve ser > 0"),
  paymentDate: z.string().min(1, "Informe a data"),
  description: z.string().optional(),
});
type PaymentValues = z.infer<typeof paymentSchema>;

const EMPTY_EXPENSES: Expense[] = [];
const DEFAULT_CARD_VALUES: Values = {
  bankName: "",
  name: "",
  network: "",
  lastFourDigits: "",
  closingDay: 1,
  dueDay: 10,
  creditLimit: 1000,
};

export default function CardsPage() {
  const { data, isLoading, reload } = useAsyncData(() => fetchCards(), [], { cacheKey: "cards" });
  const accounts = useAsyncData(() => fetchAccounts(), [], { cacheKey: "accounts" });
  const [selectedPeriod, setSelectedPeriod] = useState<{ month: number; year: number } | null>(
    null,
  );
  const period =
    selectedPeriod ?? (data?.length ? currentOpenStatementPeriod(data[0]) : currentMonthYear());
  const statementSummary = useAsyncData(
    () => fetchCardSummary(period.month, period.year),
    [period.month, period.year],
    { cacheKey: `summary-cards:${period.month}:${period.year}` },
  );
  const totalStatementAmount =
    statementSummary.data?.reduce((total, card) => total + Number(card.totalAmount ?? 0), 0) ?? 0;
  const totalRemaining =
    statementSummary.data?.reduce(
      (total, card) => total + Math.max(0, Number(card.remainingAmount ?? 0)),
      0,
    ) ?? 0;
  const allExpenses = useAsyncData(() => fetchExpenses({}), [], {
    cacheKey: "expenses:all",
    staleMs: 60_000,
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CardType | null>(null);
  const expensesByCard = useMemo(() => {
    const grouped = new Map<number, Expense[]>();
    for (const expense of allExpenses.data ?? []) {
      if (!expense.cardId) continue;
      const current = grouped.get(expense.cardId);
      if (current) current.push(expense);
      else grouped.set(expense.cardId, [expense]);
    }
    return grouped;
  }, [allExpenses.data]);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULT_CARD_VALUES,
  });

  function resetCardForm(card: CardType | null = null) {
    form.reset(
      card
        ? {
            bankName: card.bankName,
            name: card.name,
            network: card.network ?? "",
            lastFourDigits: card.lastFourDigits ?? "",
            creditLimit: card.creditLimit,
            closingDay: card.closingDay,
            dueDay: card.dueDay,
          }
        : DEFAULT_CARD_VALUES,
    );
  }

  function openCreateDialog() {
    setEditing(null);
    resetCardForm();
    setOpen(true);
  }

  function openEditDialog(card: CardType) {
    setEditing(card);
    resetCardForm(card);
    setOpen(true);
  }

  function changeDialogOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setEditing(null);
  }

  const reloadCardsData = () => {
    reload();
    accounts.reload();
    allExpenses.reload();
  };
  useFinanceUpdates(reloadCardsData);

  const save = useAsyncMutation({
    mutationFn: (v: Values) =>
      api<CardType>(editing ? `/cards/${editing.id}` : "/cards", {
        method: editing ? "PUT" : "POST",
        body: { ...v, network: v.network || null, lastFourDigits: v.lastFourDigits || null },
      }),
    onSuccess: () => {
      toast.success(editing ? "Cartão atualizado" : "Cartão criado");
      reloadCardsData();
      setOpen(false);
      setEditing(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useAsyncMutation({
    mutationFn: (id: number) => api(`/cards/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Cartão desativado");
      reloadCardsData();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Cartões</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe limite, fatura e vencimento de cada cartão.
          </p>
        </div>
        <Dialog open={open} onOpenChange={changeDialogOpen}>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4" /> Novo cartão
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar cartão" : "Novo cartão"}</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Banco</Label>
                  <Input {...form.register("bankName")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Apelido</Label>
                  <Input {...form.register("name")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Bandeira</Label>
                  <Input {...form.register("network")} placeholder="Visa, Mastercard" />
                </div>
                <div className="space-y-1.5">
                  <Label>Final (4 digitos)</Label>
                  <Input maxLength={4} {...form.register("lastFourDigits")} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Limite</Label>
                  <CurrencyAmountInput
                    value={form.watch("creditLimit")}
                    onChange={(value) =>
                      form.setValue("creditLimit", value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fechamento</Label>
                  <Input type="number" min={1} max={31} {...form.register("closingDay")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Vencimento</Label>
                  <Input type="number" min={1} max={31} {...form.register("dueDay")} />
                </div>
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

      {!!data?.length && (
        <Card className="border-border/70 shadow-sm">
          <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <WalletCards className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Total das faturas</div>
                <div className="text-xl font-semibold tabular-nums">
                  {statementSummary.isLoading && !statementSummary.data
                    ? "..."
                    : formatBRL(totalStatementAmount)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Em aberto: {formatBRL(totalRemaining)}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="text-xs text-muted-foreground">
                {statementSummary.data?.length ?? data.length} cartões
              </span>
              <PeriodPicker
                month={period.month}
                year={period.year}
                onChange={setSelectedPeriod}
                className="h-9 min-w-0 rounded-xl px-3 text-sm"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !data?.length ? (
        <Card>
          <CardContent className="p-10 text-center">
            <CardIcon className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Cadastre seu primeiro cartão.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              period={period}
              accounts={accounts.data ?? []}
              cardExpenses={expensesByCard.get(card.id) ?? EMPTY_EXPENSES}
              onEdit={() => openEditDialog(card)}
              onDelete={() => remove.mutate(card.id)}
              onRefresh={reloadCardsData}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CardItem({
  card,
  period,
  accounts,
  cardExpenses,
  onEdit,
  onDelete,
  onRefresh,
}: {
  card: CardType;
  period: { month: number; year: number };
  accounts: Account[];
  cardExpenses: Expense[];
  onEdit: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const [paymentOpen, setPaymentOpen] = useState(false);
  const stmt = useAsyncData(
    () => fetchCardStatement(card.id, period.month, period.year),
    [card.id, period.month, period.year],
    {
      cacheKey: `card-statement:${card.id}:${period.month}:${period.year}`,
    },
  );
  const brand = useMemo(() => getSharedBankBrand(card.bankName), [card.bankName]);
  const usedLimit = useMemo(
    () => cardExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0),
    [cardExpenses],
  );
  const fallbackAvailableLimit = Math.max(0, Number(card.creditLimit) - usedLimit);
  const availableLimit = stmt.data
    ? Number(stmt.data.availableLimit ?? fallbackAvailableLimit)
    : fallbackAvailableLimit;
  const displayedUsedLimit = Math.max(0, Number(card.creditLimit) - availableLimit);
  const usedPct =
    card.creditLimit > 0 ? Math.min(100, (displayedUsedLimit / card.creditLimit) * 100) : 0;
  const activeAccounts = useMemo(() => accounts.filter((account) => account.active), [accounts]);
  const paymentForm = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { paymentDate: todayIsoDate() },
  });

  const payStatement = useAsyncMutation({
    mutationFn: (values: PaymentValues) =>
      api(`/cards/${card.id}/payments`, {
        method: "POST",
        body: {
          ...values,
          month: stmt.data?.month ?? period.month,
          year: stmt.data?.year ?? period.year,
          description: values.description || null,
        },
      }),
    onSuccess: () => {
      toast.success("Pagamento registrado");
      stmt.reload();
      onRefresh();
      setPaymentOpen(false);
      paymentForm.reset({ paymentDate: todayIsoDate() });
    },
    onError: (e) => toast.error(e.message),
  });
  useFinanceUpdates(() => {
    stmt.reload();
  });

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardContent className="p-0">
        <div className={`relative overflow-hidden bg-gradient-to-r p-3 sm:p-4 ${brand.className}`}>
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex h-7 min-w-0 items-center">
              {brand.logo ? (
                <img
                  src={brand.logo}
                  alt={`${brand.label} logo`}
                  className={`max-h-6 max-w-28 object-contain ${brand.logoClassName}`}
                />
              ) : (
                <div className="truncate text-xs font-semibold uppercase tracking-wide">
                  {card.bankName}
                </div>
              )}
            </div>
            <div className="relative flex shrink-0 gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Editar ${card.name}`}
                className="h-7 w-7 text-current opacity-75 hover:bg-white/15 hover:opacity-100"
                onClick={onEdit}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <ConfirmAction
                title="Desativar cartão?"
                description={`O cartão "${card.name}" será desativado.`}
                confirmLabel="Desativar"
                destructive
                onConfirm={onDelete}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Desativar ${card.name}`}
                  className="h-7 w-7 text-current opacity-75 hover:bg-white/15 hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </ConfirmAction>
            </div>
          </div>
          <div className="relative mt-1 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-base font-semibold tracking-tight">{card.name}</div>
              <div className="mt-0.5 flex items-center gap-2 text-xs font-medium opacity-80">
                <span className="font-mono tracking-wider">
                  •••• {card.lastFourDigits ?? "0000"}
                </span>
                <span aria-hidden="true">·</span>
                <span className="truncate">{card.network || card.bankName}</span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[10px] font-medium uppercase opacity-70">Limite</div>
              <div className="whitespace-nowrap text-xs font-semibold tabular-nums sm:text-sm">
                {formatBRL(card.creditLimit)}
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-2.5 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {stmt.data ? (
              <Badge variant={stmt.data.status === "PAID" ? "secondary" : "outline"}>
                {cardStatementStatusLabel(stmt.data.status)}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">
                {stmt.isLoading ? "Carregando fatura..." : "Fatura do período"}
              </span>
            )}
            {stmt.data && (
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span>Fecha {formatDate(stmt.data.closingDate)}</span>
                <span>Vence {formatDate(stmt.data.dueDate)}</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Limite disponível</div>
              <div className="mt-0.5 whitespace-nowrap text-base font-semibold tabular-nums text-primary sm:text-lg">
                {stmt.isLoading && !stmt.data ? "..." : formatBRL(availableLimit)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                de {formatBRL(card.creditLimit)}
              </div>
            </div>
            <div className="min-w-0 text-right">
              <div className="text-xs text-muted-foreground">A pagar na fatura</div>
              <div className="mt-0.5 whitespace-nowrap text-base font-semibold tabular-nums sm:text-lg">
                {formatBRL(stmt.data?.remainingAmount ?? 0)}
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
              <span>Uso do limite</span>
              <span className="tabular-nums">
                {stmt.isLoading && !stmt.data
                  ? "..."
                  : `${usedPct.toFixed(0)}% · ${formatBRL(displayedUsedLimit)}`}
              </span>
            </div>
            <Progress value={usedPct} className="h-1.5" />
          </div>
          <div>
            <Dialog
              open={paymentOpen}
              onOpenChange={(next) => {
                setPaymentOpen(next);
                if (next) {
                  paymentForm.reset({
                    amount: stmt.data?.remainingAmount ?? 0,
                    paymentDate: todayIsoDate(),
                    description: `Pagamento ${card.name}`,
                  });
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-full">
                  <WalletCards className="h-4 w-4" /> Pagar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Pagar fatura de {card.name}</DialogTitle>
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={paymentForm.handleSubmit((v) => payStatement.mutate(v))}
                >
                  <div className="space-y-1.5">
                    <Label>Conta de pagamento</Label>
                    <Select
                      onValueChange={(v) =>
                        paymentForm.setValue("accountId", Number(v), { shouldValidate: true })
                      }
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
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Valor</Label>
                      <CurrencyAmountInput
                        value={paymentForm.watch("amount")}
                        onChange={(value) =>
                          paymentForm.setValue("amount", value, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Data</Label>
                      <Input type="date" {...paymentForm.register("paymentDate")} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Descricao</Label>
                    <Input {...paymentForm.register("description")} placeholder="opcional" />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={payStatement.isPending}>
                      {payStatement.isPending ? "Salvando..." : "Registrar pagamento"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function currentOpenStatementPeriod(card: CardType): { month: number; year: number } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const statementMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  let dueMonth = statementDueMonth(statementMonth, card);
  const dueDate = atConfiguredDay(dueMonth.getFullYear(), dueMonth.getMonth(), card.dueDay);

  if (today > dueDate) {
    statementMonth.setMonth(statementMonth.getMonth() + 1);
    dueMonth = statementDueMonth(statementMonth, card);
  }

  return { month: dueMonth.getMonth() + 1, year: dueMonth.getFullYear() };
}

function statementDueMonth(statementMonth: Date, card: CardType): Date {
  const dueMonth = new Date(statementMonth);
  if (card.dueDay <= card.closingDay) {
    dueMonth.setMonth(dueMonth.getMonth() + 1);
  }
  return dueMonth;
}

function atConfiguredDay(year: number, zeroBasedMonth: number, day: number): Date {
  const lastDay = new Date(year, zeroBasedMonth + 1, 0).getDate();
  return new Date(year, zeroBasedMonth, Math.min(day, lastDay));
}
