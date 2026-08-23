import { describe, expect, it } from "vitest";

import { deploymentFilters } from "./deployment-tracking";

describe("deployment tracking queries", () => {
  it("normalizes directory filters before requesting data", () => {
    expect(deploymentFilters({ page: "2", pageSize: "200", status: "active" })).toEqual({ page: 2, pageSize: 100, status: "active" });
  });
});
