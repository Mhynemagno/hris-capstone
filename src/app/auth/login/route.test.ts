import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const { createServerSupabaseClient, signInWithPassword } = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  signInWithPassword: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient }));

const cookieStore = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn(), getAll: vi.fn(() => []) }));
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));

function loginRequest(fields: Record<string, string>) {
  return new NextRequest("http://localhost/auth/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });
}

describe("password login route", () => {
  beforeEach(() => {
    signInWithPassword.mockReset();
    createServerSupabaseClient.mockResolvedValue({ auth: { signInWithPassword } });
  });

  it("redirects a successful POST login to the requested safe path", async () => {
    signInWithPassword.mockResolvedValue({ error: null });

    const response = await POST(loginRequest({
      email: "person@example.com",
      password: "secret1",
      next: "/hr",
    }));

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "person@example.com",
      password: "secret1",
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost/auth/continue?next=%2Fhr",
    );
  });

  it("redirects an unsuccessful login without including credentials in the URL", async () => {
    signInWithPassword.mockResolvedValue({ error: new Error("Invalid login credentials") });

    const response = await POST(loginRequest({
      email: "person@example.com",
      password: "secret1",
      next: "/hr",
    }));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost/login?next=%2Fhr&error=invalid_credentials",
    );
  });

  it("returns a failed attempt to the login page the visitor chose", async () => {
    signInWithPassword.mockResolvedValue({ error: new Error("Invalid login credentials") });

    const response = await POST(loginRequest({ as: "employee", email: "person@example.com", password: "secret1" }));

    expect(response.headers.get("location")).toBe("http://localhost/login?as=employee&error=invalid_credentials");
  });

  it("tells a person whose account was blocked from signing in", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: null }, error: Object.assign(new Error("User is banned"), { code: "user_banned" }) });

    const response = await POST(loginRequest({ email: "person@example.com", password: "secret1" }));

    expect(response.headers.get("location")).toBe("http://localhost/login?error=account_disabled");
  });

  it("signs a disabled account straight back out", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const maybeSingle = vi.fn().mockResolvedValue({ data: { is_active: false }, error: null });
    createServerSupabaseClient.mockResolvedValue({
      auth: { signInWithPassword, signOut },
      from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }) }),
    });
    signInWithPassword.mockResolvedValue({ data: { user: { id: "00000000-0000-4000-8000-000000000001" } }, error: null });

    const response = await POST(loginRequest({ email: "person@example.com", password: "secret1", next: "/applicant" }));

    expect(signOut).toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("http://localhost/login?next=%2Fapplicant&error=account_disabled");
  });

  describe("applicant email login", () => {
    function activeAccountClient() {
      const maybeSingle = vi.fn().mockResolvedValue({ data: { is_active: true }, error: null });
      createServerSupabaseClient.mockResolvedValue({
        auth: { signInWithPassword },
        from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }) }),
      });
    }

    beforeEach(() => {
      cookieStore.set.mockReset();
      cookieStore.delete.mockReset();
      activeAccountClient();
    });

    it("signs an applicant in with their email address and remembers the device", async () => {
      signInWithPassword.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      const response = await POST(loginRequest({ as: "applicant", identifier: "Juan.Delacruz@Email.com ", password: "secret1", remember: "on", next: "/applicant" }));
      expect(signInWithPassword).toHaveBeenCalledWith({ email: "juan.delacruz@email.com", password: "secret1" });
      expect(response.headers.get("location")).toContain("/auth/continue");
      expect(cookieStore.delete).toHaveBeenCalledWith("hris-session-only");
    });

    it("marks the session as browser-only before signing in when Remember me is unticked", async () => {
      signInWithPassword.mockImplementation(async () => {
        // The preference must already be in place when Supabase writes its session cookies.
        expect(cookieStore.set).toHaveBeenCalledWith("hris-session-only", "1", expect.objectContaining({ path: "/" }));
        return { data: { user: { id: "u1" } }, error: null };
      });
      await POST(loginRequest({ as: "applicant", identifier: "juan@email.com", password: "secret1" }));
      expect(signInWithPassword).toHaveBeenCalled();
    });

    it("rejects an applicant identifier that is neither an email nor an applicant number", async () => {
      const response = await POST(loginRequest({ as: "applicant", identifier: "juan", password: "secret1" }));
      expect(response.headers.get("location")).toContain("error=invalid_credentials");
      expect(signInWithPassword).not.toHaveBeenCalled();
    });
  });
});
