import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";
import type {
  Account,
  Alert,
  Budget,
  BudgetProgress,
  Card,
  CardStatement,
  Category,
  Expense,
  ForecastPoint,
  MonthlySummary,
  Recurrence,
  RecurrenceOccurrence,
  Transaction,
  TrendPoint,
} from "./types";

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
    queryFn: () => api<MonthlySummary>("/summary/monthly", { query: { month, year } }),
  });

export const trendsQuery = (fromMonth: number, fromYear: number, toMonth: number, toYear: number) =>
  queryOptions({
    queryKey: ["summary-trends", fromMonth, fromYear, toMonth, toYear],
    queryFn: () =>
      api<TrendPoint[]>("/summary/trends", { query: { fromMonth, fromYear, toMonth, toYear } }),
  });

export const forecastQuery = (months: number) =>
  queryOptions({
    queryKey: ["summary-forecast", months],
    queryFn: () => api<{ months: number; forecast: ForecastPoint[] }>("/summary/forecast", { query: { months } }),
  });

export const upcomingQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: ["summary-upcoming", from, to],
    queryFn: () => api<unknown>("/summary/upcoming", { query: { from, to } }),
  });
