import { describe, expect, it } from "vitest";

import { leaveRequestFilters } from "./leave-management";

describe("leave management queries", () => {
  it("normalizes HR queue filters before a request is made", () => {
    expect(leaveRequestFilters({ page: "2", pageSize: "200", search: "  leave  " })).toEqual({
      page: 2,
      pageSize: 100,
      search: "leave",
    });
  });
});
