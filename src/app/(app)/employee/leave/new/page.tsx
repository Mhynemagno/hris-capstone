import { EmployeeLeaveRequestForm } from "@/components/leave-management/employee-leave";
import { PageHeader } from "@/components/ui/page-header";

export default function NewLeavePage() {
  return (
    <section className="space-y-6">
      <PageHeader title="Request leave" />
      <EmployeeLeaveRequestForm />
    </section>
  );
}
