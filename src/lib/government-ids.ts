/** Government ID numbers are stored as digits only; these show them with the usual dashes. */
export function formatSssNumber(digits: string | null | undefined) {
  return digits ? `${digits.slice(0, 2)}-${digits.slice(2, 9)}-${digits.slice(9)}` : "";
}

export function formatPhilHealthNumber(digits: string | null | undefined) {
  return digits ? `${digits.slice(0, 2)}-${digits.slice(2, 11)}-${digits.slice(11)}` : "";
}
