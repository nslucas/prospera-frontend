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
    const parsed = parseCurrencyAmount(nextText);
    const digits = nextText.replace(/\D/g, "");

    if (!digits) {
      setText(nextText.trim().startsWith("-") ? "-" : "");
      onChange(0);
      return;
    }

    setText(formatCurrencyForEditing(parsed));
    onChange(parsed);
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
    .replace(/[^\d-]/g, "")
    .replace(/(?!^)-/g, "")
    .slice(0, 18);
}

function parseCurrencyAmount(value: string) {
  const sanitized = sanitizeCurrencyText(value);
  const negative = sanitized.startsWith("-");
  const digits = sanitized.replace(/\D/g, "");
  if (!digits) return 0;

  const parsed = Number(digits) / 100;
  if (!Number.isFinite(parsed)) return 0;

  const rounded = Math.round(parsed * 100) / 100;
  return negative ? -rounded : rounded;
}

function formatCurrencyForEditing(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
