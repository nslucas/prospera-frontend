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
  Plus,
  Receipt,
  Wallet,
} from "lucide-react";
import { fetchAccounts, fetchAlerts, fetchCards, fetchCardStatement, fetchMonthlySummary, fetchTrends } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { currentMonthYear, formatBRL, monthLabel } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Account, Card as CreditCardModel } from "@/lib/types";


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
  const trends = useAsyncData(() => fetchTrends(fromMonth, fromYear, month, year), [fromMonth, fromYear, month, year], {
    cacheKey: `summary-trends:${fromMonth}:${fromYear}:${month}:${year}`,
  });

  const s = summary.data;
  const trendData =
    trends.data?.map((item) => ({
      label: `${String(item.month).padStart(2, "0")}/${String(item.year).slice(-2)}`,
      Receita: item.incomeTotal,
      Despesa: item.accountExpenseTotal + item.cardStatementExpenseTotal,
    })) ?? [];
  const overdueAlerts = alerts.data?.filter((alert) => alert.type === "CARD_BILL_OVERDUE") ?? [];
  const displayName = getDisplayName(user?.email);
  const openCardBillsTotal = openStatements.data?.length
    ? openStatements.data.reduce((total, statement) => total + Number(statement.totalAmount ?? 0), 0)
    : (s?.cardBillsTotal ?? 0);
  const cardBillsLoading = cards.isLoading || openStatements.isLoading;

  return (
    <div className="space-y-4 md:space-y-6">
      <section className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)] md:items-stretch">
        <header className="relative overflow-hidden border border-border/80 bg-white px-5 pb-6 pt-7 text-foreground shadow-[0_14px_36px_rgba(16,27,21,0.045)] md:rounded-lg md:p-6">
          <div className="absolute right-10 top-10 hidden h-36 w-36 rounded-full bg-primary/6 md:block" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">{getGreeting()},</p>
              <h1 className="mt-1 max-w-[13rem] break-words text-[2rem] font-bold leading-[1.05] tracking-tight md:max-w-none md:text-3xl">
                {displayName}
              </h1>
              <p className="mt-2 text-xs font-medium capitalize text-muted-foreground md:text-sm">
                {monthLabel(month, year)}
              </p>
            </div>
            <Link
              to="/accounts"
              aria-label="Gerenciar conexoes"
              className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-border bg-white text-primary shadow-[0_10px_24px_rgba(16,27,21,0.05)] transition-colors hover:bg-accent"
            >
              <Link2 className="h-6 w-6" />
            </Link>
          </div>
        </header>

        <Link
          to="/alerts"
          className="mx-4 flex items-center gap-3 rounded-lg bg-white p-4 shadow-[0_12px_30px_rgba(16,27,21,0.045)] ring-1 ring-border/70 transition-transform hover:-translate-y-0.5 md:mx-0 md:gap-4 md:p-5"
        >
          <span className="grid h-[3.25rem] w-[3.25rem] shrink-0 place-items-center rounded-full bg-muted text-foreground md:h-14 md:w-14">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold tracking-tight md:text-base">Lancamentos atrasados</span>
            <span className="mt-0.5 block text-base leading-snug text-muted-foreground md:text-sm">
              {alerts.isLoading
                ? "Verificando pendencias"
                : overdueAlerts.length
                  ? `Você tem ${overdueAlerts.length} lançamento${overdueAlerts.length > 1 ? "s" : ""} atrasado${
                      overdueAlerts.length > 1 ? "s" : ""
                    }`
                  : "Nenhum lançamento atrasado"}
            </span>
          </span>
          <ChevronRight className="h-7 w-7 shrink-0 text-primary" />
        </Link>
      </section>

      <div className="space-y-4 px-4 md:space-y-5 md:px-0">
        <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <BalancePanel
            loading={summary.isLoading}
            total={formatBRL(s?.totalAccountBalance)}
            accounts={accounts.data ?? []}
            valuesHidden={valuesHidden}
            onToggleValues={() => setValuesHidden((hidden) => !hidden)}
          />
          <CardsPanel
            loading={summary.isLoading || cardBillsLoading}
            total={formatBRL(openCardBillsTotal)}
            cards={cards.data ?? []}
            valuesHidden={valuesHidden}
            onToggleValues={() => setValuesHidden((hidden) => !hidden)}
          />
        </section>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
            label="Fluxo liquido"
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
          <CardContent className="p-4 md:p-6">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <div className="mb-2 grid h-9 w-9 place-items-center rounded-lg bg-white text-primary ring-1 ring-border">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-semibold tracking-tight">Receitas vs. Despesas</h2>
                <p className="text-xs text-muted-foreground">Últimos 6 meses</p>
              </div>
              <Link to="/reports" className="text-xs font-medium text-primary hover:underline">
                Ver relatorios
              </Link>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="home-inc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--success)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="home-exp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickFormatter={(value) => (Number(value) >= 1000 ? `${(Number(value) / 1000).toFixed(0)}k` : `${value}`)}
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
                  <Area type="monotone" dataKey="Receita" stroke="var(--success)" fill="url(#home-inc)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Despesa" stroke="var(--destructive)" fill="url(#home-exp)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Alertas do mês</h2>
            <Link to="/alerts" className="text-xs font-medium text-primary hover:underline">
              Ver todos
            </Link>
          </div>
          <div className="space-y-2">
            {alerts.data?.slice(0, 5).map((alert) => (
              <div key={alert.key} className="flex items-start gap-3 rounded-lg border border-border/80 bg-white p-3 shadow-sm">
                <AlertTriangle
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    alert.severity === "CRITICAL" ? "text-destructive" : "text-[var(--warning)]"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{alert.message}</p>
                  <Badge variant="secondary" className="mt-1 text-[10px]">
                    {alert.type.replaceAll("_", " ")}
                  </Badge>
                </div>
              </div>
            ))}
            {!alerts.data?.length && <p className="text-sm text-muted-foreground">Tudo certo por aqui.</p>}
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
      <CardContent className="p-5 md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg text-muted-foreground md:text-base">Saldo geral</p>
            <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums md:text-4xl">
              {loading ? "..." : valuesHidden ? "R$ ****" : total}
            </p>
          </div>
          <button
            type="button"
            aria-label={valuesHidden ? "Mostrar saldo" : "Ocultar saldo"}
            onClick={onToggleValues}
            className="grid h-11 w-11 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <EyeOff className="h-6 w-6" />
          </button>
        </div>

        <div className="my-5 h-px bg-border/70 md:my-7" />

        <div className="mb-4 flex items-center justify-between md:mb-5">
          <h2 className="text-xl font-bold tracking-tight md:text-xl">Minhas contas</h2>
          <Link to="/accounts" className="text-xs font-medium text-primary hover:underline">
            Ver todas
          </Link>
        </div>

        <div className="space-y-4">
          {accounts.slice(0, 3).map((account, index) => (
            <AccountRow key={account.id} account={account} index={index} valuesHidden={valuesHidden} />
          ))}
          {!accounts.length && <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada.</p>}
        </div>

        <Link
          to="/accounts"
          className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-lg border-2 border-primary text-base font-bold text-primary transition-colors hover:bg-accent md:mt-7 md:text-base"
        >
          Gerenciar contas
        </Link>
      </CardContent>
    </Card>
  );
}

