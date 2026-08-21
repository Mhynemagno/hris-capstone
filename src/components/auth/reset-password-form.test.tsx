import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    auth: { getSession: mocks.getSession, updateUser: mocks.updateUser },
  }),
}));

import { ResetPasswordForm } from "./reset-password-form";

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    mocks.getSession.mockReset();
    mocks.refresh.mockReset();
    mocks.replace.mockReset();
    mocks.updateUser.mockReset();
  });

  it("initializes the browser session from a default invitation redirect", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "invite-token" } }, error: null });

    render(<ResetPasswordForm />);

    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Update password" })).toBeEnabled();
  });
});
