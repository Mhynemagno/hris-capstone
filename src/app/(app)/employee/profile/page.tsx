import Link from "next/link";

import { EmployeeRecordSummary } from "@/components/personnel-records/employee-record-summary";

export default function EmployeeProfilePage() { return <section className="space-y-5"><EmployeeRecordSummary /><div className="flex flex-wrap gap-x-4 gap-y-2"><Link className="text-sm underline" href="/employee/profile/change-request">Request profile change</Link><Link className="text-sm underline" href="/employee/profile/change-requests">Request history</Link><Link className="text-sm underline" href="/employee/profile/security">Change password</Link></div></section>; }
