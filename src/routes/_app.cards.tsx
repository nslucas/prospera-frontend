import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CreditCard as CardIcon, Pencil, Plus, Trash2, WalletCards } from "lucide-react";
import { accountsQuery, cardPaymentsQuery, cardStatementQuery, cardsQuery } from "@/lib/queries";
import { api, ApiError } from "@/lib/api";
import type { Account, Card as CardType, CardPayment, CardStatement } from "@/lib/types";
import { currentMonthYear, formatBRL, formatDate, monthLabel, todayIsoDate } from "@/lib/format";
import { invalidateFinanceQueries } from "@/lib/query-invalidation";
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

export const Route = createFileRoute("/_app/cards")({
  component: CardsPage,
});

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

function CardsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(cardsQuery());
  const accounts = useQuery(accountsQuery());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CardType | null>(null);

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

  const save = useMutation({
    mutationFn: (v: Values) =>
      api<CardType>(editing ? `/cards/${editing.id}` : "/cards", {
        method: editing ? "PUT" : "POST",
        body: { ...v, network: v.network || null, lastFourDigits: v.lastFourDigits || null },
      }),
    onSuccess: () => {
      toast.success(editing ? "Cartao atualizado" : "Cartao criado");
      invalidateFinanceQueries(qc);
      setOpen(false);
      setEditing(null);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api(`/cards/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Cartao desativado");
      invalidateFinanceQueries(qc);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Cartoes</h1>
          <p className="text-sm text-muted-foreground">Acompanhe limite, fatura e vencimento de cada cartao.</p>
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
              <Plus className="h-4 w-4" /> Novo cartao
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar cartao" : "Novo cartao"}</DialogTitle>
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
                  <Input type="number" step="0.01" {...form.register("creditLimit")} />
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
            <p className="text-sm text-muted-foreground">Cadastre seu primeiro cartao.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              accounts={accounts.data ?? []}
              onEdit={() => {
                setEditing(card);
                setOpen(true);
              }}
              onDelete={() => remove.mutate(card.id)}
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
  onEdit,
  onDelete,
}: {
  card: CardType;
  accounts: Account[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const qc = useQueryClient();
  const [period, setPeriod] = useState(currentMonthYear);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const stmt = useQuery(cardStatementQuery(card.id, period.month, period.year));
  const payments = useQuery(cardPaymentsQuery(card.id, period.month, period.year));
  const usedPct =
    stmt.data && card.creditLimit > 0
      ? Math.min(100, ((card.creditLimit - stmt.data.availableLimit) / card.creditLimit) * 100)
      : 0;
  const activeAccounts = accounts.filter((a) => a.active);
  const accountName = (id: number) => accounts.find((a) => a.id === id)?.name ?? `Conta #${id}`;

  const paymentForm = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { paymentDate: todayIsoDate() },
  });

  const payStatement = useMutation({
    mutationFn: (values: PaymentValues) =>
      api(`/cards/${card.id}/payments`, {
        method: "POST",
        body: {
          ...values,
          month: period.month,
          year: period.year,
          description: values.description || null,
        },
      }),
    onSuccess: () => {
      toast.success("Pagamento registrado");
      invalidateFinanceQueries(qc);
      setPaymentOpen(false);
      paymentForm.reset({ paymentDate: todayIsoDate() });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-white via-[color-mix(in_oklab,var(--accent)_65%,white)] to-white p-5 text-foreground">
          <div className="absolute right-5 top-5 h-16 w-24 rounded-lg border border-primary/15 bg-white/58 shadow-inner" />
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-medium text-primary">{card.bankName}</div>
              <div className="text-2xl font-semibold tracking-tight">{card.name}</div>
            </div>
            <div className="relative flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-white/70" onClick={onEdit}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:bg-white/70"
                onClick={() => {
                  if (confirm(`Desativar o cartao "${card.name}"?`)) onDelete();
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="relative mt-8 flex items-end justify-between">
            <div className="font-mono text-lg tracking-widest text-foreground/80">**** {card.lastFourDigits ?? "0000"}</div>
            <div className="text-right text-xs text-muted-foreground">
              <div>Fech. {card.closingDay}</div>
              <div>Venc. {card.dueDay}</div>
            </div>
          </div>
        </div>
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Fatura</span>
            <Select
              value={`${period.month}-${period.year}`}
              onValueChange={(value) => {
                const [month, year] = value.split("-").map(Number);
                setPeriod({ month, year });
              }}
            >
              <SelectTrigger className="h-8 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getMonthOptions().map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {stmt.data && <Badge variant={stmt.data.status === "PAID" ? "secondary" : "outline"}>{stmt.data.status.replaceAll("_", " ")}</Badge>}
          </div>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs text-muted-foreground">A pagar</div>
              <div className="text-xl font-semibold tabular-nums">{formatBRL(stmt.data?.remainingAmount ?? 0)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Limite usado</div>
              <div className="text-sm tabular-nums">
                {formatBRL(card.creditLimit - (stmt.data?.availableLimit ?? card.creditLimit))} / {formatBRL(card.creditLimit)}
              </div>
            </div>
          </div>
          <Progress value={usedPct} />
          {stmt.data && (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>Fecha {formatDate(stmt.data.closingDate)}</span>
              <span>Vence {formatDate(stmt.data.dueDate)}</span>
            </div>
          )}

          <CardMovements stmt={stmt} payments={payments} accountName={accountName} />

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
                      <Input type="number" step="0.01" {...paymentForm.register("amount")} />
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

function CardMovements({
  stmt,
  payments,
  accountName,
}: {
  stmt: UseQueryResult<CardStatement, Error>;
  payments: UseQueryResult<CardPayment[], Error>;
  accountName: (id: number) => string;
}) {
  const statement = stmt.data;
  return (
    <>
      <div className="rounded-md border border-border/70">
        <div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
          <div className="text-xs font-medium text-muted-foreground">Compras da fatura</div>
          <div className="text-xs tabular-nums text-muted-foreground">{formatBRL(statement?.totalAmount ?? 0)}</div>
        </div>
        {stmt.isLoading ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">Carregando...</p>
        ) : !statement?.installments.length ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">Nenhuma compra nesta fatura.</p>
        ) : (
          <ul className="divide-y divide-border/70">
            {statement.installments.map((item) => (
              <li key={`${item.expenseId}-${item.installmentNumber}`} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{item.expenseName}</div>
                  <div className="text-xs text-muted-foreground">
                    Parcela {item.installmentNumber}
                    {item.totalInstallments ? `/${item.totalInstallments}` : ""}
                    {item.dueDate ? ` - ${formatDate(item.dueDate)}` : ""}
                  </div>
                </div>
                <div className="shrink-0 text-sm font-semibold tabular-nums">{formatBRL(item.amount)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-md border border-border/70">
        <div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
          <div className="text-xs font-medium text-muted-foreground">Pagamentos</div>
          <div className="text-xs tabular-nums text-muted-foreground">{formatBRL(statement?.paidAmount ?? 0)}</div>
        </div>
        {payments.isLoading ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">Carregando...</p>
        ) : !payments.data?.length ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">Nenhum pagamento nesta fatura.</p>
        ) : (
          <ul className="divide-y divide-border/70">
            {payments.data.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{payment.description || "Pagamento de fatura"}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(payment.paymentDate)} - {accountName(payment.accountId)}
                  </div>
                </div>
                <div className="shrink-0 text-sm font-semibold tabular-nums text-[var(--success)]">{formatBRL(payment.amount)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function getMonthOptions() {
  const now = new Date();
  const out: { key: string; label: string }[] = [];
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    out.push({ key: `${m}-${y}`, label: monthLabel(m, y) });
  }
  return out;
}
