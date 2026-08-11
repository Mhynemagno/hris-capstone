import { describe, expect, it } from "vitest";

import { getRoleHome } from "./role-home";

describe("getRoleHome", () => {
  it("maps every application role to its protected home", () => {
    expect(getRoleHome("system_administrator")).toBe("/admin");
    expect(getRoleHome("hr_personnel")).toBe("/hr");
    expect(getRoleHome("applicant")).toBe("/applicant");
    expect(getRoleHome("employee")).toBe("/employee");
    expect(getRoleHome("management")).toBe("/management");
  });
});
