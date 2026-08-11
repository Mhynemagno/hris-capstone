import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const { getAuthenticatedUser, getCurrentRole } = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  getCurrentRole: vi.fn(),
}));

vi.mock("@/lib/auth/current-user", () => ({ getAuthenticatedUser }));
vi.mock("@/lib/auth/current-role", () => ({ getCurrentRole }));

describe("post-login continuation", () => {
  beforeEach(() => {
    getAuthenticatedUser.mockResolvedValue({ id: "user-id", email: "admin@example.com" });
    getCurrentRole.mockResolvedValue("system_administrator");
  });

  it("sends an administrator to the administration workspace", async () => {
    const response = await GET(new NextRequest("http://localhost/auth/continue"));
    expect(response.headers.get("location")).toBe("http://localhost/admin");
  });

  it("keeps only a same-role next path", async () => {
    const response = await GET(new NextRequest("http://localhost/auth/continue?next=/admin/users"));
    expect(response.headers.get("location")).toBe("http://localhost/admin/users");
  });

  it("rejects a cross-role next path", async () => {
    const response = await GET(new NextRequest("http://localhost/auth/continue?next=/hr"));
    expect(response.headers.get("location")).toBe("http://localhost/admin");
  });
});
