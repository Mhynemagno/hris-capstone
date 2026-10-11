import { Suspense } from "react";

import { StaffDeployments } from "@/components/deployment-tracking/staff-deployments";

export default function HrDeploymentsPage() {
  return <Suspense><StaffDeployments /></Suspense>;
}
