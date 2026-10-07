import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ transition: vi.fn(), hire: vi.fn(), notify: vi.fn(), pending: false }));
vi.mock("@/components/ui/toaster", () => ({ notifySuccess: mocks.notify }));
vi.mock("@/hooks/use-recruitment", () => ({
  useTransitionApplicationStatus: () => ({ isPending: mocks.pending, mutateAsync: mocks.transition }),
  useHireApplication: () => ({ isPending: mocks.pending, mutateAsync: mocks.hire }),
}));

import { HireDialog, MoveStageDialog, NotSelectedDialog } from "./stage-dialogs";

const id = "00000000-0000-0000-0000-000000000001";

describe("stage dialogs", () => {
  beforeEach(() => { mocks.transition.mockReset(); mocks.hire.mockReset(); mocks.notify.mockReset(); mocks.pending = false; });

  it("moves to a chosen allowed stage with an optional note and confirms with a toast", async () => {
    mocks.transition.mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(<MoveStageDialog applicationId={id} onOpenChange={onOpenChange} open status="Under Review" />);
    const dialog = screen.getByRole("dialog", { name: "Move to next stage" });
    expect(within(dialog).queryByRole("radio", { name: "Not Selected" })).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("radio", { name: "Interview" }));
    await userEvent.type(within(dialog).getByLabelText("Note to applicant"), "See you Monday");
    await userEvent.click(within(dialog).getByRole("button", { name: "Move to Interview" }));
    expect(mocks.transition).toHaveBeenCalledWith({ applicationId: id, nextStatus: "Interview", note: "See you Monday" });
    expect(mocks.notify).toHaveBeenCalledWith("Moved to Interview · applicant notified");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the dialog open and shows the server error inside it", async () => {
    mocks.transition.mockRejectedValue(new Error("Upload the BMI proof first."));
    render(<MoveStageDialog applicationId={id} initialStage="Neuro Exam" onOpenChange={() => undefined} open status="Endorsed to Crame" />);
    await userEvent.click(screen.getByRole("button", { name: "Move to Neuro Exam" }));
    expect(within(screen.getByRole("dialog")).getByRole("alert")).toHaveTextContent("Upload the BMI proof first.");
  });

  it("disables confirmation while a change is in flight", () => {
    mocks.pending = true;
    render(<MoveStageDialog applicationId={id} initialStage="Interview" onOpenChange={() => undefined} open status="Under Review" />);
    expect(screen.getByRole("button", { name: /Move to Interview/ })).toBeDisabled();
  });

  it("asks for confirmation before marking not selected", async () => {
    mocks.transition.mockResolvedValue(undefined);
    render(<NotSelectedDialog applicationId={id} onOpenChange={() => undefined} open />);
    const dialog = screen.getByRole("alertdialog", { name: "Mark as not selected?" });
    expect(dialog).toHaveTextContent("This ends the application. The applicant will be notified.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Mark as not selected" }));
    expect(mocks.transition).toHaveBeenCalledWith({ applicationId: id, nextStatus: "Not Selected", note: undefined });
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