function CardsPanel({
  loading,
  total,
  cards,
  valuesHidden,
  onToggleValues,
}: {
  loading?: boolean;
  total: string;
  cards: CreditCardModel[];
  valuesHidden: boolean;
  onToggleValues: () => void;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5 md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg text-muted-foreground md:text-base">Total das faturas</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-primary tabular-nums md:text-4xl">
              {loading ? "..." : valuesHidden ? "R$ ****" : total}
            </p>
          </div>
          <button
            type="button"
            aria-label={valuesHidden ? "Mostrar faturas" : "Ocultar faturas"}
            onClick={onToggleValues}
            className="grid h-11 w-11 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <EyeOff className="h-6 w-6" />
          </button>
        </div>

        <div className="my-5 h-px bg-border/70 md:my-7" />

        <div className="mb-4 flex items-center justify-between md:mb-5">
          <h2 className="text-xl font-bold tracking-tight md:text-xl">Meus cartoes</h2>
          <Link to="/cards" className="text-xs font-medium text-primary hover:underline">
            Ver todos
          </Link>
        </div>

        <div className="space-y-4 pr-16 md:pr-0">
          {cards.slice(0, 3).map((card) => (
            <CardRow key={card.id} card={card} />
          ))}
          {!cards.length && <p className="text-sm text-muted-foreground">Nenhum cartão cadastrado.</p>}
        </div>

        <Link
          to="/cards"
          aria-label="Adicionar cartão"
          className="absolute bottom-5 right-5 grid h-14 w-14 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-[0_18px_34px_rgba(220,38,38,0.25)] transition-transform hover:-translate-y-0.5 md:hidden"
        >
          <Plus className="h-8 w-8" />
        </Link>
      </CardContent>
    </Card>
  );
}

