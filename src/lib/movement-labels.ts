import type { TransactionType } from "@/lib/types";

const AUTOMATIC_DESCRIPTION_LABELS: Record<string, string> = {
  "opening account balance": "Saldo inicial da conta",
  "initial balance migrated from wallet": "Saldo inicial migrado da carteira",
  "card payment": "Pagamento de fatura",
  "credit card payment": "Pagamento de fatura",
  "invoice payment": "Pagamento de fatura",
};

const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  INCOME: "Receita",
  EXPENSE: "Despesa",
  TRANSFER_IN: "Transferência recebida",
  TRANSFER_OUT: "Transferência enviada",
  CARD_PAYMENT: "Pagamento de fatura",
  ADJUSTMENT: "Ajuste",
};

export function movementDescriptionLabel(description?: string | null): string | null {
  const normalized = normalizeAutomaticDescription(description);
  if (!normalized) return null;
  return AUTOMATIC_DESCRIPTION_LABELS[normalized] ?? description?.trim() ?? null;
}

export function transactionTypeLabel(type: TransactionType): string {
  return TRANSACTION_TYPE_LABELS[type] ?? type;
}

export function transactionTitle(transaction: { type: TransactionType; description?: string | null }): string {
  return movementDescriptionLabel(transaction.description) ?? transactionTypeLabel(transaction.type);
}

export function cardPaymentTitle(description?: string | null): string {
  return movementDescriptionLabel(description) ?? "Pagamento de fatura";
}

function normalizeAutomaticDescription(description?: string | null) {
  return description?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
}
