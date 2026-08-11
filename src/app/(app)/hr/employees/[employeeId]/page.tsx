import { EmployeeRecordDetail } from "@/components/personnel-records/employee-record-detail";
import { uuidSchema } from "@/schemas/common";
import { notFound } from "next/navigation";

export default async function EmployeePage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  if (!uuidSchema.safeParse(employeeId).success) notFound();
  return <EmployeeRecordDetail employeeId={employeeId} />;
}
