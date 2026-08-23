import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AttendanceStatusBadge } from "./attendance-status-badge";

describe("attendance integration presentation", () => {
  it.each(["present", "late", "absent", "incomplete"] as const)("labels %s attendance accessibly", (status) => {
    render(<AttendanceStatusBadge status={status} />);
    expect(screen.getByText(status)).toBeVisible();
  });
});
