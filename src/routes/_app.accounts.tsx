import { useAsyncData, useAsyncMutation } from "@/hooks/use-async-data";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeftRight, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { fetchAccounts } from "@/lib/queries";
import { api } from "@/lib/api";
import type { Account, AccountType } from "@/lib/types";
import { formatBRL, nowIsoDateTime } from "@/lib/format";
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
import { CurrencyAmountInput } from "@/components/currency-amount-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "CHECKING", label: "Conta Corrente" },
  { value: "SAVINGS", label: "Poupança" },
  { value: "CASH", label: "Dinheiro" },
  { value: "OTHER", label: "Outra" },
];

const schema = z.object({
  name: z.string().min(1, "Informe um nome"),
  type: z.enum(["CHECKING", "SAVINGS", "CASH", "OTHER"]),
  balance: z.coerce.number().min(0, "Saldo inicial deve ser ≥ 0"),
  currency: z.string().min(3).max(3),
});
type Values = z.infer<typeof schema>;

const transferSchema = z.object({
  targetAccountId: z.coerce.number().int().positive("Selecione a conta de destino"),
  amount: z.coerce.number().positive("Valor deve ser > 0"),
  occurredAt: z.string().min(1, "Informe a data"),
  description: z.string().optional(),
});
type TransferValues = z.infer<typeof transferSchema>;

export default function AccountsPage() {
  const { data, isLoading, reload } = useAsyncData(() => fetchAccounts(), []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [transferSource, setTransferSource] = useState<Account | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { type: "CHECKING", currency: "BRL", balance: 0 },
  });
  const transferForm = useForm<TransferValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: { occurredAt: nowIsoDateTime() },
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset({
        name: editing.name,
        type: editing.type,
        balance: editing.balance,
        currency: editing.currency || "BRL",
      });
    } else {
      form.reset({ type: "CHECKING", currency: "BRL", balance: 0, name: "" });
    }
  }, [editing, form, open]);

  const create = useAsyncMutation({
    mutationFn: (v: Values) =>
      editing
        ? api<Account>(`/accounts/${editing.id}`, {
            method: "PUT",
            body: { name: v.name, type: v.type, currency: v.currency },
          })
        : api<Account>("/accounts", { method: "POST", body: v }),
    onSuccess: () => {
      toast.success(editing ? "Conta atualizada" : "Conta criada");
      reload();
      setOpen(false);
      setEditing(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useAsyncMutation({
    mutationFn: (id: number) => api(`/accounts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Conta desativada");
      reload();
    },
    onError: (e) => toast.error(e.message),
  });

  const transfer = useAsyncMutation({
    mutationFn: ({ sourceId, values }: { sourceId: number; values: TransferValues }) =>
      api(`/accounts/${sourceId}/transfers`, {
        method: "POST",
        body: { ...values, description: values.description || null },
      }),
    onSuccess: () => {
      toast.success("Transferência registrada");
      reload();
      setTransferSource(null);
      transferForm.reset({ occurredAt: nowIsoDateTime() });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Contas</h1>
          <p className="text-sm text-muted-foreground">Suas contas correntes, poupanças e mais.</p>
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
              <Plus className="h-4 w-4" /> Nova conta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar conta" : "Nova conta"}</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit((v) => create.mutate(v))}
            >
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input {...form.register("name")} placeholder="ex: Nubank" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select
                    value={form.watch("type")}
                    onValueChange={(v) => form.setValue("type", v as AccountType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Moeda</Label>
                  <Input {...form.register("currency")} maxLength={3} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Saldo inicial</Label>
                <CurrencyAmountInput
                  value={form.watch("balance")}
                  disabled={!!editing}
                  onChange={(value) => form.setValue("balance", value, { shouldDirty: true, shouldValidate: true })}
                />
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

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : !data?.length ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Wallet className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Cadastre sua primeira conta.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{a.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {ACCOUNT_TYPES.find((t) => t.value === a.type)?.label} • {a.currency}
                  </div>
                  <div className="mt-2 text-xl font-semibold tabular-nums">
                    {formatBRL(a.balance, a.currency || "BRL")}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditing(a);
                      setOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setTransferSource(a);
                      transferForm.reset({ occurredAt: nowIsoDateTime() });
                    }}
                  >
                    <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <ConfirmAction
                    title="Desativar conta?"
                    description={`A conta "${a.name}" será desativada.`}
                    confirmLabel="Desativar"
                    destructive
                    onConfirm={() => remove.mutate(a.id)}
                  >
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </ConfirmAction>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!transferSource} onOpenChange={(next) => !next && setTransferSource(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir de {transferSource?.name}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={transferForm.handleSubmit((values) => {
              if (transferSource) transfer.mutate({ sourceId: transferSource.id, values });
            })}
          >
            <div className="space-y-1.5">
              <Label>Conta de destino</Label>
              <Select onValueChange={(v) => transferForm.setValue("targetAccountId", Number(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(data ?? [])
                    .filter((a) => a.active && a.id !== transferSource?.id)
                    .map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor</Label>
                <CurrencyAmountInput
                  value={transferForm.watch("amount")}
                  onChange={(value) => transferForm.setValue("amount", value, { shouldDirty: true, shouldValidate: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Quando</Label>
                <Input type="datetime-local" {...transferForm.register("occurredAt")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input {...transferForm.register("description")} placeholder="opcional" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={transfer.isPending}>
                {transfer.isPending ? "Salvando…" : "Transferir"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
