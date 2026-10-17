import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PNP_CERTIFICATIONS } from "@/lib/pnp-catalogue";

const hooks = vi.hoisted(() => ({
  useCreatePromotionCriterion: vi.fn(),
  usePromotionCriteria: vi.fn(),
  useSetPromotionCriterionActive: vi.fn(),
}));
vi.mock("@/hooks/use-promotion-eligibility", () => hooks);
vi.mock("@/hooks/use-administration", () => ({
  useRankOptions: () => ({ isLoading: false, data: [{ id: 7, name: "Senior Police Officer", code: "SPO", sort_order: 1, is_active: true }, { id: 9, name: "Police Chief Inspector", code: "PCI", sort_order: 2, is_active: true }] }),
}));
vi.mock("@/components/deletion/delete-record-dialog", () => ({ DeleteRecordDialog: () => null }));

import { PromotionCriteriaManager } from "./promotion-criteria-manager";

const [first, second] = PNP_CERTIFICATIONS;
const create = vi.fn();

beforeEach(() => {
  create.mockReset().mockResolvedValue("c1");
  hooks.useCreatePromotionCriterion.mockReturnValue({ isPending: false, mutateAsync: create });
  hooks.useSetPromotionCriterionActive.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });
  hooks.usePromotionCriteria.mockReturnValue({
    isLoading: false,
    error: null,
    data: [{
      id: "c0",
      target_rank_id: 9,
      minimum_years_of_service: 5,
      minimum_time_in_grade_years: 2,
      minimum_performance_rating: 3,
      iper_review_period_months: 12,
      pft_minimum_score: 75,
      pft_validity_months: 12,
      is_active: true,
      promotion_criteria_requirements: [{ id: "r1", ordinal: 1, record_kind: "certification", required_name: first, label: first }],
    }],
  });
});

async function chooseRank(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole("combobox", { name: /Target Rank/ }), "SPO");
  await user.click(await screen.findByRole("option", { name: /Senior Police Officer/ }));
}

describe("PromotionCriteriaManager", () => {
  it("collects the approved time, IPER, PFT, and course criteria", () => {
    render(<PromotionCriteriaManager />);
    expect(screen.getByLabelText(/^Time in Grade/)).toBeRequired();
    expect(screen.getByRole("group", { name: "IPER Evaluation" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Physical Fitness Test (PFT)" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Required Courses" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Minimum IPER rating/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Minimum PFT score/)).toBeInTheDocument();
    const requirement = screen.getByLabelText(/^Certification \/ Training/);
    expect(requirement).not.toBeRequired();
    expect(within(requirement).getAllByRole("option").map((option) => option.textContent)).toEqual(["Choose a certification / training", ...PNP_CERTIFICATIONS]);
    expect(screen.queryByRole("button", { name: /Remove requirement/ })).not.toBeInTheDocument();
    expect(within(requirement).getByRole("option", { name: "Public Safety Basic Recruit Course (PSBRC)" }).parentElement).toHaveAttribute("label", "Mandatory Course");
    expect(within(requirement).getByRole("option", { name: "Special Weapons and Tactics (SWAT) Course" }).parentElement).toHaveAttribute("label", "Specialized Training");
  });

  it("summarizes existing evaluation settings", () => {
    render(<PromotionCriteriaManager />);
    expect(screen.getByText("Time in Grade: at least 2 years")).toBeVisible();
    expect(screen.getByText("IPER: 3/5 within 12 months")).toBeVisible();
    expect(screen.getByText("PFT: 75+ score, valid 12 months")).toBeVisible();
    expect(screen.getByText(`Certification / Training: ${first}`)).toBeVisible();
  });

  it("requires both pieces of an IPER setting", async () => {
    const user = userEvent.setup();
    render(<PromotionCriteriaManager />);
    await chooseRank(user);
    await user.selectOptions(screen.getByLabelText(/^Minimum IPER rating/), "4");
    await user.click(screen.getByRole("button", { name: "Save Criteria" }));
    expect(await screen.findByText("Set both the IPER rating and review period, or leave both blank.")).toBeVisible();
    expect(create).not.toHaveBeenCalled();
  });

  it("adds and removes requirement rows without offering a training twice, then saves them all", async () => {
    const user = userEvent.setup();
    render(<PromotionCriteriaManager />);
    await chooseRank(user);
    await user.selectOptions(screen.getByLabelText(/^Certification \/ Training/), first);
    await user.click(screen.getByRole("button", { name: "Add another certification / training" }));
    expect(screen.getByLabelText(/^Certification \/ Training 1/)).toHaveValue(first);
    const row2 = screen.getByLabelText(/^Certification \/ Training 2/);
    expect(within(row2).queryByRole("option", { name: first })).not.toBeInTheDocument();
    await user.selectOptions(row2, second);

    await user.click(screen.getByRole("button", { name: "Add another certification / training" }));
    expect(screen.getByLabelText(/^Certification \/ Training 3/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove requirement 3" }));
    expect(screen.queryByLabelText(/^Certification \/ Training 3/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save Criteria" }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({
      targetRankId: 7,
      minimumYearsOfService: 1,
      minimumTimeInGradeYears: 1,
      minimumPerformanceRating: null,
      iperReviewPeriodMonths: null,
      pftMinimumScore: null,
      pftValidityMonths: null,
      requirements: [first, second].map((name) => ({ recordKind: "certification", requiredName: name, label: name, isMandatory: true })),
    }));
  });
});
