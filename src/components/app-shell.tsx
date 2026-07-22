import * as React from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  ChevronRight,
  CreditCard,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  PiggyBank,
  Plus,
  RotateCw,
  Settings,
  Tags,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { MovementEntryDialog } from "@/components/movement-entry-dialog";
import { ThemeSelector } from "@/components/theme-selector";
import { useAsyncData } from "@/hooks/use-async-data";
import { useAuth } from "@/lib/auth";
import { fetchUnreadNotificationCount } from "@/lib/notifications";
import { fetchPendingConnectionRequests } from "@/lib/queries";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  activePaths?: string[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Seu dinheiro",
    items: [
      { to: "/home", label: "Visão geral", icon: LayoutDashboard },
      { to: "/transactions", label: "Movimentações", icon: ArrowLeftRight },
      { to: "/accounts", label: "Contas", icon: Wallet },
      { to: "/cards", label: "Cartões", icon: CreditCard },
    ],
  },
  {
    label: "Planejamento",
    items: [
      { to: "/budgets", label: "Orçamentos", icon: PiggyBank },
      { to: "/reports", label: "Relatórios", icon: BarChart3 },
      { to: "/recurrences", label: "Recorrências", icon: RotateCw },
    ],
  },
  {
    label: "Compartilhar",
    items: [
      { to: "/connections", label: "Conexões", icon: UsersRound },
      { to: "/settlements", label: "Acertos", icon: HandCoins },
    ],
  },
];

const UTILITY_NAV: NavItem[] = [
  { to: "/categories", label: "Categorias", icon: Tags },
  { to: "/alerts", label: "Alertas", icon: Bell },
  { to: "/settings", label: "Configurações", icon: Settings, activePaths: ["/notifications"] },
];

const PAGE_META: Record<string, { eyebrow: string; title: string }> = {
  "/home": { eyebrow: "Visão geral", title: "Meu panorama" },
  "/transactions": { eyebrow: "Seu dinheiro", title: "Movimentações" },
  "/accounts": { eyebrow: "Seu dinheiro", title: "Contas" },
  "/cards": { eyebrow: "Seu dinheiro", title: "Cartões" },
  "/budgets": { eyebrow: "Planejamento", title: "Orçamentos" },
  "/reports": { eyebrow: "Planejamento", title: "Relatórios" },
  "/recurrences": { eyebrow: "Planejamento", title: "Recorrências" },
  "/connections": { eyebrow: "Compartilhar", title: "Conexões" },
  "/settlements": { eyebrow: "Compartilhar", title: "Acertos" },
  "/categories": { eyebrow: "Organização", title: "Categorias" },
  "/alerts": { eyebrow: "Organização", title: "Alertas" },
  "/notifications": { eyebrow: "Conta", title: "Notificações" },
  "/settings": { eyebrow: "Conta", title: "Configurações" },
};

