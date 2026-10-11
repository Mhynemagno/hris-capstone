import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); }, notFound: () => { throw new Error("NOT_FOUND"); } }));

import HrPromotionReviewPage from "./[employeeId]/page";
import PromotionCriteriaPage from "./criteria/page";

describe("promotion pages open the in-place panels", () => {
  it("sends Promotion criteria to the slide-over", () => {
    expect(() => PromotionCriteriaPage()).toThrow("REDIRECT /hr/promotions?criteria=1");
  });

  it("sends a promotion review to the modal", async () => {
    await expect(HrPromotionReviewPage({ params: Promise.resolve({ employeeId: "22222222-2222-4222-8222-222222222222" }) })).rejects.toThrow("REDIRECT /hr/promotions?review=22222222-2222-4222-8222-222222222222");
  });

  it("still refuses a malformed id", async () => {
    await expect(HrPromotionReviewPage({ params: Promise.resolve({ employeeId: "nope" }) })).rejects.toThrow("NOT_FOUND");
  });
});
