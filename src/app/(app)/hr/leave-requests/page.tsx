import { HrLeaveQueue } from "@/components/leave-management/hr-leave";
import { LeaveTypeManager } from "@/components/leave-management/leave-type-manager";
export default function HrLeaveRequestsPage(){return <section className="space-y-6"><h1 className="text-3xl font-semibold">Leave requests</h1><LeaveTypeManager/><HrLeaveQueue/></section>}
