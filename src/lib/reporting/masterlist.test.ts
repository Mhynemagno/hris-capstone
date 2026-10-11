import { describe, expect, it } from "vitest";

import { buildMasterlistCsv, reportGenerateHref } from "./masterlist";

describe("station masterlist", () => {
  it("writes a CSV with a header, quoting cells that need it", () => {
    expect(buildMasterlistCsv([{ badge: "1-60482", rank: "PMAJ", name: "Balneg, Maria Cristina", unit: "ARMS", status: "active" }]))
      .toBe('Badge No.,Rank,Name,Unit / Section,Employment Status\r\n1-60482,PMAJ,"Balneg, Maria Cristina",ARMS,active\r\n');
  });

  it("neutralises spreadsheet formulas", () => {
    expect(buildMasterlistCsv([{ badge: "=1+1", rank: null, name: "x", unit: null, status: "active" }])).toContain("'=1+1");
  });
});

describe("reportGenerateHref", () => {
  it("routes each export format to the report page", () => {
    expect(reportGenerateHref("deployments", { from: "2026-10-01", to: "2026-10-11", departmentId: 3, format: "pdf" })).toBe("/reports/deployments?from=2026-10-01&to=2026-10-11&department=3&print=1");
    expect(reportGenerateHref("deployments", { from: "2026-10-01", to: "2026-10-11", departmentId: null, format: "csv" })).toBe("/reports/deployments?from=2026-10-01&to=2026-10-11&export=csv");
    expect(reportGenerateHref("deployments", { from: "2026-10-01", to: "2026-10-11", departmentId: null, format: "print" })).toBe("/reports/deployments?from=2026-10-01&to=2026-10-11&print=1");
  });
});
