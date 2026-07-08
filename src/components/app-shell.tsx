import * as React from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  CreditCard,
  ArrowLeftRight,
  PiggyBank,
  Bell,
  BarChart3,
  Tag,
  RotateCw,
  HandCoins,
  LogOut,
  Menu,
  X,
  MoreHorizontal,
  Settings,
  UsersRound,
  Plus,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { BrandLogo, BrandMark } from "@/components/brand-logo";
import { MovementEntryDialog } from "@/components/movement-entry-dialog";
import { ThemeSelector } from "@/components/theme-selector";
import { useAsyncData } from "@/hooks/use-async-data";
import { fetchPendingConnectionRequests } from "@/lib/queries";
import { fetchUnreadNotificationCount } from "@/lib/notifications";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  bottom?: boolean;
  activePaths?: string[];
}

const NAV: NavItem[] = [
  { to: "/home", label: "Início", icon: LayoutDashboard, bottom: true },
  { to: "/transactions", label: "Movimentações", icon: ArrowLeftRight, bottom: true },
  { to: "/cards", label: "Cartões", icon: CreditCard, bottom: true },
  { to: "/reports", label: "Relatórios", icon: BarChart3, bottom: true },
  { to: "/accounts", label: "Contas", icon: Wallet },
  { to: "/budgets", label: "Orçamentos", icon: PiggyBank },
  { to: "/categories", label: "Categorias", icon: Tag },
  { to: "/connections", label: "Conexões", icon: UsersRound },
  { to: "/settlements", label: "Acertos", icon: HandCoins },
  { to: "/recurrences", label: "Recorrências", icon: RotateCw },
  { to: "/alerts", label: "Alertas", icon: Bell },
  { to: "/settings", label: "Config.", icon: Settings, activePaths: ["/notifications"] },
];

