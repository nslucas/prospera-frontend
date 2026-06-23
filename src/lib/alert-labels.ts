import type { Alert, AlertSeverity, AlertType } from "@/lib/types";

const TYPE_LABELS: Record<AlertType, string> = {
  CARD_LIMIT_NEAR: "Limite do cartão",
  BUDGET_NEAR_LIMIT: "Orçamento perto do limite",
  BUDGET_EXCEEDED: "Orçamento estourado",
  CARD_BILL_DUE_SOON: "Fatura a vencer",
  CARD_BILL_OVERDUE: "Fatura atrasada",
  LOW_ACCOUNT_BALANCE: "Saldo baixo",
};

const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  WARNING: "Atenção",
  CRITICAL: "Crítico",
};

export function alertTypeLabel(type: AlertType): string {
  return TYPE_LABELS[type] ?? type;
}

export function alertSeverityLabel(severity: AlertSeverity): string {
  return SEVERITY_LABELS[severity] ?? severity;
}

export function alertMessage(alert: Alert): string {
  switch (alert.type) {
    case "CARD_LIMIT_NEAR":
      return `O cartão ${extractCardName(alert.message)} atingiu ${formatPercent(alert.percentageUsed)} do limite.`;
    case "BUDGET_NEAR_LIMIT":
      return `O orçamento de ${extractBudgetName(alert.message)} atingiu ${formatPercent(alert.percentageUsed)} do limite.`;
    case "BUDGET_EXCEEDED":
      return `O orçamento de ${extractBudgetName(alert.message)} passou do limite (${formatPercent(alert.percentageUsed)} usado).`;
    case "CARD_BILL_DUE_SOON":
      return `A fatura do cartão ${extractCardName(alert.message)} vence em breve.`;
    case "CARD_BILL_OVERDUE":
      return `A fatura do cartão ${extractCardName(alert.message)} está atrasada.`;
    case "LOW_ACCOUNT_BALANCE":
      return `A conta ${extractAccountName(alert.message)} está com saldo baixo.`;
    default:
      return alert.message;
  }
}

function extractBudgetName(message: string): string {
  return matchName(message, /^Budget for (.+) is at [\d.,]+%\.$/) ?? "esta categoria";
}

function extractCardName(message: string): string {
  return (
    matchName(message, /^Card (.+) reached [\d.,]+% of its limit\.$/) ??
    matchName(message, /^Card (.+) has an overdue bill\.$/) ??
    matchName(message, /^Card (.+) bill is due soon\.$/) ??
    "este cartão"
  );
}

function extractAccountName(message: string): string {
  return matchName(message, /^Account (.+) has a low balance\.$/) ?? "esta conta";
}

function matchName(message: string, pattern: RegExp): string | null {
  return message.match(pattern)?.[1]?.trim() || null;
}

function formatPercent(value?: number | null): string {
  if (value == null) return "80%";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value)}%`;
}
