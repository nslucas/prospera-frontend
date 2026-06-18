import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2, Wallet } from "lucide-react";
import { accountsQuery } from "@/lib/queries";
import { api, ApiError } from "@/lib/api";
import type { Account, AccountType } from "@/lib/types";
import { formatBRL } from "@/lib/format";
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

export const Route = createFileRoute("/_app/accounts")({
  component: AccountsPage,
});

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

function AccountsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(accountsQuery());
  const [open, setOpen] = useState(false);

  const create = useMutation({
    mutationFn: (v: Values) => api<Account>("/accounts", { method: "POST", body: v }),
    onSuccess: () => {
      toast.success("Conta criada");
      qc.invalidateQueries({ queryKey: ["accounts"] });
      setOpen(false);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api(`/accounts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Conta desativada");
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { type: "CHECKING", currency: "BRL", balance: 0 },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl">Contas</h1>
          <p className="text-sm text-muted-foreground">Suas contas correntes, poupanças e mais.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> Nova conta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova conta</DialogTitle>
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
                    defaultValue="CHECKING"
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
                <Input type="number" step="0.01" {...form.register("balance")} />
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
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (confirm(`Desativar a conta "${a.name}"?`)) remove.mutate(a.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
