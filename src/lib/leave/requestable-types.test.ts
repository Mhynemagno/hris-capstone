import { describe, expect, it } from "vitest";

import { requestableLeaveTypes } from "./requestable-types";

const types = [
  { name: "Sick Leave", is_active: true, eligible_gender: null },
  { name: "Maternity Leave", is_active: true, eligible_gender: "female" },
  { name: "Paternity Leave", is_active: true, eligible_gender: "male" },
  { name: "Vacation Leave", is_active: false, eligible_gender: null },
] as const;

const names = (list: readonly { name: string }[]) => list.map((type) => type.name);

describe("requestableLeaveTypes", () => {
  it("offers Maternity only to female employees", () => {
    expect(names(requestableLeaveTypes(types, "female"))).toEqual(["Sick Leave", "Maternity Leave"]);
  });

  it("offers Paternity only to male employees", () => {
    expect(names(requestableLeaveTypes(types, "male"))).toEqual(["Sick Leave", "Paternity Leave"]);
  });

  it("hides gender-specific types until a gender is recorded", () => {
    expect(names(requestableLeaveTypes(types, null))).toEqual(["Sick Leave"]);
    expect(names(requestableLeaveTypes(types, undefined))).toEqual(["Sick Leave"]);
  });
});
