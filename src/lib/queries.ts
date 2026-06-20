import { queryOptions } from "@tanstack/react-query";
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

export const accountsQuery = () =>
  queryOptions({ queryKey: ["accounts"], queryFn: () => api<Account[]>("/accounts") });

export const cardsQuery = () =>
  queryOptions({ queryKey: ["cards"], queryFn: () => api<Card[]>("/cards") });

export const categoriesQuery = () =>
  queryOptions({ queryKey: ["categories"], queryFn: () => api<Category[]>("/categories") });

export const transactionsQuery = (params: { month?: number; year?: number; accountId?: number; type?: string }) =>
  queryOptions({
    queryKey: ["transactions", params],
    queryFn: () => api<Transaction[]>("/transactions", { query: params }),
  });

export const expensesQuery = (params: { month?: number; year?: number; cardId?: number }) =>
  queryOptions({
    queryKey: ["expenses", params],
    queryFn: () => api<Expense[]>("/expenses", { query: params }),
  });

export const cardStatementQuery = (cardId: number, month: number, year: number) =>
  queryOptions({
    queryKey: ["card-statement", cardId, month, year],
    queryFn: () => api<CardStatement>(`/cards/${cardId}/statements`, { query: { month, year } }),
  });

export const currentStatementQuery = (cardId: number) =>
  queryOptions({
    queryKey: ["card-statement-current", cardId],
    queryFn: () => api<CardStatement>(`/cards/${cardId}/statements/current`),
  });

export const cardPaymentsQuery = (cardId: number, month: number, year: number) =>
  queryOptions({
    queryKey: ["card-payments", cardId, month, year],
    queryFn: () => api<CardPayment[]>(`/cards/${cardId}/payments`, { query: { month, year } }),
  });

export const budgetsQuery = (month: number, year: number) =>
  queryOptions({
    queryKey: ["budgets", month, year],
    queryFn: () => api<Budget[]>("/budgets", { query: { month, year } }),
  });

export const budgetProgressQuery = (month: number, year: number) =>
  queryOptions({
    queryKey: ["budget-progress", month, year],
    queryFn: () => api<BudgetProgress[]>("/budgets/progress", { query: { month, year } }),
  });

export const recurrencesQuery = () =>
  queryOptions({ queryKey: ["recurrences"], queryFn: () => api<Recurrence[]>("/recurrences") });

export const occurrencesQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: ["recurrence-occurrences", from, to],
    queryFn: () => api<RecurrenceOccurrence[]>("/recurrences/occurrences", { query: { from, to } }),
  });

export const alertsQuery = (params: { month?: number; year?: number; from?: string; to?: string } = {}) =>
  queryOptions({ queryKey: ["alerts", params], queryFn: () => api<Alert[]>("/alerts", { query: params }) });

export const monthlySummaryQuery = (month: number, year: number) =>
  queryOptions({
    queryKey: ["summary-monthly", month, year],
    queryFn: () => api<ApiEnvelope<MonthlySummary>>("/summary/monthly", { query: { month, year } }).then(unwrapData),
  });

export const categorySummaryQuery = (month: number, year: number) =>
  queryOptions({
    queryKey: ["summary-categories", month, year],
    queryFn: () => api<ApiEnvelope<CategorySummary[]>>("/summary/categories", { query: { month, year } }).then(unwrapData),
  });

export const trendsQuery = (fromMonth: number, fromYear: number, toMonth: number, toYear: number) =>
  queryOptions({
    queryKey: ["summary-trends", fromMonth, fromYear, toMonth, toYear],
    queryFn: () =>
      api<ApiEnvelope<TrendPoint[]>>("/summary/trends", { query: { fromMonth, fromYear, toMonth, toYear } }).then(unwrapData),
  });

export const forecastQuery = (months: number) =>
  queryOptions({
    queryKey: ["summary-forecast", months],
    queryFn: () =>
      api<ApiEnvelope<{ months: number; forecast: ForecastPoint[] }>>("/summary/forecast", { query: { months } }).then(unwrapData),
  });

export const upcomingQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: ["summary-upcoming", from, to],
    queryFn: () => api<ApiEnvelope<UpcomingSummary>>("/summary/upcoming", { query: { from, to } }).then(unwrapData),
  });

export const yearlySummaryQuery = (year: number) =>
  queryOptions({
    queryKey: ["summary-yearly", year],
    queryFn: () => api<ApiEnvelope<YearlySummary>>("/summary/yearly", { query: { year } }).then(unwrapData),
  });

export const cardSummaryQuery = (month: number, year: number) =>
  queryOptions({
    queryKey: ["summary-cards", month, year],
    queryFn: () => api<ApiEnvelope<CardMonthlySummary[]>>("/summary/cards", { query: { month, year } }).then(unwrapData),
  });

export const fixedVariableSummaryQuery = (month: number, year: number) =>
  queryOptions({
    queryKey: ["summary-fixed-variable", month, year],
    queryFn: () => api<ApiEnvelope<FixedVariableSummary>>("/summary/fixed-variable", { query: { month, year } }).then(unwrapData),
  });
