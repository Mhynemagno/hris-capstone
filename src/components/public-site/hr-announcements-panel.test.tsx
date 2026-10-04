import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const base = { summary: "Summary", body: "Body", category: "news", created_by: null, updated_by: null, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-02T00:00:00Z" };
  return {
    rows: [
      { ...base, id: "11111111-1111-4111-8111-111111111111", title: "Draft notice", status: "draft", published_at: null },
      { ...base, id: "22222222-2222-4222-8222-222222222222", title: "Published notice", status: "published", published_at: "2026-10-02T00:00:00Z" },
      { ...base, id: "33333333-3333-4333-8333-333333333333", title: "Archived notice", status: "archived", published_at: "2026-09-01T00:00:00Z" },
    ],
    setStatus: vi.fn(),
    remove: vi.fn(),
    save: vi.fn(),
  };
});

vi.mock("@/hooks/use-public-site", () => ({
  useHrAnnouncements: () => ({ data: mocks.rows, error: null, isLoading: false }),
  useSetAnnouncementStatus: () => ({ isPending: false, mutateAsync: mocks.setStatus }),
  useDeleteAnnouncement: () => ({ isPending: false, mutateAsync: mocks.remove }),
  useSaveAnnouncement: () => ({ isPending: false, mutateAsync: mocks.save }),
}));

import { HrAnnouncementsPanel } from "./hr-announcements-panel";

describe("HrAnnouncementsPanel", () => {
  beforeEach(() => {
    mocks.setStatus.mockReset().mockResolvedValue({});
    mocks.remove.mockReset().mockResolvedValue(undefined);
  });

  it("shows each status and only the actions that status allows", () => {
    render(<HrAnnouncementsPanel />);
    expect(screen.getByText("Draft")).toBeVisible();
    expect(screen.getByText("Published")).toBeVisible();
    expect(screen.getByText("Archived")).toBeVisible();
    expect(screen.getByRole("button", { name: "Publish Draft notice" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Delete Draft notice" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Archive Published notice" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Delete Published notice" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish Published notice" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish Archived notice" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Delete Archived notice" })).not.toBeInTheDocument();
  });

  it("publishes a draft and reports it", async () => {
    const user = userEvent.setup();
    render(<HrAnnouncementsPanel />);
    await user.click(screen.getByRole("button", { name: "Publish Draft notice" }));
    expect(mocks.setStatus).toHaveBeenCalledWith({ announcementId: "11111111-1111-4111-8111-111111111111", status: "published" });
    expect(await screen.findByText("Draft notice is now published on the landing page.")).toBeVisible();
  });

  it("asks before deleting a draft", async () => {
    const user = userEvent.setup();
    render(<HrAnnouncementsPanel />);
    await user.click(screen.getByRole("button", { name: "Delete Draft notice" }));
    expect(mocks.remove).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(mocks.remove).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
    expect(await screen.findByText("Draft notice was deleted.")).toBeVisible();
  });

  it("shows the server's refusal", async () => {
    const user = userEvent.setup();
    mocks.setStatus.mockRejectedValue(new Error("Only a published announcement can be archived."));
    render(<HrAnnouncementsPanel />);
    await user.click(screen.getByRole("button", { name: "Archive Published notice" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only a published announcement can be archived.");
  });

  it("opens the form for a new announcement", async () => {
    const user = userEvent.setup();
    render(<HrAnnouncementsPanel />);
    await user.click(screen.getByRole("button", { name: "New announcement" }));
    expect(screen.getByRole("form", { name: "New announcement" })).toBeVisible();
  });
});
