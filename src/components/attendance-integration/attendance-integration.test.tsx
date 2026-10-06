import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AttendanceStatusBadge } from "./attendance-status-badge";

describe("attendance integration presentation", () => {
  it.each([
    ["present", "Present"],
    ["late", "Late"],
    ["absent", "Absent"],
    ["incomplete", "Partial"],
  ] as const)("labels %s attendance as %s", (status, label) => {
    render(<AttendanceStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeVisible();
  });
});
