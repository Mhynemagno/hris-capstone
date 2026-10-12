import { describe, expect, it } from "vitest";

import { matchesSearch, searchPattern, searchTerms } from "./search";

describe("search helpers", () => {
  it("splits typed text into lower-case words", () => {
    expect(searchTerms("  Juan   DELA cruz ")).toEqual(["juan", "dela", "cruz"]);
    expect(searchTerms("")).toEqual([]);
    expect(searchTerms(null)).toEqual([]);
  });

  it("matches a full name in any order across columns", () => {
    const values = ["Dela Cruz", "Juan", "PCPL-1234"];
    expect(matchesSearch("juan dela cruz", values)).toBe(true);
    expect(matchesSearch("cruz juan", values)).toBe(true);
    expect(matchesSearch("1234", values)).toBe(true);
    expect(matchesSearch("juan santos", values)).toBe(false);
    expect(matchesSearch("   ", values)).toBe(true);
  });

  it("neutralises PostgREST filter syntax and wildcards", () => {
    expect(searchPattern("Allen, (F)*%")).toBe("%Allen_ _F___%");
  });
});
