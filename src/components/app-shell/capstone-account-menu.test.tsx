import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ signOut: vi.fn().mockResolvedValue({ error: null }), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));
vi.mock("@/lib/supabase/client", () => ({ createBrowserSupabaseClient: () => ({ auth: { signOut: mocks.signOut } }) }));
vi.mock("@/lib/supabase/remember-me", () => ({ clearSessionOnlyCookie: vi.fn() }));

import { accountInitials, CapstoneAccountMenu } from "./capstone-account-menu";

describe("CapstoneAccountMenu", () => {
  it("offers Logout only when there is no profile page", async () => {
    render(<CapstoneAccountMenu afterLogoutHref="/login?as=admin" ariaLabel="Account menu for hr@example.test" email="hr@example.test" name="PMAJ M. C. Balneg" onError={vi.fn()} tone="light" />);
    await userEvent.click(screen.getByRole("button", { name: "Account menu for hr@example.test" }));
    const logout = await screen.findByRole("menuitem", { name: "Logout" });
    expect(screen.queryByRole("menuitem", { name: /profile/i })).not.toBeInTheDocument();
    await userEvent.click(logout);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login?as=admin"));
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("reports a failed logout instead of leaving", async () => {
    const onError = vi.fn();
    mocks.signOut.mockResolvedValueOnce({ error: { message: "Network down" } });
    mocks.replace.mockClear();
    render(<CapstoneAccountMenu afterLogoutHref="/" ariaLabel="menu" email={null} name="Juan Dela Cruz" onError={onError} tone="light" />);
    await userEvent.click(screen.getByRole("button", { name: "menu" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Logout" }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith("Could not log out", "Network down"));
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("takes initials from the name, skipping a rank code", () => {
    expect(accountInitials("PMAJ M. C. Balneg")).toBe("MB");
    expect(accountInitials("Aldrick Jamlani")).toBe("AJ");
    expect(accountInitials("hr@example.test")).toBe("H");
  });
});
