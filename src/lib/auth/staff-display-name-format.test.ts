import { describe, expect, it } from "vitest";
import { formatStaffDisplayName } from "./staff-display-name-format";

describe("formatStaffDisplayName", () => {
  it("writes the rank code, initials and last name", () => {
    expect(formatStaffDisplayName({ rankCode: "PMAJ", firstName: "Maria Cristina", middleName: "Baldoz", lastName: "Balneg" }, "x")).toBe("PMAJ M. C. Balneg");
  });
  it("uses the full name without a rank", () => {
    expect(formatStaffDisplayName({ rankCode: null, firstName: "Juan", middleName: null, lastName: "Dela Cruz" }, "x")).toBe("Juan Dela Cruz");
  });
  it("falls back when there is no linked employee", () => {
    expect(formatStaffDisplayName(null, "hr@example.test")).toBe("hr@example.test");
  });
});
