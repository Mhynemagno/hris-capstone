import { afterEach, describe, expect, it, vi } from "vitest";

import { jobPostingImageUrl } from "./job-posting-image";

describe("jobPostingImageUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("builds the public storage URL for a saved image path", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321/");
    expect(jobPostingImageUrl("job-openings/7/0b8f2c1e-1111-4222-8333-944455556666.png")).toBe(
      "http://127.0.0.1:54321/storage/v1/object/public/job-posting-images/job-openings/7/0b8f2c1e-1111-4222-8333-944455556666.png",
    );
  });

  it("returns null when there is no image", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    expect(jobPostingImageUrl(null)).toBeNull();
  });
});
