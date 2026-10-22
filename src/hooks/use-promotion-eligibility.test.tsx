import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ decidePromotion: vi.fn() }));

vi.mock("@/queries/promotion-eligibility", () => ({
  decidePromotion: mocks.decidePromotion,
  getMyPromotionStatus: vi.fn(),
  getPromotionEvaluation: vi.fn(),
  listPromotionCandidatesPage: vi.fn(),
  listPromotionEmployees: vi.fn(),
  listPromotionRankRequirements: vi.fn(),
  promotionCandidateFilters: vi.fn((value) => value),
  recordIperRating: vi.fn(),
  recordPftResult: vi.fn(),
}));

import { useDecidePromotion } from "./use-promotion-eligibility";

function createWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("promotion decision hook", () => {
  it("records the decision and refreshes promotion, reporting and audit data", async () => {
    mocks.decidePromotion.mockResolvedValue("123e4567-e89b-42d3-a456-426614174099");
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useDecidePromotion(), { wrapper: createWrapper(queryClient) });

    await result.current.mutateAsync({ employeeId: "123e4567-e89b-42d3-a456-426614174000", approve: true });

    expect(mocks.decidePromotion).toHaveBeenCalledWith({ employeeId: "123e4567-e89b-42d3-a456-426614174000", approve: true });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["promotion-eligibility"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["reporting"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["administration", "audit-logs"] });
  });
});
