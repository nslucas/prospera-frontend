import { api } from "./api";
import type {
  Account,
  Alert,
  Budget,
  BudgetProgress,
  Card,
  CardMonthlySummary,
  CardPayment,
  CardStatement,
  CategorySummary,
  Category,
  Expense,
  FixedVariableSummary,
  ForecastPoint,
  MonthlySummary,
  Recurrence,
  RecurrenceOccurrence,
  Transaction,
  TrendPoint,
  UpcomingSummary,
  YearlySummary,
} from "./types";

type ApiEnvelope<T> = T | { data: T };

function unwrapData<T>(value: ApiEnvelope<T>): T {
  if (value && typeof value === "object" && "data" in value) return value.data;
  return value;
}

export const fetchAccounts = () => api<Account[]>("/accounts");

export const fetchCards = () => api<Card[]>("/cards");

export const fetchCategories = () => api<Category[]>("/categories");

export const fetchTransactions = (params: { month?: number; year?: number; accountId?: number; type?: string }) =>
  api<Transaction[]>("/transactions", { query: params });

export const fetchExpenses = (params: { month?: number; year?: number; cardId?: number }) =>
  api<Expense[]>("/expenses", { query: params });

export const fetchCardStatement = (cardId: number, month: number, year: number) =>
  api<CardStatement>(`/cards/${cardId}/statements`, { query: { month, year } });

export const fetchCurrentStatement = (cardId: number) =>
  api<CardStatement>(`/cards/${cardId}/statements/current`);

export const fetchCardPayments = (cardId: number, month: number, year: number) =>
  api<CardPayment[]>(`/cards/${cardId}/payments`, { query: { month, year } });

export const fetchBudgets = (month: number, year: number) =>
  api<Budget[]>("/budgets", { query: { month, year } });

export const fetchBudgetProgress = (month: number, year: number) =>
  api<BudgetProgress[]>("/budgets/progress", { query: { month, year } });

export const fetchRecurrences = () => api<Recurrence[]>("/recurrences");

export const fetchOccurrences = (from: string, to: string) =>
  api<RecurrenceOccurrence[]>("/recurrences/occurrences", { query: { from, to } });

export const fetchAlerts = (params: { month?: number; year?: number; from?: string; to?: string } = {}) =>
  api<Alert[]>("/alerts", { query: params });

export const fetchMonthlySummary = (month: number, year: number) =>
  api<ApiEnvelope<MonthlySummary>>("/summary/monthly", { query: { month, year } }).then(unwrapData);

export const fetchCategorySummary = (month: number, year: number) =>
  api<ApiEnvelope<CategorySummary[]>>("/summary/categories", { query: { month, year } }).then(unwrapData);

export const fetchTrends = (fromMonth: number, fromYear: number, toMonth: number, toYear: number) =>
  api<ApiEnvelope<TrendPoint[]>>("/summary/trends", { query: { fromMonth, fromYear, toMonth, toYear } }).then(unwrapData);

export const fetchForecast = (months: number) =>
  api<ApiEnvelope<{ months: number; forecast: ForecastPoint[] }>>("/summary/forecast", { query: { months } }).then(unwrapData);

export const fetchUpcoming = (from: string, to: string) =>
  api<ApiEnvelope<UpcomingSummary>>("/summary/upcoming", { query: { from, to } }).then(unwrapData);

export const fetchYearlySummary = (year: number) =>
  api<ApiEnvelope<YearlySummary>>("/summary/yearly", { query: { year } }).then(unwrapData);

export const fetchCardSummary = (month: number, year: number) =>
  api<ApiEnvelope<CardMonthlySummary[]>>("/summary/cards", { query: { month, year } }).then(unwrapData);

export const fetchFixedVariableSummary = (month: number, year: number) =>
  api<ApiEnvelope<FixedVariableSummary>>("/summary/fixed-variable", { query: { month, year } }).then(unwrapData);
