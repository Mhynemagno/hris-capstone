import { describe, expect, it } from "vitest";

import { getSafeNextPath } from "./safe-redirect";

describe("getSafeNextPath", () => {
  it("keeps a local path and its query string", () => {
    expect(getSafeNextPath("/hr?tab=people")).toBe("/hr?tab=people");
  });

  it("falls back for external and protocol-relative URLs", () => {
    expect(getSafeNextPath("https://attacker.example")).toBe("/");
    expect(getSafeNextPath("//attacker.example")).toBe("/");
  });
});
