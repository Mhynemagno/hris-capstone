import { describe, expect, it, vi } from "vitest";

const from = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({ from }),
}));

import { deploymentFilters, EMPLOYEE_OPTIONS_LIMIT, listEmployeeOptions } from "./deployment-tracking";

describe("deployment tracking queries", () => {
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
