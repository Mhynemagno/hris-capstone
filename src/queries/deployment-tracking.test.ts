import { describe, expect, it, vi } from "vitest";

const from = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({ from, rpc }),
}));

import { createDeployment, deploymentFilters, EMPLOYEE_OPTIONS_LIMIT, listEmployeeOptions, listHrDeployments, updateDeployment } from "./deployment-tracking";

const deployment = { employeeId: "3f1e2d3c-4b5a-4968-8776-655443322110", location: "San Juan", unit: "", startsOn: "2026-09-25", status: "ongoing", deploymentType: "Public Assembly", eventOperation: "Rally", notes: "Relief duty" };

describe("deployment tracking queries", () => {
  it("creates with the employee and updates without it, matching the database functions", async () => {
    rpc.mockResolvedValue({ data: "d1", error: null });
    await createDeployment(deployment);
    expect(rpc).toHaveBeenLastCalledWith("create_deployment", expect.objectContaining({ target_employee_id: deployment.employeeId, target_unit: null, target_location: "San Juan", target_assignment_role: "San Juan", target_project: null, target_notes: "Relief duty", target_status: "ongoing", target_deployment_type: "Public Assembly", target_event_operation: "Rally" }));

    await updateDeployment({ ...deployment, id: "7c1e2d3c-4b5a-4968-8776-655443322110", expectedUpdatedAt: "2026-09-25T00:00:00Z" });
    const [name, args] = rpc.mock.lastCall as [string, Record<string, unknown>];
    expect(name).toBe("update_deployment");
    expect(args).not.toHaveProperty("target_employee_id");
    expect(args).toMatchObject({ target_deployment_id: "7c1e2d3c-4b5a-4968-8776-655443322110", target_project: null });
  });

  it("normalizes directory filters before requesting data", () => {
    expect(deploymentFilters({ page: "2", pageSize: "200", status: "ongoing" })).toEqual({ page: 2, pageSize: 100, status: "ongoing" });
  });

  it("lists every employee for the picker, capped at 2000, with full names and badge numbers", async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [{ id: "e1", employee_number: "PAT-001", first_name: "Ana", middle_name: "M", last_name: "Reyes", qualifier: "Jr." }],
      error: null,
    });
    const order = vi.fn();
    const chain = { order, limit };
    order.mockReturnValue(chain);
    const select = vi.fn(() => chain);
    from.mockReturnValue({ select });

    await expect(listEmployeeOptions()).resolves.toEqual([{ id: "e1", employeeNumber: "PAT-001", fullName: "Ana M Reyes Jr." }]);
    expect(from).toHaveBeenCalledWith("employees");
    expect(limit).toHaveBeenCalledWith(EMPLOYEE_OPTIONS_LIMIT);
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
    chain.then = (resolve: (value: unknown) => void) => resolve({ data: [{ id: "d1", active_employee: { employment_status: "active" } }], error: null, count: 1 });
    from.mockReturnValue(chain);

    const result = await listHrDeployments({ search: " Juan  Cruz ", activeEmployeesOnly: true });

    expect(calls.filter(([method]) => method === "ilike").map(([, args]) => args)).toEqual([["search_text", "%juan%"], ["search_text", "%cruz%"]]);
    expect(calls).toContainEqual(["select", ["*, active_employee:employees!inner(employment_status)", { count: "exact" }]]);
    expect(calls).toContainEqual(["eq", ["active_employee.employment_status", "active"]]);
    expect(result.rows).toEqual([{ id: "d1" }]);
  });
});
