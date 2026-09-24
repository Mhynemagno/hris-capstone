import { EmployeeEditor } from "@/components/personnel-records/employee-editor";
import { uuidSchema } from "@/schemas/common";
import { PageHeader } from "@/components/ui/page-header";

export default async function NewEmployeePage({ searchParams }: { searchParams: Promise<{ profileId?: string }> }) {
  const { profileId: rawProfileId } = await searchParams;
  const profileId = uuidSchema.safeParse(rawProfileId).data;
  return <section className="mx-auto max-w-3xl space-y-2"><PageHeader description="Create the official record. Employee account activation remains an administrator workflow." eyebrow="Personnel records" title="Add employee" /><div className="pt-6"><EmployeeEditor profileId={profileId} /></div></section>;
}
