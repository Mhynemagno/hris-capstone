import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  useMyPromotionEligibility: vi.fn(),
  usePromotionReadiness: vi.fn(),
  usePromotionReadinessPage: vi.fn(),
  useHrPromotionEmployee: vi.fn(),
  usePromotionCriteria: vi.fn(),
  useRecordPerformanceEvaluation: vi.fn(),
  useCreatePromotionEvaluation: vi.fn(),
}));
const adminHooks = vi.hoisted(() => ({ useRankOptions: vi.fn() }));
vi.mock("@/hooks/use-promotion-eligibility", () => hooks);
vi.mock("@/hooks/use-administration", () => adminHooks);
vi.mock("next/navigation", () => ({ usePathname: () => "/hr/promotions", useRouter: () => ({ replace: vi.fn() }), useSearchParams: () => new URLSearchParams("") }));

import { PromotionReviewModal } from "./promotion-review-modal";

const ranks = [
  { id: 7, name: "Senior Police Officer", code: "SPO", sort_order: 1, is_active: true },
  { id: 9, name: "Police Chief Inspector", code: "PCI", sort_order: 2, is_active: true },
];

describe("PromotionReviewModal rubric", () => {
  async function setup() {
    const recordEvaluation = vi.fn().mockResolvedValue("rating-id");
    hooks.useHrPromotionEmployee.mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        employee: { first_name: "Bat", last_name: "Erdene", employee_number: "1-00001", rank_id: 7, employment_started_on: "2010-01-01" },
        qualifications: [],
        certifications: [
          { id: "c1", name: "Public Safety Basic Recruit Course (PSBRC)", category: "mandatory_course", expires_on: null },
          { id: "c2", name: "Special Weapons and Tactics (SWAT) Course", category: "specialized_training", expires_on: null },
        ],
        training: [],
        ratings: [
          { id: "r1", rating: 4, review_period_starts_on: "2025-01-01", review_period_ends_on: "2025-12-31", notes: null, total_points: null },
          { id: "r2", rating: 5, review_period_starts_on: "2024-01-01", review_period_ends_on: "2024-12-31", notes: null, total_points: 95, grade_equivalent: "1.00", descriptive_rating: "Outstanding" },
        ],
        evaluations: [],
      },
    });
    hooks.usePromotionCriteria.mockReturnValue({
      isLoading: false,
      error: null,
      data: [{ id: "c1", target_rank_id: 9, minimum_years_of_service: 5, minimum_performance_rating: 3, is_active: true }],
    });
    hooks.useRecordPerformanceEvaluation.mockReturnValue({ isPending: false, mutateAsync: recordEvaluation });
    hooks.useCreatePromotionEvaluation.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });
    hooks.usePromotionReadiness.mockReturnValue({ isLoading: false, data: [
      { employee_id: "e1", employee_name: "Erdene, Bat", evaluation_id: "v1", target_rank_id: 9, target_rank_name: "Police Chief Inspector", evaluated_on: "2026-09-01", recommendation: "deferred", readiness: { yearsOfService: 6, minimumYearsOfService: 5, isReady: false, missingRequirements: ["Scuba Diving"], requirements: [{ label: "Basic Course", met: true }, { label: "Scuba Diving", met: false }] } },
    ] });
    adminHooks.useRankOptions.mockReturnValue({ isLoading: false, data: ranks });
    render(<PromotionReviewModal employeeId="00000000-0000-4000-8000-000000000201" onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Performance evaluation" }));
    return { recordEvaluation };
  }

  it("grades performance with the points rubric instead of a 1–5 dropdown", async () => {
    await setup();
    expect(screen.queryByRole("combobox", { name: /Overall rating/ })).not.toBeInTheDocument();
    const rubric = screen.getByRole("region", { name: "Performance evaluation" });
    expect(within(rubric).getByRole("row", { name: /Length of service/ })).toHaveTextContent("50 / 50");
    expect(within(rubric).getByRole("row", { name: /Mandatory career courses/ })).toHaveTextContent("15 / 30");
    expect(within(rubric).getByRole("row", { name: /Specialized unit training/ })).toHaveTextContent("10 / 20");
    expect(within(rubric).getByRole("row", { name: /Total score/ })).toHaveTextContent("75 / 100");
    expect(rubric).toHaveTextContent("2.00");
    expect(rubric).toHaveTextContent("Satisfactory");
    expect(screen.getByRole("table", { name: "Rating scale" })).toHaveTextContent("90 – 100");
  });

  it("lists saved evaluations with their score and older ratings with their label", async () => {
    await setup();
    expect(screen.getByText("95 / 100 · 1.00 Outstanding")).toBeVisible();
    expect(screen.getByText("4 – Very satisfactory")).toBeVisible();
  });

  it("records an evaluation for a review period and blocks an earlier end", async () => {
    const { recordEvaluation } = await setup();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Review period start/), "2026-06-30");
    expect(screen.getByLabelText(/Review period end/)).toHaveAttribute("min", "2026-06-30");
    await user.type(screen.getByLabelText(/Review period end/), "2026-01-01");
    await user.click(screen.getByRole("button", { name: "Save evaluation" }));
    expect(await screen.findByText("Review period end must be on or after its start.")).toBeVisible();
    expect(recordEvaluation).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText(/Review period end/));
    await user.type(screen.getByLabelText(/Review period end/), "2026-12-31");
    await user.click(screen.getByRole("button", { name: "Save evaluation" }));
    expect(recordEvaluation).toHaveBeenCalledWith(expect.objectContaining({ employeeId: "00000000-0000-4000-8000-000000000201", reviewPeriodStartsOn: "2026-06-30", reviewPeriodEndsOn: "2026-12-31" }));
  });
});
