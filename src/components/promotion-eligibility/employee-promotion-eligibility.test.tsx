import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), submit: vi.fn(), notify: vi.fn() }));
vi.mock("@/hooks/use-promotion-eligibility", () => ({
  useMyPromotionEligibility: mocks.query,
  useSubmitEmployeePromotionDocket: () => ({ mutateAsync: mocks.submit, isPending: false }),
}));
vi.mock("@/components/staff-shell/staff-notify", () => ({ notifyStaff: mocks.notify, notifyStaffError: vi.fn() }));

import { EmployeePromotionEligibility } from "./employee-promotion-eligibility";

const criterionId = "11111111-1111-4111-8111-111111111111";
const data = (overrides: Record<string, unknown> = {}, readiness: Record<string, unknown> = {}) => ({
  criterionId,
  currentRankName: "Patrolman",
  targetRankName: "Police Corporal",
  targetRankCode: "PCpl",
  evaluatedOn: null,
  docket: null,
  readiness: {
    yearsOfService: 3,
    minimumYearsOfService: 2,
    isReady: false,
    missingRequirements: ["First-aid certification"],
    requirements: [{ label: "Basic Course", met: true }, { label: "First-aid certification", met: false }],
    ...readiness,
  },
  ...overrides,
});

beforeEach(() => { vi.clearAllMocks(); mocks.submit.mockResolvedValue("docket-id"); });

describe("EmployeePromotionEligibility", () => {
  it("shows the rank-matched overview, checklist with text states, and the missing requirements", () => {
    mocks.query.mockReturnValue({ isLoading: false, error: null, data: data() });
    render(<EmployeePromotionEligibility />);
    expect(screen.getByText("Promotion Status")).toBeVisible();
    expect(screen.getByText("Police Corporal")).toBeVisible();
    expect(screen.getByText("Missing Requirements")).toBeVisible();
    expect(screen.getByText(/not an automatic promotion decision/i)).toBeVisible();
    const missing = screen.getByRole("region", { name: "Missing Requirements" });
    expect(within(missing).getByText("First-aid certification")).toBeVisible();
    expect(screen.getAllByText("MET")).toHaveLength(2);
    expect(screen.getAllByText("NOT MET").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Submit to Promotion Board" })).not.toBeInTheDocument();
    expect(screen.getByText("Requirements pending")).toBeVisible();
  });

  it("lets a ready employee open the docket modal, requires remarks, and submits through the mutation", async () => {
    const user = userEvent.setup();
    mocks.query.mockReturnValue({ isLoading: false, error: null, data: data({}, { isReady: true, missingRequirements: [], requirements: [{ label: "Basic Course", met: true }] }) });
    render(<EmployeePromotionEligibility />);
    expect(screen.getByText("Every requirement is on record.")).toBeVisible();
    await user.click(screen.getAllByRole("button", { name: "Submit to Promotion Board" })[0]);
    await user.click(screen.getByRole("button", { name: "Submit Application" }));
    expect(screen.getByText("Enter your remarks before submitting.")).toBeVisible();
    expect(mocks.submit).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText(/Applicant Remarks/), "  Ready for review.  ");
    await user.click(screen.getByRole("button", { name: "Submit Application" }));
    expect(mocks.submit).toHaveBeenCalledWith({ criterionId, remarks: "Ready for review." });
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Promotion docket submitted" }));
  });

  it("shows the submitted docket instead of submit controls", () => {
    mocks.query.mockReturnValue({ isLoading: false, error: null, data: data({ docket: { id: "d", criterionId, remarks: "Please review.", submittedAt: "2026-10-05T01:00:00+00:00" } }, { isReady: true, missingRequirements: [] }) });
    render(<EmployeePromotionEligibility />);
    expect(screen.getAllByText(/Docket submitted/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/October 5, 2026/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Submit to Promotion Board" })).not.toBeInTheDocument();
  });

  it("shows no-active-criterion only once loaded", () => {
    mocks.query.mockReturnValue({ isLoading: false, error: null, data: null });
    render(<EmployeePromotionEligibility />);
    expect(screen.getByText(/No active promotion criterion applies to your current rank/)).toBeVisible();
  });

  it("shows loading and error states, never the empty state", () => {
    mocks.query.mockReturnValue({ isLoading: true, error: null, data: undefined });
    const { rerender } = render(<EmployeePromotionEligibility />);
    expect(screen.queryByText(/No active promotion criterion/)).not.toBeInTheDocument();
    mocks.query.mockReturnValue({ isLoading: false, error: new Error("boom"), data: undefined });
    rerender(<EmployeePromotionEligibility />);
    expect(screen.getByText("boom")).toBeVisible();
    expect(screen.queryByText(/No active promotion criterion/)).not.toBeInTheDocument();
  });
});
