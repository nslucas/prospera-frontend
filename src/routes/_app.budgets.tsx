import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { useAsyncData, useAsyncMutation } from "@/hooks/use-async-data";
import { useFinanceUpdates } from "@/hooks/use-finance-updates";
import { api } from "@/lib/api";
import { fetchBudgetProgress, fetchBudgets, fetchCategories } from "@/lib/queries";
import type { Budget, BudgetProgress } from "@/lib/types";
import { currentMonthYear, formatBRL, monthLabel } from "@/lib/format";
import { ConfirmAction } from "@/components/confirm-action";
import { CurrencyAmountInput } from "@/components/currency-amount-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const GLOBAL_BUDGET_VALUE = "global";

const schema = z
  .object({
    categoryId: z.number().int().positive().nullable(),
    month: z.coerce.number().int().min(1).max(12).nullable(),
    year: z.coerce.number().int().min(2000).nullable(),
    amount: z.coerce.number().positive("Valor deve ser > 0"),
  })
  .refine((values) => (values.month === null) === (values.year === null), {
    path: ["month"],
    message: "Informe mês e ano juntos, ou deixe ambos em branco.",
  });

type Values = z.infer<typeof schema>;

const STATUS_LABELS: Record<BudgetProgress["status"], string> = {
  UNDER_BUDGET: "Dentro",
  NEAR_LIMIT: "Perto do limite",
  OVER_BUDGET: "Estourado",
};

