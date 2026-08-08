const INVALID_DATE_LABEL = "—";

function validDate(timestamp: number): Date | null {
  if (!Number.isFinite(timestamp)) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLocalTime(timestamp: number): string {
  const date = validDate(timestamp);
  if (date === null) return INVALID_DATE_LABEL;
  return new Intl.DateTimeFormat(undefined, {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export function currentLocalYear(timestamp: number = Date.now()): string {
  const date = validDate(timestamp);
  return date === null ? INVALID_DATE_LABEL : String(date.getFullYear());
}
