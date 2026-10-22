import { describe, expect, it } from "vitest";

import { DEPLOYMENT_TYPE_EVENTS, deploymentFiltersSchema, deploymentGroupInputSchema, deploymentInputSchema, deploymentStatusProposalSchema, deploymentUpdateSchema } from "./deployment-tracking";

const employeeId = "123e4567-e89b-42d3-a456-426614174000";

describe("deployment tracking schemas", () => {
  it("accepts a deployment group with unique employee assignments and required tasks", () => {
    const parsed = deploymentGroupInputSchema.parse({
      location: " San Juan ",
      startsOn: "2026-10-22",
      endsOn: "2026-10-23",
      deploymentType: "Public Assembly",
      eventOperation: "Rally",
      assignments: [
        { employeeId, task: "Deployed" },
        { employeeId: "3f1e2d3c-4b5a-4968-8776-655443322110", task: "Reserve/Standby" },
      ],
    });

    expect(parsed).toMatchObject({ location: "San Juan", assignments: [{ task: "Deployed" }, { task: "Reserve/Standby" }] });
  });

  it("rejects duplicate assignments and events that do not belong to the selected deployment type", () => {
    const base = {
      location: "San Juan",
      startsOn: "2026-10-22",
      deploymentType: "Public Assembly",
      eventOperation: "Rally",
      assignments: [{ employeeId, task: "Deployed" }],
    };

    expect(deploymentGroupInputSchema.safeParse({ ...base, assignments: [base.assignments[0], base.assignments[0]] }).success).toBe(false);
    expect(deploymentGroupInputSchema.safeParse({ ...base, eventOperation: "Flood / Emergency" }).success).toBe(false);
  });
  it("partitions events by deployment type", () => {
    expect(DEPLOYMENT_TYPE_EVENTS).toEqual({
      "Public Assembly": ["Rally"],
      "Special Event": ["Fiesta / Major Event", "Government Event"],
      "Election Security": ["Election Period"],
      "Disaster Response": ["Flood / Emergency"],
    });
  });

  it("edits location, dates, type, event and task without remarks or a status", () => {
    const base = { location: " San Juan ", startsOn: "2026-09-01", deploymentType: "Special Event", eventOperation: "Government Event", task: "Reserve/Standby" };
    const parsed = deploymentInputSchema.parse({ ...base, notes: "ignored", status: "completed" });
    expect(parsed).toEqual({ location: "San Juan", startsOn: "2026-09-01", endsOn: null, deploymentType: "Special Event", eventOperation: "Government Event", task: "Reserve/Standby" });
    expect(deploymentInputSchema.safeParse({ ...base, location: " " }).error?.issues).toEqual([expect.objectContaining({ path: ["location"], message: "Location is required." })]);
    expect(deploymentInputSchema.safeParse({ ...base, startsOn: "2026-09-03", endsOn: "2026-09-01" }).success).toBe(false);
    expect(deploymentInputSchema.safeParse({ ...base, task: "Patrol" }).success).toBe(false);
    expect(deploymentInputSchema.safeParse({ ...base, eventOperation: "Rally" }).error?.issues).toEqual([expect.objectContaining({ path: ["eventOperation"], message: "Select an event or operation for this deployment type." })]);
    expect(deploymentInputSchema.safeParse({ ...base, deploymentType: "" }).error?.issues).toEqual(expect.arrayContaining([expect.objectContaining({ path: ["deploymentType"], message: "Select a deployment type." })]));
  });

  it("accepts its own parsed output and adds the concurrency fields for updates", () => {
    const once = deploymentInputSchema.parse({ location: "San Juan", startsOn: "2026-09-25", deploymentType: "Public Assembly", eventOperation: "Rally", task: "Deployed" });
    expect(deploymentInputSchema.parse(once)).toEqual(once);
    expect(deploymentUpdateSchema.safeParse({ ...once, id: employeeId, expectedUpdatedAt: "2026-09-25T00:00:00Z" }).success).toBe(true);
    expect(deploymentUpdateSchema.safeParse(once).success).toBe(false);
  });

  it("lets employees propose only Ongoing or Completed", () => {
    expect(deploymentStatusProposalSchema.safeParse({ deploymentId: employeeId, status: "ongoing" }).success).toBe(true);
    expect(deploymentStatusProposalSchema.safeParse({ deploymentId: employeeId, status: "completed" }).success).toBe(true);
    expect(deploymentStatusProposalSchema.safeParse({ deploymentId: employeeId, status: "cancelled" }).success).toBe(false);
    expect(deploymentStatusProposalSchema.safeParse({ deploymentId: employeeId, status: "scheduled" }).success).toBe(false);
  });

  it("caps page size and rejects a reversed reporting range", () => {
    expect(deploymentFiltersSchema.parse({ page: "2", pageSize: "200", status: "ongoing" })).toMatchObject({ page: 2, pageSize: 100, status: "ongoing" });
    expect(deploymentFiltersSchema.safeParse({ startsOn: "2026-09-03", endsOn: "2026-09-01" }).success).toBe(false);
  });
});
