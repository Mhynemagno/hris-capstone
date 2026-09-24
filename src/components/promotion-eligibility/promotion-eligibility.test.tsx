import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  useMyPromotionEligibility: vi.fn(),
  usePromotionEvaluations: vi.fn(),
  useHrPromotionEmployee: vi.fn(),
  usePromotionCriteria: vi.fn(),
  useCreatePerformanceRating: vi.fn(),
  useCreatePromotionEvaluation: vi.fn(),
}));
const adminHooks = vi.hoisted(() => ({ usePositionOptions: vi.fn() }));
vi.mock("@/hooks/use-promotion-eligibility", () => hooks);
vi.mock("@/hooks/use-administration", () => adminHooks);

import { EmployeePromotionEligibility } from "./employee-promotion-eligibility";
import { HrPromotionDirectory } from "./hr-promotion-directory";
import { HrPromotionReview } from "./hr-promotion-review";

const positions = [
  { id: 7, title: "Senior Police Officer", is_active: true },
  { id: 9, title: "Police Chief Inspector", is_active: true },
];

describe("promotion eligibility presentation", () => {
  it("renders only the employee-safe readiness summary", () => {
    hooks.useMyPromotionEligibility.mockReturnValue({ isLoading: false, data: { target_position_title: "Senior Officer", years_of_service: 3, is_ready: false, missing_requirements: ["First-aid certification"] } });
    render(<EmployeePromotionEligibility />);
    expect(screen.getByText("First-aid certification")).toBeInTheDocument();
    expect(screen.queryByText(/recommendation|performance rating|HR notes/i)).not.toBeInTheDocument();
  });

  it("labels the HR directory as an advisory review without a promotion action", () => {
    hooks.usePromotionEvaluations.mockReturnValue({ isLoading: false, data: { rows: [], count: 0 } });
    adminHooks.usePositionOptions.mockReturnValue({ isLoading: false, data: positions });
    render(<HrPromotionDirectory />);
    expect(screen.getByText(/never change an employee.?s position automatically/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /promote/i })).not.toBeInTheDocument();
    expect(screen.getByText("No promotion reviews have been recorded yet.")).toBeVisible();
  });
});

describe("HrPromotionReview", () => {
  function setup() {
    const createRating = vi.fn().mockResolvedValue("rating-id");
    hooks.useHrPromotionEmployee.mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        employee: { first_name: "Bat", last_name: "Erdene", employment_started_on: "2020-01-01" },
        qualifications: [],
        certifications: [],
        training: [],
        ratings: [{ id: "r1", rating: 4, review_period_starts_on: "2025-01-01", review_period_ends_on: "2025-12-31", notes: null }],
        evaluations: [],
      },
    });
    hooks.usePromotionCriteria.mockReturnValue({
      isLoading: false,
      error: null,
      data: [{ id: "c1", target_position_id: 9, minimum_years_of_service: 5, minimum_performance_rating: 3, is_active: true }],
    });
    hooks.useCreatePerformanceRating.mockReturnValue({ isPending: false, mutateAsync: createRating });
    hooks.useCreatePromotionEvaluation.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });
    adminHooks.usePositionOptions.mockReturnValue({ isLoading: false, data: positions });
    render(<HrPromotionReview employeeId="00000000-0000-4000-8000-000000000201" />);
    return { createRating };
  }

  it("labels criteria options with the target position title", () => {
    setup();
    const criterion = screen.getByRole("combobox", { name: /Target position/ });
    const labels = within(criterion).getAllByRole("option").map((option) => option.textContent);
    expect(labels[1]).toContain("Police Chief Inspector");
    expect(labels.join(" ")).not.toMatch(/Position 9/);
  });

  it("offers a 1–5 rating select with descriptors and shows existing ratings with them", () => {
    setup();
    const rating = screen.getByRole("combobox", { name: /Overall rating/ });
    expect(within(rating).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Choose a rating",
      "1 – Poor",
      "2 – Needs improvement",
      "3 – Satisfactory",
      "4 – Very satisfactory",
      "5 – Outstanding",
    ]);
    expect(screen.getByRole("listitem")).toHaveTextContent("4 – Very satisfactory");
  });

  it("binds the rating period end minimum to its start and blocks an earlier end", async () => {
    const { createRating } = setup();
    const user = userEvent.setup();
    await user.selectOptions(screen.getByRole("combobox", { name: /Overall rating/ }), "3");
    await user.type(screen.getByLabelText(/Review period start/), "2026-06-30");
    expect(screen.getByLabelText(/Review period end/)).toHaveAttribute("min", "2026-06-30");
    await user.type(screen.getByLabelText(/Review period end/), "2026-01-01");
    await user.click(screen.getByRole("button", { name: "Save rating" }));

    expect(await screen.findByText("Review period end must be on or after its start.")).toBeVisible();
    expect(createRating).not.toHaveBeenCalled();
  });
});
