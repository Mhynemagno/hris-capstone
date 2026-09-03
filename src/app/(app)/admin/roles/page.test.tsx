import { describe, expect, it, vi } from "vitest";

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock("next/navigation", () => ({ redirect }));

import RolesPage from "./page";

describe("RolesPage", () => {
  it("redirects legacy role-management links to account management", () => {
    RolesPage();

    expect(redirect).toHaveBeenCalledWith("/admin/users");
  });
});
