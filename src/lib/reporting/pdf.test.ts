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
    expect(output).toContain("Republic of the Philippines");
    expect(output).toContain("Philippine National Police");
    expect(output).toContain("San Juan City Police Station");
    expect(output).toContain("DEPLOYMENT STATUS REPORT");
    expect(output).toContain("Employee");
    expect(output).toContain("Status");
    expect(output).not.toContain("Generated ");
    expect(output).not.toContain("  |  ");
    expect(output).toMatch(/42 \d+ m 42 \d+ l S/);
    expect(output).not.toContain("Employee: SPO2 Maria Santos");
    expect(output).toContain("SPO2 Maria Santos");
    expect(output).toContain("%%EOF");
  });

  it("starts a new portrait page before wrapped report rows reach the footer", () => {
    const pdf = buildReportPdf({
      reportKey: "deployments", title: "Deployment status report", generatedAt: "2026-10-21T08:00:00.000Z",
      columns: [{ key: "employee", label: "Employee" }, { key: "location", label: "Location" }, { key: "status", label: "Status" }],
      rows: Array.from({ length: 45 }, (_, index) => ({ employee: `Officer ${index}`, location: "San Juan City Police Station", status: "Scheduled" })),
      totalCount: 45, page: 1, pageSize: 100,
    });
    expect(new TextDecoder().decode(pdf)).toContain("Page 2 of 2");
  });

  it("splits an oversized record across portrait pages instead of drawing through the footer", () => {
    const columns = [{ key: "details", label: "Details" }];
    const row = { details: Array.from({ length: 3000 }, () => "Recorded value").join(" ") };
    const pdf = buildReportPdf({ reportKey: "deployments", title: "Oversized", generatedAt: "2026-10-21T08:00:00.000Z", columns, rows: [row], totalCount: 1, page: 1, pageSize: 100 });
    expect(new TextDecoder().decode(pdf)).toMatch(/Page 2 of [2-9]/);
  });

  it("wraps an unbroken value within its table cell", () => {
    const unbrokenValue = "X".repeat(140);
    const pdf = buildReportPdf({
      reportKey: "leave", title: "Leave", generatedAt: "2026-10-21T08:00:00.000Z",
      columns: [{ key: "name", label: "Name" }, { key: "leaveType", label: "Leave Type" }],
      rows: [{ name: "Officer Santos", leaveType: unbrokenValue }], totalCount: 1, page: 1, pageSize: 100,
    });
    const output = new TextDecoder().decode(pdf);
    expect(output).not.toContain(unbrokenValue);
    expect(output).toContain("X".repeat(60));
  });
});
