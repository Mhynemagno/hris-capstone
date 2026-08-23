import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeaveStatusBadge } from "./leave-status-badge";
import { LeaveTypeSummary } from "./leave-type-manager";

describe("leave presentation", () => {
  it("gives a rejected request an accessible textual status", () => {
    render(<LeaveStatusBadge status="rejected" />);
    expect(screen.getByText("rejected")).toBeVisible();
  });

  it("labels evidence-required leave types for HR", () => {
    render(<LeaveTypeSummary name="Sick leave" requiresAttachment />);
    expect(screen.getByText("Evidence required")).toBeVisible();
  });
});
