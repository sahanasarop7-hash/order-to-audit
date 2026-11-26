export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 3,
  }).format(value);
}

export function formatPercentage(value: number | null) {
  if (value === null) return "—";

  return `${Number(value.toFixed(2))}%`;
}

export function getToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function getMonthStart() {
  return `${getToday().slice(0, 7)}-01`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}