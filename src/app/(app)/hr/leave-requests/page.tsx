import { HrLeaveWorkspace } from "@/components/leave-management/hr-leave-workspace";
import { PageHeader } from "@/components/ui/page-header";
export default function HrLeaveRequestsPage(){return <section className="space-y-6"><PageHeader description="Manage leave types and review employee leave requests." title="Leave" /><HrLeaveWorkspace/></section>}
