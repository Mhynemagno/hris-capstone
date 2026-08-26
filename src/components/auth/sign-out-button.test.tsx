import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({ auth: { signOut: vi.fn() } }),
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
});
