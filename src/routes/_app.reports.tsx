import { useState } from "react";
import { useAsyncData } from "@/hooks/use-async-data";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fetchCardSummary,
  fetchCategorySummary,
  fetchFixedVariableSummary,
  fetchForecast,
  fetchMonthlySummary,
  fetchTrends,
  fetchUpcoming,
  fetchYearlySummary,
} from "@/lib/queries";
import { addDaysIso, currentMonthYear, formatBRL, formatDate, monthLabel, todayIsoDate } from "@/lib/format";
import { recurrenceStatusLabel } from "@/lib/recurrence-labels";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export default function ReportsPage() {
  const [{ month, year }, setPeriod] = useState(currentMonthYear);
  const today = todayIsoDate();
  const monthOptions = getMonthOptions();
  const summary = useAsyncData(() => fetchMonthlySummary(month, year), [month, year]);
  const categorySummary = useAsyncData(() => fetchCategorySummary(month, year), [month, year]);
  const cardSummary = useAsyncData(() => fetchCardSummary(month, year), [month, year]);
  const fixedVariable = useAsyncData(() => fetchFixedVariableSummary(month, year), [month, year]);
  const upcoming = useAsyncData(() => fetchUpcoming(today, addDaysIso(today, 30)), [today]);
  const yearly = useAsyncData(() => fetchYearlySummary(year), [year]);
  const fromMonth = month - 11 <= 0 ? month - 11 + 12 : month - 11;
  const fromYear = month - 11 <= 0 ? year - 1 : year;
  const trends = useAsyncData(() => fetchTrends(fromMonth, fromYear, month, year), [fromMonth, fromYear, month, year]);
  const forecast = useAsyncData(() => fetchForecast(6), []);

  const trendData =
    trends.data?.map((item) => ({
      label: `${String(item.month).padStart(2, "0")}/${String(item.year).slice(-2)}`,
      Receita: item.incomeTotal,
      Despesa: item.accountExpenseTotal + item.cardStatementExpenseTotal,
      Liquido: item.netTotal,
    })) ?? [];

  const pieData = (categorySummary.data ?? summary.data?.categoryBreakdown ?? [])
    .filter((item) => !("categoryType" in item) || item.categoryType === "EXPENSE")
    .map((item) => ({
      name: "amount" in item ? item.categoryName : item.categoryName,
      value: "amount" in item ? item.amount : item.total,
    }));

  const forecastData =
    forecast.data?.forecast.map((item) => ({
      label: `${String(item.month).padStart(2, "0")}/${String(item.year).slice(-2)}`,
      Saldo: item.projectedAccountBalance,
    })) ?? [];

  const fixedTotal =
    (fixedVariable.data?.fixedAmount ?? 0) +
    (fixedVariable.data?.variableAmount ?? 0) +
    (fixedVariable.data?.unclassifiedAmount ?? 0);

  const tooltipStyle = {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    fontSize: 12,
  };

  const isLoading =
    summary.isLoading ||
    categorySummary.isLoading ||
    cardSummary.isLoading ||
    fixedVariable.isLoading ||
    upcoming.isLoading ||
    yearly.isLoading ||
    trends.isLoading ||
    forecast.isLoading;

  if (isLoading) {
    return (
      <div className="flex h-[450px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground capitalize">{monthLabel(month, year)}</p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Relatorios</h1>
        </div>
        <Select
          value={`${month}-${year}`}
          onValueChange={(value) => {
            const [selectedMonth, selectedYear] = value.split("-").map(Number);
            setPeriod({ month: selectedMonth, year: selectedYear });
          }}
        >
          <SelectTrigger className="w-full md:w-44">
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
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric title="Receitas" value={formatBRL(summary.data?.incomeTotal)} />
        <Metric title="Despesas em conta" value={formatBRL(summary.data?.accountExpenseTotal)} />
        <Metric title="Faturas do mês" value={formatBRL(summary.data?.cardBillsTotal)} />
        <Metric title="Saldo liquido" value={formatBRL(summary.data?.netCashFlow)} />
      </div>

      <Card>
        <CardContent className="p-4 md:p-6">
          <h2 className="text-xl font-semibold tracking-tight">Tendências (12 meses)</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <BarChart data={trendData} margin={{ left: -20, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickFormatter={(value) => (Number(value) >= 1000 ? `${(Number(value) / 1000).toFixed(0)}k` : `${value}`)}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatBRL(value)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Receita" fill="var(--success)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Despesa" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-4 md:p-6">
            <h2 className="text-xl font-semibold tracking-tight">Despesas por categoria</h2>
            <div className="mt-4 h-64">
              {pieData.length === 0 ? (
                <p className="grid h-full place-items-center text-sm text-muted-foreground">Sem dados.</p>
              ) : (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                      {pieData.map((_, index) => (
                        <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatBRL(value)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <h2 className="text-xl font-semibold tracking-tight">Projeção de saldo (6 meses)</h2>
            <div className="mt-4 h-64">
              <ResponsiveContainer>
                <LineChart data={forecastData} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickFormatter={(value) => (Number(value) >= 1000 ? `${(Number(value) / 1000).toFixed(0)}k` : `${value}`)}
                  />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatBRL(value)} />
                  <Line type="monotone" dataKey="Saldo" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="p-4 md:p-6">
            <h2 className="text-xl font-semibold tracking-tight">Cartões no mês</h2>
            <div className="mt-4 space-y-3">
              {!cardSummary.data?.length ? (
                <p className="text-sm text-muted-foreground">Sem faturas no periodo.</p>
              ) : (
                cardSummary.data.map((card) => (
                  <div key={card.cardId} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-medium">{card.cardName}</span>
                      <span className="tabular-nums">{formatBRL(card.remainingAmount)}</span>
                    </div>
                    <Progress value={card.totalAmount ? Math.min(100, (card.paidAmount / card.totalAmount) * 100) : 0} />
                    <div className="text-xs text-muted-foreground">
                      Pago {formatBRL(card.paidAmount)} de {formatBRL(card.totalAmount)} - {card.status}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <h2 className="text-xl font-semibold tracking-tight">Fixo x variavel</h2>
            <div className="mt-4 space-y-3">
              <Breakdown label="Fixo" value={fixedVariable.data?.fixedAmount ?? 0} total={fixedTotal} />
              <Breakdown label="Variavel" value={fixedVariable.data?.variableAmount ?? 0} total={fixedTotal} />
              <Breakdown label="Sem classificacao" value={fixedVariable.data?.unclassifiedAmount ?? 0} total={fixedTotal} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <h2 className="text-xl font-semibold tracking-tight">Proximos 30 dias</h2>
            <div className="mt-4 space-y-3">
              {!upcoming.data?.recurrenceOccurrences.length && !upcoming.data?.cardStatements.length ? (
                <p className="text-sm text-muted-foreground">Nada previsto.</p>
              ) : (
                <>
                  {upcoming.data?.cardStatements.map((statement) => (
                    <div key={`card-${statement.cardId}-${statement.month}-${statement.year}`} className="rounded-md border border-border/70 p-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium">{statement.cardName}</span>
                        <span className="tabular-nums">{formatBRL(statement.remainingAmount)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">Vence {formatDate(statement.dueDate)}</div>
                    </div>
                  ))}
                  {upcoming.data?.recurrenceOccurrences.map((occurrence) => (
                    <div key={`rec-${occurrence.recurrenceId}-${occurrence.occurrenceDate}`} className="rounded-md border border-border/70 p-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium">{occurrence.recurrenceName}</span>
                        <span className="tabular-nums">{formatBRL(occurrence.amount)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{formatDate(occurrence.occurrenceDate)} - {recurrenceStatusLabel(occurrence.status)}</div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 md:p-6">
          <h2 className="text-xl font-semibold tracking-tight">Resumo anual {yearly.data?.year ?? year}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <Metric title="Receitas" value={formatBRL(yearly.data?.incomeTotal)} />
            <Metric title="Despesas em conta" value={formatBRL(yearly.data?.accountExpenseTotal)} />
            <Metric title="Despesas em cartão" value={formatBRL(yearly.data?.cardStatementExpenseTotal)} />
            <Metric title="Liquido" value={formatBRL(yearly.data?.netTotal)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function Breakdown({ label, value, total }: { label: string; value: number; total: number }) {
  const percent = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="font-medium tabular-nums">{formatBRL(value)}</span>
      </div>
      <Progress value={percent} />
    </div>
  );
}

function getMonthOptions() {
  const now = new Date();
  const out: Array<{ key: string; label: string }> = [];
  for (let i = 0; i < 18; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    out.push({ key: `${month}-${year}`, label: monthLabel(month, year) });
  }
  return out;
}
