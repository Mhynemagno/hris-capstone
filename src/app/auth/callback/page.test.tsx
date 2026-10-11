import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

  afterEach(() => {
    window.location.hash = "";
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

  it("tells a new applicant their email may already be confirmed when Supabase reports a used or expired link", async () => {
    mocks.searchParams = new URLSearchParams("error=access_denied&error_code=otp_expired&flow=signup&next=/jobs");
    render(<AuthCallbackPage />);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login?as=applicant&message=email_confirmed_or_used"));
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("reads an expired sign-up link reported in the URL hash", async () => {
    window.location.hash = "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";
    mocks.searchParams = new URLSearchParams("flow=signup");
    render(<AuthCallbackPage />);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login?as=applicant&message=email_confirmed_or_used"));
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it("verifies the confirmation email's token_hash link and opens the applicant portal", async () => {
    mocks.searchParams = new URLSearchParams("token_hash=abc&type=email&flow=signup");
    mocks.verifyOtp.mockResolvedValue({ error: null });
    render(<AuthCallbackPage />);
    await waitFor(() => expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: "abc", type: "email" }));
    expect(mocks.replace).toHaveBeenCalledWith("/applicant");
  });

  it("keeps invitation errors as invitation_expired", async () => {
    mocks.searchParams = new URLSearchParams("error_code=otp_expired");
    render(<AuthCallbackPage />);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login?as=employee&error=invitation_expired"));
  });

  it("tells a new applicant their email may already be confirmed when the code cannot be exchanged in this browser", async () => {
    mocks.searchParams = new URLSearchParams("code=auth-code&flow=signup&next=/jobs");
    mocks.exchangeCodeForSession.mockResolvedValue({ error: new Error("code verifier missing") });
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    render(<AuthCallbackPage />);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login?as=applicant&message=email_confirmed_or_used"));
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
