import { describe, expect, it } from "vitest";

import { toReportCsv } from "./csv";

describe("report CSV", () => {
  it("escapes spreadsheet formulas and quoted values", () => {
    expect(
      toReportCsv({
        reportKey: "deployments",
        title: "Deployments",
        generatedAt: "2026-08-24T00:00:00.000Z",
        columns: [{ key: "status", label: "Status" }],
        rows: [{ status: '=HYPERLINK("https://bad.test")' }],
        totalCount: 1,
        page: 1,
        pageSize: 25,
      }),
    ).toBe('Status\r\n"\'=HYPERLINK(""https://bad.test"")"\r\n');
  });
});
