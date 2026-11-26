import type { LucideIcon } from "lucide-react";

type KPICardProps = {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  tone?: "indigo" | "green" | "amber" | "blue" | "red";
};

const tones = {
  indigo: "bg-indigo-50 text-indigo-600",
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  blue: "bg-blue-50 text-blue-600",
  red: "bg-red-50 text-red-600",
};

export function KPICard({
  title,
  value,
  icon: Icon,
  description,
  tone = "indigo",
}: KPICardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">
          {title}
        </p>

        <div className={`rounded-lg p-2.5 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
        {value}
      </h2>

      {description && (
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          {description}
        </p>
      )}
    </div>
  );
}