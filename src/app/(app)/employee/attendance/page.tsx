import { EmployeeAttendanceList } from "@/components/attendance-integration/employee-attendance-list";

export default function EmployeeAttendancePage() { return <section className="space-y-4"><div><p className="text-sm font-medium text-primary">Work attendance</p><h1 className="text-3xl font-semibold">My attendance</h1><p className="mt-2 text-muted-foreground">Review your imported attendance history.</p></div><EmployeeAttendanceList /></section>; }
