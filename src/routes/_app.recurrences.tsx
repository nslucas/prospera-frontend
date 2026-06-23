import { useAsyncData, useAsyncMutation } from "@/hooks/use-async-data";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Calendar, Check, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { fetchAccounts, fetchCards, fetchCategories, fetchOccurrences, fetchRecurrences } from "@/lib/queries";
import { api } from "@/lib/api";
import type { Recurrence } from "@/lib/types";
import { addDaysIso, formatBRL, formatDate, todayIsoDate } from "@/lib/format";
import {
  recurrenceClassificationLabel,
  recurrenceFrequencyLabel,
  recurrenceStatusLabel,
  recurrenceTargetLabel,
  recurrenceTransactionTypeLabel,
} from "@/lib/recurrence-labels";
import { ConfirmAction } from "@/components/confirm-action";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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


const schema = z
  .object({
    name: z.string().min(1, "Informe o nome"),
    description: z.string().optional(),
    targetType: z.enum(["ACCOUNT_TRANSACTION", "CARD_EXPENSE"]),
    transactionType: z.enum(["INCOME", "EXPENSE"]).optional(),
    amount: z.coerce.number().positive("Valor deve ser > 0"),
    frequency: z.enum(["MONTHLY", "ANNUAL"]),
    startDate: z.string().min(1, "Informe a data inicial"),
    endDate: z.string().optional(),
    dayOfMonth: z.coerce.number().int().min(1).max(31),
    monthOfYear: z.coerce.number().int().min(1).max(12).optional(),
    accountId: z.coerce.number().int().optional(),
    cardId: z.coerce.number().int().optional(),
    categoryId: z.coerce.number().int().optional(),
    installmentCount: z.coerce.number().int().positive().optional(),
    classification: z.enum(["FIXED", "VARIABLE"]),
  })
  .superRefine((values, ctx) => {
    if (values.targetType === "ACCOUNT_TRANSACTION") {
      if (!values.accountId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["accountId"], message: "Selecione a conta" });
      if (!values.transactionType) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["transactionType"], message: "Selecione o tipo" });
    }
    if (values.targetType === "CARD_EXPENSE" && !values.cardId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cardId"], message: "Selecione o cartão" });
    }
    if (values.frequency === "ANNUAL" && !values.monthOfYear) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["monthOfYear"], message: "Informe o mês" });
    }
  });
type Values = z.infer<typeof schema>;

