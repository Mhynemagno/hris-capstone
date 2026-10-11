import { Suspense } from "react";

import { EmployeeLeavePortal } from "@/components/leave-management/employee-leave-portal";

export default function EmployeeLeavePage() {
  return <Suspense><EmployeeLeavePortal /></Suspense>;
}
