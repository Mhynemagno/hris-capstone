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

  it("links visitors to public careers and sign in", async () => {
    getAuthenticatedUser.mockResolvedValue(null);
    render(await Home());

    expect(
      screen
        .getAllByRole("link", { name: /sign in/i })
        .some((link) => link.getAttribute("href") === "/login"),
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: /^careers$/i })
        .some((link) => link.getAttribute("href") === "/jobs"),
    ).toBe(true);
  });

  it("redirects a verified administrator to the administration workspace", async () => {
    getAuthenticatedUser.mockResolvedValue({ id: "id", email: "person@example.com" });
    getCurrentRole.mockResolvedValue("system_administrator");
    await expect(Home()).rejects.toThrow("/admin");
    expect(redirect).toHaveBeenCalledWith("/admin");
  });
});
