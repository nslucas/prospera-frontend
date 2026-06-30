import * as React from "react";
import { Link } from "react-router-dom";
import { useAsyncData } from "@/hooks/use-async-data";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  ChevronRight,
  EyeOff,
  Landmark,
  Link2,
  Receipt,
  Wallet,
} from "lucide-react";
import {
  fetchAccounts,
  fetchAlerts,
  fetchCards,
  fetchCardStatement,
  fetchMonthlySummary,
  fetchTrends,
} from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { alertMessage, alertTypeLabel } from "@/lib/alert-labels";
import { getBankBrand } from "@/lib/bank-brand";
import { currentMonthYear, formatBRL } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Account, Card as CreditCardModel, CardStatement } from "@/lib/types";

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
  const openStatementsCacheKey = React.useMemo(
    () =>
      `home-open-statements:${(cards.data ?? [])
        .map((card) => {
          const period = currentOpenStatementPeriod(card);
          return `${card.id}-${period.month}-${period.year}`;
        })
        .join("|")}`,
    [cards.data],
  );
  const openStatements = useAsyncData(
    () =>
      Promise.all(
        (cards.data ?? []).map((card) => {
          const period = currentOpenStatementPeriod(card);
          return fetchCardStatement(card.id, period.month, period.year);
        }),
      ),
    [cards.data],
    {
      enabled: cardsReady,
      initialData: [],
      cacheKey: openStatementsCacheKey,
    },
  );
  const alerts = useAsyncData(() => fetchAlerts({ month, year }), [month, year], {
    cacheKey: `alerts:${month}:${year}`,
  });
  const fromMonth = month - 5 <= 0 ? month - 5 + 12 : month - 5;
  const fromYear = month - 5 <= 0 ? year - 1 : year;
  const trends = useAsyncData(
    () => fetchTrends(fromMonth, fromYear, month, year),
    [fromMonth, fromYear, month, year],
    {
      cacheKey: `summary-trends:${fromMonth}:${fromYear}:${month}:${year}`,
    },
  );

  const s = summary.data;
  const trendData =
    trends.data?.map((item) => ({
      label: `${String(item.month).padStart(2, "0")}/${String(item.year).slice(-2)}`,
      Receita: item.incomeTotal,
      Despesa: item.accountExpenseTotal + item.cardStatementExpenseTotal,
    })) ?? [];
  const overdueAlerts = alerts.data?.filter((alert) => alert.type === "CARD_BILL_OVERDUE") ?? [];
  const userName = getUserName(user);
  const openCardBillsTotal = openStatements.data?.length
    ? openStatements.data.reduce(
        (total, statement) => total + Number(statement.totalAmount ?? 0),
        0,
      )
    : (s?.cardBillsTotal ?? 0);
  const statementTotalsByCardId = React.useMemo(
    () => buildStatementTotalsByCardId(cards.data ?? [], openStatements.data ?? []),
    [cards.data, openStatements.data],
  );
  const cardBillsLoading = cards.isLoading || openStatements.isLoading;

  return (
    <div className="space-y-4 md:space-y-5">
      <section className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(18rem,0.68fr)] md:items-center">
        <header className="px-4 pb-1 pt-2 text-foreground md:px-0 md:py-1">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{getGreeting()},</p>
              <h1 className="mt-0.5 max-w-[13rem] break-words text-2xl font-semibold leading-tight tracking-tight md:max-w-none md:text-3xl">
                {userName}
              </h1>
            </div>
            <Link
              to="/accounts"
              aria-label="Gerenciar conexões"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border transition-colors hover:bg-accent hover:text-primary"
            >
              <Link2 className="h-5 w-5" />
            </Link>
          </div>
        </header>

        <Link
          to="/alerts"
          className="mx-4 flex items-center gap-3 rounded-lg border border-border/80 bg-card px-3 py-3 transition-colors hover:border-primary/30 hover:bg-accent/30 md:mx-0 md:px-4"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold tracking-tight">
              Lançamentos atrasados
            </span>
            <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">
              {alerts.isLoading
                ? "Verificando pendências"
                : overdueAlerts.length
                  ? `Você tem ${overdueAlerts.length} lançamento${overdueAlerts.length > 1 ? "s" : ""} atrasado${
                      overdueAlerts.length > 1 ? "s" : ""
                    }`
                  : "Nenhum lançamento atrasado"}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </Link>
      </section>

      <div className="space-y-3 px-4 md:space-y-4 md:px-0">
        <section className="grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
          <CardsPanel
            loading={summary.isLoading || cardBillsLoading}
            total={formatBRL(openCardBillsTotal)}
            cards={cards.data ?? []}
            statementTotalsByCardId={statementTotalsByCardId}
            valuesHidden={valuesHidden}
            onToggleValues={() => setValuesHidden((hidden) => !hidden)}
            statementValuesLoading={cardBillsLoading}
          />
          <BalancePanel
            loading={summary.isLoading}
            total={formatBRL(s?.totalAccountBalance)}
            accounts={accounts.data ?? []}
            valuesHidden={valuesHidden}
            onToggleValues={() => setValuesHidden((hidden) => !hidden)}
          />
        </section>

        <section className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
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
            label="Fluxo líquido"
            value={formatBRL(s?.netCashFlow)}
            icon={<Wallet className="h-4 w-4" />}
            loading={summary.isLoading}
            tone={s?.netCashFlow && s.netCashFlow >= 0 ? "success" : undefined}
          />
          <Stat
            label="Faturas"
            value={formatBRL(openCardBillsTotal)}
            icon={<Receipt className="h-4 w-4" />}
            loading={summary.isLoading || cardBillsLoading}
          />
        </section>

        <Card className="overflow-hidden">
          <CardContent className="p-4 md:p-5">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <div className="mb-1 flex items-center gap-2 text-primary">
                  <BarChart3 className="h-4 w-4" />
                  <h2 className="text-lg font-semibold tracking-tight">Receitas vs. Despesas</h2>
                </div>
                <p className="text-xs text-muted-foreground">Últimos 6 meses</p>
              </div>
              <Link to="/reports" className="text-xs font-medium text-primary hover:underline">
                Ver relatórios
              </Link>
            </div>
            <div className="h-48 md:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="home-inc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--success)" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="home-exp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.14} />
                      <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.65} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickFormatter={(value) =>
                      Number(value) >= 1000 ? `${(Number(value) / 1000).toFixed(0)}k` : `${value}`
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value: number) => formatBRL(value)}
                  />
                  <Area
                    type="monotone"
                    dataKey="Receita"
                    stroke="var(--success)"
                    fill="url(#home-inc)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="Despesa"
                    stroke="var(--destructive)"
                    fill="url(#home-exp)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Alertas do mês</h2>
            <Link to="/alerts" className="text-xs font-medium text-primary hover:underline">
              Ver todos
            </Link>
          </div>
          <div className="space-y-2">
            {alerts.data?.slice(0, 5).map((alert) => (
              <div
                key={alert.key}
                className="flex items-start gap-3 rounded-lg border border-border/70 bg-card px-3 py-2.5"
              >
                <AlertTriangle
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    alert.severity === "CRITICAL" ? "text-destructive" : "text-[var(--warning)]"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{alertMessage(alert)}</p>
                  <Badge variant="secondary" className="mt-1 text-[10px]">
                    {alertTypeLabel(alert.type)}
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
    </div>
  );
}

function BalancePanel({
  loading,
  total,
  accounts,
  valuesHidden,
  onToggleValues,
}: {
  loading?: boolean;
  total: string;
  accounts: Account[];
  valuesHidden: boolean;
  onToggleValues: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Saldo geral</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums md:text-3xl">
              {loading ? "..." : valuesHidden ? "R$ ****" : total}
            </p>
          </div>
          <button
            type="button"
            aria-label={valuesHidden ? "Mostrar saldo" : "Ocultar saldo"}
            onClick={onToggleValues}
            className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <EyeOff className="h-5 w-5" />
          </button>
        </div>

        <div className="my-4 h-px bg-border/70" />

        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">Minhas contas</h2>
          <Link to="/accounts" className="text-xs font-medium text-primary hover:underline">
            Ver todas
          </Link>
        </div>

        <div className="space-y-3">
          {accounts.slice(0, 3).map((account) => (
            <AccountRow key={account.id} account={account} valuesHidden={valuesHidden} />
          ))}
          {!accounts.length && (
            <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CardsPanel({
  loading,
  total,
  cards,
  statementTotalsByCardId,
  valuesHidden,
  onToggleValues,
  statementValuesLoading,
}: {
  loading?: boolean;
  total: string;
  cards: CreditCardModel[];
  statementTotalsByCardId: Map<number, number>;
  valuesHidden: boolean;
  onToggleValues: () => void;
  statementValuesLoading?: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Total das faturas</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-primary tabular-nums md:text-3xl">
              {loading ? "..." : valuesHidden ? "R$ ****" : total}
            </p>
          </div>
          <button
            type="button"
            aria-label={valuesHidden ? "Mostrar faturas" : "Ocultar faturas"}
            onClick={onToggleValues}
            className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <EyeOff className="h-5 w-5" />
          </button>
        </div>

        <div className="my-4 h-px bg-border/70" />

        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">Meus cartões</h2>
          <Link to="/cards" className="text-xs font-medium text-primary hover:underline">
            Ver todos
          </Link>
        </div>

        <div className="space-y-3">
          {cards.slice(0, 3).map((card) => (
            <CardRow
              key={card.id}
              card={card}
              billAmount={statementTotalsByCardId.get(card.id) ?? 0}
              valuesHidden={valuesHidden}
              loading={statementValuesLoading}
            />
          ))}
          {!cards.length && (
            <p className="text-sm text-muted-foreground">Nenhum cartão cadastrado.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AccountRow({ account, valuesHidden }: { account: Account; valuesHidden: boolean }) {
  const brand = getBankBrand(account.name);

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${brand.solidClassName} text-sm font-semibold`}
        >
          {getInitials(account.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-medium tracking-tight">{account.name}</p>
          <p className="text-xs text-muted-foreground">{accountTypeLabel(account.type)}</p>
        </div>
      </div>
      <p className="shrink-0 text-sm font-medium tabular-nums" style={{ color: brand.color }}>
        {valuesHidden ? "R$ ****" : formatBRL(account.balance, account.currency || "BRL")}
      </p>
    </div>
  );
}

function CardRow({
  card,
  billAmount,
  valuesHidden,
  loading,
}: {
  card: CreditCardModel;
  billAmount: number;
  valuesHidden: boolean;
  loading?: boolean;
}) {
  const brand = getBankBrand(card.bankName);

  return (
    <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-3">
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${brand.softClassName}`}
      >
        <Landmark className="h-5 w-5" />
      </span>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="min-w-[7rem] flex-1 truncate text-base font-medium tracking-tight">
            {card.name}
          </p>
          <p className="shrink-0 text-sm font-semibold leading-tight tabular-nums text-primary">
            {loading ? "..." : valuesHidden ? "R$ ****" : formatBRL(billAmount)}
          </p>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {card.bankName}
          {card.lastFourDigits ? ` - ${card.lastFourDigits}` : ""}
        </p>
      </div>
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
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{label}</span>
          <span className="text-primary">{icon}</span>
        </div>
        <div
          className={`mt-1 truncate text-base font-semibold tabular-nums md:text-lg ${tone === "success" ? "text-[var(--success)]" : ""}`}
        >
          {loading ? "..." : value}
        </div>
      </CardContent>
    </Card>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function getUserName(
  user?: { name?: string | null; lastName?: string | null; email?: string | null } | null,
): string {
  const name = user?.name?.trim();
  const lastName = user?.lastName?.trim();
  const fullName = [name, lastName].filter(Boolean).join(" ");
  if (fullName) return fullName;
  if (!user?.email) return "Prospera";
  const email = user.email;
  const local = email.split("@")[0] || "Prospera";
  const parts = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.replace(/\d+$/g, ""))
    .filter(Boolean);

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getInitials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "PR";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function accountTypeLabel(type: Account["type"]): string {
  const labels: Record<Account["type"], string> = {
    CHECKING: "Conta corrente",
    SAVINGS: "Poupança",
    CASH: "Dinheiro",
    OTHER: "Conta manual",
  };
  return labels[type] ?? "Conta";
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

function statementDueMonth(statementMonth: Date, card: CreditCardModel): Date {
  const dueMonth = new Date(statementMonth);
  if (card.dueDay <= card.closingDay) {
    dueMonth.setMonth(dueMonth.getMonth() + 1);
  }
  return dueMonth;
}

function atConfiguredDay(year: number, zeroBasedMonth: number, day: number): Date {
  const lastDay = new Date(year, zeroBasedMonth + 1, 0).getDate();
  return new Date(year, zeroBasedMonth, Math.min(day, lastDay));
}

function buildStatementTotalsByCardId(
  cards: CreditCardModel[],
  statements: CardStatement[],
): Map<number, number> {
  const totals = new Map<number, number>();
  statements.forEach((statement) => {
    totals.set(statement.cardId, Number(statement.totalAmount ?? 0));
  });
  cards.forEach((card) => {
    if (!totals.has(card.id)) totals.set(card.id, 0);
  });
  return totals;
}
