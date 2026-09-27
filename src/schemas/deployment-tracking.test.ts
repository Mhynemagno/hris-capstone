import { describe, expect, it } from "vitest";

import { deploymentFiltersSchema, deploymentInputSchema } from "./deployment-tracking";

const employeeId = "123e4567-e89b-42d3-a456-426614174000";

describe("deployment tracking schemas", () => {
  it("requires a location and remarks and normalizes the optional unit", () => {
    expect(deploymentInputSchema.parse({
      employeeId,
      location: " San Juan ",
      unit: " ",
      startsOn: "2026-09-01",
      status: "active",
      notes: " Relief duty ",
    })).toMatchObject({
      location: "San Juan",
      unit: null,
      endsOn: null,
      notes: "Relief duty",
    });
  });

  it("rejects a missing location, missing remarks, reversed dates, and unsupported statuses", () => {
    const base = { employeeId, location: "San Juan", unit: "Operations", startsOn: "2026-09-01", status: "active", notes: "Relief duty" };
    expect(deploymentInputSchema.safeParse(base).success).toBe(true);
    const noLocation = deploymentInputSchema.safeParse({ ...base, location: " " });
    expect(noLocation.error?.issues).toEqual([expect.objectContaining({ path: ["location"], message: "Location is required." })]);
    const noRemarks = deploymentInputSchema.safeParse({ ...base, notes: "" });
    expect(noRemarks.error?.issues).toEqual([expect.objectContaining({ path: ["notes"], message: "Remarks are required." })]);
    expect(deploymentInputSchema.safeParse({ ...base, notes: undefined }).success).toBe(false);
    expect(deploymentInputSchema.safeParse({ ...base, startsOn: "2026-09-03", endsOn: "2026-09-01" }).success).toBe(false);
    expect(deploymentInputSchema.safeParse({ ...base, status: "planned" }).success).toBe(false);
  });

  it("no longer takes an assignment role or project", () => {
    const parsed = deploymentInputSchema.parse({ employeeId, location: "San Juan", assignmentRole: "Patrol", project: "Oplan", startsOn: "2026-09-25", status: "active", notes: "Relief" });
    expect(parsed).not.toHaveProperty("assignmentRole");
    expect(parsed).not.toHaveProperty("project");
  });

  it("accepts its own parsed output, so the form and the query can both validate", () => {
    const once = deploymentInputSchema.parse({ employeeId: "3f1e2d3c-4b5a-4968-8776-655443322110", location: "San Juan", unit: "", startsOn: "2026-09-25", status: "active", notes: "Relief" });
    expect(once).toMatchObject({ unit: null, notes: "Relief" });
    expect(deploymentInputSchema.parse(once)).toEqual(once);
  });

  it("caps page size and rejects a reversed reporting range", () => {
    expect(deploymentFiltersSchema.parse({ page: "2", pageSize: "200", status: "active" })).toMatchObject({ page: 2, pageSize: 100, status: "active" });
    expect(deploymentFiltersSchema.safeParse({ startsOn: "2026-09-03", endsOn: "2026-09-01" }).success).toBe(false);
  });
});
