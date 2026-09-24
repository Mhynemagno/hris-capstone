import { HrAttendanceDirectory } from "@/components/attendance-integration/hr-attendance-directory";
import { PageHeader } from "@/components/ui/page-header";

export default function HrAttendancePage() { return <section className="space-y-4"><PageHeader description="Review imported attendance records and resolve unknown device IDs." eyebrow="Attendance integration" title="Attendance" /><HrAttendanceDirectory /></section>; }
