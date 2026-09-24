import { EmployeeLeaveRequestForm } from "@/components/leave-management/employee-leave";
import { PageHeader } from "@/components/ui/page-header";

export default function NewLeavePage() {
  return (
    <section className="space-y-6">
      <PageHeader description="Choose a leave type and dates. Fields marked * are required." title="Request leave" />
      <EmployeeLeaveRequestForm />
    </section>
  );
}
