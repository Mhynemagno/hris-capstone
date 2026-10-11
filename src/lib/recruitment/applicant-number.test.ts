import { describe, expect, it } from "vitest";

import { formatApplicantNumber } from "./applicant-number";

describe("formatApplicantNumber", () => {
  it("formats like the database, without truncating the 100th number of a year", () => {
    expect(formatApplicantNumber(202601)).toBe("2-02601");
    expect(formatApplicantNumber(2026100)).toBe("2-026100");
    expect(formatApplicantNumber(12345)).toBe("0-12345");
    expect(formatApplicantNumber(null)).toBeNull();
  });
});
