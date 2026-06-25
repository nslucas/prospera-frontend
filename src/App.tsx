import { useEffect, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/lib/auth";
import { registerPwaServiceWorker } from "@/lib/pwa";
import { ThemeProvider } from "@/lib/theme";
import LoginPage from "@/routes/auth.login";
import RegisterPage from "@/routes/auth.register";
import AccountsPage from "@/routes/_app.accounts";
import AlertsPage from "@/routes/_app.alerts";
import BudgetsPage from "@/routes/_app.budgets";
import CardsPage from "@/routes/_app.cards";
import CategoriesPage from "@/routes/_app.categories";
import ConnectionsPage from "@/routes/_app.connections";
import HomePage from "@/routes/_app.home";
import RecurrencesPage from "@/routes/_app.recurrences";
import ReportsPage from "@/routes/_app.reports";
import SettlementsPage from "@/routes/_app.settlements";
import SettingsPage from "@/routes/_app.settings";
import TransactionsPage from "@/routes/_app.transactions";

export function App() {
  useEffect(() => {
    registerPwaServiceWorker();
  }, []);

  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster richColors position="top-center" />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
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
        <Route path="/settlements" element={<SettlementsPage />} />
        <Route path="/recurrences" element={<RecurrencesPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  return <Navigate to={user ? "/transactions" : "/auth/login"} replace />;
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
