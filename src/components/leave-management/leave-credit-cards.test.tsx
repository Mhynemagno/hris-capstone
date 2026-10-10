import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeaveCreditCards } from "./leave-credit-cards";

const type = (id: string, name: string, days: number | null, description: string | null) => ({ id, name, description, days_per_year: days, excess_deducted_from_retirement: false, is_active: true, requires_attachment: false, eligible_gender: null });

describe("LeaveCreditCards", () => {
  it("shows each leave type as a card with its yearly days, note and remaining credits", () => {
    render(<LeaveCreditCards balances={[{ leave_type_id: "sick", days_per_year: 15, excess_deducted_from_retirement: false, used_days: 4 }]} types={[type("mandatory", "Mandatory Leave", 2, "2 days per year standard entitlement."), type("sick", "Sick Leave", 15, "Requires a medical certificate.")]} year={2026} />);
    const sick = screen.getByRole("article", { name: "Sick Leave" });
    expect(sick).toHaveTextContent("15 Days / Year");
    expect(sick).toHaveTextContent("11 days left in 2026");
    expect(sick).toHaveTextContent("NOTE: Requires a medical certificate.");
    expect(within(screen.getByRole("article", { name: "Mandatory Leave" })).getByText("2 days left in 2026")).toBeInTheDocument();
  });

  it("can hide remaining credits and add an action per card", () => {
    render(<LeaveCreditCards action={(leaveType) => <button type="button">Update {leaveType.name}</button>} types={[type("vacation", "Vacation Leave", 15, null)]} />);
    const card = screen.getByRole("article", { name: "Vacation Leave" });
    expect(card).not.toHaveTextContent("left in");
    expect(within(card).getByRole("button", { name: "Update Vacation Leave" })).toBeInTheDocument();
  });
});
