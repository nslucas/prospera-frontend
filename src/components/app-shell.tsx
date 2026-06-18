import * as React from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
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
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  bottom?: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Início", icon: LayoutDashboard, bottom: true },
  { to: "/transactions", label: "Transações", icon: ArrowLeftRight, bottom: true },
  { to: "/cards", label: "Cartões", icon: CreditCard, bottom: true },
  { to: "/budgets", label: "Orçamentos", icon: PiggyBank, bottom: true },
  { to: "/accounts", label: "Contas", icon: Wallet },
  { to: "/categories", label: "Categorias", icon: Tag },
  { to: "/recurrences", label: "Recorrências", icon: RotateCw },
  { to: "/alerts", label: "Alertas", icon: Bell },
  { to: "/reports", label: "Relatórios", icon: BarChart3 },
];

export function AppShell() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileMenu, setMobileMenu] = React.useState(false);

  React.useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth/login" });
  }, [loading, user, navigate]);

  React.useEffect(() => {
    setMobileMenu(false);
  }, [pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));
  const bottomItems = NAV.filter((n) => n.bottom);
  const moreItems = NAV.filter((n) => !n.bottom);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-sidebar p-4 md:flex">
        <Link to="/" className="mb-8 flex items-center gap-2 px-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-display text-lg">
            F
          </div>
          <div>
            <div className="font-display text-xl leading-none">Finanx</div>
            <div className="text-xs text-muted-foreground">Finanças pessoais</div>
          </div>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive(item.to)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 rounded-xl border border-border p-3">
          <div className="truncate text-xs text-muted-foreground">Conectado como</div>
          <div className="truncate text-sm font-medium">{user.email}</div>
          <button
            onClick={logout}
            className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:hidden">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground font-display">
            F
          </div>
          <span className="font-display text-lg">Finanx</span>
        </Link>
        <button
          aria-label="Abrir menu"
          onClick={() => setMobileMenu((s) => !s)}
          className="grid h-9 w-9 place-items-center rounded-lg border border-border"
        >
          {mobileMenu ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </header>

      {/* Mobile sheet */}
      {mobileMenu && (
        <div className="fixed inset-0 z-30 md:hidden" onClick={() => setMobileMenu(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute right-0 top-0 h-full w-72 bg-sidebar p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 truncate text-xs text-muted-foreground">{user.email}</div>
            <nav className="flex flex-col gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                    isActive(item.to)
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-sidebar-accent/60",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
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

      {/* Main */}
      <main className="md:ml-64 pb-24 md:pb-8">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
          <Outlet />
        </div>
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {bottomItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] transition-colors",
                isActive(item.to) ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
          <Link
            to="/alerts"
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-2.5 text-[10px]",
              isActive("/alerts") || moreItems.some((m) => isActive(m.to))
                ? "text-primary"
                : "text-muted-foreground",
            )}
          >
            <Bell className="h-5 w-5" />
            Mais
          </Link>
        </div>
      </nav>
    </div>
  );
}
