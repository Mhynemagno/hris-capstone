import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DocumentUploadDialog } from "./document-upload-dialog";

describe("DocumentUploadDialog (PDF p. 23)", () => {
  it("matches the p. 23 dialog and saves the chosen file", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<DocumentUploadDialog onClose={vi.fn()} onSave={onSave} open saving={false} />);
    expect(screen.getByRole("dialog", { name: "Upload files" })).toBeInTheDocument();
    expect(screen.getByText("Select and upload the file of your choice.")).toBeInTheDocument();
    expect(screen.getByText("Choose a file or drag & drop it here")).toBeInTheDocument();
    expect(screen.getByText("PDF, JPEG, PNG or WEBP formats, up to 10 MB")).toBeInTheDocument();
    const file = new File(["%PDF"], "my-cv.pdf", { type: "application/pdf" });
    await userEvent.upload(screen.getByLabelText("Browse File"), file);
    expect(screen.getByText("my-cv.pdf")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save document" }));
    expect(onSave).toHaveBeenCalledWith(file);
  });

  it("refuses a video and keeps Save disabled", async () => {
    render(<DocumentUploadDialog onClose={vi.fn()} onSave={vi.fn()} open saving={false} />);
    await userEvent.upload(screen.getByLabelText("Browse File"), new File(["x"], "clip.mp4", { type: "video/mp4" }), { applyAccept: false });
    expect(screen.getByRole("alert")).toHaveTextContent("Use a PDF, JPEG, PNG or WEBP file up to 10 MB.");
    expect(screen.getByRole("button", { name: "Save document" })).toBeDisabled();
  });

  it("lets the chosen file be removed again", async () => {
    render(<DocumentUploadDialog onClose={vi.fn()} onSave={vi.fn()} open saving={false} />);
    await userEvent.upload(screen.getByLabelText("Browse File"), new File(["%PDF"], "a.pdf", { type: "application/pdf" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove a.pdf" }));
    expect(screen.queryByText("a.pdf")).not.toBeInTheDocument();
  });

  it("shows Uploading… and blocks a second save while saving", async () => {
    const { rerender } = render(<DocumentUploadDialog onClose={vi.fn()} onSave={vi.fn()} open saving={false} />);
    await userEvent.upload(screen.getByLabelText("Browse File"), new File(["%PDF"], "a.pdf", { type: "application/pdf" }));
    rerender(<DocumentUploadDialog onClose={vi.fn()} onSave={vi.fn()} open saving />);
    expect(screen.getByText(/Uploading…/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });
});
