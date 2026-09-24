/** The attendance schedule timezone (fixed by attendance_integration_settings). */
export const ATTENDANCE_TIMEZONE = "Asia/Ulaanbaatar";

const formatter = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: ATTENDANCE_TIMEZONE });

/** HH:MM in the attendance timezone, or an em dash when there is no time. */
export function formatAttendanceTime(value: string | null | undefined) {
  return value ? formatter.format(new Date(value)) : "—";
}
