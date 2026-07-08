import type { CardStatementStatus } from "@/lib/types";

const STATEMENT_STATUS_LABELS: Record<CardStatementStatus, string> = {
  OPEN: "Em aberto",
  PARTIALLY_PAID: "Parcialmente paga",
  PAID: "Paga",
  OVERPAID: "Paga a maior",
};

export function cardStatementStatusLabel(status: CardStatementStatus): string {
  return STATEMENT_STATUS_LABELS[status] ?? status;
}