export default function BudgetsPage() {
  const [{ month, year }, setPeriod] = useState(currentMonthYear);
  const progress = useAsyncData(() => fetchBudgetProgress(month, year), [month, year], {
    cacheKey: `budget-progress:${month}:${year}`,
  });
  const budgets = useAsyncData(() => fetchBudgets({ month, year }), [month, year], {
    cacheKey: `budgets:${month}:${year}`,
  });
  const categories = useAsyncData(() => fetchCategories(), [], {
    cacheKey: "categories",
    staleMs: 60_000,
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { categoryId: null, month, year, amount: 0 },
  });

  const selectedCategoryId = form.watch("categoryId");
  const selectedMonth = form.watch("month");
  const selectedYear = form.watch("year");
  const repeatsEveryMonth = selectedMonth === null && selectedYear === null;
  const selectedScopeValue =
    selectedCategoryId === null ? GLOBAL_BUDGET_VALUE : String(selectedCategoryId);

  const save = useAsyncMutation({
    mutationFn: (values: Values) =>
      api<Budget>(editing ? `/budgets/${editing.id}` : "/budgets", {
        method: editing ? "PUT" : "POST",
        body: values,
      }),
    onSuccess: async () => {
      toast.success(editing ? "Orçamento atualizado" : "Orçamento criado");
      await Promise.all([progress.reload(), budgets.reload()]);
      setOpen(false);
      setEditing(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useAsyncMutation({
    mutationFn: (id: number) => api(`/budgets/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      toast.success("Orçamento removido");
      await Promise.all([progress.reload(), budgets.reload()]);
    },
    onError: (e) => toast.error(e.message),
  });
  useFinanceUpdates(() => {
    progress.reload();
    budgets.reload();
  });

  const expenseCats = (categories.data ?? []).filter(
    (category) => category.type === "EXPENSE" && category.active,
  );
  const monthOptions = getMonthOptions();
  const progressItems = progress.data ?? [];
  const budgetsById = useMemo(
    () => new Map((budgets.data ?? []).map((budget) => [budget.id, budget])),
    [budgets.data],
  );

  const openNew = () => {
    setEditing(null);
    form.reset({ categoryId: null, month, year, amount: 0 });
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

  const toggleRecurring = (checked: boolean) => {
    if (checked) {
      form.setValue("month", null, { shouldDirty: true, shouldValidate: true });
      form.setValue("year", null, { shouldDirty: true, shouldValidate: true });
      return;
    }

    form.setValue("month", month, { shouldDirty: true, shouldValidate: true });
    form.setValue("year", year, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground capitalize">{monthLabel(month, year)}</p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Orçamentos</h1>
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
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" /> Novo
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Editar orçamento" : "Novo orçamento"}</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={form.handleSubmit((values) => save.mutate(values))}
              >
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
                  <div className="space-y-1.5">
                    <Label>Escopo</Label>
                    <Select
                      value={selectedScopeValue}
                      onValueChange={(value) =>
                        form.setValue(
                          "categoryId",
                          value === GLOBAL_BUDGET_VALUE ? null : Number(value),
                          {
                            shouldDirty: true,
                            shouldValidate: true,
                          },
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={GLOBAL_BUDGET_VALUE}>Orçamento mensal</SelectItem>
                        {expenseCats.map((category) => (
                          <SelectItem key={category.id} value={String(category.id)}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Valor</Label>
                    <CurrencyAmountInput
                      value={form.watch("amount")}
                      onChange={(value) =>
                        form.setValue("amount", value, { shouldDirty: true, shouldValidate: true })
                      }
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2">
                  <Label htmlFor="budget-recurring" className="cursor-pointer">
                    Repete todo mês
                  </Label>
                  <Switch
                    id="budget-recurring"
                    checked={repeatsEveryMonth}
                    onCheckedChange={toggleRecurring}
                  />
                </div>

                {!repeatsEveryMonth && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Mês</Label>
                      <Input type="number" min={1} max={12} {...form.register("month")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Ano</Label>
                      <Input type="number" min={2000} {...form.register("year")} />
                    </div>
                  </div>
                )}

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

      {progress.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : progress.error ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Não foi possível carregar os orçamentos.
          </CardContent>
        </Card>
      ) : !progressItems.length ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Nenhum orçamento no mês.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {budgets.isLoading && (
            <p className="text-xs text-muted-foreground">Atualizando metadados dos orçamentos...</p>
          )}
          {progressItems.map((item) => {
            const budget = budgetsById.get(item.budgetId);
            const displayName = getBudgetDisplayName(item);

            return (
              <Card key={item.budgetId}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{displayName}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatBRL(item.spentAmount)} de {formatBRL(item.budgetAmount)}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant="outline">
                          {item.categoryId === null ? "Global" : "Categoria"}
                        </Badge>
                        <Badge variant="outline">{getBudgetPeriodLabel(budget, item)}</Badge>
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
                        {STATUS_LABELS[item.status]} - {item.percentUsed.toFixed(0)}%
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={!budget}
                        onClick={() => {
                          if (budget) openEdit(budget);
                        }}
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <ConfirmAction
                        title="Remover orçamento?"
                        description={`O orçamento de ${displayName} será removido.`}
                        confirmLabel="Remover"
                        destructive
                        onConfirm={() => remove.mutate(item.budgetId)}
                      >
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </ConfirmAction>
                    </div>
                  </div>
                  <Progress value={Math.min(100, item.percentUsed)} className="mt-3" />
                  <div className="mt-2 text-xs text-muted-foreground">
                    {getRemainingLabel(item.remainingAmount)}
                  </div>
                </CardContent>
              </Card>
            );
          })}
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

function getBudgetDisplayName(item: BudgetProgress): string {
  return item.categoryId === null ? "Orçamento mensal" : item.categoryName;
}

function getBudgetPeriodLabel(budget: Budget | undefined, item: BudgetProgress): string {
  if (budget?.month === null && budget.year === null) return "Todo mês";
  return monthLabel(budget?.month ?? item.month, budget?.year ?? item.year);
}

function getRemainingLabel(remainingAmount: number): string {
  if (remainingAmount >= 0) return `Restam ${formatBRL(remainingAmount)}`;
  return `${formatBRL(Math.abs(remainingAmount))} acima do limite`;
}
