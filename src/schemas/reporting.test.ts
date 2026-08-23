import { describe, expect, it } from "vitest";

import { reportFiltersSchema } from "./reporting";

describe("reporting schemas", () => {
  it("normalizes a report filter with pagination", () => {
    expect(
      reportFiltersSchema.parse({
        reportKey: "attendance-leave",
        startsOn: "2026-08-01",
        endsOn: "2026-08-31",
        page: "2",
        pageSize: "25",
      }),
    ).toMatchObject({ reportKey: "attendance-leave", page: 2, pageSize: 25 });
  });

  it("rejects unknown reports and reversed ranges", () => {
    expect(reportFiltersSchema.safeParse({ reportKey: "unknown" }).success).toBe(false);
    expect(reportFiltersSchema.safeParse({ reportKey: "deployments", startsOn: "2026-08-31", endsOn: "2026-08-01" }).success).toBe(false);
  });

  it("supplies a complete default date range", () => {
    const result = reportFiltersSchema.parse({ reportKey: "deployments" });
    expect(result.startsOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.endsOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
