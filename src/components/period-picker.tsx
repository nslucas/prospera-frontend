import { useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import { monthLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Period = {
  month: number;
  year: number;
};

type PeriodPickerProps = Period & {
  onChange: (period: Period) => void;
  className?: string;
};

export function PeriodPicker({ month, year, onChange, className }: PeriodPickerProps) {
  const [open, setOpen] = useState(false);
  const [visibleYear, setVisibleYear] = useState(year);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setVisibleYear(year);
    setOpen(nextOpen);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-12 min-w-[9.5rem] rounded-2xl border-border/80 bg-background px-5 text-base font-semibold shadow-none md:min-w-[10.5rem]",
            className,
          )}
        >
          <span>{periodLabel(month, year)}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-[19rem] rounded-2xl p-3">
        <div className="mb-3 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl"
            aria-label="Ano anterior"
            onClick={() => setVisibleYear((current) => current - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-base font-semibold tabular-nums">{visibleYear}</div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl"
            aria-label="Proximo ano"
            onClick={() => setVisibleYear((current) => current + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: 12 }, (_, index) => {
            const optionMonth = index + 1;
            const selected = optionMonth === month && visibleYear === year;
            return (
              <button
                key={optionMonth}
                type="button"
                onClick={() => {
                  onChange({ month: optionMonth, year: visibleYear });
                  setOpen(false);
                }}
                className={cn(
                  "flex h-10 items-center justify-center gap-1 rounded-xl px-2 text-sm font-medium transition-colors",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {monthName(optionMonth, visibleYear)}
                {selected && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function monthName(month: number, year: number) {
  const label = monthLabel(month, year).replace(/\s+de\s+\d{4}$/i, "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function periodLabel(month: number, year: number) {
  return `${monthName(month, year)} de ${year}`;
}
