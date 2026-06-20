export function formatBRL(value: number | string | undefined | null, currency = "BRL"): string {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(n);
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = parseIsoDate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function monthLabel(m: number, y: number): string {
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function todayIsoDate(): string {
  return toLocalIsoDate(new Date());
}

export function nowIsoDateTime(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  return `${toLocalIsoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function addDaysIso(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + days);
  return toLocalIsoDate(d);
}

export function currentMonthYear(): { month: number; year: number } {
  const d = new Date();
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

function parseIsoDate(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return new Date(iso);
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function toLocalIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
