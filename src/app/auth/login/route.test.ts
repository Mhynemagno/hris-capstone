import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const { createServerSupabaseClient, signInWithPassword } = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  signInWithPassword: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient }));

const { serviceRpc } = vi.hoisted(() => ({ serviceRpc: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc: serviceRpc }) }));
vi.mock("@/lib/supabase/env", () => ({ getPublicSupabaseConfig: () => ({ url: "http://localhost:54321", publishableKey: "publishable" }) }));

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

describe("Employee / HR login for HR and System Administrators", () => {
  function clientWithRole(role: string | null) {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((table: string) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue(table === "profiles" ? { data: { is_active: true }, error: null } : { data: role ? { role } : null, error: null }),
        }),
      }),
    }));
    createServerSupabaseClient.mockResolvedValue({ auth: { signInWithPassword, signOut }, from });
    return { signOut };
  }

  beforeEach(() => {
    signInWithPassword.mockReset();
    serviceRpc.mockReset();
    signInWithPassword.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
  });
  afterEach(() => vi.unstubAllEnvs());

  for (const [role, badge, email, next] of [["hr_personnel", "0-00002", "hr@example.test", "/hr"], ["system_administrator", "0-00004", "admin@example.test", "/admin"]] as const) {
    it(`signs ${role} in with their badge number, looked up server-side`, async () => {
      serviceRpc.mockResolvedValue({ data: email, error: null });
      clientWithRole(role);
      const response = await POST(loginRequest({ as: "employee", identifier: ` ${badge} `, password: "secret1", next }));
      expect(serviceRpc).toHaveBeenCalledWith("resolve_login_identifier", { target_mode: "employee", target_identifier: badge });
      expect(signInWithPassword).toHaveBeenCalledWith({ email, password: "secret1" });
      expect(response.headers.get("location")).toBe(`http://localhost/auth/continue?next=${encodeURIComponent(next)}`);
    });
  }

  it("still signs in an account without a badge by email, without a lookup", async () => {
    clientWithRole("hr_personnel");
    const response = await POST(loginRequest({ as: "employee", identifier: "HR@Example.test", password: "secret1" }));
    expect(serviceRpc).not.toHaveBeenCalled();
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "hr@example.test", password: "secret1" });
    expect(response.headers.get("location")).toBe("http://localhost/auth/continue?next=%2F");
  });

  it("treats a post from the old Admin & HR Login as the Employee / HR login", async () => {
    serviceRpc.mockResolvedValue({ data: null, error: null });
    const response = await POST(loginRequest({ as: "admin", access_level: "sysad", identifier: "9-99999", password: "secret1" }));
    expect(response.headers.get("location")).toBe("http://localhost/login?as=employee&error=invalid_credentials");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});
