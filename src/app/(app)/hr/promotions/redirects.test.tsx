import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); }, notFound: () => { throw new Error("NOT_FOUND"); } }));

import HrPromotionReviewPage from "./[employeeId]/page";

describe("promotion pages open the in-place details view", () => {
  it("no longer offers a promotion criteria page (requirements are system-owned)", () => {
    expect(existsSync(join(__dirname, "criteria", "page.tsx"))).toBe(false);
  });

  it("sends an employee's promotion evaluation to the details view", async () => {
    await expect(HrPromotionReviewPage({ params: Promise.resolve({ employeeId: "22222222-2222-4222-8222-222222222222" }) })).rejects.toThrow("REDIRECT /hr/promotions?view=22222222-2222-4222-8222-222222222222");
  });

  it("still refuses a malformed id", async () => {
    await expect(HrPromotionReviewPage({ params: Promise.resolve({ employeeId: "nope" }) })).rejects.toThrow("NOT_FOUND");
  });
});
