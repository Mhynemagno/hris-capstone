import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { MetricCard } from "./metric-card";

it("renders a dashboard metric with a stable numeric treatment", () => {
  render(
    <MetricCard
      description="As of the selected reporting period"
      label="Active personnel"
      value={120}
    />,
  );

  expect(screen.getByRole("article")).toHaveAccessibleName(
    "Active personnel",
  );
  expect(screen.getByText("120")).toHaveClass("tabular-nums");
});
