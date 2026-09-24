import { UnmatchedAttendanceQueue } from "@/components/attendance-integration/unmatched-attendance-queue";
import { PageHeader } from "@/components/ui/page-header";

export default function UnmatchedAttendancePage() { return <section className="space-y-4"><PageHeader description="Assign an imported external ID to an existing employee. Names are never used as a matching input." eyebrow="Attendance integration" title="Unmatched device IDs" /><UnmatchedAttendanceQueue /></section>; }
