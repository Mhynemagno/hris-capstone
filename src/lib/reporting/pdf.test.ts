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

  it("starts a new portrait page before wrapped report rows reach the footer", () => {
    const pdf = buildReportPdf({
      reportKey: "deployments", title: "Deployment status report", generatedAt: "2026-10-21T08:00:00.000Z",
      columns: [{ key: "employee", label: "Employee" }, { key: "location", label: "Location" }, { key: "status", label: "Status" }],
      rows: Array.from({ length: 18 }, (_, index) => ({ employee: `Officer ${index}`, location: "San Juan City Police Station", status: "Scheduled" })),
      totalCount: 18, page: 1, pageSize: 100,
    });
    expect(new TextDecoder().decode(pdf)).toContain("Page 2 of 2");
  });

  it("splits an oversized record across portrait pages instead of drawing through the footer", () => {
    const columns = Array.from({ length: 45 }, (_, index) => ({ key: `field${index}`, label: `Field ${index}` }));
    const row = Object.fromEntries(columns.map((column) => [column.key, "Recorded value"]));
    const pdf = buildReportPdf({ reportKey: "deployments", title: "Oversized", generatedAt: "2026-10-21T08:00:00.000Z", columns, rows: [row], totalCount: 1, page: 1, pageSize: 100 });
    expect(new TextDecoder().decode(pdf)).toContain("Page 2 of 2");
  });
});
