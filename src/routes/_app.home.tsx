import * as React from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  ChevronRight,
  CreditCard,
  Eye,
  EyeOff,
  Landmark,
  PiggyBank,
  ReceiptText,
  WalletCards,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { useAsyncData } from "@/hooks/use-async-data";
import { useFinanceUpdates } from "@/hooks/use-finance-updates";
import { alertMessage } from "@/lib/alert-labels";
import { useAuth } from "@/lib/auth";
import { getBankBrand } from "@/lib/bank-brand";
import { currentMonthYear, formatBRL } from "@/lib/format";
import {
  fetchAccounts,
  fetchAlerts,
  fetchCards,
  fetchCardStatement,
  fetchMonthlySummary,
  fetchTransactions,
  fetchTrends,
} from "@/lib/queries";
import type {
  Account,
  BudgetProgress,
  Card as CreditCardModel,
  CardStatement,
  CategorySummary,
  Transaction,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORY_COLORS = ["#56b787", "#83a9d3", "#8d82c4", "#e99367", "#c6d1cb"];

export default function HomePage() {
  const { user } = useAuth();
  const [valuesHidden, setValuesHidden] = React.useState(false);
  const { month, year } = currentMonthYear();
  const summary = useAsyncData(() => fetchMonthlySummary(month, year), [month, year], {
    cacheKey: `summary-monthly:${month}:${year}`,
  });
  const accounts = useAsyncData(() => fetchAccounts(), [], { cacheKey: "accounts" });
  const cards = useAsyncData(() => fetchCards(), [], { cacheKey: "cards" });
  const transactions = useAsyncData(() => fetchTransactions({ month, year }), [month, year], {
    cacheKey: `transactions:${month}:${year}`,
  });
  const alerts = useAsyncData(() => fetchAlerts({ month, year }), [month, year], {
    cacheKey: `alerts:${month}:${year}`,
  });
  const fromMonth = month - 5 <= 0 ? month + 7 : month - 5;
  const fromYear = month - 5 <= 0 ? year - 1 : year;
  const trends = useAsyncData(
    () => fetchTrends(fromMonth, fromYear, month, year),
    [fromMonth, fromYear, month, year],
    { cacheKey: `summary-trends:${fromMonth}:${fromYear}:${month}:${year}` },
  );
  const cardsReady = !cards.isLoading && Boolean(cards.data);
  const statementCacheKey = React.useMemo(
    () =>
      `dashboard-statements:${(cards.data ?? [])
        .map((card) => {
          const period = currentOpenStatementPeriod(card);
          return `${card.id}-${period.month}-${period.year}`;
        })
        .join("|")}`,
    [cards.data],
  );
  const statements = useAsyncData(
    () =>
      Promise.all(
        (cards.data ?? []).map((card) => {
          const period = currentOpenStatementPeriod(card);
          return fetchCardStatement(card.id, period.month, period.year);
        }),
      ),
    [cards.data],
    { enabled: cardsReady, initialData: [], cacheKey: statementCacheKey },
  );

  useFinanceUpdates(() => {
    summary.reload();
    accounts.reload();
    cards.reload();
    transactions.reload();
    alerts.reload();
    trends.reload();
    statements.reload();
  });

  const data = summary.data;
  const monthlyExpenses = (data?.accountExpenseTotal ?? 0) + (data?.cardPaymentsTotal ?? 0);
  const budgets = data?.budgetProgress ?? [];
  const budgetRemaining = budgets.reduce(
    (total, budget) => total + Math.max(0, budget.remainingAmount),
    0,
  );
  const chartData =
    trends.data?.map((point) => ({
      label: shortMonth(point.month, point.year),
      Receitas: point.incomeTotal,
      Despesas: point.accountExpenseTotal + point.cardStatementExpenseTotal,
    })) ?? [];
  const expenseCategories = normalizeCategoryBreakdown(data?.categoryBreakdown ?? []).slice(0, 5);
  const categoryTotal = expenseCategories.reduce((total, item) => total + item.value, 0);
  const statementTotals = React.useMemo(
    () => buildStatementTotalsByCardId(cards.data ?? [], statements.data ?? []),
    [cards.data, statements.data],
  );
  const recentTransactions = React.useMemo(
    () =>
      [...(transactions.data ?? [])]
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
        .slice(0, 5),
    [transactions.data],
  );
  const accountNames = React.useMemo(
    () => new Map((accounts.data ?? []).map((account) => [account.id, account.name])),
    [accounts.data],
  );
  const categoryNames = React.useMemo(
    () =>
      new Map(
        (data?.categoryBreakdown ?? [])
          .filter((category) => category.categoryId != null)
          .map((category) => [category.categoryId as number, category.categoryName]),
      ),
    [data?.categoryBreakdown],
  );
  const firstName = user?.name?.trim().split(/\s+/)[0] || "Olá";

  return (
    <>
      <MobileHomeDashboard
        firstName={firstName}
        valuesHidden={valuesHidden}
        onToggleValues={() => setValuesHidden((current) => !current)}
        totalBalance={data?.totalAccountBalance ?? 0}
        monthlyExpenses={monthlyExpenses}
        expenseCategories={expenseCategories}
        categoryTotal={categoryTotal}
        budgets={budgets}
      />

      <div className="hidden space-y-5 md:block sm:space-y-6">
        <header className="reveal-in flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-[-0.035em] sm:text-[1.75rem]">
              Olá, {firstName}! <span aria-hidden="true">👋</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Acompanhe suas finanças em um só lugar.
            </p>
          </div>
          <div className="inline-flex w-fit items-center rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground shadow-sm">
            {formatPeriod(month, year)}
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Saldo total"
            value={formatBRL(data?.totalAccountBalance)}
            hidden={valuesHidden}
            status="Saldo disponível em contas"
            tone="green"
            action={
              <button
                type="button"
                onClick={() => setValuesHidden((current) => !current)}
                className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label={valuesHidden ? "Mostrar valores" : "Ocultar valores"}
              >
                {valuesHidden ? (
                  <Eye className="h-3.5 w-3.5" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5" />
                )}
              </button>
            }
          />
          <MetricCard
            label="Receitas"
            value={formatBRL(data?.incomeTotal)}
            hidden={valuesHidden}
            status="Entradas neste mês"
            tone="green"
          />
          <MetricCard
            label="Despesas"
            value={formatBRL(monthlyExpenses)}
            hidden={valuesHidden}
            status="Saídas neste mês"
            tone="red"
          />
          <MetricCard
            label="Orçamento restante"
            value={formatBRL(budgetRemaining)}
            hidden={valuesHidden}
            status={
              budgets.length ? `${budgets.length} limites acompanhados` : "Nenhum limite criado"
            }
            tone="green"
          />
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <Card className="order-2 overflow-hidden">
            <CardContent className="p-5 sm:p-6">
              <SectionHeader
                title="Gastos ao longo do tempo"
                subtitle="Evolução dos últimos seis meses"
              />
              <div className="mt-5 h-[15.5rem] sm:h-[18rem]">
                <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                  <AreaChart data={chartData} margin={{ left: -12, right: 4, top: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dashboard-income" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#54b889" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#54b889" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="dashboard-expense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#e78277" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#e78277" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      width={48}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      tickFormatter={formatCompactBRL}
                    />
                    <Tooltip
                      formatter={(value: number) => formatBRL(value)}
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        boxShadow: "0 14px 35px rgba(22, 44, 35, .1)",
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Receitas"
                      stroke="#48a879"
                      fill="url(#dashboard-income)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="Despesas"
                      stroke="#dd766c"
                      fill="url(#dashboard-expense)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex gap-5 border-t border-border/70 pt-4 text-[11px] font-medium text-muted-foreground">
                <LegendDot color="#48a879" label="Receitas" />
                <LegendDot color="#dd766c" label="Despesas" />
              </div>
            </CardContent>
          </Card>

          <Card className="order-1 overflow-hidden">
            <CardContent className="p-5 sm:p-6">
              <SectionHeader title="Resumo de Gastos" subtitle="Distribuição do mês" />
              {expenseCategories.length ? (
                <>
                  <div className="relative mx-auto mt-5 h-44 max-w-[15rem]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                      <PieChart>
                        <Pie
                          data={expenseCategories}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={52}
                          outerRadius={75}
                          paddingAngle={1}
                          stroke="none"
                        >
                          {expenseCategories.map((item, index) => (
                            <Cell
                              key={item.name}
                              fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
                      <p className="text-[10px] text-muted-foreground">Total</p>
                      <p className="text-sm font-bold tabular-nums">
                        {valuesHidden ? "R$ ••••" : formatBRL(categoryTotal)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2.5">
                    {expenseCategories.map((item, index) => (
                      <div key={item.name} className="flex items-center gap-2 text-[11px]">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
                          }}
                        />
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">
                          {item.name}
                        </span>
                        <span className="font-semibold tabular-nums">
                          {Math.round((item.value / categoryTotal) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyLine text="As despesas categorizadas aparecerão aqui." className="mt-5" />
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardContent className="p-5 sm:p-6">
              <SectionHeader title="Últimas movimentações" to="/transactions" />
              <div className="mt-4 divide-y divide-border/70">
                {recentTransactions.map((transaction) => (
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    accountName={accountNames.get(transaction.accountId)}
                    categoryName={
                      transaction.categoryId ? categoryNames.get(transaction.categoryId) : undefined
                    }
                    hidden={valuesHidden}
                  />
                ))}
                {!transactions.isLoading && !recentTransactions.length ? (
                  <EmptyLine text="Nenhuma movimentação neste mês." />
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 sm:p-6">
              <SectionHeader title="Orçamentos" to="/budgets" />
              <div className="mt-5 space-y-5">
                {budgets.slice(0, 4).map((budget) => (
                  <BudgetRow
                    key={budget.budgetId}
                    name={budget.categoryName}
                    percentage={budget.percentUsed}
                    amount={budget.remainingAmount}
                  />
                ))}
                {!summary.isLoading && !budgets.length ? (
                  <EmptyLine text="Crie um orçamento para acompanhar seus limites." />
                ) : null}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          <DashboardListCard title="Contas" icon={<Landmark className="h-4 w-4" />} to="/accounts">
            {(accounts.data ?? []).slice(0, 4).map((account) => (
              <AccountRow key={account.id} account={account} hidden={valuesHidden} />
            ))}
            {!accounts.isLoading && !accounts.data?.length ? (
              <EmptyLine text="Nenhuma conta cadastrada." />
            ) : null}
          </DashboardListCard>

          <DashboardListCard title="Cartões" icon={<CreditCard className="h-4 w-4" />} to="/cards">
            {(cards.data ?? []).slice(0, 4).map((card) => (
              <CardBillRow
                key={card.id}
                card={card}
                amount={statementTotals.get(card.id) ?? 0}
                hidden={valuesHidden}
                loading={statements.isLoading}
              />
            ))}
            {!cards.isLoading && !cards.data?.length ? (
              <EmptyLine text="Nenhum cartão cadastrado." />
            ) : null}
          </DashboardListCard>

          <DashboardListCard
            title="Alertas"
            icon={<AlertCircle className="h-4 w-4" />}
            to="/alerts"
          >
            {(alerts.data ?? []).slice(0, 4).map((alert) => (
              <Link
                key={alert.key}
                to="/alerts"
                className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition hover:bg-muted"
              >
                <span
                  className={cn(
                    "mt-1 h-2 w-2 shrink-0 rounded-full",
                    alert.severity === "CRITICAL" ? "bg-[#dd766c]" : "bg-[#d8a249]",
                  )}
                />
                <p className="line-clamp-2 min-w-0 flex-1 text-xs font-medium leading-relaxed">
                  {alertMessage(alert)}
                </p>
                <ChevronRight className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            ))}
            {!alerts.isLoading && !alerts.data?.length ? (
              <EmptyLine text="Tudo sob controle neste período." />
            ) : null}
          </DashboardListCard>
        </section>
      </div>
    </>
  );
}

function MobileHomeDashboard({
  firstName,
  valuesHidden,
  onToggleValues,
  totalBalance,
  monthlyExpenses,
  expenseCategories,
  categoryTotal,
  budgets,
}: {
  firstName: string;
  valuesHidden: boolean;
  onToggleValues: () => void;
  totalBalance: number;
  monthlyExpenses: number;
  expenseCategories: Array<{ name: string; value: number }>;
  categoryTotal: number;
  budgets: BudgetProgress[];
}) {
  const quickActions = [
    { to: "/transactions", label: "Gastos", icon: ReceiptText },
    { to: "/accounts", label: "Contas", icon: Landmark },
    { to: "/cards", label: "Cartões", icon: CreditCard },
    { to: "/reports", label: "Relatórios", icon: BarChart3 },
  ];

  return (
    <div className="space-y-6 pb-2 md:hidden">
      <header className="flex items-center justify-between pt-1">
        <h1 className="font-display text-[1.35rem] font-bold tracking-[-0.035em]">
          Olá, {firstName} <span aria-hidden="true">👋</span>
        </h1>
        <Link
          to="/notifications"
          aria-label="Notificações"
          className="relative grid h-9 w-9 place-items-center rounded-full text-foreground"
        >
          <Bell className="h-[1.1rem] w-[1.1rem]" />
          <span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-[#ef6262] ring-2 ring-[#f7f8f6]" />
        </Link>
      </header>

      <section className="rounded-[1.15rem] bg-gradient-to-br from-[#139a61] via-[#19a968] to-[#129052] px-4 py-4 text-white shadow-[0_12px_30px_rgba(18,145,82,0.18)]">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium text-white/85">Saldo Total</p>
          <button
            type="button"
            onClick={onToggleValues}
            aria-label={valuesHidden ? "Mostrar valores" : "Ocultar valores"}
            className="grid h-7 w-7 place-items-center rounded-full text-white/80"
          >
            {valuesHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>
        </div>
        <p className="mt-1 font-display text-[1.55rem] font-bold tracking-[-0.04em] tabular-nums">
          {valuesHidden ? "R$ •••••" : formatBRL(totalBalance)}
        </p>
        <p className="mt-1.5 flex items-center gap-1 text-[9px] font-semibold text-white/90">
          <ArrowUpRight className="h-3 w-3" /> Saldo disponível em contas
        </p>
      </section>

      <nav aria-label="Atalhos financeiros" className="grid grid-cols-4 gap-2">
        {quickActions.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="flex min-h-[4.6rem] flex-col items-center justify-center gap-2 rounded-[1rem] border border-border/70 bg-card px-1 text-center shadow-[0_6px_18px_rgba(24,65,47,0.04)]"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-muted text-foreground">
              <action.icon className="h-3.5 w-3.5" />
            </span>
            <span className="text-[9px] font-semibold">{action.label}</span>
          </Link>
        ))}
      </nav>

      <section>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold">Resumo de Gastos</h2>
            <p className="mt-1 font-display text-xl font-bold tracking-[-0.035em] tabular-nums">
              {valuesHidden ? "R$ •••••" : formatBRL(monthlyExpenses)}
            </p>
            <p className="text-[9px] text-muted-foreground">Este mês</p>
          </div>
          <Link to="/reports" className="text-[9px] font-semibold text-primary">
            Ver todos
          </Link>
        </div>

        {expenseCategories.length ? (
          <div className="mt-3 grid grid-cols-[8.25rem_minmax(0,1fr)] items-center gap-4">
            <div className="h-[8.25rem]">
              <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                <PieChart>
                  <Pie
                    data={expenseCategories}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={38}
                    outerRadius={61}
                    paddingAngle={1}
                    stroke="none"
                  >
                    {expenseCategories.map((item, index) => (
                      <Cell
                        key={item.name}
                        fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2.5">
              {expenseCategories.map((item, index) => (
                <div key={item.name} className="flex min-w-0 items-center gap-2 text-[9px]">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                  />
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{item.name}</span>
                  <span className="font-semibold tabular-nums">
                    {categoryTotal ? Math.round((item.value / categoryTotal) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyLine text="As despesas categorizadas aparecerão aqui." className="mt-4" />
        )}
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Orçamentos</h2>
          <Link to="/budgets" className="text-[9px] font-semibold text-primary">
            Ver todos
          </Link>
        </div>
        <div className="mt-3 divide-y divide-border/70 rounded-[1rem] border border-border/70 bg-card px-3">
          {budgets.slice(0, 3).map((budget) => (
            <div key={budget.budgetId} className="flex items-center gap-3 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                <PiggyBank className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-[10px] font-semibold">{budget.categoryName}</p>
                  <span className="text-[9px] font-semibold tabular-nums text-muted-foreground">
                    {Math.round(budget.percentUsed)}%
                  </span>
                </div>
                <p className="mt-0.5 text-[8px] text-muted-foreground">
                  {valuesHidden
                    ? "R$ ••• de R$ •••"
                    : `${formatBRL(budget.spentAmount)} de ${formatBRL(budget.budgetAmount)}`}
                </p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[#28a76c]"
                    style={{ width: `${Math.min(100, Math.max(0, budget.percentUsed))}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
          {!budgets.length ? (
            <p className="py-5 text-center text-[10px] text-muted-foreground">
              Crie um orçamento para acompanhar seus limites.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hidden,
  status,
  tone,
  action,
}: {
  label: string;
  value: string;
  hidden: boolean;
  status: string;
  tone: "green" | "red";
  action?: React.ReactNode;
}) {
  return (
    <Card className="reveal-in overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
          {action}
        </div>
        <p className="mt-2 truncate font-display text-xl font-bold tracking-[-0.035em] tabular-nums sm:text-2xl">
          {hidden ? "R$ ••••••" : value}
        </p>
        <div
          className={cn(
            "mt-3 flex items-center gap-1.5 text-[10px] font-medium",
            tone === "green" ? "text-[#3a9a6c]" : "text-[#cf675e]",
          )}
        >
          {tone === "green" ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownLeft className="h-3 w-3" />
          )}
          <span>{status}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionHeader({ title, subtitle, to }: { title: string; subtitle?: string; to?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="font-display text-sm font-bold tracking-tight sm:text-base">{title}</h2>
        {subtitle ? <p className="mt-1 text-[11px] text-muted-foreground">{subtitle}</p> : null}
      </div>
      {to ? (
        <Link
          to={to}
          className="text-[10px] font-semibold text-[#31966b] transition hover:text-primary"
        >
          Ver todas
        </Link>
      ) : null}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function TransactionRow({
  transaction,
  accountName,
  categoryName,
  hidden,
}: {
  transaction: Transaction;
  accountName?: string;
  categoryName?: string;
  hidden: boolean;
}) {
  const positive = transaction.type === "INCOME" || transaction.type === "TRANSFER_IN";
  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
          positive
            ? "bg-[#e8f5ee] text-[#3c9c70] dark:bg-primary/15"
            : "bg-muted text-muted-foreground",
        )}
      >
        {positive ? <WalletCards className="h-4 w-4" /> : <ReceiptText className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">
          {transaction.description || transactionLabel(transaction.type)}
        </p>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
          {categoryName || accountName || "Movimentação"} ·{" "}
          {formatTransactionDate(transaction.occurredAt)}
        </p>
      </div>
      <p
        className={cn(
          "shrink-0 text-xs font-semibold tabular-nums",
          positive ? "text-[#31966b]" : "text-foreground",
        )}
      >
        {hidden ? "••••" : `${positive ? "+ " : "- "}${formatBRL(Math.abs(transaction.amount))}`}
      </p>
    </div>
  );
}

function BudgetRow({
  name,
  percentage,
  amount,
}: {
  name: string;
  percentage: number;
  amount: number;
}) {
  const safe = Math.min(100, Math.max(0, percentage));
  const critical = percentage >= 100;
  const warning = percentage >= 80;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{name}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {amount >= 0
              ? `${formatBRL(amount)} restantes`
              : `${formatBRL(Math.abs(amount))} acima do limite`}
          </p>
        </div>
        <p
          className={cn(
            "shrink-0 text-[10px] font-semibold",
            critical ? "text-destructive" : warning ? "text-[#b77a13]" : "text-muted-foreground",
          )}
        >
          {Math.round(percentage)}%
        </p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            critical ? "bg-destructive" : warning ? "bg-[#e8ad3f]" : "bg-[#56b787]",
          )}
          style={{ width: `${safe}%` }}
        />
      </div>
    </div>
  );
}

function DashboardListCard({
  title,
  icon,
  to,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  to: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#e8f5ee] text-[#31966b] dark:bg-primary/15">
              {icon}
            </span>
            <h2 className="font-display text-sm font-bold">{title}</h2>
          </div>
          <Link
            to={to}
            aria-label={`Ver ${title.toLowerCase()}`}
            className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="space-y-3">{children}</div>
      </CardContent>
    </Card>
  );
}

function AccountRow({ account, hidden }: { account: Account; hidden: boolean }) {
  const brand = getBankBrand(account.name);
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-full text-[10px] font-bold",
          brand.softClassName,
        )}
      >
        {getInitials(account.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">{account.name}</p>
        <p className="text-[10px] text-muted-foreground">{accountTypeLabel(account.type)}</p>
      </div>
      <p className="text-xs font-semibold tabular-nums">
        {hidden ? "R$ ••••" : formatBRL(account.balance, account.currency || "BRL")}
      </p>
    </div>
  );
}

function CardBillRow({
  card,
  amount,
  hidden,
  loading,
}: {
  card: CreditCardModel;
  amount: number;
  hidden: boolean;
  loading: boolean;
}) {
  const brand = getBankBrand(card.bankName);
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", brand.softClassName)}
      >
        <CreditCard className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">{card.name}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {card.bankName}
          {card.lastFourDigits ? ` · ${card.lastFourDigits}` : ""}
        </p>
      </div>
      <p className="text-xs font-semibold tabular-nums">
        {loading ? "—" : hidden ? "R$ ••••" : formatBRL(amount)}
      </p>
    </div>
  );
}

function EmptyLine({ text, className }: { text: string; className?: string }) {
  return (
    <p
      className={cn(
        "rounded-lg bg-muted/70 px-3 py-3 text-xs leading-relaxed text-muted-foreground",
        className,
      )}
    >
      {text}
    </p>
  );
}

function normalizeCategoryBreakdown(categories: CategorySummary[]) {
  return categories
    .filter((category) => category.categoryType !== "INCOME")
    .map((category) => ({
      name: category.categoryName,
      value: Number(category.amount ?? category.total ?? 0),
    }))
    .filter((category) => category.value > 0)
    .sort((left, right) => right.value - left.value);
}

function shortMonth(month: number, year: number) {
  return new Intl.DateTimeFormat("pt-BR", { month: "short" })
    .format(new Date(year, month - 1, 1))
    .replace(".", "");
}

function formatPeriod(month: number, year: number) {
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatCompactBRL(value: number) {
  if (Math.abs(value) >= 1000) return `${Math.round(value / 1000)}k`;
  return String(Math.round(value));
}

function formatTransactionDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
    new Date(value),
  );
}

function transactionLabel(type: Transaction["type"]) {
  return (
    {
      INCOME: "Receita",
      EXPENSE: "Despesa",
      TRANSFER_IN: "Transferência recebida",
      TRANSFER_OUT: "Transferência enviada",
      CARD_PAYMENT: "Pagamento de cartão",
      ADJUSTMENT: "Ajuste",
    } as const
  )[type];
}

function getInitials(value: string) {
  return (
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "PR"
  );
}

function accountTypeLabel(type: Account["type"]) {
  return (
    (
      {
        CHECKING: "Conta corrente",
        SAVINGS: "Poupança",
        CASH: "Dinheiro",
        OTHER: "Conta manual",
      } as const
    )[type] ?? "Conta"
  );
}

function currentOpenStatementPeriod(card: CreditCardModel): { month: number; year: number } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const statementMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  let dueMonth = statementDueMonth(statementMonth, card);
  const dueDate = atConfiguredDay(dueMonth.getFullYear(), dueMonth.getMonth(), card.dueDay);
  if (today > dueDate) {
    statementMonth.setMonth(statementMonth.getMonth() + 1);
    dueMonth = statementDueMonth(statementMonth, card);
  }
  return { month: dueMonth.getMonth() + 1, year: dueMonth.getFullYear() };
}

function statementDueMonth(statementMonth: Date, card: CreditCardModel) {
  const dueMonth = new Date(statementMonth);
  if (card.dueDay <= card.closingDay) dueMonth.setMonth(dueMonth.getMonth() + 1);
  return dueMonth;
}

function atConfiguredDay(year: number, zeroBasedMonth: number, day: number) {
  const lastDay = new Date(year, zeroBasedMonth + 1, 0).getDate();
  return new Date(year, zeroBasedMonth, Math.min(day, lastDay));
}

function buildStatementTotalsByCardId(cards: CreditCardModel[], statements: CardStatement[]) {
  const totals = new Map<number, number>();
  statements.forEach((statement) =>
    totals.set(statement.cardId, Number(statement.remainingAmount ?? statement.totalAmount ?? 0)),
  );
  cards.forEach((card) => {
    if (!totals.has(card.id)) totals.set(card.id, 0);
  });
  return totals;
}
