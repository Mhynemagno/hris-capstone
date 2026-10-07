import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ replace: vi.fn(), search: "q=ana&page=3" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => "/hr/applications",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

import { useListParams } from "./list-params";

beforeEach(() => { nav.replace.mockReset(); nav.search = "q=ana&page=3"; });

it("reads params with empty-string defaults", () => {
  const { result } = renderHook(() => useListParams(["q", "stage", "page"] as const));
  expect(result.current.params).toEqual({ q: "ana", stage: "", page: "3" });
});

it("resets the page when a filter changes and drops empty values", () => {
  const { result } = renderHook(() => useListParams(["q", "stage", "page"] as const));
  act(() => result.current.set({ stage: "Interview", q: "" }));
  expect(nav.replace).toHaveBeenCalledWith("/hr/applications?stage=Interview", { scroll: false });
});

it("keeps other params when only the page changes", () => {
  const { result } = renderHook(() => useListParams(["q", "page"] as const));
  act(() => result.current.set({ page: "4" }));
  expect(nav.replace).toHaveBeenCalledWith("/hr/applications?q=ana&page=4", { scroll: false });
});
