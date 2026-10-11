import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn(), notify: vi.fn(), detail: { data: undefined as unknown, isLoading: false, error: null as Error | null }, criteria: undefined as unknown, readiness: undefined as unknown }));
vi.mock("@/components/staff-shell/staff-notify", () => ({ notifyStaff: mocks.notify }));
vi.mock("./performance-evaluation", () => ({ PerformanceEvaluation: () => <p>Rubric form</p> }));
vi.mock("@/hooks/use-administration", () => ({
  useRankOptions: () => ({ data: [{ id: 3, name: "Police Staff Sergeant", code: "PSSG", sort_order: 3, is_active: true }, { id: 4, name: "Police Master Sergeant", code: "PMSG", sort_order: 4, is_active: true }] }),
}));
vi.mock("@/hooks/use-promotion-eligibility", () => ({
  useHrPromotionEmployee: () => mocks.detail,
  usePromotionCriteria: () => mocks.criteria,
  usePromotionReadiness: () => mocks.readiness,
  useCreatePromotionEvaluation: () => ({ mutateAsync: mocks.create, isPending: false }),
}));

import { PromotionReviewModal } from "./promotion-review-modal";

const EMPLOYEE_ID = "22222222-2222-4222-8222-222222222222";

describe("PromotionReviewModal (promotions.html Open Review)", () => {
  beforeEach(() => {
    mocks.detail = { isLoading: false, error: null, data: { employee: { id: EMPLOYEE_ID, first_name: "Tyson", last_name: "Peters", employee_number: "4-15889", rank_id: 3, employment_started_on: "2024-01-01" }, qualifications: [], certifications: [], training: [], ratings: [] } };
    mocks.criteria = { isLoading: false, error: null, data: [{ id: "11111111-1111-4111-8111-111111111111", target_rank_id: 4, minimum_years_of_service: 2, is_active: true }] };
    mocks.readiness = { isLoading: false, error: null, data: [{ target_rank_id: 4, target_rank_name: "Police Master Sergeant", evaluated_on: "2026-10-09", readiness: { isReady: false, yearsOfService: 2.5, minimumYearsOfService: 2, missingRequirements: ["Police Intelligence Operations Course"], requirements: [{ label: "At least 2 years of service", met: true }, { label: "Police Intelligence Operations Course", met: false }] } }] };
  });
  afterEach(() => { mocks.create.mockReset(); mocks.notify.mockReset(); });

  it("shows the candidate, the checklist and the rubric", async () => {
    render(<PromotionReviewModal employeeId={EMPLOYEE_ID} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Promotion Eligibility Evaluation" })).toBeInTheDocument();
    expect(screen.getByText("Review candidate criteria checklist for PMSG rank")).toBeInTheDocument();
    expect(screen.getByText("Current Rank: Police Staff Sergeant (PSSG) • Badge 4-15889")).toBeInTheDocument();
    expect(screen.getByText("Not Yet Ready")).toBeInTheDocument();
    expect(screen.getByText("PASSED")).toBeInTheDocument();
    expect(screen.getByText("NOT MET")).toBeInTheDocument();
    expect(screen.queryByText("Rubric form")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Performance evaluation" }));
    expect(screen.getByText("Rubric form")).toBeInTheDocument();
  });

  it("submits the endorsement once", async () => {
    const onClose = vi.fn();
    mocks.create.mockResolvedValue("ev1");
    render(<PromotionReviewModal employeeId={EMPLOYEE_ID} onClose={onClose} />);
    await userEvent.selectOptions(screen.getByLabelText(/^Recommendation/), "deferred");
    await userEvent.type(screen.getByLabelText(/^Remarks/), "Complete the course first.");
    await userEvent.click(screen.getByRole("button", { name: "Submit Endorsement" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ employeeId: EMPLOYEE_ID, targetRankId: 4, criterionId: "11111111-1111-4111-8111-111111111111", recommendation: "deferred", notes: "Complete the course first.", evidence: [] }));
    expect(mocks.notify).toHaveBeenCalledWith({ title: "Board endorsement submitted" });
    expect(onClose).toHaveBeenCalled();
  });

  it("says when the employee cannot be found", () => {
    mocks.detail = { isLoading: false, error: null, data: null };
    render(<PromotionReviewModal employeeId={EMPLOYEE_ID} onClose={vi.fn()} />);
    expect(screen.getByText("This employee could not be found.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit Endorsement" })).not.toBeInTheDocument();
  });

  it("requires HR to choose a target rank when readiness has no rank", () => {
    mocks.readiness = { isLoading: false, error: null, data: [] };
    render(<PromotionReviewModal employeeId={EMPLOYEE_ID} onClose={vi.fn()} />);
    const target = screen.getByLabelText("Target Rank");
    expect(target).toBeRequired();
    expect(target).toHaveValue("");
    expect(screen.getByRole("button", { name: "Submit Endorsement" })).toBeDisabled();
  });

  it("blocks submission while readiness is loading", () => {
    mocks.readiness = { isLoading: true, error: null, data: undefined };
    render(<PromotionReviewModal employeeId={EMPLOYEE_ID} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Submit Endorsement" })).toBeDisabled();
  });

  it("shows the criteria query error instead of an absent-criteria message", () => {
    mocks.criteria = { isLoading: false, error: new Error("Criteria service unavailable"), data: [] };
    render(<PromotionReviewModal employeeId={EMPLOYEE_ID} onClose={vi.fn()} />);
    expect(screen.getByText("Criteria service unavailable")).toBeInTheDocument();
    expect(screen.queryByText("No active promotion criteria exist. Add criteria first.")).not.toBeInTheDocument();
  });
});
