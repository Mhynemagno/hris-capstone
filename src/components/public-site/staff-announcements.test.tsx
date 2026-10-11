import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ replace: vi.fn(), params: new URLSearchParams(), setStatus: vi.fn(), notify: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/hr/public-site", useRouter: () => ({ replace: mocks.replace }), useSearchParams: () => mocks.params }));
vi.mock("@/components/staff-shell/staff-notify", () => ({ notifyStaff: mocks.notify }));
vi.mock("./announcement-modal", () => ({ AnnouncementModal: ({ mode }: { mode: { kind: string } | null }) => (mode ? <div role="dialog">{mode.kind === "create" ? "Create New Announcement" : "Edit Announcement"}</div> : null) }));
vi.mock("./hr-contacts-panel", () => ({ HrContactsPanel: () => <p>Contacts panel</p> }));

const announcement = (id: string, title: string, category: string, status: string, published_at: string | null) => ({ id, title, summary: `**${title}** summary`, body: "Body", category, status, published_at, created_by: null, updated_by: null, created_at: "2026-10-08T00:00:00Z", updated_at: "2026-10-09T00:00:00Z" });
vi.mock("@/hooks/use-public-site", () => ({
  useHrAnnouncements: () => ({ isLoading: false, error: null, data: [
    announcement("a1", "Oplan Bisita Eskwela", "news", "published", "2026-10-09T00:00:00Z"),
    announcement("a2", "Information Awareness", "advisory", "draft", null),
    announcement("a3", "Accounting of Personnel", "advisory", "archived", "2026-09-20T00:00:00Z"),
  ] }),
  useHrContacts: () => ({ data: [{ id: "c1" }, { id: "c2" }] }),
  useSetAnnouncementStatus: () => ({ mutateAsync: mocks.setStatus, isPending: false }),
}));

import { StaffAnnouncements } from "./staff-announcements";

describe("StaffAnnouncements (announcements.html)", () => {
  beforeEach(() => { mocks.params = new URLSearchParams(); });
  afterEach(() => { mocks.replace.mockReset(); mocks.setStatus.mockReset(); mocks.notify.mockReset(); });

  it("shows the header, tabs with counts and the cards", () => {
    render(<StaffAnnouncements />);
    expect(screen.getByRole("heading", { level: 1, name: "Announcements & Public Content" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Announcements 3" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Station Contacts 2" })).toBeInTheDocument();
    expect(screen.getByText("Showing 2 active entries")).toBeInTheDocument();
    const published = screen.getByRole("heading", { name: "Oplan Bisita Eskwela" }).closest("article")!;
    expect(within(published).getByText("Published")).toBeInTheDocument();
    expect(within(published).getByText("News")).toBeInTheDocument();
    expect(within(published).getByText("First published October 9, 2026")).toBeInTheDocument();
    expect(within(published).getByText("Oplan Bisita Eskwela summary")).toBeInTheDocument();
    expect(within(screen.getByRole("heading", { name: "Information Awareness" }).closest("article")!).getByText("Draft")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish Information Awareness" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish Accounting of Personnel" })).toBeInTheDocument();
  });

  it("archives and publishes from the cards", async () => {
    mocks.setStatus.mockResolvedValue(undefined);
    render(<StaffAnnouncements />);
    await userEvent.click(screen.getByRole("button", { name: "Archive Oplan Bisita Eskwela" }));
    expect(mocks.setStatus).toHaveBeenCalledWith({ announcementId: "a1", status: "archived" });
    expect(mocks.notify).toHaveBeenCalledWith({ title: "Announcement archived" });
    await userEvent.click(screen.getByRole("button", { name: "Publish Information Awareness" }));
    expect(mocks.setStatus).toHaveBeenLastCalledWith({ announcementId: "a2", status: "published" });
  });

  it("opens the create and edit modals in place", async () => {
    render(<StaffAnnouncements />);
    await userEvent.click(screen.getByRole("button", { name: /New Announcement/ }));
    expect(mocks.replace).toHaveBeenCalledWith("/hr/public-site?new=1", { scroll: false });
    await userEvent.click(screen.getByRole("button", { name: "Edit Oplan Bisita Eskwela" }));
    expect(mocks.replace).toHaveBeenLastCalledWith("/hr/public-site?edit=a1", { scroll: false });
  });

  it("shows the contacts in their tab", async () => {
    render(<StaffAnnouncements />);
    await userEvent.click(screen.getByRole("tab", { name: "Station Contacts 2" }));
    expect(mocks.replace).toHaveBeenCalledWith("/hr/public-site?tab=contacts", { scroll: false });
  });
});
