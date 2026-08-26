import { EmployeeDirectory } from "@/components/personnel-records/employee-directory";
import { PageHeader } from "@/components/ui/page-header";

export default function EmployeesPage() {
  return <section className="space-y-8"><PageHeader description="Create, locate, and maintain official employee records." eyebrow="Personnel records" title="Employees" /><EmployeeDirectory /></section>;
}
