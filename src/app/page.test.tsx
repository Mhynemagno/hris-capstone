import { render, screen } from "@testing-library/react";
import { beforeEach, vi } from "vitest";

import Home from "./page";

const { getAuthenticatedUser } = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
}));

vi.mock("@/lib/auth/current-user", () => ({ getAuthenticatedUser }));
vi.mock("@/components/auth/sign-out-button", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));

describe("Home", () => {
  beforeEach(() => { getAuthenticatedUser.mockReset(); });

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

  it("shows sign out to a verified user", async () => {
    getAuthenticatedUser.mockResolvedValue({ id: "id", email: "person@example.com" });
    render(await Home());
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });
});
