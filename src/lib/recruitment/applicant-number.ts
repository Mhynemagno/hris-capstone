/** Applicant numbers display like badge numbers: 12345 → "0-12345". */
export function formatApplicantNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  const digits = String(value).padStart(6, "0");
  return `${digits.slice(0, 1)}-${digits.slice(1)}`;
}
