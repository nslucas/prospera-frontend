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
  LogOut,
  Menu,
  X,
  MoreHorizontal,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { BrandLogo, BrandMark } from "@/components/brand-logo";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  bottom?: boolean;
}

const NAV: NavItem[] = [
  { to: "/home", label: "Inicio", icon: LayoutDashboard, bottom: true },
  { to: "/transactions", label: "Mov.", icon: ArrowLeftRight, bottom: true },
  { to: "/cards", label: "Cartoes", icon: CreditCard, bottom: true },
  { to: "/reports", label: "Relatorios", icon: BarChart3, bottom: true },
  { to: "/accounts", label: "Contas", icon: Wallet },
  { to: "/budgets", label: "Orcamentos", icon: PiggyBank },
  { to: "/categories", label: "Categorias", icon: Tag },
  { to: "/recurrences", label: "Recorrencias", icon: RotateCw },
  { to: "/alerts", label: "Alertas", icon: Bell },
];

export function AppShell() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileMenu, setMobileMenu] = React.useState(false);

  React.useEffect(() => {
    if (!loading && !user) navigate("/auth/login");
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

  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
  const bottomItems = NAV.filter((item) => item.bottom);
  const moreItems = NAV.filter((item) => !item.bottom);

  return (
    <div className="soft-grid min-h-screen text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-sidebar-border bg-white p-4 shadow-[18px_0_45px_rgba(16,27,21,0.025)] md:flex">
        <Link to="/transactions" className="mb-8 flex items-center gap-3 rounded-lg px-2 py-2">
          <BrandMark />
          <div>
            <div className="font-display text-lg font-bold leading-none tracking-tight">Prospera</div>
            <div className="text-xs text-muted-foreground">Financas pessoais</div>
          </div>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all",
                isActive(item.to)
                  ? "bg-accent text-sidebar-accent-foreground font-medium shadow-sm shadow-[rgba(16,27,21,0.035)] ring-1 ring-sidebar-border/80"
                  : "text-muted-foreground hover:bg-white/70 hover:text-foreground",
              )}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 transition-colors",
                  isActive(item.to) ? "text-primary" : "text-muted-foreground group-hover:text-primary",
                )}
              />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 rounded-lg border border-sidebar-border bg-white/72 p-3 shadow-sm">
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

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/70 bg-white/88 px-4 py-3 backdrop-blur md:hidden">
        <Link to="/transactions" className="flex items-center gap-2">
          <BrandLogo markSize="sm" textClassName="text-lg" />
        </Link>
        <button
          aria-label="Abrir menu"
          onClick={() => setMobileMenu((open) => !open)}
          className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-white shadow-sm"
        >
          {mobileMenu ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </header>

      {mobileMenu && (
        <div className="fixed inset-0 z-30 md:hidden" onClick={() => setMobileMenu(false)}>
          <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" />
          <div
            className="absolute right-0 top-0 h-full w-72 bg-white p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
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
                      ? "bg-accent text-sidebar-accent-foreground font-medium shadow-sm"
                      : "text-muted-foreground hover:bg-white/70",
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

      <main className="pb-24 md:ml-72 md:pb-8">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">
          <Outlet />
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-1.5 shadow-[0_-12px_30px_rgba(16,27,21,0.05)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {bottomItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[11px] font-medium leading-none transition-all",
                isActive(item.to)
                  ? "bg-accent text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <item.icon className={cn("h-[1.35rem] w-[1.35rem]", isActive(item.to) && "stroke-[2.4]")} />
              <span className="max-w-full whitespace-nowrap">{item.label}</span>
            </Link>
          ))}
          <button
            type="button"
            aria-label="Abrir mais opcoes"
            onClick={() => setMobileMenu(true)}
            className={cn(
              "flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[11px] font-medium leading-none transition-all",
              moreItems.some((item) => isActive(item.to))
                ? "bg-accent text-primary shadow-sm"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>Mais</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
