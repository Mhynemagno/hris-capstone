import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const { createServerSupabaseClient, exchangeCodeForSession, signOut, verifyOtp } = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  signOut: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient }));

describe("auth callback route", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset();
    signOut.mockReset();
    verifyOtp.mockReset();
    createServerSupabaseClient.mockResolvedValue({ auth: { exchangeCodeForSession, signOut, verifyOtp } });
  });

  it("preserves the PKCE verifier while exchanging a code and rejects an external redirect", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await GET(new NextRequest("http://localhost/auth/callback?code=abc&next=https://attacker.example"));
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(signOut).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  it("sends a callback without a code to the invitation recovery state", async () => {
    const response = await GET(new NextRequest("http://localhost/auth/callback"));

    expect(response.headers.get("location")).toBe(
      "http://localhost/login?error=invitation_expired",
    );
  });

  it("sends a rejected code exchange to the invitation recovery state", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("expired") });

    const response = await GET(
      new NextRequest("http://localhost/auth/callback?code=expired"),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost/login?error=invitation_expired",
    );
  });

  it("verifies an invitation token hash before redirecting to password setup", async () => {
    verifyOtp.mockResolvedValue({ error: null });

    const response = await GET(
      new NextRequest(
        "http://localhost/auth/callback?next=/reset-password&token_hash=invite-token&type=invite",
      ),
    );

    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "invite-token", type: "invite" });
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("http://localhost/reset-password");
  });
});
