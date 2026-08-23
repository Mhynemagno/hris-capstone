import { UnmatchedAttendanceQueue } from "@/components/attendance-integration/unmatched-attendance-queue";

export default function UnmatchedAttendancePage() { return <section className="space-y-4"><div><p className="text-sm font-medium text-primary">Attendance integration</p><h1 className="text-3xl font-semibold">Unmatched device IDs</h1><p className="mt-2 text-muted-foreground">Assign an imported external ID to an existing employee. Names are never used as a matching input.</p></div><UnmatchedAttendanceQueue /></section>; }
