import { Suspense } from "react";

import { StaffAttendance } from "@/components/attendance-integration/staff-attendance";

export default function HrAttendancePage() {
  return <Suspense><StaffAttendance /></Suspense>;
}
