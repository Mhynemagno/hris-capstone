import { describe, expect, it, vi } from "vitest";

const from = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({ from, rpc }),
}));

import { cancelDeployment, createDeploymentGroup, deploymentFilters, EMPLOYEE_OPTIONS_LIMIT, listEmployeeIdsOnLeave, listEmployeeOptions, listHrDeployments, proposeDeploymentStatus, reviewDeploymentStatus, updateDeployment } from "./deployment-tracking";

const deployment = { employeeId: "3f1e2d3c-4b5a-4968-8776-655443322110" };
const details = { location: "San Juan", startsOn: "2026-09-25", deploymentType: "Public Assembly", eventOperation: "Rally", task: "Reserve/Standby" };
const deploymentId = "7c1e2d3c-4b5a-4968-8776-655443322110";

describe("deployment tracking queries", () => {
  it("creates a grouped deployment through the assignment RPC", async () => {
    rpc.mockResolvedValue({ data: "group-1", error: null });
    await expect(createDeploymentGroup({
      location: "San Juan",
      startsOn: "2026-10-22",
      deploymentType: "Public Assembly",
      eventOperation: "Rally",
      assignments: [
        { employeeId: deployment.employeeId, task: "Deployed" },
        { employeeId: "7c1e2d3c-4b5a-4968-8776-655443322110", task: "Reserve/Standby" },
      ],
    })).resolves.toBe("group-1");

    expect(rpc).toHaveBeenLastCalledWith("create_deployment_group", {
      target_location: "San Juan",
      target_unit: null,
      target_starts_on: "2026-10-22",
      target_ends_on: null,
      target_deployment_type: "Public Assembly",
      target_event_operation: "Rally",
      target_assignments: [
        { employeeId: deployment.employeeId, task: "Deployed" },
        { employeeId: "7c1e2d3c-4b5a-4968-8776-655443322110", task: "Reserve/Standby" },
      ],
    });
  });

  it("updates details with the task and never sends a status", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await updateDeployment({ ...details, endsOn: null, id: deploymentId, expectedUpdatedAt: "2026-09-25T00:00:00Z" });
    expect(rpc).toHaveBeenLastCalledWith("update_deployment_details", {
      target_deployment_id: deploymentId,
      expected_updated_at: "2026-09-25T00:00:00Z",
      target_location: "San Juan",
      target_starts_on: "2026-09-25",
      target_ends_on: null,
      target_deployment_type: "Public Assembly",
      target_event_operation: "Rally",
      target_task: "Reserve/Standby",
    });
    await expect(updateDeployment({ ...details, eventOperation: "Fiesta / Major Event", id: deploymentId, expectedUpdatedAt: "2026-09-25T00:00:00Z" })).rejects.toThrow();
  });

  it("cancels, proposes and reviews status through their own RPCs", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await cancelDeployment({ id: deploymentId, expectedUpdatedAt: "2026-09-25T00:00:00Z" });
    expect(rpc).toHaveBeenLastCalledWith("cancel_deployment", { target_deployment_id: deploymentId, expected_updated_at: "2026-09-25T00:00:00Z" });
    await proposeDeploymentStatus({ deploymentId, status: "completed" });
    expect(rpc).toHaveBeenLastCalledWith("propose_deployment_status", { target_deployment_id: deploymentId, target_status: "completed" });
    await expect(proposeDeploymentStatus({ deploymentId, status: "cancelled" })).rejects.toThrow();
    await reviewDeploymentStatus({ id: deploymentId, approve: false });
    expect(rpc).toHaveBeenLastCalledWith("review_deployment_status", { target_deployment_id: deploymentId, approve: false });
  });

  it("finds employees on approved leave overlapping the chosen dates", async () => {
    const calls: Array<[string, unknown[]]> = [];
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "lte", "gte"]) chain[method] = vi.fn((...args: unknown[]) => { calls.push([method, args]); return chain; });
    chain.then = (resolve: (value: unknown) => void) => resolve({ data: [{ employee_id: "e1" }, { employee_id: "e1" }, { employee_id: "e2" }], error: null });
    from.mockReturnValue(chain);
    await expect(listEmployeeIdsOnLeave({ startsOn: "2026-10-22", endsOn: "2026-10-25" })).resolves.toEqual(["e1", "e2"]);
    expect(from).toHaveBeenLastCalledWith("leave_requests");
    expect(calls).toEqual(expect.arrayContaining([["eq", ["status", "approved"]], ["lte", ["starts_on", "2026-10-25"]], ["gte", ["ends_on", "2026-10-22"]]]));
  });

  it("normalizes directory filters before requesting data", () => {
    expect(deploymentFilters({ page: "2", pageSize: "200", status: "ongoing" })).toEqual({ page: 2, pageSize: 100, status: "ongoing" });
  });

  it("lists every employee for the picker, capped at 2000, with full names and badge numbers", async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [{ id: "e1", employee_number: "PAT-001", first_name: "Ana", middle_name: "M", last_name: "Reyes", qualifier: "Jr.", rank: { code: "PCPL", sort_order: 2 }, department: { name: "Investigation" } }],
      error: null,
    });
    const order = vi.fn();
    const eq = vi.fn();
    const chain = { order, limit, eq };
    order.mockReturnValue(chain);
    eq.mockReturnValue(chain);
    const select = vi.fn(() => chain);
    from.mockReturnValue({ select });

    await expect(listEmployeeOptions()).resolves.toEqual([{ id: "e1", employeeNumber: "PAT-001", fullName: "Ana M Reyes Jr.", rank: "PCPL", rankSortOrder: 2, department: "Investigation" }]);
    expect(from).toHaveBeenCalledWith("employees");
    expect(limit).toHaveBeenCalledWith(EMPLOYEE_OPTIONS_LIMIT);
    expect(eq).toHaveBeenCalledWith("employment_status", "active");
    expect(EMPLOYEE_OPTIONS_LIMIT).toBe(2000);
  });

  it("filters the HR list by deployment type", async () => {
    const eq = vi.fn();
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "order", "range", "or", "lte"]) chain[method] = vi.fn(() => chain);
    chain.eq = vi.fn((...args: unknown[]) => { eq(...args); return chain; });
    chain.then = (resolve: (value: unknown) => void) => resolve({ data: [], error: null, count: 0 });
    from.mockReturnValue(chain);
    await listHrDeployments({ deploymentType: "Special Event" });
    expect(eq).toHaveBeenCalledWith("deployment_type", "Special Event");
  });

  it("searches every page on the server and can leave retired personnel out (HR dashboard)", async () => {
    const calls: Array<[string, unknown[]]> = [];
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "order", "range", "or", "lte", "eq", "ilike"]) chain[method] = vi.fn((...args: unknown[]) => { calls.push([method, args]); return chain; });
    chain.then = (resolve: (value: unknown) => void) => resolve({ data: [{ id: "d1", employee: { id: "e1", employee_number: "1-001", first_name: "Juan", middle_name: null, last_name: "Cruz", qualifier: null, rank: { code: "PAT" }, employment_status: "active" } }], error: null, count: 1 });
    from.mockReturnValue(chain);

    const result = await listHrDeployments({ search: " Juan  Cruz ", activeEmployeesOnly: true });

    expect(calls.filter(([method]) => method === "ilike").map(([, args]) => args)).toEqual([["search_text", "%juan%"], ["search_text", "%cruz%"]]);
    expect(calls).toContainEqual(["select", ["*, employee:employees!inner(id, employee_number, first_name, middle_name, last_name, qualifier, rank:ranks(code), employment_status)", { count: "exact" }]]);
    expect(calls).toContainEqual(["eq", ["employee.employment_status", "active"]]);
    expect(result.rows).toEqual([{ id: "d1", employee: { id: "e1", employee_number: "1-001", first_name: "Juan", middle_name: null, last_name: "Cruz", qualifier: null, rank: { code: "PAT" } } }]);
  });
});
