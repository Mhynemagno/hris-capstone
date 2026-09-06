import { describe, expect, it } from "vitest";

import { deploymentFiltersSchema, deploymentInputSchema } from "./deployment-tracking";

const employeeId = "123e4567-e89b-42d3-a456-426614174000";

describe("deployment tracking schemas", () => {
  it("normalizes a unit assignment with optional fields", () => {
    expect(deploymentInputSchema.parse({
      employeeId,
      location: " ",
      unit: " Operations ",
      project: " ",
      assignmentRole: " Analyst ",
      startsOn: "2026-09-01",
      status: "active",
      notes: " ",
    })).toMatchObject({
      location: null,
      unit: "Operations",
      project: null,
      assignmentRole: "Analyst",
      endsOn: null,
      notes: null,
    });
  });

  it("rejects missing destinations, reversed dates, and unsupported statuses", () => {
    const base = { employeeId, location: "", unit: "", project: "", assignmentRole: "Analyst", startsOn: "2026-09-01", status: "active" };
    expect(deploymentInputSchema.safeParse(base).success).toBe(false);
    expect(deploymentInputSchema.safeParse({ ...base, unit: "Operations", startsOn: "2026-09-03", endsOn: "2026-09-01" }).success).toBe(false);
    expect(deploymentInputSchema.safeParse({ ...base, unit: "Operations", status: "planned" }).success).toBe(false);
  });

  it("caps page size and rejects a reversed reporting range", () => {
    expect(deploymentFiltersSchema.parse({ page: "2", pageSize: "200", status: "active" })).toMatchObject({ page: 2, pageSize: 100, status: "active" });
    expect(deploymentFiltersSchema.safeParse({ startsOn: "2026-09-03", endsOn: "2026-09-01" }).success).toBe(false);
  });
});
