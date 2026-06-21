import { useAsyncData, useAsyncMutation } from "@/hooks/use-async-data";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { fetchBudgetProgress, fetchCategories, fetchExpenses, fetchTransactions } from "@/lib/queries";
import { api } from "@/lib/api";
import type { Budget, BudgetProgress, Expense, Transaction } from "@/lib/types";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


const schema = z.object({
  categoryId: z.coerce.number().int().positive("Selecione uma categoria"),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000),
  amount: z.coerce.number().positive("Valor deve ser > 0"),
});
type Values = z.infer<typeof schema>;

export default function BudgetsPage() {
  const [{ month, year }, setPeriod] = useState(currentMonthYear);
  const progress = useAsyncData(() => fetchBudgetProgress(month, year), [month, year]);
  const transactions = useAsyncData(() => fetchTransactions({ month, year }), [month, year]);
  const expenses = useAsyncData(() => fetchExpenses({ month, year }), [month, year]);
  const categories = useAsyncData(() => fetchCategories(), []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { month, year, amount: 0 },
  });

  const save = useAsyncMutation({
    mutationFn: (values: Values) =>
      api<Budget>(editing ? `/budgets/${editing.id}` : "/budgets", {
        method: editing ? "PUT" : "POST",
        body: values,
      }),
    onSuccess: () => {
      toast.success(editing ? "Orcamento atualizado" : "Orcamento criado");
      progress.reload();
      transactions.reload();
      expenses.reload();
      setOpen(false);
      setEditing(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useAsyncMutation({
    mutationFn: (id: number) => api(`/budgets/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Orcamento removido");
      progress.reload();
      transactions.reload();
      expenses.reload();
    },
    onError: (e) => toast.error(e.message),
  });

  const expenseCats = (categories.data ?? []).filter((c) => c.type === "EXPENSE" && c.active);
  const monthOptions = getMonthOptions();
  const progressItems = useMemo(() => {
    if (!progress.data) return [];
    if (!transactions.data || !expenses.data) return progress.data;
    return applyLocalSpending(progress.data, transactions.data ?? [], expenses.data ?? []);
  }, [expenses.data, progress.data, transactions.data]);

  const openNew = () => {
    setEditing(null);
    form.reset({ month, year, amount: 0 });
    setOpen(true);
  };

  const openEdit = (budget: Budget) => {
    setEditing(budget);
    form.reset({
      categoryId: budget.categoryId,
      month: budget.month,
      year: budget.year,
      amount: budget.amount,
    });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground capitalize">{monthLabel(month, year)}</p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Orcamentos</h1>
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
                <DialogTitle>{editing ? "Editar orcamento" : "Novo orcamento"}</DialogTitle>
              </DialogHeader>
              <form className="space-y-4" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Select
                    value={form.watch("categoryId") ? String(form.watch("categoryId")) : undefined}
                    onValueChange={(value) => form.setValue("categoryId", Number(value), { shouldValidate: true })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseCats.map((category) => (
                        <SelectItem key={category.id} value={String(category.id)}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Mes</Label>
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
                  <Button type="submit" disabled={save.isPending}>
                    {save.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {progress.isLoading || transactions.isLoading || expenses.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !progressItems.length ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">Nenhum orcamento no mes.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {progressItems.map((item) => (
            <Card key={item.budgetId}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{item.categoryName}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatBRL(item.spentAmount)} de {formatBRL(item.budgetAmount)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        item.status === "OVER_BUDGET"
                          ? "destructive"
                          : item.status === "NEAR_LIMIT"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {item.percentUsed.toFixed(0)}%
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        openEdit({
                          id: item.budgetId,
                          categoryId: item.categoryId,
                          month: item.month,
                          year: item.year,
                          amount: item.budgetAmount,
                          active: true,
                        })
                      }
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        if (confirm("Remover orcamento?")) remove.mutate(item.budgetId);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
                <Progress value={Math.min(100, item.percentUsed)} className="mt-3" />
                <div className="mt-2 text-xs text-muted-foreground">
                  Restam {formatBRL(Math.max(0, item.remainingAmount))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function getMonthOptions() {
  const now = new Date();
  const out: { key: string; label: string }[] = [];
  for (let i = 0; i < 18; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    out.push({ key: `${month}-${year}`, label: monthLabel(month, year) });
  }
  return out;
}

function applyLocalSpending(
  progress: BudgetProgress[],
  transactions: Transaction[],
  expenses: Expense[],
): BudgetProgress[] {
  const spentByCategory = new Map<number, number>();

  for (const transaction of transactions) {
    if (transaction.type !== "EXPENSE" || !transaction.categoryId) continue;
    addSpent(spentByCategory, transaction.categoryId, Math.abs(transaction.amount));
  }

  for (const expense of expenses) {
    if (!expense.categoryId) continue;
    addSpent(spentByCategory, expense.categoryId, Math.abs(expense.amount));
  }

  return progress.map((item) => {
    const spentAmount = spentByCategory.get(item.categoryId) ?? 0;
    const remainingAmount = item.budgetAmount - spentAmount;
    const percentUsed = item.budgetAmount > 0 ? (spentAmount / item.budgetAmount) * 100 : 0;

    return {
      ...item,
      spentAmount,
      remainingAmount,
      percentUsed,
      status: getBudgetStatus(percentUsed),
    };
  });
}

function addSpent(spentByCategory: Map<number, number>, categoryId: number, amount: number): void {
  spentByCategory.set(categoryId, (spentByCategory.get(categoryId) ?? 0) + amount);
}

function getBudgetStatus(percentUsed: number): BudgetProgress["status"] {
  if (percentUsed >= 100) return "OVER_BUDGET";
  if (percentUsed >= 80) return "NEAR_LIMIT";
  return "UNDER_BUDGET";
}
