import { describe, expect, it } from "vitest";

import { formatGovernmentId, formatPhilHealthNumber, formatSssNumber, GOVERNMENT_ID_FORMATS } from "./government-ids";

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

describe("formatGovernmentId", () => {
  it("formats each ID with the client's dashes while typing", () => {
    expect(formatGovernmentId("philhealth", "123456789012")).toBe("12-345678901-2");
    expect(formatGovernmentId("philhealth", "123")).toBe("12-3");
    expect(formatGovernmentId("pagibig", "123456789012")).toBe("1234-5678-9012");
    expect(formatGovernmentId("gsis", "12345678901")).toBe("12345678901");
  });

  it("drops non-digits and anything past the allowed length", () => {
    expect(formatGovernmentId("pagibig", "1234-5678-9012-999")).toBe("1234-5678-9012");
    expect(formatGovernmentId("gsis", "12 345 678 901 23")).toBe("12345678901");
    expect(formatGovernmentId("philhealth", null)).toBe("");
  });

  it("publishes the placeholders shown inside each box", () => {
    expect(GOVERNMENT_ID_FORMATS.philhealth.placeholder).toBe("12-345678901-2");
    expect(GOVERNMENT_ID_FORMATS.pagibig.placeholder).toBe("XXXX-XXXX-XXXX");
    expect(GOVERNMENT_ID_FORMATS.gsis.placeholder).toBe("XXXXXXXXXXX");
  });
});
