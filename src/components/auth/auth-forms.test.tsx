import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForgotPasswordForm } from "./forgot-password-form";
import { LoginForm } from "./login-form";

const { replace, refresh, signInWithPassword, resetPasswordForEmail } = vi.hoisted(
  () => ({
    replace: vi.fn(),
    refresh: vi.fn(),
    signInWithPassword: vi.fn(),
    resetPasswordForEmail: vi.fn(),
  }),
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    auth: { signInWithPassword, resetPasswordForEmail },
  }),
}));

describe("authentication forms", () => {
  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
    signInWithPassword.mockReset();
    resetPasswordForEmail.mockReset();
  });

  it("shows validation feedback before submitting invalid login data", async () => {
    const user = userEvent.setup();
    render(<LoginForm nextPath="/hr" />);

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid email/i);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("signs in and redirects to the requested safe path", async () => {
    const user = userEvent.setup();
    signInWithPassword.mockResolvedValue({ error: null });
    render(<LoginForm nextPath="/hr" />);

    await user.type(screen.getByLabelText(/email/i), "person@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "secret1");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "person@example.com",
      password: "secret1",
    });
    expect(replace).toHaveBeenCalledWith("/hr");
  });

  it("keeps password recovery confirmation neutral", async () => {
    const user = userEvent.setup();
    resetPasswordForEmail.mockResolvedValue({ error: null });
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email/i), "person@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
  });
});
