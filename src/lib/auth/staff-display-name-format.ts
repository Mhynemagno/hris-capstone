/** "PMAJ M. C. Balneg" (Capstone UI header): rank code, first-name initials and last name. */
export type StaffPerson = { rankCode: string | null; firstName: string; middleName: string | null; lastName: string };

export function formatStaffDisplayName(person: StaffPerson | null, fallback: string) {
  if (!person) return fallback;
  if (!person.rankCode) return `${person.firstName} ${person.lastName}`.trim();
  const initials = person.firstName.split(/\s+/).filter(Boolean).map((word) => `${word[0]!.toUpperCase()}.`).join(" ");
  return [person.rankCode, initials, person.lastName].filter(Boolean).join(" ");
}
