// Domain types matching the Finanx REST API handoff.
export type AccountType = "CHECKING" | "SAVINGS" | "CASH" | "OTHER";
export type TransactionType =
  | "INCOME"
  | "EXPENSE"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "CARD_PAYMENT"
  | "ADJUSTMENT";
export type CategoryType = "INCOME" | "EXPENSE";
export type BudgetStatus = "UNDER_BUDGET" | "NEAR_LIMIT" | "OVER_BUDGET";
export type CardStatementStatus = "OPEN" | "PARTIALLY_PAID" | "PAID" | "OVERPAID";
export type RecurringTargetType = "ACCOUNT_TRANSACTION" | "CARD_EXPENSE";
export type RecurringFrequency = "MONTHLY" | "ANNUAL";
export type RecurringClassification = "FIXED" | "VARIABLE";
export type RecurringOccurrenceStatus = "PENDING" | "MATERIALIZED" | "SKIPPED";
export type AlertType =
  | "CARD_LIMIT_NEAR"
  | "BUDGET_NEAR_LIMIT"
  | "BUDGET_EXCEEDED"
  | "CARD_BILL_DUE_SOON"
  | "CARD_BILL_OVERDUE"
  | "LOW_ACCOUNT_BALANCE";
export type AlertSeverity = "WARNING" | "CRITICAL";

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  active: boolean;
}

export interface Transaction {
  id: number;
  type: TransactionType;
  amount: number;
  occurredAt: string;
  description?: string | null;
  accountId: number;
  relatedTransactionId?: number | null;
  categoryId?: number | null;
}

export interface Card {
  id: number;
  bankName: string;
  name: string;
  network?: string | null;
  lastFourDigits?: string | null;
  creditLimit: number;
  closingDay: number;
  dueDay: number;
  active: boolean;
}

export interface CardStatement {
  cardId: number;
  cardName: string;
  month: number;
  year: number;
  dueDate: string;
  closingDate: string;
  totalAmount: number;
  availableLimit: number;
  paidAmount: number;
  remainingAmount: number;
  status: CardStatementStatus;
  installments: Array<{
    expenseId: number;
    expenseName: string;
    installmentNumber: number;
    totalInstallments: number;
    amount: number;
  }>;
}

export interface Expense {
  id: number;
  name: string;
  amount: number;
  installmentCount: number;
  purchaseDate: string;
  description?: string | null;
  cardId?: number | null;
  categoryId?: number | null;
}

export interface Category {
  id: number;
  name: string;
  type: CategoryType;
  active: boolean;
}

export interface Budget {
  id: number;
  categoryId: number;
  month: number;
  year: number;
  amount: number;
  active: boolean;
}

export interface BudgetProgress {
  budgetId: number;
  categoryId: number;
  categoryName: string;
  month: number;
  year: number;
  budgetAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentUsed: number;
  status: BudgetStatus;
}

export interface Recurrence {
  id: number;
  name: string;
  description?: string | null;
  targetType: RecurringTargetType;
  transactionType?: TransactionType | null;
  amount: number;
  frequency: RecurringFrequency;
  startDate: string;
  endDate?: string | null;
  dayOfMonth: number;
  monthOfYear?: number | null;
  accountId?: number | null;
  cardId?: number | null;
  categoryId?: number | null;
  installmentCount?: number | null;
  classification: RecurringClassification;
  active: boolean;
}

export interface RecurrenceOccurrence {
  id: number;
  recurrenceId: number;
  recurrenceName: string;
  occurrenceDate: string;
  amount: number;
  targetType: RecurringTargetType;
  transactionType?: TransactionType | null;
  accountId?: number | null;
  cardId?: number | null;
  categoryId?: number | null;
  classification: RecurringClassification;
  status: RecurringOccurrenceStatus;
  transactionId?: number | null;
  expenseId?: number | null;
}

export interface Alert {
  key: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  resourceType: string;
  resourceId: number;
  amount?: number | null;
  threshold?: number | null;
  percentageUsed?: number | null;
  dueDate?: string | null;
  month?: number | null;
  year?: number | null;
}

export interface MonthlySummary {
  month: number;
  year: number;
  incomeTotal: number;
  accountExpenseTotal: number;
  cardPaymentsTotal: number;
  netCashFlow: number;
  totalAccountBalance: number;
  cardBillsTotal: number;
  cardBillsRemaining: number;
  categoryBreakdown: Array<{ categoryId: number; categoryName: string; total: number }>;
  budgetProgress: BudgetProgress[];
}

export interface TrendPoint {
  month: number;
  year: number;
  incomeTotal: number;
  accountExpenseTotal: number;
  cardStatementExpenseTotal: number;
  netTotal: number;
}

export interface ForecastPoint {
  month: number;
  year: number;
  incomeTotal: number;
  accountExpenseTotal: number;
  cardStatementExpenseTotal: number;
  cardPaymentsTotal: number;
  recurringIncomeTotal: number;
  recurringAccountExpenseTotal: number;
  recurringCardExpenseTotal: number;
  projectedNetCashFlow: number;
  projectedAccountBalance: number;
}

export interface AuthResponse {
  token: string;
  id: number;
  email: string;
}
