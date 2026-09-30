import { render, screen } from "@testing-library/react";
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

  it("offers employee and applicant sign-in, and the job openings, without a Careers button", async () => {
    getAuthenticatedUser.mockResolvedValue(null);
    render(await Home());

    expect(screen.getByRole("button", { name: /^login$/i })).toBeVisible();
    expect(
      screen.getAllByRole("link", { name: /login as employee/i }).some((link) => link.getAttribute("href") === "/login?as=employee"),
    ).toBe(true);
    expect(
      screen.getAllByRole("link", { name: /login as applicant/i }).some((link) => link.getAttribute("href") === "/login?as=applicant"),
    ).toBe(true);
    expect(screen.getByRole("link", { name: /view all openings/i })).toHaveAttribute("href", "/jobs");
    expect(screen.queryByRole("link", { name: /^careers$/i })).not.toBeInTheDocument();
  });

  it("redirects a verified administrator to the administration workspace", async () => {
    getAuthenticatedUser.mockResolvedValue({ id: "id", email: "person@example.com" });
    getCurrentRole.mockResolvedValue("system_administrator");
    await expect(Home()).rejects.toThrow("/admin");
    expect(redirect).toHaveBeenCalledWith("/admin");
  });
});
