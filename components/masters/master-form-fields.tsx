"use client";

import { useId, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/language-context";

type FieldProps = {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: string;
  placeholder?: string;
  disabled?: boolean;
};

export function MasterField({
  label,
  value,
  onChange,
  type = "text",
  required,
  min,
  max,
  step,
  placeholder,
  disabled,
}: FieldProps) {
  const { t } = useLanguage();
  const id = useId();

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {t(label)}
        {required && (
          <span className="ml-1 text-red-500">*</span>
        )}
      </Label>

      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
}

export function MasterSelect({
  label,
  value,
  onChange,
  children,
  required,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  required?: boolean;
  disabled?: boolean;
}) {
  const { t } = useLanguage();
  const id = useId();

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {t(label)}
        {required && (
          <span className="ml-1 text-red-500">*</span>
        )}
      </Label>

      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"
      >
        {children}
      </select>
    </div>
  );
}

export function ActiveField({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const { t } = useLanguage();

  return (
    <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-indigo-600"
      />

      {t("Active record")}
    </label>
  );
}