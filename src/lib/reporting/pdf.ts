import type { ReportResponse } from "@/schemas/reporting";

const encoder = new TextEncoder();
const pageWidth = 612;
const pageHeight = 792;
const left = 42;
const right = pageWidth - left;
const tableTop = 666;
const tableBottom = 50;
const cellPadding = 4;
const tableLineHeight = 10;

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
    const chunks = word.match(new RegExp(`.{1,${limit}}`, "g")) ?? [word];
    for (const chunk of chunks) {
      if (`${current} ${chunk}`.trim().length > limit && current) {
        lines.push(current);
        current = chunk;
      } else {
        current = `${current} ${chunk}`.trim();
      }
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

function columnWidths(report: ReportResponse) {
  const available = right - left;
  const weights = report.columns.map((column) => Math.max(column.label.length, 8));
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  return weights.map((weight) => Math.max(1, (available * weight) / totalWeight));
}

function charactersPerLine(width: number) {
  return Math.max(4, Math.floor((width - cellPadding * 2) / 4.2));
}

type TableRow = { cells: string[][]; lineCount: number };

function tableRow(cells: string[], widths: number[]): TableRow {
  const lines = cells.map((value, index) => split(value, charactersPerLine(widths[index] ?? 1)));
  return { cells: lines, lineCount: Math.max(...lines.map((cell) => cell.length), 1) };
}

function rowHeight(row: TableRow) {
  return row.lineCount * tableLineHeight + cellPadding * 2;
}

function paginateRows(report: ReportResponse, widths: number[]) {
  const groups: TableRow[][] = [[]];
  let usedHeight = 0;
  const maximumHeight = tableTop - tableBottom - rowHeight(tableRow(report.columns.map((column) => column.label), widths));
  for (const row of report.rows) {
    const source = tableRow(report.columns.map((column) => formatPdfCell(row[column.key])), widths);
    let offset = 0;
    while (offset < source.lineCount) {
      const remainingLines = Math.max(1, Math.floor((maximumHeight - usedHeight - cellPadding * 2) / tableLineHeight));
      if (groups.at(-1)?.length && remainingLines < 1) {
        groups.push([]);
        usedHeight = 0;
        continue;
      }
      const lineCount = Math.min(source.lineCount - offset, Math.max(1, remainingLines));
      const chunk = { cells: source.cells.map((cell) => cell.slice(offset, offset + lineCount)), lineCount };
      const height = rowHeight(chunk);
      if (groups.at(-1)?.length && usedHeight + height > maximumHeight) {
        groups.push([]);
        usedHeight = 0;
        continue;
      }
      groups.at(-1)?.push(chunk);
      usedHeight += height;
      offset += lineCount;
      if (offset < source.lineCount) {
        groups.push([]);
        usedHeight = 0;
      }
    }
  }
  return groups;
}

function drawRow(commands: string[], row: TableRow, widths: number[], top: number, bold = false) {
  const bottom = top - rowHeight(row);
  commands.push(line(left, top, right, top));
  commands.push(line(left, bottom, right, bottom));
  let x = left;
  for (let index = 0; index <= widths.length; index += 1) {
    commands.push(line(x, top, x, bottom));
    x += widths[index] ?? 0;
  }
  x = left;
  row.cells.forEach((cell, index) => {
    cell.forEach((value, lineIndex) => commands.push(text(x + cellPadding, top - cellPadding - 8 - lineIndex * tableLineHeight, 7, value, bold)));
    x += widths[index] ?? 0;
  });
  return bottom;
}

function pageContent(report: ReportResponse, pageRows: TableRow[], widths: number[], page: number, pageCount: number) {
  const commands = [
    "0.2 w",
    text(left, 755, 9, "Republic of the Philippines", true),
    text(left, 742, 9, "Philippine National Police", true),
    text(left, 728, 14, "San Juan City Police Station", true),
    line(left, 719, pageWidth - left, 719),
    text(left, 698, 13, report.title.toUpperCase(), true),
    text(left, 680, 8, `Records: ${report.totalCount}    Page ${page} of ${pageCount}`),
  ];
  let y = drawRow(commands, tableRow(report.columns.map((column) => column.label), widths), widths, tableTop, true);
  for (const row of pageRows) y = drawRow(commands, row, widths, y);
  commands.push(text(left, 28, 7, "Official HRIS report - San Juan City Police Station"));
  return commands.join("\n");
}

/** Builds a compact, portrait, downloadable PDF without relying on the browser print dialog. */
export function buildReportPdf(report: ReportResponse) {
  const widths = columnWidths(report);
  const groups = paginateRows(report, widths);
  const pageObjectStart = 5;
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${groups.map((_, index) => `${pageObjectStart + index * 2} 0 R`).join(" ")}] /Count ${groups.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  groups.forEach((rows, index) => {
    const content = pageContent(report, rows, widths, index + 1, groups.length);
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
