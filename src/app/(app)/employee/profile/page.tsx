import Link from "next/link";
import { FilePen, History, KeyRound } from "lucide-react";

import { EmployeeRecordSummary } from "@/components/personnel-records/employee-record-summary";
import { PageTitle } from "@/components/staff-shell/ui/page-title";

const primaryAction = "inline-flex items-center gap-1.5 rounded-xl bg-blue-900 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";
const secondaryAction = "inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";

export default function EmployeeProfilePage() {
  return (
    <div className="space-y-6">
      <PageTitle subtitle="Your official personnel record." title="My Profile 201" />
      <EmployeeRecordSummary
        actions={<>
          <Link className={primaryAction} href="/employee/profile/change-request"><FilePen aria-hidden className="size-3.5" />Request Profile Change</Link>
          <Link className={secondaryAction} href="/employee/profile/change-requests"><History aria-hidden className="size-3.5" />Request History</Link>
          <Link className={secondaryAction} href="/employee/profile/security"><KeyRound aria-hidden className="size-3.5" />Change Password</Link>
        </>}
      />
    </div>
  );
}
