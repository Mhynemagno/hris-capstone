const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MANILA = "Asia/Manila";

/**
 * Shows a date in words, e.g. "September 23, 2026".
 * A plain `YYYY-MM-DD` value is treated as a calendar day so it never shifts by
 * the viewer's time zone; a full timestamp is shown as its Philippine date.
 */
export function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const day = DATE_ONLY.exec(value);
  if (day) {
    const date = new Date(Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3])));
    return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: MANILA });
}

/** Shows a timestamp in words with its Philippine time, e.g. "September 23, 2026, 2:05 PM". */
export function formatDateTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: MANILA });
}

/** Shows a date range in words, e.g. "September 28, 2026 to October 9, 2026". */
export function formatDateRange(start: string | null | undefined, end: string | null | undefined, openEnd = "present") {
  return `${formatDate(start) ?? ""} to ${formatDate(end) ?? openEnd}`;
}
