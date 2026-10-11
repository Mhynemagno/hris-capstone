import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ signOut: vi.fn(), replace: vi.fn(), refresh: vi.fn(), clear: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));
vi.mock("@/lib/supabase/client", () => ({ createBrowserSupabaseClient: () => ({ auth: { signOut: mocks.signOut } }) }));
vi.mock("@/lib/supabase/remember-me", () => ({ clearSessionOnlyCookie: mocks.clear }));

import { ApplicantAccountMenu } from "./applicant-account-menu";

describe("ApplicantAccountMenu", () => {
  it("shows the applicant and offers Profile and Logout", async () => {
    mocks.signOut.mockResolvedValue({ error: null });
    render(<ApplicantAccountMenu email="aldrick.jamlani@gmail.com" name="Aldrick Jamlani" />);
    const trigger = screen.getByRole("button", { name: "Account menu for Aldrick Jamlani" });
    expect(trigger).toHaveTextContent("AJ");
    expect(trigger).toHaveTextContent("aldrick.jamlani@gmail.com");
    await userEvent.click(trigger);
    expect(await screen.findByRole("menuitem", { name: "Profile" })).toHaveAttribute("href", "/applicant/profile");
    await userEvent.click(screen.getByRole("menuitem", { name: "Logout" }));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" }));
    expect(mocks.clear).toHaveBeenCalled();
    expect(mocks.replace).toHaveBeenCalledWith("/");
  });
});
