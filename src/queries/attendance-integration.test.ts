import { describe, expect, it, vi } from "vitest";

const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createBrowserSupabaseClient: () => ({ from }) }));

import { attendanceFilters, listHrAttendanceLogs } from "./attendance-integration";

describe("attendance integration queries", () => {
  it("validates filters before requesting protected attendance data", () => {
    expect(attendanceFilters({ page: "2", pageSize: "25", status: "late" })).toEqual({ page: 2, pageSize: 25, status: "late" });
  });

  it("searches every page on the server, one word at a time, with a stable order", async () => {
    const calls: Array<[string, unknown[]]> = [];
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "order", "range", "eq", "in", "gte", "lte", "ilike"]) chain[method] = vi.fn((...args: unknown[]) => { calls.push([method, args]); return chain; });
    chain.then = (resolve: (value: unknown) => void) => resolve({ data: [], error: null, count: 0 });
    from.mockReturnValue(chain);

    await listHrAttendanceLogs({ search: "dela cruz, juan", status: "late" });

    expect(calls.filter(([method]) => method === "ilike").map(([, args]) => args)).toEqual([["search_text", "%dela%"], ["search_text", "%cruz_%"], ["search_text", "%juan%"]]);
    expect(calls.filter(([method]) => method === "order").map(([, args]) => args[0])).toEqual(["attendance_date", "time_in", "id"]);
    expect(calls).toContainEqual(["eq", ["status", "late"]]);
  });
});
