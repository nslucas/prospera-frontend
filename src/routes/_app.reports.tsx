import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
import { forecastQuery, monthlySummaryQuery, trendsQuery } from "@/lib/queries";
import { currentMonthYear, formatBRL, monthLabel } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsPage,
});

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function ReportsPage() {
  const { month, year } = currentMonthYear();
  const summary = useQuery(monthlySummaryQuery(month, year));
  const fromMonth = month - 11 <= 0 ? month - 11 + 12 : month - 11;
  const fromYear = month - 11 <= 0 ? year - 1 : year;
  const trends = useQuery(trendsQuery(fromMonth, fromYear, month, year));
  const forecast = useQuery(forecastQuery(6));

  const trendData =
    trends.data?.map((t) => ({
      label: `${String(t.month).padStart(2, "0")}/${String(t.year).slice(-2)}`,
      Receita: t.incomeTotal,
      Despesa: t.accountExpenseTotal + t.cardStatementExpenseTotal,
      Liquido: t.netTotal,
    })) ?? [];

  const pieData =
    summary.data?.categoryBreakdown.map((c) => ({ name: c.categoryName, value: c.total })) ?? [];

  const forecastData =
    forecast.data?.forecast.map((f) => ({
      label: `${String(f.month).padStart(2, "0")}/${String(f.year).slice(-2)}`,
      Saldo: f.projectedAccountBalance,
    })) ?? [];

  const tooltipStyle = {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    fontSize: 12,
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground capitalize">{monthLabel(month, year)}</p>
        <h1 className="font-display text-3xl md:text-4xl">Relatórios</h1>
      </div>

      <Card>
        <CardContent className="p-4 md:p-6">
          <h2 className="font-display text-xl">Tendências (12 meses)</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <BarChart data={trendData} margin={{ left: -20, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatBRL(v)} />
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
            <h2 className="font-display text-xl">Despesas por categoria</h2>
            <div className="mt-4 h-64">
              {pieData.length === 0 ? (
                <p className="grid h-full place-items-center text-sm text-muted-foreground">
                  Sem dados.
                </p>
              ) : (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatBRL(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <h2 className="font-display text-xl">Projeção de saldo (6 meses)</h2>
            <div className="mt-4 h-64">
              <ResponsiveContainer>
                <LineChart data={forecastData} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
                  />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatBRL(v)} />
                  <Line
                    type="monotone"
                    dataKey="Saldo"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