function AccountRow({ account, index, valuesHidden }: { account: Account; index: number; valuesHidden: boolean }) {
  const tones = ["bg-violet-600", "bg-blue-600", "bg-amber-500"];

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-4">
        <span
          className={`grid h-[3.25rem] w-[3.25rem] shrink-0 place-items-center rounded-full ${tones[index % tones.length]} text-base font-bold text-white shadow-sm md:h-12 md:w-12 md:text-sm`}
        >
          {getInitials(account.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold tracking-tight md:text-base">{account.name}</p>
          <p className="text-sm text-muted-foreground md:text-sm">{accountTypeLabel(account.type)}</p>
        </div>
      </div>
      <p className="shrink-0 text-lg font-medium tabular-nums text-blue-700 md:text-base">
        {valuesHidden ? "R$ ****" : formatBRL(account.balance, account.currency || "BRL")}
      </p>
    </div>
  );
}

function CardRow({ card }: { card: CreditCardModel }) {
  return (
    <div className="flex items-center gap-4">
      <span className="grid h-[3.25rem] w-[3.25rem] shrink-0 place-items-center rounded-lg bg-muted text-primary md:h-12 md:w-12">
        <Landmark className="h-7 w-7 md:h-6 md:w-6" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold tracking-tight md:text-base">{card.name}</p>
        <p className="text-sm text-muted-foreground md:text-sm">
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
    <Card className="transition-transform duration-200 hover:-translate-y-0.5">
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-primary ring-1 ring-border">{icon}</span>
        </div>
        <div className={`mt-2 truncate text-lg font-semibold tabular-nums md:text-xl ${tone === "success" ? "text-[var(--success)]" : ""}`}>
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

function getDisplayName(email?: string): string {
  if (!email) return "Prospera";
  const local = email.split("@")[0] || "Prospera";
  const parts = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.replace(/\d+$/g, ""))
    .filter(Boolean);

  if (parts.length >= 2 && /^lucasn$/i.test(parts[0]) && /^nunes$/i.test(parts[1])) {
    return "Lucas Nunes";
  }

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
    SAVINGS: "Poupanca",
    CASH: "Dinheiro",
    OTHER: "Conta manual",
  };
  return labels[type] ?? "Conta";
}

function currentOpenStatementPeriod(card: CreditCardModel): { month: number; year: number } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const statementMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const closingDate = atConfiguredDay(statementMonth.getFullYear(), statementMonth.getMonth(), card.closingDay);

  if (today > closingDate) {
    statementMonth.setMonth(statementMonth.getMonth() + 1);
  }

  const dueMonth = new Date(statementMonth);
  if (card.dueDay <= card.closingDay) {
    dueMonth.setMonth(dueMonth.getMonth() + 1);
  }

  return { month: dueMonth.getMonth() + 1, year: dueMonth.getFullYear() };
}

function atConfiguredDay(year: number, zeroBasedMonth: number, day: number): Date {
  const lastDay = new Date(year, zeroBasedMonth + 1, 0).getDate();
  return new Date(year, zeroBasedMonth, Math.min(day, lastDay));
}
