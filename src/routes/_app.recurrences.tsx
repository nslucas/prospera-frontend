import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X, Calendar } from "lucide-react";
import { occurrencesQuery, recurrencesQuery } from "@/lib/queries";
import { api, ApiError } from "@/lib/api";
import { addDaysIso, formatBRL, formatDate, todayIsoDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_app/recurrences")({
  component: RecurrencesPage,
});

function RecurrencesPage() {
  const qc = useQueryClient();
  const today = todayIsoDate();
  const to = addDaysIso(today, 60);
  const list = useQuery(recurrencesQuery());
  const occ = useQuery(occurrencesQuery(today, to));

  const materialize = useMutation({
    mutationFn: ({ id, date }: { id: number; date: string }) =>
      api(`/recurrences/${id}/occurrences`, { method: "POST", body: { occurrenceDate: date } }),
    onSuccess: () => {
      toast.success("Lançado");
      qc.invalidateQueries({ queryKey: ["recurrence-occurrences"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });
  const skip = useMutation({
    mutationFn: ({ id, date }: { id: number; date: string }) =>
      api(`/recurrences/${id}/occurrences/skip`, { method: "POST", body: { occurrenceDate: date } }),
    onSuccess: () => {
      toast.success("Pulado");
      qc.invalidateQueries({ queryKey: ["recurrence-occurrences"] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl md:text-4xl">Recorrências</h1>
        <p className="text-sm text-muted-foreground">
          Visualize e materialize lançamentos futuros nos próximos 60 dias.
        </p>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Próximas</TabsTrigger>
          <TabsTrigger value="rules">Regras</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4 space-y-3">
          {occ.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : !occ.data?.length ? (
            <Card>
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                <Calendar className="mx-auto mb-2 h-5 w-5" /> Nada nos próximos 60 dias.
              </CardContent>
            </Card>
          ) : (
            occ.data.map((o) => (
              <Card key={`${o.recurrenceId}-${o.occurrenceDate}`}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{o.recurrenceName}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {o.classification}
                      </Badge>
                      <Badge
                        variant={o.status === "MATERIALIZED" ? "secondary" : "outline"}
                        className="text-[10px]"
                      >
                        {o.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{formatDate(o.occurrenceDate)}</div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums">{formatBRL(o.amount)}</div>
                  {o.status === "PENDING" && (
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => materialize.mutate({ id: o.recurrenceId, date: o.occurrenceDate })}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => skip.mutate({ id: o.recurrenceId, date: o.occurrenceDate })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="rules" className="mt-4 space-y-3">
          {list.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : !list.data?.length ? (
            <Card>
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                Nenhuma recorrência cadastrada.
              </CardContent>
            </Card>
          ) : (
            list.data.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.frequency} • {r.classification} •{" "}
                        {r.targetType === "CARD_EXPENSE" ? "cartão" : r.transactionType}
                      </div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums">{formatBRL(r.amount)}</div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
