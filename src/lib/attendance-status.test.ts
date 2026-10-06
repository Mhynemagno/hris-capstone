import { describe, expect, it } from "vitest";

import { attendanceStatusLabel } from "./attendance-status";

describe("attendanceStatusLabel", () => {
  it.each([
    ["present", "Present"],
    ["late", "Late"],
    ["absent", "Absent"],
    ["incomplete", "Partial"],
  ])("shows %s as %s", (status, label) => {
    expect(attendanceStatusLabel(status)).toBe(label);
  });

  it("title-cases a status it does not know", () => {
    expect(attendanceStatusLabel("on_leave")).toBe("On leave");
  });
});
