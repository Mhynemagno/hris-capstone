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

  it("preserves the shared notifications destination for every authenticated role", async () => {
    const response = await GET(new NextRequest("http://localhost/auth/continue?next=/notifications?page=2"));
    expect(response.headers.get("location")).toBe("http://localhost/notifications?page=2");
  });

  it("preserves reports for roles that can access reporting", async () => {
    getCurrentRole.mockResolvedValue("hr_personnel");
    const response = await GET(new NextRequest("http://localhost/auth/continue?next=/reports/workforce-summary"));
    expect(response.headers.get("location")).toBe("http://localhost/reports/workforce-summary");
  });

  it("preserves public job destinations for applicants", async () => {
    getCurrentRole.mockResolvedValue("applicant");
    const response = await GET(new NextRequest("http://localhost/auth/continue?next=/jobs/42"));
    expect(response.headers.get("location")).toBe("http://localhost/jobs/42");
  });
});
