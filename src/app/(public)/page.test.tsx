import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import Home from "./page";

const { getAuthenticatedUser, getCurrentRole, redirect } = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  getCurrentRole: vi.fn(),
  redirect: vi.fn((destination: string) => {
    throw new Error(destination);
  }),
}));

vi.mock("@/lib/auth/current-user", () => ({ getAuthenticatedUser }));
vi.mock("@/lib/auth/current-role", () => ({ getCurrentRole }));
vi.mock("next/navigation", () => ({ redirect }));

describe("Home", () => {
  beforeEach(() => {
    getAuthenticatedUser.mockReset();
    getCurrentRole.mockReset();
    redirect.mockClear();
  });

  it("offers the LOGIN role picker for personnel and applicants, without a Careers button", async () => {
    getAuthenticatedUser.mockResolvedValue(null);
    render(await Home());

    expect(screen.getByRole("tab", { name: "Recruitment Openings" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "LOGIN" }));
    const dialog = await screen.findByRole("dialog", { name: "Select User Role" });
    expect(within(dialog).getByRole("link", { name: /HR \/ Employee Portal/ })).toHaveAttribute("href", "/login?as=employee");
    expect(within(dialog).getByRole("link", { name: /Applicant Portal/ })).toHaveAttribute("href", "/login?as=applicant");
    expect(screen.queryByRole("link", { name: /^careers$/i })).not.toBeInTheDocument();
  });

  it("redirects a verified administrator to the administration workspace", async () => {
    getAuthenticatedUser.mockResolvedValue({ id: "id", email: "person@example.com" });
    getCurrentRole.mockResolvedValue("system_administrator");
    await expect(Home()).rejects.toThrow("/admin");
    expect(redirect).toHaveBeenCalledWith("/admin");
  });
});
