import { beforeEach, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ table: "", filters: [] as Array<[string, string, unknown]>, result: { count: 4, error: null as { message: string } | null } }));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    from: (table: string) => {
      calls.table = table;
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => { calls.filters.push(["eq", column, value]); return builder; },
        is: (column: string, value: unknown) => { calls.filters.push(["is", column, value]); return builder; },
        then: (resolve: (value: unknown) => unknown) => resolve(calls.result),
      };
      return builder;
    },
  }),
}));

import { getWorkspaceCount } from "./workspace-counts";

beforeEach(() => { calls.filters = []; calls.result = { count: 4, error: null }; });

it.each([
  ["applicationsAwaitingReview", "applications", ["eq", "status", "Application Submission"]],
  ["leaveForApproval", "leave_requests", ["eq", "status", "pending"]],
  ["profileChangesPending", "profile_change_requests", ["eq", "status", "pending"]],
  ["unmatchedAttendance", "attendance_unmatched_events", ["is", "resolved_at", null]],
] as const)("counts %s from %s", async (key, table, filter) => {
  await expect(getWorkspaceCount(key)).resolves.toBe(4);
  expect(calls.table).toBe(table);
  expect(calls.filters).toContainEqual(filter);
});

it("throws when the count query fails", async () => {
  calls.result = { count: 0, error: { message: "denied" } };
  await expect(getWorkspaceCount("leaveForApproval")).rejects.toThrow("denied");
});
