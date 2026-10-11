import { describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/client", () => ({ createBrowserSupabaseClient: () => ({ rpc }) }));

import { getFullReport, reportingFilters } from "./reporting";

describe("reporting queries", () => {
  it("validates report filters before requesting protected data", () => {
    expect(reportingFilters({ reportKey: "deployments", page: "2", pageSize: "25" })).toMatchObject({ reportKey: "deployments", page: 2, pageSize: 25 });
  });

  it("fetches every page of a report for export, 100 rows at a time", async () => {
    const page = (number: number, count: number) => ({
      reportKey: "deployments", title: "Deployments", generatedAt: "2026-10-11T00:00:00.000Z",
      columns: [{ key: "employee", label: "Employee" }],
      rows: Array.from({ length: count }, (_, index) => ({ employee: `E${(number - 1) * 100 + index + 1}` })),
      totalCount: 230, page: number, pageSize: 100,
    });
    rpc.mockImplementation((_name: string, args: { target_page: number }) => Promise.resolve({ data: page(args.target_page, args.target_page < 3 ? 100 : 30), error: null }));
    const full = await getFullReport({ reportKey: "deployments", status: "ongoing" }, "management");
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(rpc).toHaveBeenCalledWith("get_management_report", expect.objectContaining({ target_page: 3, target_page_size: 100, target_status: "ongoing" }));
    expect(full.rows).toHaveLength(230);
    expect(full.rows.at(-1)).toEqual({ employee: "E230" });
  });
});
