import { describe, expect, it } from "vitest";

import { reportingFilters } from "./reporting";

describe("reporting queries", () => {
  it("validates report filters before requesting protected data", () => {
    expect(reportingFilters({ reportKey: "deployments", page: "2", pageSize: "25" })).toMatchObject({ reportKey: "deployments", page: 2, pageSize: 25 });
  });
});
