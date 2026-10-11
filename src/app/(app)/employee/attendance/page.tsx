import { EmployeeAttendanceHeader, EmployeeAttendanceList } from "@/components/attendance-integration/employee-attendance-list";
import { EmployeeFaceScan } from "@/components/face-recognition/employee-face-scan";

export default function EmployeeAttendancePage() {
  return (
    <div className="space-y-6">
      <EmployeeAttendanceHeader />
      <EmployeeFaceScan />
      <EmployeeAttendanceList />
    </div>
  );
}
