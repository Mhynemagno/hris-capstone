import { describe, expect, it } from "vitest";
import { leaveTypeStyle } from "./leave-type-style";

describe("leaveTypeStyle", () => {
  it("uses the leave.html icon, colour and footnote", () => {
    expect(leaveTypeStyle("Maternity Leave")).toMatchObject({ tone: "purple", footnote: "Full pay for female personnel." });
    expect(leaveTypeStyle("Sick Leave")).toMatchObject({ tone: "rose", footnote: "Requires medical certificate." });
    expect(leaveTypeStyle("Special Privilege Leave").tone).toBe("amber");
  });
  it("falls back for other leave types", () => {
    expect(leaveTypeStyle("Study Leave")).toMatchObject({ tone: "slate", footnote: "" });
  });
});
