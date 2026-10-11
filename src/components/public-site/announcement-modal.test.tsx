import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ save: vi.fn(), setStatus: vi.fn(), remove: vi.fn(), notify: vi.fn() }));
vi.mock("@/components/staff-shell/staff-notify", () => ({ notifyStaff: mocks.notify }));
const existing = { id: "a1", title: "Oplan Bisita Eskwela", summary: "Summary", body: "Body text", category: "news", status: "published", published_at: "2026-10-09T00:00:00Z" };
vi.mock("@/hooks/use-public-site", () => ({
  useHrAnnouncements: () => ({ isLoading: false, data: [existing] }),
  useSaveAnnouncement: () => ({ mutateAsync: mocks.save, isPending: false }),
  useSetAnnouncementStatus: () => ({ mutateAsync: mocks.setStatus, isPending: false }),
  useDeleteAnnouncement: () => ({ mutateAsync: mocks.remove, isPending: false }),
}));

import { AnnouncementModal } from "./announcement-modal";

describe("AnnouncementModal (PDF pp. 35–36)", () => {
  afterEach(() => { vi.restoreAllMocks(); mocks.save.mockReset(); mocks.setStatus.mockReset(); mocks.remove.mockReset(); mocks.notify.mockReset(); });

  it("creates and publishes immediately", async () => {
    const onClose = vi.fn();
    mocks.save.mockResolvedValue({ id: "new1" });
    render(<AnnouncementModal mode={{ kind: "create" }} onClose={onClose} />);
    const dialog = screen.getByRole("dialog", { name: "Create New Announcement" });
    expect(within(dialog).getByText("Short summary for quick preview on the public dashboard.")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: /Save Announcement/ }));
    expect(within(dialog).getByText("Enter a title.")).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
    await userEvent.type(within(dialog).getByLabelText(/^Title/), "Fiesta advisory");
    await userEvent.type(within(dialog).getByLabelText(/^Summary/), "Roads close on Sunday.");
    await userEvent.type(within(dialog).getByLabelText(/^Announcement Text/), "Details here.");
    await userEvent.click(within(dialog).getByLabelText("Publish immediately"));
    await userEvent.click(within(dialog).getByRole("button", { name: /Save Announcement/ }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(mocks.save).toHaveBeenCalledWith({ input: { title: "Fiesta advisory", category: "news", summary: "Roads close on Sunday.", body: "Details here." } });
    expect(mocks.setStatus).toHaveBeenCalledWith({ announcementId: "new1", status: "published" });
    expect(mocks.notify).toHaveBeenCalledWith({ title: "Announcement published" });
    expect(onClose).toHaveBeenCalled();
  });

  it("saves a draft when Publish immediately is unticked", async () => {
    mocks.save.mockResolvedValue({ id: "new2" });
    render(<AnnouncementModal mode={{ kind: "create" }} onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/^Title/), "Draft");
    await userEvent.type(screen.getByLabelText(/^Summary/), "S");
    await userEvent.type(screen.getByLabelText(/^Announcement Text/), "B");
    await userEvent.click(screen.getByRole("button", { name: /Save Announcement/ }));
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith({ title: "Draft saved" }));
    expect(mocks.setStatus).not.toHaveBeenCalled();
  });

  it("wraps the selection in bold and refuses unsafe links", async () => {
    render(<AnnouncementModal mode={{ kind: "create" }} onClose={vi.fn()} />);
    const text = screen.getByLabelText(/^Announcement Text/) as HTMLTextAreaElement;
    await userEvent.type(text, "say hello");
    text.setSelectionRange(4, 9);
    await userEvent.click(screen.getByRole("button", { name: "Bold" }));
    expect(text).toHaveValue("say **hello**");
    vi.spyOn(window, "prompt").mockReturnValue("javascript:alert(1)");
    await userEvent.click(screen.getByRole("button", { name: "Insert link" }));
    expect(mocks.notify).toHaveBeenCalledWith({ title: "Links must start with https:// or http://", tone: "error" });
    expect(text).toHaveValue("say **hello**");
  });

  it("edits, and deletes after confirming", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mocks.remove.mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<AnnouncementModal mode={{ kind: "edit", id: "a1" }} onClose={onClose} />);
    const dialog = screen.getByRole("dialog", { name: "Edit Announcement" });
    expect(within(dialog).getByLabelText(/^Title/)).toHaveValue("Oplan Bisita Eskwela");
    expect(within(dialog).queryByLabelText("Publish immediately")).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: /Delete/ }));
    expect(window.confirm).toHaveBeenCalledWith("Delete this announcement?");
    expect(mocks.remove).toHaveBeenCalledWith("a1");
    expect(onClose).toHaveBeenCalled();
  });

  it("says when the announcement to edit cannot be found", () => {
    render(<AnnouncementModal mode={{ kind: "edit", id: "missing" }} onClose={vi.fn()} />);
    expect(screen.getByText("This announcement could not be found.")).toBeInTheDocument();
  });
});
