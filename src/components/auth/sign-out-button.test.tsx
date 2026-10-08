import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({ auth: { signOut: mocks.signOut } }),
}));

import { SignOutButton } from "./sign-out-button";

describe("SignOutButton", () => {
  it("keeps a visible, named sign-out action in the sidebar", () => {
    render(<SignOutButton />);

    const button = screen.getByRole("button", { name: "Sign out" });
    expect(button).toHaveTextContent("Sign out");
    expect(button.querySelector("svg")).toBeInTheDocument();
    expect(button).toHaveClass("text-sidebar-foreground");
  });

  it("returns to the public landing page after a successful local sign-out", async () => {
    mocks.signOut.mockResolvedValueOnce({ error: null });
    const user = userEvent.setup();
    render(<SignOutButton />);

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/"));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});
