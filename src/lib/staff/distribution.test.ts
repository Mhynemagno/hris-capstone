import { describe, expect, it } from "vitest";
import { distributionRows } from "./distribution";

describe("distributionRows", () => {
  it("adds percentages of the total and widths relative to the largest", () => {
    expect(distributionRows([{ label: "ARMS", count: 7 }, { label: "IDMS", count: 4 }, { label: "SDEU", count: 0 }])).toEqual([
      { label: "ARMS", count: 7, percent: "63.6%", width: 100 },
      { label: "IDMS", count: 4, percent: "36.4%", width: 57.14285714285714 },
      { label: "SDEU", count: 0, percent: "0.0%", width: 0 },
    ]);
  });
  it("handles an empty station", () => {
    expect(distributionRows([{ label: "ARMS", count: 0 }])).toEqual([{ label: "ARMS", count: 0, percent: "0.0%", width: 0 }]);
  });
});
