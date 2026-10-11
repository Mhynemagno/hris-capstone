import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ replace: vi.fn(), remove: vi.fn(), notify: vi.fn() }));
vi.mock("@/hooks/use-personnel-records", () => ({
  useReplacePersonnelDocument: () => ({ mutateAsync: mocks.replace, isPending: false }),
  useRemovePersonnelDocument: () => ({ mutateAsync: mocks.remove, isPending: false }),
}));
vi.mock("@/components/staff-shell/staff-notify", () => ({ notifyStaff: mocks.notify }));

import { RecordDocumentRow } from "./record-document-row";

const withDocument = { id: "c1", employee_id: "e1", name: "PSBRC", document_path: "certifications/e1/x.pdf", document_name: "psbrc.pdf", document_mime_type: "application/pdf", document_size_bytes: 61_440 };
const withoutDocument = { id: "c2", employee_id: "e1", name: "CIC", document_path: null, document_name: null, document_mime_type: null, document_size_bytes: null };

describe("RecordDocumentRow", () => {
  afterEach(() => { vi.restoreAllMocks(); mocks.replace.mockReset(); mocks.remove.mockReset(); mocks.notify.mockReset(); });

  it("shows the file with open, replace and remove", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mocks.remove.mockResolvedValue(undefined);
    render(<RecordDocumentRow canEdit entry={withDocument} kind="certification" />);
    expect(screen.getByText("psbrc.pdf")).toBeInTheDocument();
    expect(screen.getByText("60 KB")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open psbrc.pdf" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replace" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(window.confirm).toHaveBeenCalledWith("Remove the uploaded document for PSBRC?");
    expect(mocks.remove).toHaveBeenCalledWith({ id: "c1", document_path: "certifications/e1/x.pdf" });
    expect(mocks.notify).toHaveBeenCalledWith({ title: "Document removed" });
  });

  it("offers an upload when there is no file", async () => {
    render(<RecordDocumentRow canEdit entry={withoutDocument} kind="certification" />);
    await userEvent.click(screen.getByRole("button", { name: "Upload document" }));
    expect(await screen.findByRole("dialog", { name: "Upload files" })).toBeInTheDocument();
  });

  it("is read-only without edit rights", () => {
    render(<RecordDocumentRow canEdit={false} entry={withDocument} kind="certification" />);
    expect(screen.getByRole("button", { name: "Open psbrc.pdf" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Replace" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });

  it("shows nothing read-only when there is no file", () => {
    const { container } = render(<RecordDocumentRow canEdit={false} entry={withoutDocument} kind="certification" />);
    expect(container).toBeEmptyDOMElement();
  });
});
