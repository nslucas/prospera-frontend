import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, Plus, Trash2 } from "lucide-react";
import {
  accountsQuery,
  categoriesQuery,
  transactionsQuery,
} from "@/lib/queries";
import { api, ApiError } from "@/lib/api";
import type { Transaction, TransactionType } from "@/lib/types";
import { currentMonthYear, formatBRL, formatDateTime, monthLabel, nowIsoDateTime } from "@/lib/format";
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

export const Route = createFileRoute("/_app/transactions")({
  component: TransactionsPage,
});

const schema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z.coerce.number().positive("Valor deve ser > 0"),
  occurredAt: z.string().min(1, "Informe a data"),
  description: z.string().optional(),
  accountId: z.coerce.number().int().positive("Selecione uma conta"),
  categoryId: z.coerce.number().int().optional(),
});
type Values = z.infer<typeof schema>;

function TransactionsPage() {
  const qc = useQueryClient();
  const [{ month, year }, setPeriod] = useState(currentMonthYear);
  const tx = useQuery(transactionsQuery({ month, year }));
  const accounts = useQuery(accountsQuery());
  const categories = useQuery(categoriesQuery());
  const [open, setOpen] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { type: "EXPENSE", occurredAt: nowIsoDateTime() },
  });
  const watchType = form.watch("type");

  const create = useMutation({
    mutationFn: (v: Values) =>
      api<Transaction>("/transactions", {
        method: "POST",
        body: { ...v, categoryId: v.categoryId || null },
      }),
    onSuccess: () => {
      toast.success("Transação criada");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["summary-monthly"] });
      setOpen(false);
      form.reset({ type: "EXPENSE", occurredAt: nowIsoDateTime() });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api(`/transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Removida");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const monthOptions = useMonthOptions();
  const filteredCategories = (categories.data ?? []).filter((c) => c.type === watchType);
  const accountName = (id: number) => accounts.data?.find((a) => a.id === id)?.name ?? `Conta #${id}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground capitalize">{monthLabel(month, year)}</p>
          <h1 className="font-display text-3xl md:text-4xl">Transações</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={`${month}-${year}`}
            onValueChange={(v) => {
              const [m, y] = v.split("-").map(Number);
              setPeriod({ month: m, year: y });
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((o) => (
                <SelectItem key={o.key} value={o.key}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Nova
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova transação</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={form.handleSubmit((v) => create.mutate(v))}
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Tipo</Label>
                    <Select
                      defaultValue="EXPENSE"
                      onValueChange={(v) =>
                        form.setValue("type", v as TransactionType extends "INCOME" | "EXPENSE" ? "INCOME" | "EXPENSE" : never)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EXPENSE">Despesa</SelectItem>
                        <SelectItem value="INCOME">Receita</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Valor</Label>
                    <Input type="number" step="0.01" {...form.register("amount")} />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label>Quando</Label>
                    <Input type="datetime-local" {...form.register("occurredAt")} />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label>Descrição</Label>
                    <Input {...form.register("description")} placeholder="opcional" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Conta</Label>
                    <Select onValueChange={(v) => form.setValue("accountId", Number(v))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.data?.map((a) => (
                          <SelectItem key={a.id} value={String(a.id)}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Categoria</Label>
                    <Select
                      onValueChange={(v) =>
                        form.setValue("categoryId", v === "_none" ? undefined : Number(v))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Opcional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Sem categoria</SelectItem>
                        {filteredCategories.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={create.isPending}>
                    {create.isPending ? "Salvando…" : "Salvar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {tx.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando…</p>
          ) : !tx.data?.length ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhuma transação nesse mês.</p>
          ) : (
            <ul className="divide-y divide-border">
              {tx.data.map((t) => (
                <li key={t.id} className="flex items-center gap-3 p-4">
                  <div
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                      isInflow(t.type) ? "bg-[color-mix(in_oklab,var(--success)_15%,transparent)]" : "bg-accent"
                    }`}
                  >
                    {isInflow(t.type) ? (
                      <ArrowDownRight className="h-4 w-4 text-[var(--success)]" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {t.description || labelType(t.type)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(t.occurredAt)} • {accountName(t.accountId)}
                    </div>
                  </div>
                  <div
                    className={`text-sm font-semibold tabular-nums ${
                      isInflow(t.type) ? "text-[var(--success)]" : "text-foreground"
                    }`}
                  >
                    {isInflow(t.type) ? "+" : "−"}
                    {formatBRL(Math.abs(t.amount))}
                  </div>
                  {t.type !== "CARD_PAYMENT" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        if (confirm("Remover esta transação?")) remove.mutate(t.id);
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

function isInflow(t: TransactionType) {
  return t === "INCOME" || t === "TRANSFER_IN";
}

function labelType(t: TransactionType): string {
  const map: Record<TransactionType, string> = {
    INCOME: "Receita",
    EXPENSE: "Despesa",
    TRANSFER_IN: "Transferência recebida",
    TRANSFER_OUT: "Transferência enviada",
    CARD_PAYMENT: "Pagamento de fatura",
    ADJUSTMENT: "Ajuste",
  };
  return map[t];
}

function useMonthOptions() {
  const now = new Date();
  const out: { key: string; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    out.push({ key: `${m}-${y}`, label: monthLabel(m, y) });
  }
  return out;
}
