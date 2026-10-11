import { Suspense } from "react";

import { StaffApplicantRoster } from "@/components/recruitment/staff-applicant-roster";

export default function HrApplicationsPage() {
  return <Suspense><StaffApplicantRoster /></Suspense>;
}
