import { EmployeeEditor } from "@/components/personnel-records/employee-editor";

export default function NewEmployeePage() {
  return <section className="mx-auto max-w-3xl space-y-2"><p className="text-sm font-medium text-primary">Personnel records</p><h1 className="text-3xl font-semibold tracking-tight">Add employee</h1><p className="text-muted-foreground">Create the official record. Employee account activation remains an administrator workflow.</p><div className="pt-6"><EmployeeEditor /></div></section>;
}
