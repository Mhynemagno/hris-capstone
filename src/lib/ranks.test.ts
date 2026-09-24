import { describe, expect, it } from "vitest";

import { rankLabel } from "./ranks";

describe("rankLabel", () => {
  it("formats a rank as code — name", () => {
    expect(rankLabel({ code: "Pat", name: "Patrolman / Patrolwoman" })).toBe("Pat — Patrolman / Patrolwoman");
  });
});
