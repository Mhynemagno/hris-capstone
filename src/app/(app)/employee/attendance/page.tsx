import Link from "next/link";

import { EmployeeAttendanceList } from "@/components/attendance-integration/employee-attendance-list";
import { buttonVariants } from "@/components/ui/button";

export default function EmployeeAttendancePage() { return <section className="space-y-4"><div><p className="text-sm font-medium text-primary">Work attendance</p><h1 className="text-3xl font-semibold">My attendance</h1><p className="mt-2 text-muted-foreground">Review your attendance history, or record today’s attendance with your face.</p><Link className={buttonVariants({ className: "mt-4" })} href="/employee/attendance/scan">Scan attendance</Link></div><EmployeeAttendanceList /></section>; }
