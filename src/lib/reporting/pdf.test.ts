import { describe, expect, it } from "vitest";

import { buildReportPdf } from "./pdf";

describe("buildReportPdf", () => {
  it("creates a downloadable portrait PDF with the station letterhead and report data", () => {
    const pdf = buildReportPdf({
      reportKey: "deployments",
      title: "Deployment status report",
      generatedAt: "2026-10-21T08:00:00.000Z",
      columns: [{ key: "employee", label: "Employee" }, { key: "status", label: "Status" }],
      rows: [{ employee: "SPO2 Maria Santos", status: "Ongoing" }],
      totalCount: 1,
      page: 1,
      pageSize: 100,
    });

    const output = new TextDecoder().decode(pdf);
    expect(output.startsWith("%PDF-1.4")).toBe(true);
    expect(output).toContain("SAN JUAN CITY POLICE STATION");
    expect(output).toContain("DEPLOYMENT STATUS REPORT");
    expect(output).toContain("SPO2 Maria Santos");
    expect(output).toContain("%%EOF");
  });
});
