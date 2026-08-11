import { EmployeeRecordDetail } from "@/components/personnel-records/employee-record-detail";
export default async function ServiceHistoryPage({ params }: { params: Promise<{ employeeId: string }> }) { return <EmployeeRecordDetail employeeId={(await params).employeeId} />; }
