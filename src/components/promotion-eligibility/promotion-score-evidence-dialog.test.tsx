import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ assignment: vi.fn(), award: vi.fn(), board: vi.fn(), notify: vi.fn() }));
vi.mock("@/components/staff-shell/staff-notify", () => ({ notifyStaff: mocks.notify }));
vi.mock("@/hooks/use-promotion-scorecard", () => ({
  useRecordPromotionAssignment: () => ({ isPending: false, mutateAsync: mocks.assignment }),
  useRecordPromotionAward: () => ({ isPending: false, mutateAsync: mocks.award }),
  useRecordPromotionBoardAssessment: () => ({ isPending: false, mutateAsync: mocks.board }),
}));

import { PromotionScoreEvidenceDialog } from "./promotion-score-evidence-dialog";

const employeeId = "11111111-1111-4111-8111-111111111111";

describe("PromotionScoreEvidenceDialog", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  it("bounds a Promotion Board score to the policy maximum and closes after saving", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mocks.board.mockResolvedValue("22222222-2222-4222-8222-222222222222");
    render(<PromotionScoreEvidenceDialog band="PSMS-PEMS" criterion="board" employeeId={employeeId} employeeName="Cruz, Ana" onClose={onClose} presentRankId={5} />);

    const score = screen.getByLabelText(/score/i);
    expect(score).toHaveAttribute("max", "10");
    await user.type(score, "11");
    await user.type(screen.getByLabelText(/evidence/i), "Panel interview sheet");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("cannot exceed 10");
    expect(mocks.board).not.toHaveBeenCalled();

    await user.clear(score);
    await user.type(score, "9.5");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(mocks.board).toHaveBeenCalledWith(expect.objectContaining({ employeeId, criterion: "board", band: "PSMS-PEMS", score: 9.5, evidence: "Panel interview sheet" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("offers only the band's fixed assignment types and asks for a region only for geographical ones", async () => {
    const user = userEvent.setup();
    mocks.assignment.mockResolvedValue("22222222-2222-4222-8222-222222222222");
    render(<PromotionScoreEvidenceDialog band="PSMS-PEMS" criterion="assignment" employeeId={employeeId} onClose={vi.fn()} presentRankId={5} />);

    const type = screen.getByLabelText(/assignment type/i);
    expect(within(type).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Choose a type", "Field Duty/QUAD Staff", "Administrative Duty", "Geographical Assignment (Luzon or Visayas)", "Geographical Assignment (Mindanao)",
    ]);
    expect(screen.queryByLabelText(/region/i)).not.toBeInTheDocument();
    await user.selectOptions(type, "geographic_luzon_visayas");
    const region = screen.getByLabelText(/region/i);
    expect(within(region).getAllByRole("option").map((option) => option.textContent)).toEqual(["Choose a region", "Luzon", "Visayas"]);

    await user.selectOptions(region, "Visayas");
    await user.type(screen.getByLabelText(/start/i), "2026-01-01");
    await user.type(screen.getByLabelText(/end/i), "2026-06-30");
    await user.type(screen.getByLabelText(/evidence/i), "Special orders");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(mocks.assignment).toHaveBeenCalledWith({ employeeId, kind: "geographic", region: "Visayas", startedOn: "2026-01-01", endedOn: "2026-06-30", evidence: "Special orders" });
  });

  it("lists policy awards with their fixed points and shows RPC errors", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mocks.award.mockRejectedValue(new Error("Awards must be recorded against the employee current rank."));
    render(<PromotionScoreEvidenceDialog band="PCPL-PMSG" criterion="awards" employeeId={employeeId} onClose={onClose} presentRankId={3} />);

    const award = screen.getByLabelText(/award/i, { selector: "select" });
    expect(within(award).getByRole("option", { name: "Medalya ng Kagitingan (10 pts)" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/points/i, { selector: "input" })).not.toBeInTheDocument();
    await user.selectOptions(award, "medalya_ng_kagitingan");
    await user.type(screen.getByLabelText(/date awarded/i), "2026-03-01");
    await user.type(screen.getByLabelText(/evidence/i), "Citation");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(mocks.award).toHaveBeenCalledWith({ employeeId, awardKey: "medalya_ng_kagitingan", awardedOn: "2026-03-01", presentRankId: 3, evidence: "Citation" });
    expect(screen.getByRole("alert")).toHaveTextContent("current rank");
    expect(onClose).not.toHaveBeenCalled();
  });
});
