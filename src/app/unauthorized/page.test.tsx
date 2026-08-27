import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentRole = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-role", () => ({ getCurrentRole }));

import UnauthorizedPage from "./page";

describe("UnauthorizedPage", () => {
  beforeEach(() => getCurrentRole.mockReset());

  it("returns an authenticated user to their own workspace", async () => {
    getCurrentRole.mockResolvedValue("management");

    render(await UnauthorizedPage());

    expect(screen.getByRole("link", { name: /return to management workspace/i })).toHaveAttribute("href", "/management");
  });

  it("returns a signed-out visitor to sign in", async () => {
    getCurrentRole.mockResolvedValue(null);

    render(await UnauthorizedPage());

    expect(screen.getByRole("link", { name: /return to sign in/i })).toHaveAttribute("href", "/login");
  });
});
