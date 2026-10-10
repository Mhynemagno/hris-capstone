/** Government ID numbers are stored as digits only; these show them with the usual dashes. */
export function formatSssNumber(digits: string | null | undefined) {
  return digits ? `${digits.slice(0, 2)}-${digits.slice(2, 9)}-${digits.slice(9)}` : "";
}

export function formatPhilHealthNumber(digits: string | null | undefined) {
  return digits ? `${digits.slice(0, 2)}-${digits.slice(2, 11)}-${digits.slice(11)}` : "";
}

/** Digit counts, dash grouping and the in-box placeholder for each government ID on the personnel record. */
export const GOVERNMENT_ID_FORMATS = {
  philhealth: { digits: 12, groups: [2, 9, 1], placeholder: "12-345678901-2" },
  gsis: { digits: 11, groups: [11], placeholder: "XXXXXXXXXXX" },
  pagibig: { digits: 12, groups: [4, 4, 4], placeholder: "XXXX-XXXX-XXXX" },
} as const;

export type GovernmentIdKind = keyof typeof GOVERNMENT_ID_FORMATS;

/** Keeps only the allowed number of digits and inserts the dashes, so it works for saved values and while typing. */
export function formatGovernmentId(kind: GovernmentIdKind, value: string | null | undefined) {
  const { digits, groups } = GOVERNMENT_ID_FORMATS[kind];
  const clean = (value ?? "").replace(/\D/g, "").slice(0, digits);
  const parts: string[] = [];
  let index = 0;
  for (const size of groups) {
    if (index >= clean.length) break;
    parts.push(clean.slice(index, index + size));
    index += size;
  }
  return parts.join("-");
}
