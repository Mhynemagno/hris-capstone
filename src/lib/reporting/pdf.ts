import type { ReportResponse } from "@/schemas/reporting";

const encoder = new TextEncoder();
const pageWidth = 612;
const pageHeight = 792;
const left = 42;
const firstRowY = 660;
const lineHeight = 14;
const linesPerPage = 38;

function ascii(value: string) {
  return value
    .replace(/[\\()]/g, (character) => `\\${character}`)
    .replace(/[^\x20-\x7e]/g, "?");
}

function text(x: number, y: number, size: number, value: string, bold = false) {
  return `BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${ascii(value)}) Tj ET`;
}

function line(x1: number, y1: number, x2: number, y2: number) {
  return `${x1} ${y1} m ${x2} ${y2} l S`;
}

function split(value: string, limit: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (`${current} ${word}`.trim().length > limit && current) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ["—"];
}

function formatPdfCell(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === "pending") return "For approval";
  if (value === "incomplete") return "Partial";
  return String(value);
}

function rowLines(report: ReportResponse, row: ReportResponse["rows"][number]) {
  return split(report.columns.map((column) => formatPdfCell(row[column.key])).join("  |  "), 94);
}

function pageContent(report: ReportResponse, pageRows: string[][], page: number, pageCount: number) {
  const commands = [
    "0.2 w",
    text(left, 755, 9, "Republic of the Philippines", true),
    text(left, 742, 9, "Philippine National Police", true),
    text(left, 728, 14, "San Juan City Police Station", true),
    line(left, 719, pageWidth - left, 719),
    text(left, 698, 13, report.title.toUpperCase(), true),
    text(left, 684, 8, `Generated ${new Date(report.generatedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "long", timeStyle: "short" })}`),
    text(left, 671, 8, `Records: ${report.totalCount}    Page ${page} of ${pageCount}`),
    text(left, 658, 8, report.columns.map((column) => column.label).join("  |  "), true),
    line(left, 652, pageWidth - left, 652),
  ];
  let y = firstRowY - 12;
  for (const fields of pageRows) {
    for (const field of fields) {
      commands.push(text(left, y, 8, field));
      y -= lineHeight;
    }
    commands.push(line(left, y + 5, pageWidth - left, y + 5));
    y -= 5;
  }
  commands.push(text(left, 28, 7, "Official HRIS report • San Juan City Police Station"));
  return commands.join("\n");
}

/** Builds a compact, portrait, downloadable PDF without relying on the browser print dialog. */
export function buildReportPdf(report: ReportResponse) {
  const groups: string[][][] = [[]];
  let usedLines = 0;
  for (const row of report.rows) {
    const fields = rowLines(report, row);
    // A row has one rendered line per column (and may wrap). A very wide or
    // verbose row is split at a field boundary across pages instead of being
    // drawn through the footer.
    while (fields.length) {
      const remaining = linesPerPage - usedLines;
      if (usedLines > 0 && remaining < 2) {
        groups.push([]);
        usedLines = 0;
        continue;
      }
      const take = Math.max(1, Math.min(fields.length, remaining - 1));
      groups.at(-1)?.push(fields.splice(0, take));
      usedLines += take + 1;
      if (fields.length) {
        groups.push([]);
        usedLines = 0;
      }
    }
  }
  const pageObjectStart = 5;
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${groups.map((_, index) => `${pageObjectStart + index * 2} 0 R`).join(" ")}] /Count ${groups.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  groups.forEach((rows, index) => {
    const content = pageContent(report, rows, index + 1, groups.length);
    const pageObject = pageObjectStart + index * 2;
    const contentObject = pageObject + 1;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObject} 0 R >>`);
    objects.push(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`);
  });

  let output = "%PDF-1.4\n%????\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(encoder.encode(output).length);
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = encoder.encode(output).length;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { output += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return encoder.encode(output);
}
