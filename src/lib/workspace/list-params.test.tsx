import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ replace: vi.fn(), search: "q=ana&page=3" }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/hr/applications",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

import { useListParams } from "./list-params";

// Written through the History API (no server round trip); Next.js syncs useSearchParams from it.
beforeEach(() => {
  vi.restoreAllMocks();
  nav.replace.mockReset();
  nav.search = "q=ana&page=3";
  window.history.replaceState(null, "", "/hr/applications?q=ana&page=3");
  vi.spyOn(window.history, "replaceState").mockImplementation((_state, _unused, url) => nav.replace(url, { scroll: false }));
});

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

it("resets a configured page key when a tab changes while preserving unrelated dashboard state", () => {
  nav.search = "period=month&attentionPage=3&attention=leave";
  const { result } = renderHook(() => useListParams(["attention", "attentionPage"] as const, { pageKey: "attentionPage" }));

  act(() => result.current.set({ attention: "attendance" }));

  expect(nav.replace).toHaveBeenCalledWith("/hr/applications?period=month&attention=attendance", { scroll: false });
});

it("does not let a delayed list update overwrite a destination navigation", () => {
  const { result } = renderHook(() => useListParams(["q", "page"] as const));
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/hr/employees/00000000-0000-4000-8000-000000000001");
  vi.spyOn(window.history, "replaceState").mockImplementation((_state, _unused, url) => nav.replace(url, { scroll: false }));

  act(() => result.current.set({ q: "demo" }));

  expect(nav.replace).not.toHaveBeenCalled();
});
