"use client";

import { useRouter } from "next/navigation";

import { EmployeeForm } from "./employee-form";
import { useSaveEmployee } from "@/hooks/use-personnel-records";
import type { Employee } from "@/lib/types/database";

export function EmployeeEditor({ employee }: { employee?: Employee }) {
  const router = useRouter();
  const save = useSaveEmployee();
  return <EmployeeForm employee={employee} pending={save.isPending} onSaved={async (input) => { const result = await save.mutateAsync({ input, employeeId: employee?.id }); router.push(`/hr/employees/${result.id}`); router.refresh(); }} />;
}
