export type PeriodPreset = "7d" | "30d" | "month" | "custom";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The calendar day in the Philippines (the station's time zone), as YYYY-MM-DD. */
function isoDay(date: Date) {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

function daysBefore(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() - days);
  return copy;
}

/** The dashboard period from `?period=&from=&to=`. Matches the RPC's own 30-day default. */
export function resolvePeriod(params: { period: string; from: string; to: string }, today = new Date()) {
  const endsOn = isoDay(today);
  if (params.period === "7d") return { preset: "7d" as const, startsOn: isoDay(daysBefore(today, 6)), endsOn };
  if (params.period === "month") return { preset: "month" as const, startsOn: `${endsOn.slice(0, 7)}-01`, endsOn };
  if (params.period === "custom" && ISO_DAY.test(params.from) && ISO_DAY.test(params.to) && params.from <= params.to) {
    return { preset: "custom" as const, startsOn: params.from, endsOn: params.to };
  }
  return { preset: "30d" as const, startsOn: isoDay(daysBefore(today, 29)), endsOn };
}
