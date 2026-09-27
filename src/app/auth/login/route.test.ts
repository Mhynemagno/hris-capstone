import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const { createServerSupabaseClient, signInWithPassword } = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  signInWithPassword: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient }));

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
});