export function AppShell() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileMenu, setMobileMenu] = React.useState(false);
  const [movementEntryOpen, setMovementEntryOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar-collapsed") === "true";
    }
    return false;
  });
  const pendingRequests = useAsyncData(() => fetchPendingConnectionRequests(), [], {
    enabled: !loading && !!user,
    initialData: [],
    cacheKey: "connection-requests-pending",
  });
  const pendingConnectionCount = pendingRequests.data?.length ?? 0;
  const unreadNotifications = useAsyncData(() => fetchUnreadNotificationCount(), [], {
    enabled: !loading && !!user,
    initialData: { count: 0 },
    cacheKey: "notifications:unread-count",
  });
  const unreadNotificationCount = unreadNotifications.data?.count ?? 0;
  const reloadPendingRequests = pendingRequests.reload;
  const reloadUnreadNotifications = unreadNotifications.reload;

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  React.useEffect(() => {
    if (!loading && !user) navigate("/auth/login");
  }, [loading, user, navigate]);

  React.useEffect(() => {
    setMobileMenu(false);
  }, [pathname]);

  React.useEffect(() => {
    const handleConnectionsUpdated = () => {
      reloadPendingRequests();
    };
    window.addEventListener("prospera:connections-updated", handleConnectionsUpdated);
    return () =>
      window.removeEventListener("prospera:connections-updated", handleConnectionsUpdated);
  }, [reloadPendingRequests]);

  React.useEffect(() => {
    const handleNotificationsUpdated = () => {
      reloadUnreadNotifications();
    };
    window.addEventListener("prospera:notifications-updated", handleNotificationsUpdated);
    return () =>
      window.removeEventListener("prospera:notifications-updated", handleNotificationsUpdated);
  }, [reloadUnreadNotifications]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const isActivePath = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
  const isNavItemActive = (item: NavItem) =>
    isActivePath(item.to) || (item.activePaths?.some((path) => isActivePath(path)) ?? false);
  const bottomItems = NAV.filter((item) => item.bottom);
  const moreItems = NAV.filter((item) => !item.bottom);
  const getBadgeCount = (item: NavItem) => {
    if (item.to === "/connections") return pendingConnectionCount;
    if (item.to === "/settings") return unreadNotificationCount;
    return 0;
  };

  return (
    <div className="soft-grid min-h-screen text-foreground">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar p-3 md:flex transition-all duration-300 ease-in-out",
          isCollapsed ? "w-16 px-2" : "w-64",
        )}
      >
        <div
          className={cn(
            "mb-5 flex items-center justify-between transition-all duration-300 gap-2",
            isCollapsed ? "flex-col justify-center px-0 gap-4" : "flex-row px-1.5",
          )}
        >
          {isCollapsed ? (
            <>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-300"
                  title="Expandir menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <ThemeSelector className="border-transparent shadow-none" />
              </div>
              <BrandMark />
            </>
          ) : (
            <>
              <Link to="/transactions" className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1">
                <BrandMark />
                <div className="min-w-0">
                  <div className="truncate font-display text-lg font-bold leading-none tracking-tight">
                    Prospera
                  </div>
                  <div className="truncate text-xs text-muted-foreground">Finanças pessoais</div>
                </div>
              </Link>
              <div className="flex shrink-0 items-center gap-1.5">
                <ThemeSelector />
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-300"
                  title="Recolher menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </div>
            </>
          )}
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = isNavItemActive(item);
            const badgeCount = getBadgeCount(item);

            return (
              <Link
                key={item.to}
                to={item.to}
                title={isCollapsed ? item.label : undefined}
                className={cn(
                  "group relative flex items-center rounded-lg py-2 text-sm transition-all duration-200 ease-in-out",
                  isCollapsed ? "px-2 justify-center" : "px-3 gap-3",
                  active
                    ? "bg-accent text-sidebar-accent-foreground font-medium ring-1 ring-sidebar-border/70"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4 transition-colors shrink-0",
                    active ? "text-primary" : "text-muted-foreground group-hover:text-primary",
                  )}
                />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
                {badgeCount > 0 && (
                  <span
                    className={cn(
                      "ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground",
                      isCollapsed && "absolute right-1 top-1 h-2 min-w-2 p-0 text-[0px]",
                    )}
                  >
                    {badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {isCollapsed ? (
          <div className="mt-4 flex flex-col items-center py-2 border-t border-sidebar-border/40">
            <button
              onClick={logout}
              title={`Sair (${user.email})`}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors duration-300"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-sidebar-border bg-card/60 p-2.5 transition-all duration-300">
            <div className="truncate text-xs text-muted-foreground">{user.email}</div>
            <button
              onClick={logout}
              className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" /> Sair
            </button>
          </div>
        )}
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between bg-gradient-to-b from-background via-background/95 to-background/70 px-4 pb-4 pt-3 backdrop-blur md:hidden">
        <Link to="/transactions" className="flex items-center gap-2">
          <BrandLogo markSize="sm" textClassName="text-lg" />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeSelector />
          <button
            aria-label="Abrir menu"
            onClick={() => setMobileMenu((open) => !open)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card shadow-sm"
          >
            {mobileMenu ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {mobileMenu && (
        <div className="fixed inset-0 z-30 md:hidden" onClick={() => setMobileMenu(false)}>
          <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" />
          <div
            className="absolute right-0 top-0 h-full w-64 bg-card p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 truncate text-xs text-muted-foreground">{user.email}</div>
            <nav className="flex flex-col gap-1">
              {moreItems.map((item) => {
                const badgeCount = getBadgeCount(item);

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
                      isNavItemActive(item)
                        ? "bg-accent text-sidebar-accent-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted/70",
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                    {badgeCount > 0 && (
                      <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                        {badgeCount}
                      </span>
                    )}
                  </Link>
                );
              })}
              <button
                onClick={logout}
                className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" /> Sair
              </button>
            </nav>
          </div>
        </div>
      )}

      <MovementEntryDialog open={movementEntryOpen} onOpenChange={setMovementEntryOpen} />

      <main
        className={cn(
          "pb-32 md:pb-8 transition-all duration-300 ease-in-out",
          isCollapsed ? "md:ml-16" : "md:ml-64",
        )}
      >
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">
          <Outlet />
        </div>
      </main>

      {!mobileMenu && !movementEntryOpen && (
        <>
          <button
            type="button"
            aria-label="Nova movimentação"
            title="Nova movimentação"
            onClick={() => setMovementEntryOpen(true)}
            className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.35rem)] right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95 md:hidden"
          >
            <Plus className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={() => setMovementEntryOpen(true)}
            className="fixed bottom-6 right-6 z-30 hidden h-12 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-95 md:inline-flex"
          >
            <Plus className="h-4 w-4" />
            Nova movimentação
          </button>
        </>
      )}

      <nav className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.55rem)] z-20 px-4 md:hidden">
        <div className="mx-auto grid max-w-sm grid-cols-5 gap-1 rounded-2xl border border-border/80 bg-card/92 p-1.5 shadow-[0_8px_24px_rgba(16,27,21,0.14)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/86">
          {bottomItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              aria-label={item.label}
              title={item.label}
              className={cn(
                "flex min-h-12 items-center justify-center rounded-xl px-1 text-[11px] font-medium leading-none transition-all",
                isNavItemActive(item)
                  ? "bg-accent text-primary ring-1 ring-primary/15"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
              )}
            >
              <item.icon className={cn("h-5 w-5", isNavItemActive(item) && "stroke-[2.4]")} />
            </Link>
          ))}
          <button
            type="button"
            aria-label="Abrir mais opções"
            title="Mais"
            onClick={() => setMobileMenu(true)}
            className={cn(
              "relative flex min-h-12 items-center justify-center rounded-xl px-1 text-[11px] font-medium leading-none transition-all",
              moreItems.some((item) => isNavItemActive(item))
                ? "bg-accent text-primary ring-1 ring-primary/15"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            {moreItems.some((item) => getBadgeCount(item) > 0) && (
              <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-primary" />
            )}
          </button>
        </div>
      </nav>
    </div>
  );
}
