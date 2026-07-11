import * as React from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronRight,
  CreditCard,
  Eye,
  EyeOff,
  Landmark,
  PiggyBank,
  Sparkles,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useFinanceUpdates } from "@/hooks/use-finance-updates";
import { useAsyncData } from "@/hooks/use-async-data";
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
  fetchTrends,
} from "@/lib/queries";
import type { Account, Card as CreditCardModel, CardStatement } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const { user } = useAuth();
  const [valuesHidden, setValuesHidden] = React.useState(false);
  const { month, year } = currentMonthYear();
  const summary = useAsyncData(() => fetchMonthlySummary(month, year), [month, year], {
    cacheKey: `summary-monthly:${month}:${year}`,
  });
  const accounts = useAsyncData(() => fetchAccounts(), [], { cacheKey: "accounts" });
  const cards = useAsyncData(() => fetchCards(), [], { cacheKey: "cards" });
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

  useFinanceUpdates(() => {
    summary.reload();
    accounts.reload();
    cards.reload();
    statements.reload();
    alerts.reload();
    trends.reload();
  });

  const data = summary.data;
  const statementTotals = React.useMemo(
    () => buildStatementTotalsByCardId(cards.data ?? [], statements.data ?? []),
    [cards.data, statements.data],
  );
  const openBillsTotal = statements.data?.length
    ? statements.data.reduce(
        (total, statement) => total + Number(statement.remainingAmount ?? 0),
        0,
      )
    : (data?.cardBillsRemaining ?? data?.cardBillsTotal ?? 0);
  const monthlyExpenses = (data?.accountExpenseTotal ?? 0) + (data?.cardPaymentsTotal ?? 0);
  const savingsRate = data?.incomeTotal
    ? Math.round(((data.incomeTotal - monthlyExpenses) / data.incomeTotal) * 100)
    : 0;
  const chartData =
    trends.data?.map((point) => ({
      label: shortMonth(point.month),
      Receitas: point.incomeTotal,
      Despesas: point.accountExpenseTotal + point.cardStatementExpenseTotal,
    })) ?? [];
  const budgets = data?.budgetProgress ?? [];

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="reveal-in flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-[#9ed440]" />
            {getGreeting()}, {getFirstName(user)}
          </div>
          <h1 className="font-display text-[2rem] font-extrabold leading-tight tracking-[-0.04em] sm:text-[2.6rem]">
            Seu dinheiro, em perspectiva.
          </h1>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground shadow-sm">
          <CalendarDays className="h-3.5 w-3.5 text-primary" />
          {formatPeriod(month, year)}
        </div>
      </header>

      <section className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
        <div className="reveal-in order-2 relative min-h-[22rem] overflow-hidden rounded-[1.75rem] bg-[#0b2e24] p-6 text-white shadow-[0_24px_60px_rgba(11,46,36,0.18)] sm:p-8">
          <div className="absolute -right-28 -top-28 hidden h-80 w-80 rounded-full border-[52px] border-[#c9ff5b]/10 sm:block" />
          <div className="absolute -bottom-24 right-28 h-56 w-56 rounded-full bg-[#c9ff5b]/10 blur-3xl" />
          <div className="relative flex h-full flex-col justify-between gap-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-white/55">
                  <WalletCards className="h-4 w-4 text-[#c9ff5b]" />
                  Patrimônio disponível
                </div>
                <p className="font-display text-4xl font-extrabold tracking-[-0.045em] sm:text-5xl">
                  {summary.isLoading
                    ? "—"
                    : valuesHidden
                      ? "R$ ••••••"
                      : formatBRL(data?.totalAccountBalance)}
                </p>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-white/50">
                  Soma das suas contas ativas. Faturas e compromissos aparecem separados para você
                  decidir com clareza.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setValuesHidden((value) => !value)}
                aria-label={valuesHidden ? "Mostrar valores" : "Ocultar valores"}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.07] text-white/65 transition hover:bg-white/10 hover:text-white"
              >
                {valuesHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3">
              <HeroMetric
                label="Entrou no mês"
                value={formatBRL(data?.incomeTotal)}
                hidden={valuesHidden}
                icon={<ArrowDownLeft className="h-4 w-4" />}
                positive
              />
              <HeroMetric
                label="Saiu no mês"
                value={formatBRL(monthlyExpenses)}
                hidden={valuesHidden}
                icon={<ArrowUpRight className="h-4 w-4" />}
              />
              <HeroMetric
                label="Fluxo líquido"
                value={formatBRL(data?.netCashFlow)}
                hidden={valuesHidden}
                icon={<Sparkles className="h-4 w-4" />}
                positive={(data?.netCashFlow ?? 0) >= 0}
              />
            </div>
          </div>
        </div>

        <Card className="reveal-in order-1 overflow-hidden">
          <CardContent className="flex h-full flex-col p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  A pagar
                </p>
                <h2 className="mt-2 font-display text-2xl font-extrabold tracking-[-0.035em]">
                  Faturas abertas
                </h2>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#fff0ec] text-[#df5a48] dark:bg-[#5b281f] dark:text-[#ff9a8a]">
                <CreditCard className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-6">
              <p className="text-xs text-muted-foreground">Saldo pendente total</p>
              <p className="mt-1 font-display text-3xl font-extrabold tracking-[-0.04em]">
                {statements.isLoading ? "—" : valuesHidden ? "R$ ••••" : formatBRL(openBillsTotal)}
              </p>
            </div>
            <div className="my-5 h-px bg-border" />
            <div className="flex-1 space-y-3">
              {(cards.data ?? []).slice(0, 3).map((card) => (
                <CardBillRow
                  key={card.id}
                  card={card}
                  amount={statementTotals.get(card.id) ?? 0}
                  hidden={valuesHidden}
                  loading={statements.isLoading}
                />
              ))}
              {!cards.isLoading && !cards.data?.length && (
                <EmptyLine text="Nenhum cartão cadastrado." />
              )}
            </div>
            <Link
              to="/cards"
              className="mt-5 flex items-center justify-between rounded-2xl bg-muted px-4 py-3 text-sm font-semibold transition hover:bg-accent"
            >
              Gerenciar cartões <ArrowRight className="h-4 w-4 text-primary" />
            </Link>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="overflow-hidden">
          <CardContent className="p-5 sm:p-6">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">
                  <BarChart3 className="h-4 w-4" /> Ritmo financeiro
                </div>
                <h2 className="font-display text-2xl font-extrabold tracking-[-0.035em]">
                  Entradas e saídas
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Evolução dos últimos seis meses
                </p>
              </div>
              <Link
                to="/reports"
                className="rounded-full border border-border px-3.5 py-2 text-xs font-semibold transition hover:border-primary/30 hover:bg-accent"
              >
                Explorar relatórios
              </Link>
            </div>
            <div className="h-[16rem] sm:h-[19rem]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ left: 0, right: 4, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="income-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.23} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expense-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 6" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      boxShadow: "0 18px 48px rgba(10, 30, 22, .12)",
                      fontSize: 12,
                    }}
                    formatter={(value: number) => formatBRL(value)}
                  />
                  <Area
                    type="monotone"
                    dataKey="Receitas"
                    stroke="var(--chart-1)"
                    fill="url(#income-fill)"
                    strokeWidth={2.5}
                  />
                  <Area
                    type="monotone"
                    dataKey="Despesas"
                    stroke="var(--chart-2)"
                    fill="url(#expense-fill)"
                    strokeWidth={2.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex gap-5 border-t border-border pt-4 text-xs font-medium text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--chart-1)]" />
                Receitas
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--chart-2)]" />
                Despesas
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden bg-[#e8f0d9] dark:bg-[#15291f]">
          <CardContent className="flex h-full flex-col p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <Badge className="rounded-full border-0 bg-[#0b2e24] px-3 text-[#c9ff5b] hover:bg-[#0b2e24]">
                Leitura do mês
              </Badge>
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="mt-8">
              <p className="text-sm text-muted-foreground">Taxa de sobra estimada</p>
              <p className="mt-1 font-display text-6xl font-extrabold tracking-[-0.06em] text-[#0b2e24] dark:text-foreground">
                {summary.isLoading ? "—" : `${savingsRate}%`}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {savingsRate >= 20
                  ? "Você está preservando uma boa parte da renda deste mês. Continue assim."
                  : savingsRate >= 0
                    ? "Seu mês está positivo, mas há pouco espaço para imprevistos."
                    : "As saídas superaram as entradas. Vale revisar os maiores gastos."}
              </p>
            </div>
            <div className="mt-auto pt-8">
              <div className="h-2 overflow-hidden rounded-full bg-[#0b2e24]/10 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-[#0b2e24] dark:bg-[#c9ff5b]"
                  style={{ width: `${Math.max(4, Math.min(100, savingsRate))}%` }}
                />
              </div>
              <div className="mt-3 flex justify-between text-[11px] font-semibold text-muted-foreground">
                <span>0%</span>
                <span>Meta saudável: 20%</span>
                <span>100%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <DashboardListCard
          eyebrow="Liquidez"
          title="Suas contas"
          icon={<Landmark className="h-5 w-5" />}
          to="/accounts"
          linkLabel="Ver contas"
        >
          <div className="space-y-3">
            {(accounts.data ?? []).slice(0, 4).map((account) => (
              <AccountRow key={account.id} account={account} hidden={valuesHidden} />
            ))}
            {!accounts.isLoading && !accounts.data?.length && (
              <EmptyLine text="Nenhuma conta cadastrada." />
            )}
          </div>
        </DashboardListCard>

        <DashboardListCard
          eyebrow="Limites"
          title="Orçamentos"
          icon={<PiggyBank className="h-5 w-5" />}
          to="/budgets"
          linkLabel="Planejar gastos"
        >
          <div className="space-y-4">
            {budgets.slice(0, 4).map((budget) => (
              <BudgetRow
                key={budget.budgetId}
                name={budget.categoryName}
                percentage={budget.percentUsed}
                amount={budget.remainingAmount}
              />
            ))}
            {!summary.isLoading && !budgets.length && (
              <EmptyLine text="Crie um orçamento para acompanhar seus limites." />
            )}
          </div>
        </DashboardListCard>

        <DashboardListCard
          eyebrow="Atenção"
          title="O que pede ação"
          icon={<AlertCircle className="h-5 w-5" />}
          to="/alerts"
          linkLabel="Ver central"
        >
          <div className="space-y-2.5">
            {(alerts.data ?? []).slice(0, 4).map((alert) => (
              <Link
                key={alert.key}
                to="/alerts"
                className="flex items-start gap-3 rounded-2xl bg-muted/70 p-3 transition hover:bg-accent"
              >
                <span
                  className={cn(
                    "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full",
                    alert.severity === "CRITICAL" ? "bg-[#ef6a57]" : "bg-[#e3aa37]",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">
                    {alertMessage(alert)}
                  </p>
                  {alert.dueDate && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Vence em {formatDate(alert.dueDate)}
                    </p>
                  )}
                </div>
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
            {!alerts.isLoading && !alerts.data?.length && (
              <div className="rounded-2xl bg-[#e7f5df] p-4 dark:bg-[#163226]">
                <p className="text-sm font-semibold text-primary">Tudo sob controle</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Nenhum alerta financeiro para este período.
                </p>
              </div>
            )}
          </div>
        </DashboardListCard>
      </section>
    </div>
  );
}

function HeroMetric({
  label,
  value,
  hidden,
  icon,
  positive = false,
}: {
  label: string;
  value: string;
  hidden: boolean;
  icon: React.ReactNode;
  positive?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-3.5 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-white/50">
        <span
          className={cn(
            "grid h-7 w-7 place-items-center rounded-lg",
            positive ? "bg-[#c9ff5b]/15 text-[#c9ff5b]" : "bg-white/8 text-white/70",
          )}
        >
          {icon}
        </span>
        {label}
      </div>
      <p className="mt-3 truncate text-sm font-bold tabular-nums sm:text-base">
        {hidden ? "R$ ••••" : value}
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
        className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", brand.softClassName)}
      >
        <CreditCard className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{card.name}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {card.bankName}
          {card.lastFourDigits ? ` • ${card.lastFourDigits}` : ""}
        </p>
      </div>
      <p className="text-sm font-bold tabular-nums">
        {loading ? "—" : hidden ? "••••" : formatBRL(amount)}
      </p>
    </div>
  );
}

function AccountRow({ account, hidden }: { account: Account; hidden: boolean }) {
  const brand = getBankBrand(account.name);
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-extrabold",
          brand.solidClassName,
        )}
      >
        {getInitials(account.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{account.name}</p>
        <p className="text-[11px] text-muted-foreground">{accountTypeLabel(account.type)}</p>
      </div>
      <p className="text-sm font-bold tabular-nums" style={{ color: brand.color }}>
        {hidden ? "R$ ••••" : formatBRL(account.balance, account.currency || "BRL")}
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
        <p className="truncate text-sm font-semibold">{name}</p>
        <p
          className={cn(
            "shrink-0 text-[11px] font-bold",
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
            critical ? "bg-destructive" : warning ? "bg-[#e8ad3f]" : "bg-primary",
          )}
          style={{ width: `${safe}%` }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {amount >= 0
          ? `${formatBRL(amount)} disponíveis`
          : `${formatBRL(Math.abs(amount))} acima do limite`}
      </p>
    </div>
  );
}

function DashboardListCard({
  eyebrow,
  title,
  icon,
  to,
  linkLabel,
  children,
}: {
  eyebrow: string;
  title: string;
  icon: React.ReactNode;
  to: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {eyebrow}
            </p>
            <h2 className="mt-1 font-display text-xl font-extrabold tracking-[-0.03em]">{title}</h2>
          </div>
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-accent text-primary">
            {icon}
          </span>
        </div>
        <div className="min-h-36">{children}</div>
        <Link
          to={to}
          className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs font-bold text-primary"
        >
          {linkLabel} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <p className="rounded-2xl bg-muted/70 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
      {text}
    </p>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function getFirstName(user?: { name?: string | null; email?: string | null } | null) {
  if (user?.name?.trim()) return user.name.trim().split(/\s+/)[0];
  const local = user?.email?.split("@")[0] ?? "Prospera";
  const name = local.split(/[._-]+/).find(Boolean) ?? "Prospera";
  return name.charAt(0).toUpperCase() + name.slice(1).replace(/\d+$/g, "").toLowerCase();
}

function shortMonth(month: number) {
  return new Intl.DateTimeFormat("pt-BR", { month: "short" })
    .format(new Date(2026, month - 1, 1))
    .replace(".", "");
}

function formatPeriod(month: number, year: number) {
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
    new Date(`${value}T12:00:00`),
  );
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
    { CHECKING: "Conta corrente", SAVINGS: "Poupança", CASH: "Dinheiro", OTHER: "Conta manual" }[
      type
    ] ?? "Conta"
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
