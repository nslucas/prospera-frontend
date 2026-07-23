import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { NotificationSync } from "@/components/notification-sync";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/lib/auth";
import { registerPwaServiceWorker } from "@/lib/pwa";
import { ThemeProvider } from "@/lib/theme";

const AppShell = lazy(() =>
  import("@/components/app-shell").then((module) => ({ default: module.AppShell })),
);
const LoginPage = lazy(() => import("@/routes/auth.login"));
const RegisterPage = lazy(() => import("@/routes/auth.register"));
const LandingPage = lazy(() => import("@/routes/landing"));
const AccountsPage = lazy(() => import("@/routes/_app.accounts"));
const AlertsPage = lazy(() => import("@/routes/_app.alerts"));
const BudgetsPage = lazy(() => import("@/routes/_app.budgets"));
const CardsPage = lazy(() => import("@/routes/_app.cards"));
const CategoriesPage = lazy(() => import("@/routes/_app.categories"));
const ConnectionsPage = lazy(() => import("@/routes/_app.connections"));
const HomePage = lazy(() => import("@/routes/_app.home"));
const NotificationsPage = lazy(() => import("@/routes/_app.notifications"));
const RecurrencesPage = lazy(() => import("@/routes/_app.recurrences"));
const ReportsPage = lazy(() => import("@/routes/_app.reports"));
const SettlementsPage = lazy(() => import("@/routes/_app.settlements"));
const SettingsPage = lazy(() => import("@/routes/_app.settings"));
const TransactionsPage = lazy(() => import("@/routes/_app.transactions"));

export function App() {
  useEffect(() => {
    registerPwaServiceWorker();
  }, []);

  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <NotificationSync />
          <Suspense fallback={<FullPageSpinner />}>
            <AppRoutes />
          </Suspense>
          <Toaster richColors position="top-center" />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/auth/register" element={<RegisterPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/home" element={<HomePage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/cards" element={<CardsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/budgets" element={<BudgetsPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/connections" element={<ConnectionsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/settlements" element={<SettlementsPage />} />
        <Route path="/recurrences" element={<RecurrencesPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/auth/login" replace state={{ from: location }} />;

  return children;
}

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço que você acessou não existe.
        </p>
        <div className="mt-6">
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir para o início
          </a>
        </div>
      </div>
    </div>
  );
}
