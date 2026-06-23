import { useAsyncData } from "@/hooks/use-async-data";
import { AlertTriangle, BellOff } from "lucide-react";
import { fetchAlerts } from "@/lib/queries";
import { alertMessage, alertSeverityLabel, alertTypeLabel } from "@/lib/alert-labels";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatDate } from "@/lib/format";


export default function AlertsPage() {
  const { data, isLoading } = useAsyncData(() => fetchAlerts(), [], { cacheKey: "alerts" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Alertas</h1>
        <p className="text-sm text-muted-foreground">
          Avisos sobre limites de cartão, orçamentos e faturas a vencer.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : !data?.length ? (
        <Card>
          <CardContent className="p-10 text-center">
            <BellOff className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Tudo certo. Sem alertas agora.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.map((a) => (
            <Card key={a.key}>
              <CardContent className="flex items-start gap-3 p-4">
                <AlertTriangle
                  className={`h-5 w-5 mt-0.5 shrink-0 ${
                    a.severity === "CRITICAL" ? "text-destructive" : "text-[var(--warning)]"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={a.severity === "CRITICAL" ? "destructive" : "secondary"}>
                      {alertSeverityLabel(a.severity)}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {alertTypeLabel(a.type)}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm">{alertMessage(a)}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {a.amount != null && <span>Valor: {formatBRL(a.amount)}</span>}
                    {a.percentageUsed != null && <span>Uso: {a.percentageUsed.toFixed(0)}%</span>}
                    {a.dueDate && <span>Vence: {formatDate(a.dueDate)}</span>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
