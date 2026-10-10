import { EmployeeLeaveCredits, EmployeeLeaveList } from "@/components/leave-management/employee-leave";
import { PageHeader } from "@/components/ui/page-header";

export default function EmployeeLeavePage() {
  return (
    <section className="space-y-6">
      <PageHeader description="See your leave credits, track your requests, and cancel ones HR has not decided yet." title="My leave" />
      <EmployeeLeaveCredits />
      <EmployeeLeaveList />
    </section>
  );
}
