import { formatDate } from "@/lib/format-date";
import type { Applicant } from "@/lib/types/database";

const titleCase = (value: string | null) => (value ? value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()) : null);

export function ProfileTab({ applicant }: { applicant: Applicant | null }) {
  if (!applicant) return <p className="text-muted-foreground">The applicant profile is not available.</p>;
  const groups: { title: string; rows: [string, string | null][] }[] = [
    { title: "Personal", rows: [
      ["First name", applicant.first_name], ["Middle name", applicant.middle_name], ["Last name", applicant.last_name], ["Qualifier", applicant.qualifier],
      ["Date of birth", formatDate(applicant.date_of_birth)], ["Place of birth", applicant.place_of_birth], ["Gender", titleCase(applicant.gender)],
      ["Civil status", titleCase(applicant.civil_status)], ["Religion", applicant.religion], ["Citizenship", applicant.citizenship],
    ] },
    { title: "Contact", rows: [["Mobile", applicant.phone]] },
    { title: "Address", rows: [["Home address", applicant.address]] },
  ];
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section aria-labelledby={`profile-${group.title}`} className="rounded-lg border bg-card p-5" key={group.title}>
          <h3 className="mb-3 text-base font-semibold" id={`profile-${group.title}`}>{group.title}</h3>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {group.rows.map(([label, value]) => (
              <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className={value ? "text-base" : "text-base text-muted-foreground"}>{value || "Not provided"}</dd></div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
