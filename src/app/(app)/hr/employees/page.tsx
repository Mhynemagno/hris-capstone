import { EmployeeDirectory } from "@/components/personnel-records/employee-directory";

export default function EmployeesPage() {
  return <section className="space-y-2"><div><p className="text-sm font-medium text-primary">Personnel records</p><h1 className="text-3xl font-semibold tracking-tight">Employees</h1><p className="mt-2 text-muted-foreground">Create, locate, and maintain official employee records.</p></div><div className="pt-6"><EmployeeDirectory /></div></section>;
}
