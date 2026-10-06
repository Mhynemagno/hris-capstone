import { describe, expect, it } from "vitest";

import { formatPhilHealthNumber, formatSssNumber } from "./government-ids";

describe("government ID formatting", () => {
  it("shows an SSS number as 12-3456789-0", () => {
    expect(formatSssNumber("3412345678")).toBe("34-1234567-8");
  });

  it("shows a PhilHealth number as 12-345678901-2", () => {
    expect(formatPhilHealthNumber("123456789012")).toBe("12-345678901-2");
  });

  it("leaves a missing number empty", () => {
    expect(formatSssNumber(null)).toBe("");
    expect(formatPhilHealthNumber(undefined)).toBe("");
  });
});
