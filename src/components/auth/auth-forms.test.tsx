import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForgotPasswordForm } from "./forgot-password-form";
import { LoginForm } from "./login-form";

const { resetPasswordForEmail } = vi.hoisted(
  () => ({
    resetPasswordForEmail: vi.fn(),
  }),
);

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({ auth: { resetPasswordForEmail } }),
}));

describe("authentication forms", () => {
  beforeEach(() => {
    resetPasswordForEmail.mockReset();
  });

  it("posts sign-in credentials to the secure login route", async () => {
    const user = userEvent.setup();
    render(<LoginForm nextPath="/hr" />);

    const form = screen.getByRole("button", { name: /sign in/i }).closest("form");
    expect(form).toHaveAttribute("action", "/auth/login");
    expect(form).toHaveAttribute("method", "post");
    expect(screen.getByDisplayValue("/hr")).toHaveAttribute("name", "next");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show password" }));

    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();
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