export function AppShell() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileMenu, setMobileMenu] = React.useState(false);
  const [movementEntryOpen, setMovementEntryOpen] = React.useState(false);
  const pendingRequests = useAsyncData(() => fetchPendingConnectionRequests(), [], {
    enabled: !loading && !!user,
    initialData: [],
    cacheKey: "connection-requests-pending",
  });
  const unreadNotifications = useAsyncData(() => fetchUnreadNotificationCount(), [], {
    enabled: !loading && !!user,
    initialData: { count: 0 },
    cacheKey: "notifications:unread-count",
  });
  const reloadPendingRequests = pendingRequests.reload;
  const reloadUnreadNotifications = unreadNotifications.reload;

  React.useEffect(() => {
    if (!loading && !user) navigate("/auth/login");
  }, [loading, user, navigate]);

  React.useEffect(() => setMobileMenu(false), [pathname]);

  React.useEffect(() => {
    const refreshConnections = () => reloadPendingRequests();
    const refreshNotifications = () => reloadUnreadNotifications();
    window.addEventListener("prospera:connections-updated", refreshConnections);
    window.addEventListener("prospera:notifications-updated", refreshNotifications);
    return () => {
      window.removeEventListener("prospera:connections-updated", refreshConnections);
      window.removeEventListener("prospera:notifications-updated", refreshNotifications);
    };
  }, [reloadPendingRequests, reloadUnreadNotifications]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const isActive = (item: NavItem) =>
    pathname === item.to ||
    pathname.startsWith(`${item.to}/`) ||
    (item.activePaths?.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ??
      false);
  const pageMeta =
    Object.entries(PAGE_META).find(
      ([path]) => pathname === path || pathname.startsWith(`${path}/`),
    )?.[1] ?? PAGE_META["/home"];
  const pendingConnectionCount = pendingRequests.data?.length ?? 0;
  const notificationCount = unreadNotifications.data?.count ?? 0;

  const badgeFor = (item: NavItem) => (item.to === "/connections" ? pendingConnectionCount : 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[17rem] flex-col overflow-hidden bg-[#0b2e24] text-white lg:flex">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#c9ff5b]/10 blur-3xl" />
        <div className="relative flex h-24 items-center px-6">
          <Link
            to="/home"
            className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9ff5b]"
          >
            <BrandLogo
              markSize="sm"
              textClassName="text-xl !text-white"
              className="[&>span:first-child]:shadow-none"
            />
          </Link>
        </div>

        <div className="relative px-4">
          <button
            type="button"
            onClick={() => setMovementEntryOpen(true)}
            className="group flex h-12 w-full items-center justify-between rounded-2xl bg-[#c9ff5b] px-4 text-sm font-bold text-[#0b2e24] shadow-[0_16px_34px_rgba(0,0,0,0.2)] transition hover:-translate-y-0.5 hover:bg-[#d7ff81]"
          >
            <span className="flex items-center gap-2.5">
              <Plus className="h-4 w-4" /> Nova movimentação
            </span>
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        <nav className="relative mt-6 flex-1 overflow-y-auto px-4 pb-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    item={item}
                    active={isActive(item)}
                    badge={badgeFor(item)}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="my-4 h-px bg-white/8" />
          <div className="space-y-1">
            {UTILITY_NAV.map((item) => (
              <NavLink key={item.to} item={item} active={isActive(item)} badge={badgeFor(item)} />
            ))}
          </div>
        </nav>

        <div className="relative m-4 rounded-2xl border border-white/10 bg-white/[0.06] p-3.5">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#c9ff5b] text-xs font-extrabold text-[#0b2e24]">
              {getInitials(user.name, user.email)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.name || "Minha conta"}</p>
              <p className="truncate text-[11px] text-white/45">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              aria-label="Sair"
              title="Sair"
              className="grid h-8 w-8 place-items-center rounded-lg text-white/45 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[17rem]">
        <header className="sticky top-0 z-30 border-b border-border/70 bg-background/88 backdrop-blur-xl">
          <div className="flex h-[4.5rem] items-center justify-between px-4 sm:px-6 lg:px-9">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenu(true)}
                aria-label="Abrir menu"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground shadow-sm lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <Link to="/home" className="lg:hidden">
                <BrandLogo markSize="sm" textClassName="text-base" />
              </Link>
              <div className="hidden min-w-0 sm:block">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  {pageMeta.eyebrow}
                </p>
                <p className="truncate text-base font-semibold tracking-tight">{pageMeta.title}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="mr-2 hidden text-xs font-medium text-muted-foreground xl:inline">
                {formatHeaderDate()}
              </span>
              <ThemeSelector className="h-10 w-10 rounded-xl bg-card" />
              <Link
                to="/notifications"
                aria-label="Notificações"
                className="relative grid h-10 w-10 place-items-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm transition hover:-translate-y-0.5 hover:text-foreground"
              >
                <Bell className="h-4 w-4" />
                {notificationCount > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#ef6a57] px-1 text-[9px] font-bold text-white ring-2 ring-background">
                    {notificationCount > 9 ? "9+" : notificationCount}
                  </span>
                )}
              </Link>
              <button
                type="button"
                onClick={() => setMovementEntryOpen(true)}
                className="ml-1 hidden h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-[0_10px_24px_rgba(16,91,68,0.18)] transition hover:-translate-y-0.5 sm:inline-flex lg:hidden"
              >
                <Plus className="h-4 w-4" /> Adicionar
              </button>
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-4.5rem)] pb-28 lg:pb-10">
          <div className="mx-auto max-w-[94rem] px-4 py-5 sm:px-6 sm:py-8 lg:px-9">
            <Outlet />
          </div>
        </main>
      </div>

      {mobileMenu && (
        <MobileMenu
          user={user}
          activePath={pathname}
          pendingConnections={pendingConnectionCount}
          onClose={() => setMobileMenu(false)}
          onAdd={() => {
            setMobileMenu(false);
            setMovementEntryOpen(true);
          }}
          onLogout={logout}
        />
      )}

      <MovementEntryDialog open={movementEntryOpen} onOpenChange={setMovementEntryOpen} />

      {!mobileMenu && !movementEntryOpen && (
        <MobileBottomNav
          pathname={pathname}
          badgeCount={pendingConnectionCount + notificationCount}
          onAdd={() => setMovementEntryOpen(true)}
          onMore={() => setMobileMenu(true)}
        />
      )}
    </div>
  );
}

