import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PNP_TRAININGS } from "@/lib/pnp-catalogue";

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

const [first, second] = PNP_TRAININGS;
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
      minimum_performance_rating: 3,
      is_active: true,
      promotion_criteria_requirements: [{ id: "r1", ordinal: 1, record_kind: "training", required_name: first, label: first }],
    }],
  });
});

async function chooseRank(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole("combobox", { name: /Target rank/ }), "SPO");
  await user.click(await screen.findByRole("option", { name: /Senior Police Officer/ }));
}

describe("PromotionCriteriaManager", () => {
  it("asks only for years of service and required trainings", () => {
    render(<PromotionCriteriaManager />);
    expect(screen.queryByLabelText(/performance rating/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Required credential/i)).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: /^Requirements/ })).toBeInTheDocument();
    const recordType = screen.getByLabelText(/^Record type/);
    expect(within(recordType).getAllByRole("option").map((option) => option.textContent)).toEqual(["Training / Schooling"]);
    expect(screen.getByLabelText(/^Requirement 1/)).toBeRequired();
    expect(screen.queryByRole("button", { name: /Remove requirement/ })).not.toBeInTheDocument();
  });

  it("summarizes existing criteria without a rating minimum", () => {
    render(<PromotionCriteriaManager />);
    expect(screen.getByText("At least 5 years of service")).toBeVisible();
    expect(screen.queryByText(/rating/i)).not.toBeInTheDocument();
    expect(screen.getByText(`Training / Schooling: ${first}`)).toBeVisible();
  });

  it("requires at least one requirement", async () => {
    const user = userEvent.setup();
    render(<PromotionCriteriaManager />);
    await chooseRank(user);
    await user.click(screen.getByRole("button", { name: "Save criteria" }));
    expect(await screen.findByText("Choose a training or schooling.")).toBeVisible();
    expect(create).not.toHaveBeenCalled();
  });

  it("adds and removes requirement rows without offering a training twice, then saves them all", async () => {
    const user = userEvent.setup();
    render(<PromotionCriteriaManager />);
    await chooseRank(user);
    await user.selectOptions(screen.getByLabelText(/^Requirement 1/), first);
    await user.click(screen.getByRole("button", { name: "Add requirement" }));
    const row2 = screen.getByLabelText(/^Requirement 2/);
    expect(within(row2).queryByRole("option", { name: first })).not.toBeInTheDocument();
    await user.selectOptions(row2, second);

    await user.click(screen.getByRole("button", { name: "Add requirement" }));
    expect(screen.getByLabelText(/^Requirement 3/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove requirement 3" }));
    expect(screen.queryByLabelText(/^Requirement 3/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save criteria" }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({
      targetRankId: 7,
      minimumYearsOfService: 0,
      minimumPerformanceRating: null,
      requirements: [first, second].map((name) => ({ recordKind: "training", requiredName: name, label: name, isMandatory: true })),
    }));
  });
});
