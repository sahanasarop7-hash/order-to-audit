"use client";

import { CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/language-context";
import { currentMonthRange } from "@/lib/format";

export type DateRange = {
  start: string;
  end: string;
};

type DateRangeFilterProps = {
  value: DateRange;
  onChange: (value: DateRange) => void;
};

export function DateRangeFilter({
  value,
  onChange,
}: DateRangeFilterProps) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex items-center gap-2 self-center text-slate-500">
        <CalendarDays className="h-5 w-5" />
      </div>

      <div className="flex-1 space-y-2 sm:flex-none">
        <Label htmlFor="date-from">{t("From")}</Label>

        <Input
          id="date-from"
          type="date"
          value={value.start}
          max={value.end || undefined}
          onChange={(e) =>
            onChange({
              ...value,
              start: e.target.value,
            })
          }
          className="w-full sm:w-44"
        />
      </div>

      <div className="flex-1 space-y-2 sm:flex-none">
        <Label htmlFor="date-to">{t("To")}</Label>

        <Input
          id="date-to"
          type="date"
          value={value.end}
          min={value.start || undefined}
          onChange={(e) =>
            onChange({
              ...value,
              end: e.target.value,
            })
          }
          className="w-full sm:w-44"
        />
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => onChange(currentMonthRange())}
      >
        {t("This month")}
      </Button>
    </div>
  );
}
