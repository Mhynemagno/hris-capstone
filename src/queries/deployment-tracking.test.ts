import { describe, expect, it, vi } from "vitest";

const from = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({ from, rpc }),
}));

import { createDeployment, deploymentFilters, EMPLOYEE_OPTIONS_LIMIT, listEmployeeOptions, updateDeployment } from "./deployment-tracking";

const deployment = { employeeId: "3f1e2d3c-4b5a-4968-8776-655443322110", location: "San Juan", unit: "", project: "", assignmentRole: "Patrol", startsOn: "2026-09-25", status: "active", notes: "" };

describe("deployment tracking queries", () => {
  it("creates with the employee and updates without it, matching the database functions", async () => {
    rpc.mockResolvedValue({ data: "d1", error: null });
    await createDeployment(deployment);
    expect(rpc).toHaveBeenLastCalledWith("create_deployment", expect.objectContaining({ target_employee_id: deployment.employeeId, target_unit: null }));

    await updateDeployment({ ...deployment, id: "7c1e2d3c-4b5a-4968-8776-655443322110", expectedUpdatedAt: "2026-09-25T00:00:00Z" });
    const [name, args] = rpc.mock.lastCall as [string, Record<string, unknown>];
    expect(name).toBe("update_deployment");
    expect(args).not.toHaveProperty("target_employee_id");
    expect(args).toMatchObject({ target_deployment_id: "7c1e2d3c-4b5a-4968-8776-655443322110", target_project: null });
  });

  it("normalizes directory filters before requesting data", () => {
    expect(deploymentFilters({ page: "2", pageSize: "200", status: "active" })).toEqual({ page: 2, pageSize: 100, status: "active" });
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
});
