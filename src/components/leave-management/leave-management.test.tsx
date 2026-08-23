import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeaveStatusBadge } from "./leave-status-badge";

describe("leave presentation", () => {
  it("gives a rejected request an accessible textual status", () => {
    render(<LeaveStatusBadge status="rejected" />);
    expect(screen.getByText("rejected")).toBeVisible();
  });
});
