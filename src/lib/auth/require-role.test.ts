import { beforeEach, describe, expect, it, vi } from "vitest";

import { APP_ROLES, type AppRole } from "@/lib/types/roles";

import { requireRole } from "./require-role";

const { getAuthenticatedUser, getCurrentRole, redirect } = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  getCurrentRole: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("./current-user", () => ({ getAuthenticatedUser }));
vi.mock("./current-role", () => ({ getCurrentRole }));
vi.mock("next/navigation", () => ({ redirect }));

describe("requireRole", () => {
  beforeEach(() => {
    getAuthenticatedUser.mockReset();
    getCurrentRole.mockReset();
    redirect.mockClear();
  });

  it("returns the authenticated user when the expected role matches", async () => {
    getAuthenticatedUser.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000001",
      email: "hr@example.com",
    });
    getCurrentRole.mockResolvedValue("hr_personnel");

    await expect(requireRole("hr_personnel")).resolves.toEqual({
      user: {
        id: "00000000-0000-4000-8000-000000000001",
        email: "hr@example.com",
      },
      role: "hr_personnel",
    });
  });

  it("redirects an unauthenticated request to login", async () => {
    getAuthenticatedUser.mockResolvedValue(null);

    await expect(requireRole("hr_personnel")).rejects.toThrow(
      "NEXT_REDIRECT:/login",
    );
  });

  it("redirects a mismatched role to unauthorized", async () => {
    getAuthenticatedUser.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000001",
      email: "hr@example.com",
    });
    getCurrentRole.mockResolvedValue("hr_personnel");

    await expect(requireRole("management")).rejects.toThrow(
      "NEXT_REDIRECT:/unauthorized",
    );
  });

  it("redirects a missing role to unauthorized", async () => {
    getAuthenticatedUser.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000001",
      email: "hr@example.com",
    });
    getCurrentRole.mockResolvedValue(null);

    await expect(requireRole("employee")).rejects.toThrow(
      "NEXT_REDIRECT:/unauthorized",
    );
  });

  it.each(
    APP_ROLES.flatMap((expectedRole) =>
      APP_ROLES.filter((actualRole) => actualRole !== expectedRole).map(
        (actualRole) => [expectedRole, actualRole] as const,
      ),
    ),
  )(
    "redirects %s when the authenticated user has %s",
    async (expectedRole: AppRole, actualRole: AppRole) => {
      getAuthenticatedUser.mockResolvedValue({
        id: "00000000-0000-4000-8000-000000000001",
        email: "user@example.com",
      });
      getCurrentRole.mockResolvedValue(actualRole);

      await expect(requireRole(expectedRole)).rejects.toThrow(
        "NEXT_REDIRECT:/unauthorized",
      );
    },
  );
});
