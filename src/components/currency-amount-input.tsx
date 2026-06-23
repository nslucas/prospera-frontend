import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/format";

interface CurrencyAmountInputProps {
  value: number | null | undefined;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function CurrencyAmountInput({ value, onChange, disabled }: CurrencyAmountInputProps) {
  const numericValue = Number(value ?? 0);
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(formatBRL(numericValue));

  useEffect(() => {
    if (!focused) setText(formatBRL(numericValue));
  }, [focused, numericValue]);

  const updateAmount = (nextText: string) => {
    const sanitized = sanitizeCurrencyText(nextText);
    setText(sanitized);
    onChange(parseCurrencyAmount(sanitized));
  };

  return (
    <Input
      type="text"
      inputMode="decimal"
      className="tabular-nums"
      value={text}
      placeholder="0,00"
      disabled={disabled}
      onFocus={(event) => {
        const input = event.currentTarget;
        setFocused(true);
        setText(numericValue ? formatCurrencyForEditing(numericValue) : "");
        requestAnimationFrame(() => input.select());
      }}
      onBlur={(event) => {
        const parsed = parseCurrencyAmount(event.currentTarget.value);
        setFocused(false);
        onChange(parsed);
        setText(formatBRL(parsed));
      }}
      onChange={(event) => updateAmount(event.target.value)}
    />
  );
}

function sanitizeCurrencyText(value: string) {
  return value
    .replace(/[^\d,.-]/g, "")
    .replace(/(?!^)-/g, "")
    .slice(0, 18);
}

function parseCurrencyAmount(value: string) {
  const sanitized = sanitizeCurrencyText(value);
  const negative = sanitized.startsWith("-");
  const unsigned = negative ? sanitized.slice(1) : sanitized;
  if (!unsigned) return 0;

  const lastComma = unsigned.lastIndexOf(",");
  const lastDot = unsigned.lastIndexOf(".");
  const decimalSeparator = getDecimalSeparator(unsigned, lastComma, lastDot);
  const normalized =
    decimalSeparator >= 0
      ? `${unsigned.slice(0, decimalSeparator).replace(/\D/g, "") || "0"}.${unsigned.slice(decimalSeparator + 1).replace(/\D/g, "").slice(0, 2)}`
      : unsigned.replace(/\D/g, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;

  const rounded = Math.round(parsed * 100) / 100;
  return negative ? -rounded : rounded;
}

function getDecimalSeparator(value: string, lastComma: number, lastDot: number) {
  if (lastComma >= 0) return lastComma;
  if (lastDot < 0) return -1;

  const digitsAfterDot = value.length - lastDot - 1;
  const dots = value.match(/\./g)?.length ?? 0;
  if (dots === 1 && digitsAfterDot > 0 && digitsAfterDot <= 2) return lastDot;
  return -1;
}

function formatCurrencyForEditing(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
