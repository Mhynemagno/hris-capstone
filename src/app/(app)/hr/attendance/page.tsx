import { HrAttendanceDirectory } from "@/components/attendance-integration/hr-attendance-directory";

export default function HrAttendancePage() { return <section className="space-y-4"><div><p className="text-sm font-medium text-primary">Attendance integration</p><h1 className="text-3xl font-semibold">Attendance</h1><p className="mt-2 text-muted-foreground">Review normalized imported attendance records and resolve unknown device IDs.</p></div><HrAttendanceDirectory /></section>; }
