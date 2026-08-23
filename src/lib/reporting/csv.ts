import type { ReportResponse } from "@/schemas/reporting";

function escapeCsvCell(value: unknown) {
  const raw = value == null ? "" : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function toReportCsv(report: ReportResponse) {
  const header = report.columns.map((column) => escapeCsvCell(column.label)).join(",");
  const rows = report.rows.map((row) => report.columns.map((column) => escapeCsvCell(row[column.key])).join(","));
  return `${[header, ...rows].join("\r\n")}\r\n`;
}
