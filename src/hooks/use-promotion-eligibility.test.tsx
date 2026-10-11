import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ submitEmployeePromotionDocket: vi.fn() }));

vi.mock("@/queries/promotion-eligibility", () => ({
  createPerformanceRating: vi.fn(),
  createPromotionCriterion: vi.fn(),
  createPromotionEvaluation: vi.fn(),
  getHrPromotionEmployee: vi.fn(),
  getMyPromotionEligibility: vi.fn(),
  listPromotionCriteria: vi.fn(),
  listPromotionEvaluations: vi.fn(),
  listPromotionReadiness: vi.fn(),
  listPromotionReadinessPage: vi.fn(),
  promotionEvaluationFilters: vi.fn((value) => value),
  promotionReadinessFilters: vi.fn((value) => value),
  recordPerformanceEvaluation: vi.fn(),
  setPromotionCriterionActive: vi.fn(),
  submitEmployeePromotionDocket: mocks.submitEmployeePromotionDocket,
  updatePerformanceRating: vi.fn(),
  updatePromotionCriterion: vi.fn(),
  updatePromotionEvaluation: vi.fn(),
}));

import { useSubmitEmployeePromotionDocket } from "./use-promotion-eligibility";

function createWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("employee promotion docket hook", () => {
  it("submits the docket and refreshes employee, HR, reporting, and notification data", async () => {
    mocks.submitEmployeePromotionDocket.mockResolvedValue("123e4567-e89b-42d3-a456-426614174099");
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useSubmitEmployeePromotionDocket(), { wrapper: createWrapper(queryClient) });

    await result.current.mutateAsync({ criterionId: "123e4567-e89b-42d3-a456-426614174000", remarks: "Board-ready record" });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["promotion-eligibility"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["employee-dashboard"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["notifications"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["reporting"] });
  });
});
