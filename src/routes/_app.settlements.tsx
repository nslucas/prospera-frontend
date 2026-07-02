import { useMemo, useState } from "react";
import type { ComponentType } from "react";
import { CheckCircle2, HandCoins, ReceiptText, Scale } from "lucide-react";
import { toast } from "sonner";

import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAsyncData, useAsyncMutation } from "@/hooks/use-async-data";
import { api } from "@/lib/api";
import { formatBRL, formatDateTime } from "@/lib/format";
import { fetchSettlementItems, fetchSettlements } from "@/lib/queries";
import type { SettlementDirection, SettlementItem } from "@/lib/types";

const ALL_COUNTERPARTIES = "_all";

export default function SettlementsPage() {
  const [counterparty, setCounterparty] = useState<string>(ALL_COUNTERPARTIES);
  const [selectedShareIds, setSelectedShareIds] = useState<Set<number>>(() => new Set());
  const counterpartyUserId = counterparty === ALL_COUNTERPARTIES ? undefined : Number(counterparty);
  const settlements = useAsyncData(() => fetchSettlements(), [], { cacheKey: "settlements" });
  const items = useAsyncData(
    () => fetchSettlementItems({ counterpartyUserId }),
    [counterpartyUserId],
    { cacheKey: `settlement-items:${counterpartyUserId ?? "all"}` },
  );

  const settleSelectedItems = useAsyncMutation({
    mutationFn: (shareIds: number[]) =>
      Promise.all(
        shareIds.map((shareId) =>
          api<SettlementItem>(`/settlements/items/${shareId}/settle`, { method: "POST" }),
        ),
      ),
    onSuccess: (_, shareIds) => {
      toast.success(
        shareIds.length === 1 ? "Acerto quitado" : `${shareIds.length} acertos quitados`,
      );
      setSelectedShareIds(new Set());
      settlements.reload();
      items.reload();
    },
    onError: (error) => toast.error(error.message),
  });

  const openItems = useMemo(
    () => (items.data ?? []).filter((item) => item.status === "OPEN"),
    [items.data],
  );
  const selectedOpenItems = useMemo(
    () => openItems.filter((item) => selectedShareIds.has(item.shareId)),
    [openItems, selectedShareIds],
  );
  const allOpenSelected = openItems.length > 0 && selectedOpenItems.length === openItems.length;
  const totalToReceive = (settlements.data ?? [])
    .filter((item) => item.direction === "OWES_YOU")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const totalToPay = (settlements.data ?? [])
    .filter((item) => item.direction === "YOU_OWE")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const selectedTotal = selectedOpenItems.reduce(
    (sum, item) => sum + Number(item.participantAmount),
    0,
  );

  function changeCounterparty(nextCounterparty: string) {
    setCounterparty(nextCounterparty);
    setSelectedShareIds(new Set());
  }

  function toggleItemSelection(shareId: number, checked: boolean) {
    setSelectedShareIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(shareId);
      } else {
        next.delete(shareId);
      }
      return next;
    });
  }

  function toggleAllOpenItems(checked: boolean) {
    setSelectedShareIds((current) => {
      const next = new Set(current);
      openItems.forEach((item) => {
        if (checked) {
          next.add(item.shareId);
        } else {
          next.delete(item.shareId);
        }
      });
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Acertos</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe compras compartilhadas em aberto e marque itens já quitados.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Metric
          title="A receber"
          value={formatBRL(totalToReceive)}
          icon={HandCoins}
          tone="positive"
        />
        <Metric title="A pagar" value={formatBRL(totalToPay)} icon={Scale} />
        <Metric title="Itens em aberto" value={String(openItems.length)} icon={ReceiptText} />
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Resumo por pessoa</h2>
              <p className="text-sm text-muted-foreground">
                Saldos líquidos de compras ainda abertas.
              </p>
            </div>
            <Select value={counterparty} onValueChange={changeCounterparty}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_COUNTERPARTIES}>Todas as pessoas</SelectItem>
                {(settlements.data ?? []).map((settlement) => (
                  <SelectItem
                    key={settlement.counterpartyUserId}
                    value={String(settlement.counterpartyUserId)}
                  >
                    {settlement.counterpartyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {settlements.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : !settlements.data?.length ? (
            <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
              Nenhum acerto em aberto.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {settlements.data.map((settlement) => (
                <button
                  key={settlement.counterpartyUserId}
                  type="button"
                  className="rounded-lg border p-4 text-left transition-colors hover:bg-accent/50"
                  onClick={() => changeCounterparty(String(settlement.counterpartyUserId))}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{settlement.counterpartyName}</p>
                      <p className="text-sm text-muted-foreground">
                        {settlementLabel(settlement.direction)}
                      </p>
                    </div>
                    <Badge variant={settlement.direction === "OWES_YOU" ? "secondary" : "outline"}>
                      {settlementBadge(settlement.direction)}
                    </Badge>
                  </div>
                  <p className="mt-3 text-2xl font-semibold tabular-nums">
                    {formatBRL(settlement.amount)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Itens compartilhados</h2>
              <p className="text-sm text-muted-foreground">
                Detalhes das compras usadas para calcular os acertos.
              </p>
            </div>
            <ConfirmAction
              title="Quitar acertos selecionados?"
              description="Os itens selecionados sairão dos acertos em aberto e nenhuma movimentação bancária será criada."
              confirmLabel="Quitar selecionados"
              onConfirm={() =>
                settleSelectedItems.mutate(selectedOpenItems.map((item) => item.shareId))
              }
            >
              <Button
                type="button"
                disabled={!selectedOpenItems.length || settleSelectedItems.isPending}
              >
                <CheckCircle2 className="h-4 w-4" />
                {selectedOpenItems.length ? `Quitar ${selectedOpenItems.length}` : "Quitar"}
              </Button>
            </ConfirmAction>
          </div>

          {items.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : !items.data?.length ? (
            <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
              Nenhum item encontrado para o filtro atual.
            </p>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/40 px-3 py-2">
                <label className="flex items-center gap-3 text-sm font-medium">
                  <Checkbox
                    checked={
                      allOpenSelected
                        ? true
                        : selectedOpenItems.length > 0
                          ? "indeterminate"
                          : false
                    }
                    disabled={!openItems.length || settleSelectedItems.isPending}
                    onCheckedChange={(checked) => toggleAllOpenItems(checked === true)}
                  />
                  Selecionar todos em aberto
                </label>
                <span className="text-sm text-muted-foreground">
                  {selectedOpenItems.length} selecionado{selectedOpenItems.length === 1 ? "" : "s"}{" "}
                  - {formatBRL(selectedTotal)}
                </span>
              </div>
              <ul className="divide-y divide-border">
                {items.data.map((item) => (
                  <li
                    key={item.shareId}
                    className="flex flex-wrap items-center gap-3 py-4 first:pt-0 last:pb-0"
                  >
                    {item.status === "OPEN" && (
                      <Checkbox
                        checked={selectedShareIds.has(item.shareId)}
                        disabled={settleSelectedItems.isPending}
                        aria-label={`Selecionar ${item.expenseName}`}
                        onCheckedChange={(checked) =>
                          toggleItemSelection(item.shareId, checked === true)
                        }
                      />
                    )}
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent">
                      <ReceiptText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{item.expenseName}</p>
                        <Badge variant={item.status === "SETTLED" ? "secondary" : "outline"}>
                          {item.status === "SETTLED" ? "Quitado" : "Aberto"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {itemDescription(item)} • criado em {formatDateTime(item.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatBRL(item.participantAmount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        de {formatBRL(item.expenseAmount)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  tone?: "positive";
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p
            className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "positive" ? "text-[var(--success)]" : ""}`}
          >
            {value}
          </p>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-accent">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}

function settlementLabel(direction: SettlementDirection) {
  return direction === "OWES_YOU" ? "Essa pessoa deve a você" : "Você deve a essa pessoa";
}

function settlementBadge(direction: SettlementDirection) {
  return direction === "OWES_YOU" ? "A receber" : "A pagar";
}

function itemDescription(item: SettlementItem) {
  if (item.direction === "OWES_YOU") {
    return `${item.participantName} deve a ${item.creatorName}`;
  }
  return `${item.creatorName} pagou por ${item.participantName}`;
}
