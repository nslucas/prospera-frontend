import type {
  RecurringClassification,
  RecurringFrequency,
  RecurringOccurrenceStatus,
  RecurringTargetType,
  TransactionType,
} from "@/lib/types";

const CLASSIFICATION_LABELS: Record<RecurringClassification, string> = {
  FIXED: "Fixa",
  VARIABLE: "Variavel",
};

const OCCURRENCE_STATUS_LABELS: Record<RecurringOccurrenceStatus, string> = {
  PENDING: "Pendente",
  MATERIALIZED: "Lancada",
  SKIPPED: "Pulada",
};

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  MONTHLY: "Mensal",
  ANNUAL: "Anual",
};

const TARGET_LABELS: Record<RecurringTargetType, string> = {
  ACCOUNT_TRANSACTION: "Conta",
  CARD_EXPENSE: "Cartão",
};

const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  INCOME: "Receita",
  EXPENSE: "Despesa",
  ADJUSTMENT: "Ajuste",
};

export function recurrenceClassificationLabel(value: RecurringClassification) {
  return CLASSIFICATION_LABELS[value] ?? value;
}

export function recurrenceStatusLabel(value: RecurringOccurrenceStatus) {
  return OCCURRENCE_STATUS_LABELS[value] ?? value;
}

export function recurrenceFrequencyLabel(value: RecurringFrequency) {
  return FREQUENCY_LABELS[value] ?? value;
}

export function recurrenceTargetLabel(value: RecurringTargetType) {
  return TARGET_LABELS[value] ?? value;
}

export function recurrenceTransactionTypeLabel(value?: TransactionType | null) {
  return value ? TRANSACTION_TYPE_LABELS[value] ?? value : null;
}
