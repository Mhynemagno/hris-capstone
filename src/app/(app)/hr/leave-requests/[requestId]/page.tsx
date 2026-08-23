import { HrLeaveDetail } from "@/components/leave-management/hr-leave";
export default async function HrLeaveRequestPage({params}:{params:Promise<{requestId:string}>}){const {requestId}=await params;return <HrLeaveDetail requestId={requestId}/>}
