import { Suspense } from "react";

import { StaffJobPostings } from "@/components/recruitment/staff-job-postings";

export default function HrJobsPage() {
  return <Suspense><StaffJobPostings /></Suspense>;
}
