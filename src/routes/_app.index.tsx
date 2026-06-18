import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, CreditCard, Wallet, AlertTriangle } from "lucide-react";
import {
  accountsQuery,
  alertsQuery,
  cardsQuery,
  monthlySummaryQuery,
  trendsQuery,
} from "@/lib/queries";
import { currentMonthYear, formatBRL, monthLabel } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { month, year } = currentMonthYear();
  const summary = useQuery(monthlySummaryQuery(month, year));
  const accounts = useQuery(accountsQuery());
  const cards = useQuery(cardsQuery());
  const alerts = useQuery(alertsQuery({ month, year }));
  const fromMonth = month - 5 <= 0 ? month - 5 + 12 : month - 5;
  const fromYear = month - 5 <= 0 ? year - 1 : year;
  const trends = useQuery(trendsQuery(fromMonth, fromYear, month, year));

  const s = summary.data;
  const trendData =
    trends.data?.map((t) => ({
      label: `${String(t.month).padStart(2, "0")}/${String(t.year).slice(-2)}`,
      Receita: t.incomeTotal,
      Despesa: t.accountExpenseTotal + t.cardStatementExpenseTotal,
    })) ?? [];

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-muted-foreground capitalize">{monthLabel(month, year)}</p>
        <h1 className="font-display text-3xl md:text-4xl">Visão geral</h1>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Saldo total"
          value={formatBRL(s?.totalAccountBalance)}
          icon={<Wallet className="h-4 w-4" />}
          loading={summary.isLoading}
        />
        <Stat
          label="Receitas"
          value={formatBRL(s?.incomeTotal)}
          icon={<ArrowDownRight className="h-4 w-4 text-[var(--success)]" />}
          loading={summary.isLoading}
          tone="success"
        />
        <Stat
          label="Despesas"
          value={formatBRL((s?.accountExpenseTotal ?? 0) + (s?.cardPaymentsTotal ?? 0))}
          icon={<ArrowUpRight className="h-4 w-4 text-destructive" />}
          loading={summary.isLoading}
        />
        <Stat
          label="Faturas a pagar"
          value={formatBRL(s?.cardBillsRemaining)}
          icon={<CreditCard className="h-4 w-4" />}
          loading={summary.isLoading}
        />
      </section>

      <Card className="overflow-hidden">
        <CardContent className="p-4 md:p-6">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="font-display text-xl">Receitas vs. Despesas</h2>
              <p className="text-xs text-muted-foreground">Últimos 6 meses</p>
            </div>
            <Link to="/reports" className="text-xs text-primary hover:underline">
              Ver relatórios
            </Link>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="inc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--success)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => formatBRL(v)}
                />
                <Area type="monotone" dataKey="Receita" stroke="var(--success)" fill="url(#inc)" strokeWidth={2} />
                <Area type="monotone" dataKey="Despesa" stroke="var(--primary)" fill="url(#exp)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl">Contas</h2>
              <Link to="/accounts" className="text-xs text-primary hover:underline">
                Gerenciar
              </Link>
            </div>
            <div className="space-y-2">
              {accounts.data?.slice(0, 4).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{a.name}</div>
                    <div className="text-xs text-muted-foreground">{a.type}</div>
                  </div>
                  <div className="text-sm font-medium tabular-nums">
                    {formatBRL(a.balance, a.currency || "BRL")}
                  </div>
                </div>
              ))}
              {!accounts.data?.length && (
                <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl">Cartões</h2>
              <Link to="/cards" className="text-xs text-primary hover:underline">
                Gerenciar
              </Link>
            </div>
            <div className="space-y-2">
              {cards.data?.slice(0, 4).map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {c.name}{" "}
                      <span className="text-muted-foreground">• {c.lastFourDigits ?? "····"}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{c.bankName}</div>
                  </div>
                  <div className="text-sm font-medium tabular-nums">{formatBRL(c.creditLimit)}</div>
                </div>
              ))}
              {!cards.data?.length && (
                <p className="text-sm text-muted-foreground">Nenhum cartão cadastrado.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl">Alertas do mês</h2>
          <Link to="/alerts" className="text-xs text-primary hover:underline">
            Ver todos
          </Link>
        </div>
        <div className="space-y-2">
          {alerts.data?.slice(0, 5).map((a) => (
            <div
              key={a.key}
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
            >
              <AlertTriangle
                className={`h-4 w-4 mt-0.5 shrink-0 ${
                  a.severity === "CRITICAL" ? "text-destructive" : "text-[var(--warning)]"
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{a.message}</p>
                <Badge variant="secondary" className="mt-1 text-[10px]">
                  {a.type.replaceAll("_", " ")}
                </Badge>
              </div>
            </div>
          ))}
          {!alerts.data?.length && (
            <p className="text-sm text-muted-foreground">Tudo certo por aqui.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  loading,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  loading?: boolean;
  tone?: "success";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          {icon}
        </div>
        <div
          className={`mt-2 truncate text-lg font-semibold tabular-nums md:text-xl ${
            tone === "success" ? "text-[var(--success)]" : ""
          }`}
        >
          {loading ? "…" : value}
        </div>
      </CardContent>
    </Card>
  );
}
