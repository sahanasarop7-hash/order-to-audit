"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { currentMonthRange } from "@/lib/format";

export type DateRange = {
  start: string;
  end: string;
};

export function DateRangeFilter({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (value: DateRange) => void;
}) {
  const invalid =
    !value.start ||
    !value.end ||
    value.start > value.end;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="range-start">From</Label>

          <Input
            id="range-start"
            type="date"
            value={value.start}
            onChange={(event) =>
              onChange({
                ...value,
                start: event.target.value,
              })
            }
            className="h-10"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="range-end">To</Label>

          <Input
            id="range-end"
            type="date"
            value={value.end}
            onChange={(event) =>
              onChange({
                ...value,
                end: event.target.value,
              })
            }
            className="h-10"
          />
        </div>

        <Button
          variant="outline"
          onClick={() => onChange(currentMonthRange())}
          className="h-10"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          This month
        </Button>
      </div>

      {invalid && (
        <p role="alert" className="text-xs text-red-600">
          Please select a valid date range.
        </p>
      )}
    </div>
  );
}