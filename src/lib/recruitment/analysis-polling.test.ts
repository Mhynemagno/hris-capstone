import { describe, expect, it } from "vitest";

import { ANALYSIS_POLL_MS, analysisRefetchInterval } from "./analysis-polling";

describe("analysisRefetchInterval", () => {
  it("polls while any analysis is queued or processing", () => {
    expect(analysisRefetchInterval(["queued"])).toBe(ANALYSIS_POLL_MS);
    expect(analysisRefetchInterval(["completed", "processing"])).toBe(ANALYSIS_POLL_MS);
    expect(ANALYSIS_POLL_MS).toBe(5000);
  });

  it("stops polling once every analysis has settled", () => {
    expect(analysisRefetchInterval(["completed"])).toBe(false);
    expect(analysisRefetchInterval(["failed", "unscored"])).toBe(false);
    expect(analysisRefetchInterval([undefined, null])).toBe(false);
    expect(analysisRefetchInterval([])).toBe(false);
  });
});
