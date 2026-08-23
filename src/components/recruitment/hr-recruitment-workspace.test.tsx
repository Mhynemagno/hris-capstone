import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HrJobForm } from "./hr-job-form";
import { HrApplicationDetail } from "./hr-application-detail";

const mocks = vi.hoisted(() => ({
  saveJob: vi.fn(),
  transition: vi.fn(),
  hire: vi.fn(),
}));

vi.mock("@/hooks/use-administration", () => ({
  useDepartments: () => ({ data: { rows: [{ id: 1, name: "People" }] } }),
  usePositions: () => ({ data: { rows: [{ id: 2, title: "Recruiter" }] } }),
}));

vi.mock("@/hooks/use-recruitment", () => ({
  useSaveJobOpening: () => ({ isPending: false, mutateAsync: mocks.saveJob }),
  useMyApplication: () => ({
    isLoading: false,
    data: {
      application: { id: "00000000-0000-0000-0000-000000000001", status: "Shortlisted", submitted_at: "2026-08-20T00:00:00Z", cover_note: "Interested" },
      history: [{ id: "00000000-0000-0000-0000-000000000002", next_status: "Shortlisted", note: null }],
      documents: [],
    },
  }),
  useTransitionApplicationStatus: () => ({ isPending: false, mutateAsync: mocks.transition }),
  useHireApplication: () => ({ isPending: false, mutateAsync: mocks.hire }),
}));

describe("HR recruitment workspace", () => {
  it("saves a draft job opening with its qualification criteria", async () => {
    mocks.saveJob.mockResolvedValue({ id: 3 });
    const user = userEvent.setup();
    render(<HrJobForm />);

    await user.type(screen.getByLabelText("Title"), "Senior Recruiter");
    await user.type(screen.getByLabelText("Description"), "Lead recruitment operations across the organization.");
    await user.type(screen.getByLabelText("Qualification 1"), "Five years of experience");
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(mocks.saveJob).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({ status: "draft", departmentId: 1, positionId: 2, criteria: [expect.objectContaining({ requirement: "Five years of experience" })] }),
    })));
  });

  it("allows HR to move an application forward and open the hire decision", async () => {
    mocks.transition.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<HrApplicationDetail applicationId="00000000-0000-0000-0000-000000000001" />);

    await user.selectOptions(screen.getByLabelText("Next status"), "Interview");
    await user.click(screen.getByRole("button", { name: "Update status" }));
    expect(mocks.transition).toHaveBeenCalledWith({ applicationId: "00000000-0000-0000-0000-000000000001", nextStatus: "Interview", note: undefined });

    await user.selectOptions(screen.getByLabelText("Next status"), "Hired");
    expect(screen.getByRole("heading", { name: "Hire applicant" })).toBeInTheDocument();
  });
});
