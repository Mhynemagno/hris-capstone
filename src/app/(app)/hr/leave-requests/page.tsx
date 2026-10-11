import { Suspense } from "react";

import { StaffLeave } from "@/components/leave-management/staff-leave";

export default function HrLeaveRequestsPage() {
  return <Suspense><StaffLeave /></Suspense>;
}
