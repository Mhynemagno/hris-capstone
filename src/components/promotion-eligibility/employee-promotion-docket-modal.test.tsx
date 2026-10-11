import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ submit: vi.fn(), notify: vi.fn() }));
vi.mock("@/hooks/use-promotion-eligibility", () => ({ useSubmitEmployeePromotionDocket: () => ({ mutateAsync: mocks.submit, isPending: false }) }));
vi.mock("@/components/staff-shell/staff-notify", () => ({ notifyStaff: mocks.notify, notifyStaffError: vi.fn() }));

import { EmployeePromotionDocketModal } from "./employee-promotion-docket-modal";

const criterionId = "11111111-1111-4111-8111-111111111111";
beforeEach(() => vi.clearAllMocks());

describe("EmployeePromotionDocketModal", () => {
  it("names the target rank and does not invent a unit commander", () => {
    render(<EmployeePromotionDocketModal criterionId={criterionId} onOpenChange={vi.fn()} open targetRankName="Police Corporal" />);
    expect(screen.getByText("Submit Promotion Docket")).toBeVisible();
    expect(screen.getByText("Police Corporal")).toBeVisible();
    expect(screen.queryByText(/Endorsing Unit Commander/)).not.toBeInTheDocument();
  });

  it("keeps the modal open and shows the error when submission fails", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    mocks.submit.mockRejectedValue(new Error("You already have a docket for this criterion."));
    render(<EmployeePromotionDocketModal criterionId={criterionId} onOpenChange={onOpenChange} open targetRankName="Police Corporal" />);
    await user.type(screen.getByLabelText(/Applicant Remarks/), "Ready.");
    await user.click(screen.getByRole("button", { name: "Submit Application" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You already have a docket for this criterion.");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("closes and confirms on success", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    mocks.submit.mockResolvedValue("docket-id");
    render(<EmployeePromotionDocketModal criterionId={criterionId} onOpenChange={onOpenChange} open targetRankName="Police Corporal" />);
    await user.type(screen.getByLabelText(/Applicant Remarks/), "Ready.");
    await user.click(screen.getByRole("button", { name: "Submit Application" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Promotion docket submitted" }));
  });
});
