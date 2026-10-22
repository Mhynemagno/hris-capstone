import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ recordPromotionAssignment: vi.fn(), recordPromotionAward: vi.fn(), recordPromotionBoardAssessment: vi.fn() }));

vi.mock("@/queries/promotion-scorecard", () => mocks);
vi.mock("@/queries/promotion-eligibility", () => ({}));

import { useRecordPromotionAssignment, useRecordPromotionAward, useRecordPromotionBoardAssessment } from "./use-promotion-scorecard";

function createWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const employeeId = "123e4567-e89b-42d3-a456-426614174000";

async function expectRecordedAndRefreshed(mutate: (queryClient: QueryClient) => Promise<unknown>, mutation: ReturnType<typeof vi.fn>, input: unknown) {
  mutation.mockResolvedValue("123e4567-e89b-42d3-a456-426614174099");
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
  await mutate(queryClient);
  expect(mutation).toHaveBeenCalledWith(input);
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["promotion-eligibility"] });
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["reporting"] });
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["administration", "audit-logs"] });
}

describe("promotion scorecard evidence hooks", () => {
  it("records an assignment and refreshes scorecards, reports and audit data", async () => {
    const input = { employeeId, kind: "administrative" as const, region: null, startedOn: "2026-01-01", endedOn: "2026-06-30", evidence: "Orders" };
    await expectRecordedAndRefreshed(async (queryClient) => {
      const { result } = renderHook(() => useRecordPromotionAssignment(), { wrapper: createWrapper(queryClient) });
      await result.current.mutateAsync(input);
    }, mocks.recordPromotionAssignment, input);
  });

  it("records an award and refreshes scorecards, reports and audit data", async () => {
    const input = { employeeId, awardKey: "commendation", awardedOn: "2026-01-01", presentRankId: 3, evidence: "Citation" };
    await expectRecordedAndRefreshed(async (queryClient) => {
      const { result } = renderHook(() => useRecordPromotionAward(), { wrapper: createWrapper(queryClient) });
      await result.current.mutateAsync(input);
    }, mocks.recordPromotionAward, input);
  });

  it("records a board assessment and refreshes scorecards, reports and audit data", async () => {
    const input = { employeeId, criterion: "board" as const, band: "PCPL-PMSG" as const, assessedOn: "2026-01-01", score: 12, evidence: "Panel" };
    await expectRecordedAndRefreshed(async (queryClient) => {
      const { result } = renderHook(() => useRecordPromotionBoardAssessment(), { wrapper: createWrapper(queryClient) });
      await result.current.mutateAsync(input);
    }, mocks.recordPromotionBoardAssessment, input);
  });
});
