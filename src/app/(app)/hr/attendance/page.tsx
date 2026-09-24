import { HrAttendanceDirectory } from "@/components/attendance-integration/hr-attendance-directory";
import { PageHeader } from "@/components/ui/page-header";

export default function HrAttendancePage() { return <section className="space-y-4"><PageHeader description="Review imported and face-scanned attendance records, resolve unknown device IDs, and run the face attendance kiosk." eyebrow="Attendance integration" title="Attendance" /><HrAttendanceDirectory /></section>; }
