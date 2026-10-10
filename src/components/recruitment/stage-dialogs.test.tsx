import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ record: vi.fn(), hire: vi.fn(), notify: vi.fn(), pending: false }));
vi.mock("@/components/ui/toaster", () => ({ notifySuccess: mocks.notify }));
vi.mock("@/hooks/use-recruitment", () => ({
  useRecordStageResult: () => ({ isPending: mocks.pending, mutateAsync: mocks.record }),
  useHireApplication: () => ({ isPending: mocks.pending, mutateAsync: mocks.hire }),
}));

import { HireDialog, StageResultDialog } from "./stage-dialogs";

const id = "00000000-0000-0000-0000-000000000001";

describe("stage dialogs", () => {
  beforeEach(() => { mocks.record.mockReset(); mocks.hire.mockReset(); mocks.notify.mockReset(); mocks.pending = false; });

  it("marks a test as scheduled with a note and confirms with a toast", async () => {
    mocks.record.mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(<StageResultDialog applicationId={id} onOpenChange={onOpenChange} open result="scheduled" status="Drug Test" />);
    const dialog = screen.getByRole("dialog", { name: "Mark Drug Test as Scheduled" });
    expect(within(dialog).queryByLabelText(/^Supporting document/)).not.toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText("Note to applicant"), "Monday 8 AM");
    await userEvent.click(within(dialog).getByRole("button", { name: "Mark as Scheduled" }));
    expect(mocks.record).toHaveBeenCalledWith({ applicationId: id, result: "scheduled", note: "Monday 8 AM", file: null });
    expect(mocks.notify).toHaveBeenCalledWith("Drug Test: Scheduled · applicant notified");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("requires a supporting document before passing a test stage", async () => {
    mocks.record.mockResolvedValue(undefined);
    render(<StageResultDialog applicationId={id} onOpenChange={() => undefined} open result="passed" status="Drug Test" />);
    const dialog = screen.getByRole("dialog", { name: "Mark Drug Test as Passed" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Mark as Passed" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Upload a supporting document for this result.");
    expect(mocks.record).not.toHaveBeenCalled();

    const file = new File(["%PDF"], "drug-test.pdf", { type: "application/pdf" });
    await userEvent.upload(within(dialog).getByLabelText(/^Supporting document/), file);
    await userEvent.click(within(dialog).getByRole("button", { name: "Mark as Passed" }));
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ result: "passed", file }));
  });

  it("explains that Failed ends the application and shows server errors inside the dialog", async () => {
    mocks.record.mockRejectedValue(new Error("This application is no longer in the recruitment process."));
    render(<StageResultDialog applicationId={id} onOpenChange={() => undefined} open result="failed" status="Application Submission" />);
    const dialog = screen.getByRole("dialog", { name: "Mark Application Submission as Failed" });
    expect(dialog).toHaveTextContent("This ends the application as Disqualified.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Mark as Failed" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("This application is no longer in the recruitment process.");
  });

  it("requires a badge number before hiring", async () => {
    render(<HireDialog applicantNumber={12345} applicationId={id} onOpenChange={() => undefined} open />);
    const dialog = screen.getByRole("dialog", { name: "Hire applicant" });
    expect(within(dialog).getByLabelText("Applicant number")).toHaveValue("0-12345");
    await userEvent.click(within(dialog).getByRole("button", { name: "Hire applicant" }));
    expect(mocks.hire).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("alert")).toBeInTheDocument();
  });
});
