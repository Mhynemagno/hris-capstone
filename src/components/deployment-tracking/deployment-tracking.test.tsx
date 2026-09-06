import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DeploymentStatusBadge } from "./deployment-status-badge";

describe("deployment tracking presentation", () => {
  it.each(["active", "rejected"] as const)("labels %s deployments accessibly", (status) => {
    render(<DeploymentStatusBadge status={status} />);
    expect(screen.getByText(status)).toBeVisible();
  });
});
