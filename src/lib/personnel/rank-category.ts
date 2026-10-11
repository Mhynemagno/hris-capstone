// The ranks table has no category column; the PNP rank codes decide it.
const COMMISSIONED = new Set(["PGEN", "PLTGEN", "PMGEN", "PBGEN", "PCOL", "PLTCOL", "PMAJ", "PCPT", "PLT"]);
const NON_COMMISSIONED = new Set(["PEMS", "PCMS", "PSMS", "PMSG", "PSSG", "PCPL", "PAT"]);

export function rankCategory(code: string | null) {
  const value = code?.toUpperCase() ?? "";
  if (COMMISSIONED.has(value)) return "Commissioned Officer (PCO)";
  if (NON_COMMISSIONED.has(value)) return "Non-Commissioned (PNCO)";
  return "Civilian Staff";
}

export function rankRowLabel(code: string | null, name: string | null) {
  if (!code) return "Non-Uniformed Personnel (NUP)";
  return name ? `${name} (${code})` : code;
}
