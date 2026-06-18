import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { budgetProgressQuery, categoriesQuery } from "@/lib/queries";
import { api, ApiError } from "@/lib/api";
import type { Budget } from "@/lib/types";
import { currentMonthYear, formatBRL, monthLabel } from "@/lib/format";
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

export const Route = createFileRoute("/_app/budgets")({
  component: BudgetsPage,
});

const schema = z.object({
  categoryId: z.coerce.number().int().positive("Selecione uma categoria"),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000),
  amount: z.coerce.number().positive("Valor deve ser > 0"),
});
type Values = z.infer<typeof schema>;

function BudgetsPage() {
  const qc = useQueryClient();
  const { month, year } = currentMonthYear();
  const progress = useQuery(budgetProgressQuery(month, year));
  const categories = useQuery(categoriesQuery());
  const [open, setOpen] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { month, year, amount: 0 },
  });

  const create = useMutation({
    mutationFn: (v: Values) => api<Budget>("/budgets", { method: "POST", body: v }),
    onSuccess: () => {
      toast.success("Orçamento criado");
      qc.invalidateQueries({ queryKey: ["budget-progress"] });
      qc.invalidateQueries({ queryKey: ["budgets"] });
      setOpen(false);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api(`/budgets/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["budget-progress"] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const expenseCats = (categories.data ?? []).filter((c) => c.type === "EXPENSE" && c.active);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground capitalize">{monthLabel(month, year)}</p>
          <h1 className="font-display text-3xl md:text-4xl">Orçamentos</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> Novo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo orçamento</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select onValueChange={(v) => form.setValue("categoryId", Number(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCats.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Mês</Label>
                  <Input type="number" min={1} max={12} {...form.register("month")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Ano</Label>
                  <Input type="number" {...form.register("year")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Valor</Label>
                  <Input type="number" step="0.01" {...form.register("amount")} />
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

      {progress.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : !progress.data?.length ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Nenhum orçamento no mês.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {progress.data.map((p) => (
            <Card key={p.budgetId}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{p.categoryName}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatBRL(p.spentAmount)} de {formatBRL(p.budgetAmount)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        p.status === "OVER_BUDGET"
                          ? "destructive"
                          : p.status === "NEAR_LIMIT"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {p.percentUsed.toFixed(0)}%
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        if (confirm("Remover orçamento?")) remove.mutate(p.budgetId);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
                <Progress value={Math.min(100, p.percentUsed)} className="mt-3" />
                <div className="mt-2 text-xs text-muted-foreground">
                  Restam {formatBRL(Math.max(0, p.remainingAmount))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
