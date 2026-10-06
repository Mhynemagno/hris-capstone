import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ savePersonnelEntry: vi.fn() }));

vi.mock("@/queries/personnel-records", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/queries/personnel-records")>()),
  savePersonnelEntry: mocks.savePersonnelEntry,
}));

import { useSavePersonnelEntry } from "./use-personnel-records";

describe("personnel record hooks", () => {
  it("refreshes promotion readiness after a certification is saved", async () => {
    mocks.savePersonnelEntry.mockResolvedValue({ id: "c1" });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useSavePersonnelEntry("certification", "123e4567-e89b-42d3-a456-426614174000"), { wrapper });

    await act(() => result.current.mutateAsync({ input: { name: "Basic Course" } as never }));

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["promotion-eligibility"] });
  });
});
