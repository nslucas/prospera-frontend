import { useAsyncData, useAsyncMutation } from "@/hooks/use-async-data";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CreditCard as CardIcon, Pencil, Plus, Trash2, WalletCards } from "lucide-react";
import { fetchAccounts, fetchCardStatement, fetchCards, fetchExpenses } from "@/lib/queries";
import { api } from "@/lib/api";
import { getBankBrand as getSharedBankBrand } from "@/lib/bank-brand";
import type { Account, Card as CardType, Expense } from "@/lib/types";
import { formatBRL, formatDate, todayIsoDate } from "@/lib/format";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyAmountInput } from "@/components/currency-amount-input";


const schema = z.object({
  bankName: z.string().min(1, "Informe o banco"),
  name: z.string().min(1, "Informe o apelido"),
  network: z.string().optional(),
  lastFourDigits: z.string().regex(/^\d{4}$/, "4 digitos").optional().or(z.literal("")),
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

export default function CardsPage() {
  const { data, isLoading, reload } = useAsyncData(() => fetchCards(), [], { cacheKey: "cards" });
  const accounts = useAsyncData(() => fetchAccounts(), [], { cacheKey: "accounts" });
  const allExpenses = useAsyncData(() => fetchExpenses({}), [], { cacheKey: "expenses:all", staleMs: 60_000 });
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
    defaultValues: { closingDay: 1, dueDay: 10, creditLimit: 1000 },
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset({
        bankName: editing.bankName,
        name: editing.name,
        network: editing.network ?? "",
        lastFourDigits: editing.lastFourDigits ?? "",
        creditLimit: editing.creditLimit,
        closingDay: editing.closingDay,
        dueDay: editing.dueDay,
      });
    } else {
      form.reset({ bankName: "", name: "", network: "", lastFourDigits: "", closingDay: 1, dueDay: 10, creditLimit: 1000 });
    }
  }, [editing, form, open]);

  const reloadCardsData = () => {
    reload();
    accounts.reload();
    allExpenses.reload();
  };

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
          <p className="text-sm text-muted-foreground">Acompanhe limite, fatura e vencimento de cada cartão.</p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> Novo cartão
            </Button>
          </DialogTrigger>
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
                    onChange={(value) => form.setValue("creditLimit", value, { shouldDirty: true, shouldValidate: true })}
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
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              accounts={accounts.data ?? []}
              cardExpenses={expensesByCard.get(card.id) ?? EMPTY_EXPENSES}
              cardExpensesLoading={allExpenses.isLoading}
              onEdit={() => {
                setEditing(card);
                setOpen(true);
              }}
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
  accounts,
  cardExpenses,
  cardExpensesLoading,
  onEdit,
  onDelete,
  onRefresh,
}: {
  card: CardType;
  accounts: Account[];
  cardExpenses: Expense[];
  cardExpensesLoading: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const [period, setPeriod] = useState(() => currentOpenStatementPeriod(card));
  const [paymentOpen, setPaymentOpen] = useState(false);
  const stmt = useAsyncData(() => fetchCardStatement(card.id, period.month, period.year), [card.id, period.month, period.year], {
    cacheKey: `card-statement:${card.id}:${period.month}:${period.year}`,
  });
  const brand = useMemo(() => getSharedBankBrand(card.bankName), [card.bankName]);
  const usedLimit = useMemo(() => cardExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0), [cardExpenses]);
  const availableLimit = Math.max(0, Number(card.creditLimit) - usedLimit);
  const usedPct = card.creditLimit > 0 ? Math.min(100, (usedLimit / card.creditLimit) * 100) : 0;
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

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardContent className="p-0">
        <div className={`relative min-h-56 overflow-hidden bg-gradient-to-br p-5 ${brand.className}`}>
          <div className={`absolute -right-8 -top-10 h-36 w-36 rounded-full border ${brand.accentClassName}`} />
          <div className={`absolute right-8 top-20 h-16 w-24 rounded-lg border shadow-inner ${brand.accentClassName}`} />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex h-10 max-w-40 items-center">
                {brand.logo ? (
                  <img src={brand.logo} alt={`${brand.label} logo`} className={`max-h-8 max-w-36 object-contain ${brand.logoClassName}`} />
                ) : (
                  <div className="text-sm font-semibold uppercase tracking-wide">{card.bankName}</div>
                )}
              </div>
              <div className="mt-4 truncate text-2xl font-semibold tracking-tight">{card.name}</div>
              <div className="mt-1 text-xs font-medium opacity-75">{card.bankName}</div>
            </div>
            <div className="relative flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-current opacity-75 hover:bg-white/15 hover:opacity-100" onClick={onEdit}>
                <Pencil className="h-4 w-4" />
              </Button>
              <ConfirmAction
                title="Desativar cartão?"
                description={`O cartão "${card.name}" será desativado.`}
                confirmLabel="Desativar"
                destructive
                onConfirm={onDelete}
              >
                <Button variant="ghost" size="icon" className="h-8 w-8 text-current opacity-75 hover:bg-white/15 hover:opacity-100">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </ConfirmAction>
            </div>
          </div>
          <div className="relative mt-12 flex items-end justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase opacity-60">Final</div>
              <div className="font-mono text-xl tracking-widest opacity-90">**** {card.lastFourDigits ?? "0000"}</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-medium uppercase opacity-60">{card.network || "Cartão"}</div>
              <div className="text-sm font-semibold tabular-nums">Limite {formatBRL(card.creditLimit)}</div>
            </div>
          </div>
        </div>
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Fatura</span>
            <PeriodPicker month={period.month} year={period.year} onChange={setPeriod} className="h-10 min-w-[10rem] px-4 text-sm" />
            {stmt.data && <Badge variant={stmt.data.status === "PAID" ? "secondary" : "outline"}>{stmt.data.status.replaceAll("_", " ")}</Badge>}
          </div>
          <div className="grid gap-3 sm:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-md border border-primary/25 bg-primary/5 p-3">
              <div className="text-xs text-muted-foreground">Limite disponivel</div>
              <div className="text-2xl font-semibold tabular-nums text-primary">
                {cardExpensesLoading ? "..." : formatBRL(availableLimit)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">de {formatBRL(card.creditLimit)}</div>
            </div>
            <div className="rounded-md border border-border/70 bg-muted/20 p-3 sm:text-right">
              <div className="text-xs text-muted-foreground">A pagar na fatura</div>
              <div className="text-xl font-semibold tabular-nums">{formatBRL(stmt.data?.remainingAmount ?? 0)}</div>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>Uso do limite</span>
              <span className="tabular-nums">
                {cardExpensesLoading ? "..." : `${formatBRL(usedLimit)} (${usedPct.toFixed(0)}%)`}
              </span>
            </div>
            <Progress value={usedPct} />
          </div>
          {stmt.data && (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>Fecha {formatDate(stmt.data.closingDate)}</span>
              <span>Vence {formatDate(stmt.data.dueDate)}</span>
              <span>Dia cadastro: fecha {card.closingDay}, vence {card.dueDay}</span>
            </div>
          )}

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
                <Button variant="outline" size="sm" className="w-full">
                  <WalletCards className="h-4 w-4" /> Pagar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Pagar fatura de {card.name}</DialogTitle>
                </DialogHeader>
                <form className="space-y-4" onSubmit={paymentForm.handleSubmit((v) => payStatement.mutate(v))}>
                  <div className="space-y-1.5">
                    <Label>Conta de pagamento</Label>
                    <Select onValueChange={(v) => paymentForm.setValue("accountId", Number(v), { shouldValidate: true })}>
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
                        onChange={(value) => paymentForm.setValue("amount", value, { shouldDirty: true, shouldValidate: true })}
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
  const closingDate = atConfiguredDay(statementMonth.getFullYear(), statementMonth.getMonth(), card.closingDay);

  if (today > closingDate) {
    statementMonth.setMonth(statementMonth.getMonth() + 1);
  }

  const dueMonth = new Date(statementMonth);
  if (card.dueDay <= card.closingDay) {
    dueMonth.setMonth(dueMonth.getMonth() + 1);
  }

  return { month: dueMonth.getMonth() + 1, year: dueMonth.getFullYear() };
}

function atConfiguredDay(year: number, zeroBasedMonth: number, day: number): Date {
  const lastDay = new Date(year, zeroBasedMonth + 1, 0).getDate();
  return new Date(year, zeroBasedMonth, Math.min(day, lastDay));
}

