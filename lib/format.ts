export function formatCurrency(
  value: number | string | null | undefined
) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

export function formatNumber(
  value: number | string | null | undefined,
  decimals = 3
) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: decimals,
  }).format(Number(value ?? 0));
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export function formatPercentage(
  value: number | null | undefined
) {
  if (value == null) return "—";

  return `${Number(value).toFixed(2)}%`;
}

export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function currentMonthRange() {
  const today = todayISO();
  const [year, month] = today.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();

  return {
    start: `${year}-${String(month).padStart(2, "0")}-01`,
    end: `${year}-${String(month).padStart(2, "0")}-${lastDay}`,
  };
}