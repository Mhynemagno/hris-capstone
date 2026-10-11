import { describe, expect, it } from "vitest";
import { rankCategory, rankRowLabel } from "./rank-category";

describe("rank categories", () => {
  it("classifies commissioned, non-commissioned and civilian", () => {
    expect(rankCategory("PMAJ")).toBe("Commissioned Officer (PCO)");
    expect(rankCategory("PSSG")).toBe("Non-Commissioned (PNCO)");
    expect(rankCategory(null)).toBe("Civilian Staff");
  });
  it("labels rows as in dashboard.html", () => {
    expect(rankRowLabel("PMAJ", "Police Major")).toBe("Police Major (PMAJ)");
    expect(rankRowLabel(null, null)).toBe("Non-Uniformed Personnel (NUP)");
  });
});
