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

  it("links visitors to sign in and future job openings", async () => {
    getAuthenticatedUser.mockResolvedValue(null);
    render(await Home());

    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(
      screen.getByRole("link", { name: /view job openings/i }),
    ).toHaveAttribute("href", "/jobs");
  });

  it("redirects a verified administrator to the administration workspace", async () => {
    getAuthenticatedUser.mockResolvedValue({ id: "id", email: "person@example.com" });
    getCurrentRole.mockResolvedValue("system_administrator");
    await expect(Home()).rejects.toThrow("/admin");
    expect(redirect).toHaveBeenCalledWith("/admin");
  });
});
