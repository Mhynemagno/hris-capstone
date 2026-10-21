import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ replace: vi.fn(), params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/hr/promotions", useRouter: () => ({ replace: mocks.replace }), useSearchParams: () => mocks.params }));
vi.mock("./promotion-review-modal", () => ({ PromotionReviewModal: ({ employeeId }: { employeeId: string }) => <div role="dialog">Review {employeeId}</div> }));
vi.mock("@/components/deletion/delete-record-dialog", () => ({ DeleteRecordDialog: () => null }));
vi.mock("@/hooks/use-administration", () => ({ useRankOptions: () => ({ data: [{ id: 4, name: "Police Master Sergeant", code: "PMSG", sort_order: 4, is_active: true }] }) }));
vi.mock("@/hooks/use-promotion-eligibility", () => ({
  useCreatePromotionCriterion: () => ({ isPending: false, mutateAsync: vi.fn() }),
  usePromotionCriteria: () => ({ isLoading: false, error: null, data: [] }),
  usePromotionReadinessPage: () => ({
    isLoading: false,
    error: null,
    data: { count: 1, rows: [{ employee_id: "e1", employee_name: "Tyson Peters", evaluation_id: "v1", target_rank_id: 4, target_rank_name: "Police Master Sergeant", evaluated_on: "2026-10-09", recommendation: "recommended", readiness: { isReady: true, yearsOfService: 2.5, minimumYearsOfService: 2, missingRequirements: [], requirements: [] } }] },
  }),
  useSetPromotionCriterionActive: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

import { StaffPromotions } from "./staff-promotions";

describe("StaffPromotions (promotions.html)", () => {
  beforeEach(() => { mocks.params = new URLSearchParams(); });
  afterEach(() => mocks.replace.mockReset());

  it("shows the banner and the candidates table", async () => {
    render(<StaffPromotions />);
    expect(screen.getByRole("heading", { level: 1, name: "Promotions Evaluation" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search candidates" })).toHaveAttribute("placeholder", "Search employee, badge no. or rank...");
    expect(screen.getByText("Promotion Board Guidelines")).toBeInTheDocument();
    const row = screen.getByText("Tyson Peters").closest("tr")!;
    expect(within(row).getByText("PMSG — Police Master Sergeant")).toBeInTheDocument();
    expect(within(row).getByText("October 9, 2026")).toBeInTheDocument();
    expect(within(row).getByText("Ready")).toBeInTheDocument();
    expect(within(row).getByText("Recommended")).toBeInTheDocument();
    await userEvent.click(within(row).getByRole("button", { name: "Open review for Tyson Peters, PMSG — Police Master Sergeant" }));
    expect(mocks.replace).toHaveBeenCalledWith("/hr/promotions?review=e1", { scroll: false });
  });

  it("opens the read-only official policy matrix instead of manual policy configuration", async () => {
    render(<StaffPromotions />);
    await userEvent.click(screen.getByRole("button", { name: /Official policy matrix/ }));
    expect(mocks.replace).toHaveBeenCalledWith("/hr/promotions?criteria=1", { scroll: false });
  });

  it("renders the criteria panel and the review from the URL", () => {
    mocks.params = new URLSearchParams("criteria=1");
    const { unmount } = render(<StaffPromotions />);
    expect(screen.getByRole("dialog", { name: "Official promotion policy matrix" })).toHaveTextContent("PLT–PLTCOL");
    unmount();
    mocks.params = new URLSearchParams("review=e1");
    render(<StaffPromotions />);
    expect(screen.getByRole("dialog")).toHaveTextContent("Review e1");
  });
});
