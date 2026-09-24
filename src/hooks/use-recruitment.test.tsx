import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const applicationId = "123e4567-e89b-42d3-a456-426614174000";

const mocks = vi.hoisted(() => ({
  hireApplication: vi.fn(),
  getApplicationAiScores: vi.fn(),
}));

vi.mock("@/queries/recruitment", () => ({
  hireApplication: mocks.hireApplication,
  getApplicationAiScores: mocks.getApplicationAiScores,
}));

import * as hooks from "./index";

function createWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("recruitment hooks", () => {
  it("refreshes recruitment, personnel, and administrator data after hiring", async () => {
    const recruitment = hooks as typeof hooks & {
      useHireApplication: () => {
        mutateAsync: (input: {
          applicationId: string;
          badgeNumber: string;
        }) => Promise<string>;
      };
    };
    mocks.hireApplication.mockResolvedValue("123e4567-e89b-42d3-a456-426614174099");
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = createWrapper(queryClient);

    expect(recruitment.useHireApplication).toBeDefined();
    const { result } = renderHook(() => recruitment.useHireApplication(), { wrapper });
    await result.current.mutateAsync({
      applicationId,
      badgeNumber: "EMP-2026-001",
    });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["recruitment"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["personnel-records", "directory"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["administration", "users"] });
  });

  it("refreshes the AI recommendation while analysis runs and stops once it settles", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mocks.getApplicationAiScores
        .mockResolvedValueOnce([{ id: "s1", status: "queued" }])
        .mockResolvedValue([{ id: "s1", status: "completed", score: 80 }]);
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const { result } = renderHook(() => hooks.useApplicationAiScores(applicationId), { wrapper: createWrapper(queryClient) });

      await waitFor(() => expect(result.current.data?.[0]?.status).toBe("queued"));
      await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
      await waitFor(() => expect(result.current.data?.[0]?.status).toBe("completed"));
      expect(mocks.getApplicationAiScores).toHaveBeenCalledTimes(2);

      await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
      expect(mocks.getApplicationAiScores).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
