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
});
