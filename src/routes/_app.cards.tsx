import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, CreditCard as CardIcon, Trash2 } from "lucide-react";
import { cardsQuery, currentStatementQuery } from "@/lib/queries";
import { api, ApiError } from "@/lib/api";
import type { Card as CardType } from "@/lib/types";
import { formatBRL } from "@/lib/format";
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

export const Route = createFileRoute("/_app/cards")({
  component: CardsPage,
});

const schema = z.object({
  bankName: z.string().min(1, "Informe o banco"),
  name: z.string().min(1, "Informe o apelido"),
  network: z.string().optional(),
  lastFourDigits: z
    .string()
    .regex(/^\d{4}$/, "4 dígitos")
    .optional()
    .or(z.literal("")),
  creditLimit: z.coerce.number().positive("Limite deve ser > 0"),
  closingDay: z.coerce.number().int().min(1).max(31),
  dueDay: z.coerce.number().int().min(1).max(31),
});
type Values = z.infer<typeof schema>;

function CardsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(cardsQuery());
  const [open, setOpen] = useState(false);

  const create = useMutation({
    mutationFn: (v: Values) =>
      api<CardType>("/cards", {
        method: "POST",
        body: { ...v, lastFourDigits: v.lastFourDigits || null },
      }),
    onSuccess: () => {
      toast.success("Cartão criado");
      qc.invalidateQueries({ queryKey: ["cards"] });
      setOpen(false);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api(`/cards/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Cartão desativado");
      qc.invalidateQueries({ queryKey: ["cards"] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { closingDay: 1, dueDay: 10, creditLimit: 1000 },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl">Cartões</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe limite, fatura e vencimento de cada cartão.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> Novo cartão
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo cartão</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
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
                  <Input {...form.register("network")} placeholder="Visa, Mastercard…" />
                </div>
                <div className="space-y-1.5">
                  <Label>Final (4 dígitos)</Label>
                  <Input maxLength={4} {...form.register("lastFourDigits")} />
                </div>
                <div className="space-y-1.5 col-span-2">
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
            <CardIcon className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Cadastre seu primeiro cartão.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((c) => (
            <CardItem key={c.id} card={c} onDelete={() => remove.mutate(c.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function CardItem({ card, onDelete }: { card: CardType; onDelete: () => void }) {
  const stmt = useQuery(currentStatementQuery(card.id));
  const usedPct =
    stmt.data && card.creditLimit > 0
      ? Math.min(100, ((card.creditLimit - stmt.data.availableLimit) / card.creditLimit) * 100)
      : 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="bg-gradient-to-br from-primary to-[oklch(0.38_0.18_290)] p-5 text-primary-foreground">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs opacity-80">{card.bankName}</div>
              <div className="font-display text-2xl">{card.name}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-primary-foreground/80 hover:bg-white/10 hover:text-primary-foreground"
              onClick={() => {
                if (confirm(`Desativar o cartão "${card.name}"?`)) onDelete();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-8 flex items-end justify-between">
            <div className="font-mono text-lg tracking-widest opacity-90">
              •••• {card.lastFourDigits ?? "····"}
            </div>
            <div className="text-right text-xs opacity-80">
              <div>Fech. {card.closingDay}</div>
              <div>Venc. {card.dueDay}</div>
            </div>
          </div>
        </div>
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Fatura atual</span>
            {stmt.data && (
              <Badge variant={stmt.data.status === "PAID" ? "secondary" : "outline"}>
                {stmt.data.status.replaceAll("_", " ")}
              </Badge>
            )}
          </div>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs text-muted-foreground">A pagar</div>
              <div className="text-xl font-semibold tabular-nums">
                {formatBRL(stmt.data?.remainingAmount ?? 0)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Limite usado</div>
              <div className="text-sm tabular-nums">
                {formatBRL(card.creditLimit - (stmt.data?.availableLimit ?? card.creditLimit))} /{" "}
                {formatBRL(card.creditLimit)}
              </div>
            </div>
          </div>
          <Progress value={usedPct} />
        </div>
      </CardContent>
    </Card>
  );
}
