import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useSearchDraft } from "./use-search-draft";

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

it("commits the trimmed text once typing pauses, not per keystroke", () => {
  const onCommit = vi.fn();
  const { result } = renderHook(() => useSearchDraft("", onCommit));
  act(() => result.current.change("ju"));
  act(() => result.current.change("juan "));
  expect(onCommit).not.toHaveBeenCalled();
  expect(result.current.draft).toBe("juan ");
  act(() => { vi.advanceTimersByTime(300); });
  expect(onCommit).toHaveBeenCalledTimes(1);
  expect(onCommit).toHaveBeenCalledWith("juan");
});

it("keeps the trailing space so a second word can be typed after the URL catches up", () => {
  const onCommit = vi.fn();
  const { result, rerender } = renderHook(({ value }) => useSearchDraft(value, onCommit), { initialProps: { value: "" } });
  act(() => result.current.change("juan "));
  act(() => { vi.advanceTimersByTime(300); });
  rerender({ value: "juan" });
  expect(result.current.draft).toBe("juan ");
});

it("searches immediately on Enter and follows outside changes such as Clear all", () => {
  const onCommit = vi.fn();
  const { result, rerender } = renderHook(({ value }) => useSearchDraft(value, onCommit), { initialProps: { value: "ana" } });
  act(() => result.current.change("anabel"));
  act(() => result.current.flush());
  expect(onCommit).toHaveBeenLastCalledWith("anabel");
  rerender({ value: "anabel" });
  rerender({ value: "" });
  expect(result.current.draft).toBe("");
});

it("cancels a pending search when a link begins navigation", () => {
  const onCommit = vi.fn();
  const { result } = renderHook(() => useSearchDraft("", onCommit));
  const link = document.createElement("a");
  link.href = "/hr/employees/00000000-0000-4000-8000-000000000001";
  link.addEventListener("click", (event) => event.preventDefault());
  document.body.append(link);

  act(() => result.current.change("ana"));
  act(() => link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));
  act(() => { vi.advanceTimersByTime(300); });

  expect(onCommit).not.toHaveBeenCalled();
  link.remove();
});
