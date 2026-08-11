import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAuthenticatedUser, getVerifiedUserId } from "./current-user";

const { createServerSupabaseClient } = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient,
}));

describe("getVerifiedUserId", () => {
  beforeEach(() => {
    createServerSupabaseClient.mockReset();
  });

  it("returns the verified JWT subject", async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: { sub: "00000000-0000-4000-8000-000000000001" } },
          error: null,
        }),
      },
    });

    await expect(getVerifiedUserId()).resolves.toBe(
      "00000000-0000-4000-8000-000000000001",
    );
  });

  it("returns verified identity details when the email claim is present", async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: {
            claims: {
              sub: "00000000-0000-4000-8000-000000000001",
              email: "admin@example.com",
            },
          },
          error: null,
        }),
      },
    });

    await expect(getAuthenticatedUser()).resolves.toEqual({
      id: "00000000-0000-4000-8000-000000000001",
      email: "admin@example.com",
    });
  });

  it("does not trust an absent or invalid claim", async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: null },
          error: new Error("invalid JWT"),
        }),
      },
    });

    await expect(getVerifiedUserId()).resolves.toBeNull();
  });
});
