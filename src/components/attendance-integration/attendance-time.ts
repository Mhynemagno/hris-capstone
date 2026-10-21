/** The attendance schedule timezone (fixed by attendance_integration_settings). */
export const ATTENDANCE_TIMEZONE = "Asia/Ulaanbaatar";

const formatter = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: ATTENDANCE_TIMEZONE });
const meridiemFormatter = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: true, timeZone: ATTENDANCE_TIMEZONE });

/** HH:MM in the attendance timezone, or an em dash when there is no time. */
export function formatAttendanceTime(value: string | null | undefined) {
  return value ? formatter.format(new Date(value)) : "—";
}

/** A precise 24-hour time with an explicit AM/PM cue for readers used to either convention. */
export function formatAttendanceTimeWithMeridiem(value: string | null | undefined) {
  if (!value) return "—";
  const period = meridiemFormatter.formatToParts(new Date(value)).find((part) => part.type === "dayPeriod")?.value;
  return `${formatAttendanceTime(value)}${period ? ` (${period})` : ""}`;
}

/** Worked elapsed time, never inferred for an open or invalid attendance record. */
export function workedDuration(timeIn: string | null | undefined, timeOut: string | null | undefined) {
  if (!timeIn || !timeOut) return "—";
  const elapsedMinutes = Math.floor((new Date(timeOut).getTime() - new Date(timeIn).getTime()) / 60_000);
  if (!Number.isFinite(elapsedMinutes) || elapsedMinutes < 0) return "—";
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}
