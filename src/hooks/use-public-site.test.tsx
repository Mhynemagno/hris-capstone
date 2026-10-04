import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ saveAnnouncement: vi.fn(), reorderPublicContacts: vi.fn() }));

vi.mock("@/queries/public-site", () => ({
  deleteAnnouncement: vi.fn(),
  deletePublicContact: vi.fn(),
  listHrAnnouncements: vi.fn(),
  listHrContacts: vi.fn(),
  listPublishedAnnouncements: vi.fn(),
  listVisibleContacts: vi.fn(),
  reorderPublicContacts: mocks.reorderPublicContacts,
  saveAnnouncement: mocks.saveAnnouncement,
  savePublicContact: vi.fn(),
  setAnnouncementStatus: vi.fn(),
}));

import { useReorderPublicContacts, useSaveAnnouncement } from "./use-public-site";

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  return { invalidateQueries, wrapper };
}

describe("public-site hooks", () => {
  it("refreshes every public-site query after saving an announcement", async () => {
    const { invalidateQueries, wrapper } = setup();
    mocks.saveAnnouncement.mockResolvedValue({ id: "a" });
    const { result } = renderHook(() => useSaveAnnouncement(), { wrapper });
    const input = { title: "T", category: "news" as const, summary: "S", body: "B" };
    await result.current.mutateAsync({ input });
    expect(mocks.saveAnnouncement).toHaveBeenCalledWith(input, undefined);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["public-site"] });
  });

  it("passes the full new order when reordering contacts", async () => {
    const { invalidateQueries, wrapper } = setup();
    mocks.reorderPublicContacts.mockResolvedValue(undefined);
    const { result } = renderHook(() => useReorderPublicContacts(), { wrapper });
    await result.current.mutateAsync(["b", "a"]);
    expect(mocks.reorderPublicContacts).toHaveBeenCalledWith(["b", "a"]);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["public-site"] });
  });
});