function NavLink({ item, active, badge = 0 }: { item: NavItem; active: boolean; badge?: number }) {
  return (
    <Link
      to={item.to}
      className={cn(
        "group flex min-h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition",
        active
          ? "bg-white/[0.11] text-white"
          : "text-white/85 hover:bg-white/[0.06] hover:text-white",
      )}
    >
      <item.icon
        className={cn(
          "h-4 w-4",
          active ? "text-[#c9ff5b]" : "text-white/65 group-hover:text-white/90",
        )}
      />
      <span className="flex-1">{item.label}</span>
      {badge > 0 && (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#c9ff5b] px-1 text-[9px] font-extrabold text-[#0b2e24]">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
      {active && !badge && <span className="h-1.5 w-1.5 rounded-full bg-[#c9ff5b]" />}
    </Link>
  );
}

function MobileMenu({
  user,
  activePath,
  pendingConnections,
  onClose,
  onAdd,
  onLogout,
}: {
  user: { name?: string | null; email?: string | null };
  activePath: string;
  pendingConnections: number;
  onClose: () => void;
  onAdd: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        className="absolute inset-0 bg-[#061a14]/55 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Fechar menu"
      />
      <aside className="absolute inset-y-0 left-0 flex w-[min(88vw,21rem)] flex-col overflow-y-auto bg-[#0b2e24] p-4 text-white shadow-2xl">
        <div className="mb-5 flex items-center justify-between px-1 py-2">
          <BrandLogo markSize="sm" textClassName="!text-white text-xl" />
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl bg-white/10"
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={onAdd}
          className="mb-6 flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#c9ff5b] text-sm font-bold text-[#0b2e24]"
        >
          <Plus className="h-4 w-4" /> Nova movimentação
        </button>
        <nav className="flex-1">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    item={item}
                    active={activePath === item.to || activePath.startsWith(`${item.to}/`)}
                    badge={item.to === "/connections" ? pendingConnections : 0}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="my-4 h-px bg-white/10" />
          {UTILITY_NAV.map((item) => (
            <NavLink key={item.to} item={item} active={activePath === item.to} />
          ))}
        </nav>
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#c9ff5b] text-xs font-bold text-[#0b2e24]">
            {getInitials(user.name, user.email)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.name || "Minha conta"}</p>
            <p className="truncate text-[11px] text-white/45">{user.email}</p>
          </div>
          <button
            onClick={onLogout}
            className="grid h-9 w-9 place-items-center rounded-xl text-white/50 hover:bg-white/10 hover:text-white"
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>
    </div>
  );
}

function MobileBottomNav({
  pathname,
  badgeCount,
  onAdd,
  onMore,
}: {
  pathname: string;
  badgeCount: number;
  onAdd: () => void;
  onMore: () => void;
}) {
  const isPathActive = (path: string) => pathname === path || pathname.startsWith(`${path}/`);
  const moreActive = !["/home", "/transactions", "/cards"].some(isPathActive);

  return (
    <nav
      aria-label="Navegação principal móvel"
      className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+0.65rem)] md:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 items-end rounded-[1.4rem] border border-border/90 bg-card/94 p-1.5 shadow-[0_18px_48px_rgba(11,46,36,0.2)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/88">
        <MobileBottomLink
          to="/home"
          label="Início"
          icon={LayoutDashboard}
          active={isPathActive("/home")}
        />
        <MobileBottomLink
          to="/transactions"
          label="Movimentos"
          icon={ArrowLeftRight}
          active={isPathActive("/transactions")}
        />

        <button
          type="button"
          aria-label="Nova movimentação"
          onClick={onAdd}
          className="flex min-h-14 items-center justify-center"
        >
          <span className="grid h-12 w-12 -translate-y-1 place-items-center rounded-2xl bg-[#c9ff5b] text-[#0b2e24] shadow-[0_12px_28px_rgba(11,46,36,0.28)] transition active:scale-95">
            <Plus className="h-5 w-5 stroke-[2.6]" />
          </span>
        </button>

        <MobileBottomLink
          to="/cards"
          label="Cartões"
          icon={CreditCard}
          active={isPathActive("/cards")}
        />
        <button
          type="button"
          aria-label="Abrir mais opções"
          onClick={onMore}
          className={cn(
            "relative flex min-h-14 items-center justify-center rounded-[1.05rem] px-1 transition",
            moreActive
              ? "bg-[#0b2e24] text-[#c9ff5b] dark:bg-[#c9ff5b] dark:text-[#0b2e24]"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <span className="relative">
            <MoreHorizontal className="h-5 w-5" />
            {badgeCount > 0 && (
              <span className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-[#ef6a57] ring-2 ring-card" />
            )}
          </span>
        </button>
      </div>
    </nav>
  );
}

function MobileBottomLink({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-14 items-center justify-center rounded-[1.05rem] px-1 transition",
        active
          ? "bg-[#0b2e24] text-[#c9ff5b] dark:bg-[#c9ff5b] dark:text-[#0b2e24]"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className={cn("h-5 w-5", active && "stroke-[2.4]")} />
    </Link>
  );
}

function getInitials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.split("@")[0] || "Prospera";
  return source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatHeaderDate() {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());
}
