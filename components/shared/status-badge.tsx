const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  approved: "bg-blue-50 text-blue-700 border-blue-200",
  invoiced: "bg-indigo-50 text-indigo-700 border-indigo-200",
  dispatched: "bg-emerald-50 text-emerald-700 border-emerald-200",
  posted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  issued: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  partial: "bg-amber-50 text-amber-700 border-amber-200",
  partially_paid: "bg-amber-50 text-amber-700 border-amber-200",
  unpaid: "bg-red-50 text-red-700 border-red-200",
  overdue: "bg-red-50 text-red-700 border-red-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  reversed: "bg-orange-50 text-orange-700 border-orange-200",
  recorded: "bg-emerald-50 text-emerald-700 border-emerald-200",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-slate-100 text-slate-600 border-slate-200",
  alert: "bg-red-50 text-red-700 border-red-200",
  within_tolerance: "bg-emerald-50 text-emerald-700 border-emerald-200",
  unplanned_consumption: "bg-red-50 text-red-700 border-red-200",
  low_stock: "bg-amber-50 text-amber-700 border-amber-200",
  out_of_stock: "bg-red-50 text-red-700 border-red-200",
};

export function StatusBadge({
  status,
  label,
}: {
  status: string | null | undefined;
  label?: string;
}) {
  const key = status?.toLowerCase() ?? "unknown";

  const style =
    STATUS_STYLES[key] ??
    "bg-slate-100 text-slate-600 border-slate-200";

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${style}`}
    >
      {label ?? key.replaceAll("_", " ")}
    </span>
  );
}