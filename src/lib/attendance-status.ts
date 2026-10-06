/** How an attendance status reads on screen. The stored value stays `incomplete`; the client calls it "Partial". */
const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  incomplete: "Partial",
};

export function attendanceStatusLabel(status: string) {
  return ATTENDANCE_STATUS_LABELS[status] ?? status.replaceAll("_", " ").replace(/^./, (value) => value.toUpperCase());
}
