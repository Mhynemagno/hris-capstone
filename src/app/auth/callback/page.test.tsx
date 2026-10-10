import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  getSession: vi.fn(),
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
  verifyOtp: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => mocks.searchParams,
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      getSession: mocks.getSession,
      verifyOtp: mocks.verifyOtp,
    },
  }),
}));

import AuthCallbackPage from "./page";

describe("AuthCallbackPage", () => {
  beforeEach(() => {
    mocks.exchangeCodeForSession.mockReset();
    mocks.getSession.mockReset();
    mocks.replace.mockReset();
    mocks.verifyOtp.mockReset();
    mocks.searchParams = new URLSearchParams();
  });

  it("exchanges a PKCE code before redirecting to a safe destination", async () => {
    mocks.searchParams = new URLSearchParams("code=auth-code&next=https://attacker.example");
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });

    render(<AuthCallbackPage />);

    await waitFor(() => expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("auth-code"));
    expect(mocks.replace).toHaveBeenCalledWith("/");
  });

  it("accepts the default invitation session from the browser URL fragment", async () => {
    mocks.searchParams = new URLSearchParams("next=/reset-password");
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "invite-token" } }, error: null });

    render(<AuthCallbackPage />);

    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    expect(mocks.replace).toHaveBeenCalledWith("/reset-password");
  });

  it("verifies a token-hash invitation before opening password setup", async () => {
    mocks.searchParams = new URLSearchParams("token_hash=invite-token&type=invite&next=/reset-password");
    mocks.verifyOtp.mockResolvedValue({ error: null });

    render(<AuthCallbackPage />);

    await waitFor(() => expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: "invite-token", type: "invite" }));
    expect(mocks.replace).toHaveBeenCalledWith("/reset-password");
  });
  it("verifies a sign-up token hash", async () => {
    mocks.searchParams = new URLSearchParams("token_hash=signup-token&type=signup&next=/jobs");
    mocks.verifyOtp.mockResolvedValue({ error: null });
    render(<AuthCallbackPage />);
    await waitFor(() => expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: "signup-token", type: "signup" }));
    expect(mocks.replace).toHaveBeenCalledWith("/jobs");
  });

  it("shows the invalid-link error straight away when Supabase reports an expired link", async () => {
    mocks.searchParams = new URLSearchParams("error=access_denied&error_code=otp_expired&flow=signup&next=/jobs");
    render(<AuthCallbackPage />);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login?as=applicant&error=invitation_expired"));
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("tells a new applicant their email is confirmed when the code cannot be exchanged in this browser", async () => {
    mocks.searchParams = new URLSearchParams("code=auth-code&flow=signup&next=/jobs");
    mocks.exchangeCodeForSession.mockResolvedValue({ error: new Error("code verifier missing") });
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    render(<AuthCallbackPage />);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login?as=applicant&message=email_confirmed"));
  });

  it("keeps the invalid-link error for a failed non-sign-up code", async () => {
    mocks.searchParams = new URLSearchParams("code=auth-code&next=/reset-password");
    mocks.exchangeCodeForSession.mockResolvedValue({ error: new Error("bad code") });
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    render(<AuthCallbackPage />);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login?as=employee&error=invitation_expired"));
  });

  it("continues when the exchange fails but this browser is already signed in", async () => {
    mocks.searchParams = new URLSearchParams("code=used-code&flow=signup&next=/jobs");
    mocks.exchangeCodeForSession.mockResolvedValue({ error: new Error("already used") });
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });
    render(<AuthCallbackPage />);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/jobs"));
  });
});
