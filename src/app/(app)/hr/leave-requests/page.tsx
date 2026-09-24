import { HrLeaveQueue } from "@/components/leave-management/hr-leave";
import { LeaveTypeManager } from "@/components/leave-management/leave-type-manager";
import { PageHeader } from "@/components/ui/page-header";
export default function HrLeaveRequestsPage(){return <section className="space-y-6"><PageHeader description="Manage leave types and review employee leave requests." eyebrow="Leave management" title="Leave requests" /><LeaveTypeManager/><HrLeaveQueue/></section>}
