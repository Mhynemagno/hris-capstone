import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({ useMyPromotionEligibility: vi.fn(), usePromotionEvaluations: vi.fn() }));
vi.mock("@/hooks/use-promotion-eligibility", () => hooks);

import { EmployeePromotionEligibility } from "./employee-promotion-eligibility";
import { HrPromotionDirectory } from "./hr-promotion-directory";

describe("promotion eligibility presentation", () => {
  it("renders only the employee-safe readiness summary", () => {
    hooks.useMyPromotionEligibility.mockReturnValue({ isLoading: false, data: { target_position_title: "Senior Officer", years_of_service: 3, is_ready: false, missing_requirements: ["First-aid certification"] } });
    render(<EmployeePromotionEligibility />);
    expect(screen.getByText("First-aid certification")).toBeInTheDocument();
    expect(screen.queryByText(/recommendation|performance rating|HR notes/i)).not.toBeInTheDocument();
  });

  it("labels the HR directory as an advisory review without a promotion action", () => {
    hooks.usePromotionEvaluations.mockReturnValue({ isLoading: false, data: { rows: [], count: 0 } });
    render(<HrPromotionDirectory />);
    expect(screen.getByText(/never change an employee.?s position automatically/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /promote/i })).not.toBeInTheDocument();
  });
});