export default function RecurrencesPage() {
  const today = todayIsoDate();
  const to = addDaysIso(today, 60);
  const list = useAsyncData(() => fetchRecurrences(), [], { cacheKey: "recurrences" });
  const occ = useAsyncData(() => fetchOccurrences(today, to), [today, to], {
    cacheKey: `recurrence-occurrences:${today}:${to}`,
  });
  const accounts = useAsyncData(() => fetchAccounts(), [], { cacheKey: "accounts" });
  const cards = useAsyncData(() => fetchCards(), [], { cacheKey: "cards" });
  const categories = useAsyncData(() => fetchCategories(), [], { cacheKey: "categories", staleMs: 60_000 });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Recurrence | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      targetType: "ACCOUNT_TRANSACTION",
      transactionType: "EXPENSE",
      frequency: "MONTHLY",
      startDate: today,
      dayOfMonth: new Date().getDate(),
      installmentCount: 1,
      classification: "FIXED",
    },
  });
  const targetType = form.watch("targetType");
  const frequency = form.watch("frequency");
  const transactionType = form.watch("transactionType");

  const save = useAsyncMutation({
    mutationFn: (values: Values) =>
      api<Recurrence>(editing ? `/recurrences/${editing.id}` : "/recurrences", {
        method: editing ? "PUT" : "POST",
        body: toPayload(values),
      }),
    onSuccess: () => {
      toast.success(editing ? "Recorrência atualizada" : "Recorrência criada");
      list.reload();
      occ.reload();
      setOpen(false);
      setEditing(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useAsyncMutation({
    mutationFn: (id: number) => api(`/recurrences/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Recorrência removida");
      list.reload();
      occ.reload();
    },
    onError: (e) => toast.error(e.message),
  });

  const materialize = useAsyncMutation({
    mutationFn: ({ id, date }: { id: number; date: string }) =>
      api(`/recurrences/${id}/occurrences`, { method: "POST", body: { occurrenceDate: date } }),
    onSuccess: () => {
      toast.success("Lancado");
      list.reload();
      occ.reload();
    },
    onError: (e) => toast.error(e.message),
  });

  const skip = useAsyncMutation({
    mutationFn: ({ id, date }: { id: number; date: string }) =>
      api(`/recurrences/${id}/occurrences/skip`, { method: "POST", body: { occurrenceDate: date } }),
    onSuccess: () => {
      toast.success("Ocorrencia pulada");
      list.reload();
      occ.reload();
    },
    onError: (e) => toast.error(e.message),
  });

  const revert = useAsyncMutation({
    mutationFn: ({ id, date }: { id: number; date: string }) =>
      api(`/recurrences/${id}/occurrences/revert`, { method: "POST", body: { occurrenceDate: date } }),
    onSuccess: () => {
      toast.success("Ocorrencia revertida");
      list.reload();
      occ.reload();
    },
    onError: (e) => toast.error(e.message),
  });

  const activeAccounts = (accounts.data ?? []).filter((account) => account.active);
  const activeCards = (cards.data ?? []).filter((card) => card.active);
  const filteredCategories = (categories.data ?? []).filter((category) => {
    if (!category.active) return false;
    if (targetType === "CARD_EXPENSE") return category.type === "EXPENSE";
    return category.type === transactionType;
  });

  const openNew = () => {
    setEditing(null);
    form.reset({
      name: "",
      description: "",
      targetType: "ACCOUNT_TRANSACTION",
      transactionType: "EXPENSE",
      amount: 0,
      frequency: "MONTHLY",
      startDate: today,
      endDate: "",
      dayOfMonth: new Date().getDate(),
      monthOfYear: undefined,
      accountId: undefined,
      cardId: undefined,
      categoryId: undefined,
      installmentCount: 1,
      classification: "FIXED",
    });
    setOpen(true);
  };

  const openEdit = (recurrence: Recurrence) => {
    setEditing(recurrence);
    form.reset({
      name: recurrence.name,
      description: recurrence.description ?? "",
      targetType: recurrence.targetType,
      transactionType: recurrence.transactionType === "INCOME" || recurrence.transactionType === "EXPENSE" ? recurrence.transactionType : undefined,
      amount: recurrence.amount,
      frequency: recurrence.frequency,
      startDate: recurrence.startDate,
      endDate: recurrence.endDate ?? "",
      dayOfMonth: recurrence.dayOfMonth,
      monthOfYear: recurrence.monthOfYear ?? undefined,
      accountId: recurrence.accountId ?? undefined,
      cardId: recurrence.cardId ?? undefined,
      categoryId: recurrence.categoryId ?? undefined,
      installmentCount: recurrence.installmentCount ?? 1,
      classification: recurrence.classification,
    });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Recorrências</h1>
          <p className="text-sm text-muted-foreground">Crie regras, visualize próximas ocorrências e lance quando quiser.</p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" /> Nova
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar recorrência" : "Nova recorrência"}</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
              <RecurrenceFields
                form={form}
                targetType={targetType}
                frequency={frequency}
                activeAccounts={activeAccounts}
                activeCards={activeCards}
                categories={filteredCategories}
              />
              <DialogFooter>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Próximas</TabsTrigger>
          <TabsTrigger value="rules">Regras</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4 space-y-3">
          {occ.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : !occ.data?.length ? (
            <Card>
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                <Calendar className="mx-auto mb-2 h-5 w-5" /> Nada nos proximos 60 dias.
              </CardContent>
            </Card>
          ) : (
            occ.data.map((item) => (
              <Card key={`${item.recurrenceId}-${item.occurrenceDate}`}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{item.recurrenceName}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {recurrenceClassificationLabel(item.classification)}
                      </Badge>
                      <Badge variant={item.status === "MATERIALIZED" ? "secondary" : "outline"} className="text-[10px]">
                        {recurrenceStatusLabel(item.status)}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{formatDate(item.occurrenceDate)}</div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums">{formatBRL(item.amount)}</div>
                  {item.status === "PENDING" && (
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        disabled={materialize.isPending}
                        onClick={() => materialize.mutate({ id: item.recurrenceId, date: item.occurrenceDate })}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        disabled={skip.isPending}
                        onClick={() => skip.mutate({ id: item.recurrenceId, date: item.occurrenceDate })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {item.status === "MATERIALIZED" && (
                    <ConfirmAction
                      title="Desfazer lançamento?"
                      description={`A ocorrencia "${item.recurrenceName}" de ${formatDate(item.occurrenceDate)} voltara para pendente.`}
                      confirmLabel="Desfazer"
                      onConfirm={() => revert.mutate({ id: item.recurrenceId, date: item.occurrenceDate })}
                    >
                      <Button size="icon" variant="ghost" className="h-8 w-8" disabled={revert.isPending} title="Desfazer lançamento">
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </ConfirmAction>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="rules" className="mt-4 space-y-3">
          {list.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : !list.data?.length ? (
            <Card>
              <CardContent className="p-10 text-center text-sm text-muted-foreground">Nenhuma recorrência cadastrada.</CardContent>
            </Card>
          ) : (
            list.data.map((item) => (
              <Card key={item.id}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{item.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {recurrenceFrequencyLabel(item.frequency)} - {recurrenceClassificationLabel(item.classification)} - {recurrenceDestinationLabel(item)}
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums">{formatBRL(item.amount)}</div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <ConfirmAction
                    title="Remover recorrência?"
                    description={`A recorrência "${item.name}" será desativada.`}
                    confirmLabel="Remover"
                    destructive
                    onConfirm={() => remove.mutate(item.id)}
                  >
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </ConfirmAction>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RecurrenceFields({
  form,
  targetType,
  frequency,
  activeAccounts,
  activeCards,
  categories,
}: {
  form: ReturnType<typeof useForm<Values>>;
  targetType: Values["targetType"];
  frequency: Values["frequency"];
  activeAccounts: Array<{ id: number; name: string }>;
  activeCards: Array<{ id: number; name: string }>;
  categories: Array<{ id: number; name: string }>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2 space-y-1.5">
        <Label>Nome</Label>
        <Input {...form.register("name")} />
      </div>
      <div className="space-y-1.5">
        <Label>Destino</Label>
        <Select
          value={form.watch("targetType")}
          onValueChange={(value) => {
            const target = value as Values["targetType"];
            form.setValue("targetType", target, { shouldValidate: true });
            if (target === "CARD_EXPENSE") {
              form.setValue("transactionType", undefined);
              form.setValue("accountId", undefined);
            } else {
              form.setValue("cardId", undefined);
              form.setValue("transactionType", "EXPENSE");
            }
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ACCOUNT_TRANSACTION">Conta</SelectItem>
            <SelectItem value="CARD_EXPENSE">Cartão</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {targetType === "ACCOUNT_TRANSACTION" ? (
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Select
            value={form.watch("transactionType") ?? undefined}
            onValueChange={(value) => form.setValue("transactionType", value as Values["transactionType"], { shouldValidate: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EXPENSE">Despesa</SelectItem>
              <SelectItem value="INCOME">Receita</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label>Parcelas</Label>
          <Input type="number" min={1} {...form.register("installmentCount")} />
        </div>
      )}
      <div className="space-y-1.5">
        <Label>Valor</Label>
        <CurrencyAmountInput
          value={form.watch("amount")}
          onChange={(value) => form.setValue("amount", value, { shouldDirty: true, shouldValidate: true })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Classificacao</Label>
        <Select value={form.watch("classification")} onValueChange={(value) => form.setValue("classification", value as Values["classification"])}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="FIXED">Fixa</SelectItem>
            <SelectItem value="VARIABLE">Variavel</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Frequencia</Label>
        <Select value={form.watch("frequency")} onValueChange={(value) => form.setValue("frequency", value as Values["frequency"])}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MONTHLY">Mensal</SelectItem>
            <SelectItem value="ANNUAL">Anual</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Dia</Label>
        <Input type="number" min={1} max={31} {...form.register("dayOfMonth")} />
      </div>
      {frequency === "ANNUAL" && (
        <div className="space-y-1.5">
          <Label>Mes</Label>
          <Input type="number" min={1} max={12} {...form.register("monthOfYear")} />
        </div>
      )}
      <div className="space-y-1.5">
        <Label>Inicio</Label>
        <Input type="date" {...form.register("startDate")} />
      </div>
      <div className="space-y-1.5">
        <Label>Fim</Label>
        <Input type="date" {...form.register("endDate")} />
      </div>
      {targetType === "ACCOUNT_TRANSACTION" ? (
        <div className="space-y-1.5">
          <Label>Conta</Label>
          <Select
            value={form.watch("accountId") ? String(form.watch("accountId")) : undefined}
            onValueChange={(value) => form.setValue("accountId", Number(value), { shouldValidate: true })}
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
      ) : (
        <div className="space-y-1.5">
          <Label>Cartão</Label>
          <Select
            value={form.watch("cardId") ? String(form.watch("cardId")) : undefined}
            onValueChange={(value) => form.setValue("cardId", Number(value), { shouldValidate: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {activeCards.map((card) => (
                <SelectItem key={card.id} value={String(card.id)}>
                  {card.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-1.5">
        <Label>Categoria</Label>
        <Select
          value={form.watch("categoryId") ? String(form.watch("categoryId")) : "_none"}
          onValueChange={(value) => form.setValue("categoryId", value === "_none" ? undefined : Number(value))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">Sem categoria</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={String(category.id)}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2 space-y-1.5">
        <Label>Descricao</Label>
        <Input {...form.register("description")} placeholder="opcional" />
      </div>
    </div>
  );
}

function recurrenceDestinationLabel(item: Recurrence) {
  if (item.targetType === "CARD_EXPENSE") return recurrenceTargetLabel(item.targetType);
  return recurrenceTransactionTypeLabel(item.transactionType) ?? recurrenceTargetLabel(item.targetType);
}

function toPayload(values: Values) {
  const accountTarget = values.targetType === "ACCOUNT_TRANSACTION";
  const annual = values.frequency === "ANNUAL";
  return {
    name: values.name,
    description: values.description || null,
    targetType: values.targetType,
    transactionType: accountTarget ? values.transactionType : null,
    amount: values.amount,
    frequency: values.frequency,
    startDate: values.startDate,
    endDate: values.endDate || null,
    dayOfMonth: values.dayOfMonth,
    monthOfYear: annual ? values.monthOfYear || null : null,
    accountId: accountTarget ? values.accountId : null,
    cardId: accountTarget ? null : values.cardId,
    categoryId: values.categoryId || null,
    installmentCount: accountTarget ? null : values.installmentCount || 1,
    classification: values.classification,
  };
}
