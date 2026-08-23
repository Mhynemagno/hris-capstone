import { EmployeeRecordSummary } from "@/components/personnel-records/employee-record-summary";
import Link from "next/link";
export default function EmployeeProfilePage() { return <section className="space-y-5"><EmployeeRecordSummary /><Link className="text-sm underline" href="/employee/profile/change-request">Request profile change</Link><Link className="ml-4 text-sm underline" href="/employee/profile/change-requests">Request history</Link></section>; }
