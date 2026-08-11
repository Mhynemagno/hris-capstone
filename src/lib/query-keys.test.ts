import { describe, expect, it } from "vitest";

import { queryKeys } from "./query-keys";

describe("queryKeys", () => {
  it("namespaces a role landing key with its role", () => {
    expect(queryKeys.roleLanding("management")).toEqual([
      "role-landing",
      "management",
    ]);
  });

  it("provides a stable key for app shell concerns", () => {
    expect(queryKeys.appShell()).toEqual(["app-shell"]);
  });
});
