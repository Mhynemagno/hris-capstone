import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ save: vi.fn() }));

vi.mock("@/hooks/use-public-site", () => ({ useSaveAnnouncement: () => ({ isPending: false, mutateAsync: mocks.save }) }));

import { HrAnnouncementForm } from "./hr-announcement-form";

const existing = {
  id: "3f2b8c1e-5d4a-4b7e-9c2d-1a2b3c4d5e6f",
  title: "Road safety advisory",
  summary: "Road works this weekend.",
  body: "Details.",
  category: "advisory" as const,
  status: "published" as const,
  published_at: "2026-10-03T02:00:00Z",
  created_by: null,
  updated_by: null,
  created_at: "2026-10-03T01:00:00Z",
  updated_at: "2026-10-03T02:00:00Z",
};

describe("HrAnnouncementForm", () => {
  beforeEach(() => vi.resetAllMocks());

  it("shows field errors and does not save an empty announcement", async () => {
    const user = userEvent.setup();
    render(<HrAnnouncementForm onCancel={vi.fn()} onSaved={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Enter a title.")).toBeInTheDocument();
    expect(screen.getByText("Enter a short summary.")).toBeInTheDocument();
    expect(screen.getByText("Enter the announcement text.")).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("saves a new announcement as a draft with trimmed values", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    mocks.save.mockResolvedValue({ ...existing, status: "draft" });
    render(<HrAnnouncementForm onCancel={vi.fn()} onSaved={onSaved} />);
    await user.type(screen.getByLabelText(/^Title/), "  Road safety advisory  ");
    await user.selectOptions(screen.getByLabelText(/^Category/), "advisory");
    await user.type(screen.getByLabelText(/^Summary/), "Road works this weekend.");
    await user.type(screen.getByLabelText(/^Announcement text/), "First.{Enter}{Enter}Second.");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({
      input: { title: "Road safety advisory", category: "advisory", summary: "Road works this weekend.", body: "First.\n\nSecond." },
      announcementId: undefined,
    }));
    expect(onSaved).toHaveBeenCalledWith("Road safety advisory was saved as a draft.");
  });

  it("edits an existing announcement and shows the server's error", async () => {
    const user = userEvent.setup();
    mocks.save.mockRejectedValue(new Error("HR access is required."));
    render(<HrAnnouncementForm announcement={existing} onCancel={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByRole("form", { name: "Edit Road safety advisory" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Title/)).toHaveValue("Road safety advisory");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("HR access is required.");
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ announcementId: existing.id }));
  });
});
