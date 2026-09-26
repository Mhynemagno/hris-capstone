import Link from "next/link";
import { FilePen, History, KeyRound } from "lucide-react";

import { EmployeeRecordSummary } from "@/components/personnel-records/employee-record-summary";
import { buttonVariants } from "@/components/ui/button";

export default function EmployeeProfilePage() {
  return (
    <EmployeeRecordSummary
      actions={<>
        <Link className={buttonVariants({ size: "sm" })} href="/employee/profile/change-request"><FilePen aria-hidden />Request profile change</Link>
        <Link className={buttonVariants({ size: "sm", variant: "outline" })} href="/employee/profile/change-requests"><History aria-hidden />Request history</Link>
        <Link className={buttonVariants({ size: "sm", variant: "outline" })} href="/employee/profile/security"><KeyRound aria-hidden />Change password</Link>
      </>}
    />
  );
}
