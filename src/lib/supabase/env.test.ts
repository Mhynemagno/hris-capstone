import { afterEach, describe, expect, it, vi } from "vitest";

import { getPublicSupabaseConfig } from "./env";

describe("getPublicSupabaseConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects a missing public project URL before a client is created", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-key");

    expect(() => getPublicSupabaseConfig()).toThrow(
      "Missing NEXT_PUBLIC_SUPABASE_URL",
    );
  });

  it("returns the two public values needed by a Supabase client", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-key");

    expect(getPublicSupabaseConfig()).toEqual({
      url: "https://project.supabase.co",
      publishableKey: "public-key",
    });
  });
});
