import { escapeCsvCell } from "@/lib/reporting/csv";
import type { ReportFilters } from "@/schemas/reporting";

export type MasterlistRow = { badge: string; rank: string | null; name: string; unit: string | null; status: string };

const HEADER = ["Badge No.", "Rank", "Name", "Unit / Section", "Employment Status"];

/** The Export Station Masterlist CSV (Capstone UI reports.html), with spreadsheet formulas neutralised. */
export function buildMasterlistCsv(rows: MasterlistRow[]) {
  const lines = [HEADER, ...rows.map((row) => [row.badge, row.rank, row.name, row.unit, row.status])].map((cells) => cells.map(escapeCsvCell).join(","));
  return `${lines.join("\r\n")}\r\n`;
}

export type ReportExportFormat = "pdf" | "csv" | "print";

/** Where the Generate Report modal sends each export format: the report page prints or downloads once loaded. */
export function reportGenerateHref(key: ReportFilters["reportKey"], input: { from: string; to: string; departmentId: number | null; format: ReportExportFormat }) {
  const params = new URLSearchParams({ from: input.from, to: input.to });
  if (input.departmentId) params.set("department", String(input.departmentId));
  if (input.format === "csv") params.set("export", "csv");
  else params.set("print", "1");
  return `/reports/${key}?${params.toString()}`;
}
