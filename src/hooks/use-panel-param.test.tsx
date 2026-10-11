import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/hr/leave-requests",
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams("status=pending&review=abc"),
}));

import { usePanelParam } from "./use-panel-param";

describe("usePanelParam", () => {
  it("reads and clears a panel param, keeping other params", () => {
    const { result } = renderHook(() => usePanelParam("review"));
    expect(result.current[0]).toBe("abc");
    act(() => result.current[1](null));
    expect(replace).toHaveBeenCalledWith("/hr/leave-requests?status=pending", { scroll: false });
    act(() => result.current[1]("xyz"));
    expect(replace).toHaveBeenLastCalledWith("/hr/leave-requests?status=pending&review=xyz", { scroll: false });
  });
});
