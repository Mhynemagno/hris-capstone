import { render, screen } from "@testing-library/react";
import Link from "next/link";
import { expect, it } from "vitest";

import { StatusPanel } from "./status-panel";

it("makes an error state actionable and announced", () => {
  render(
    <StatusPanel
      action={<Link href="/jobs">Try careers again</Link>}
      description="We could not load current openings."
      kind="error"
      title="Job openings are unavailable"
    />,
  );

  expect(screen.getByRole("alert")).toHaveTextContent(
    "Job openings are unavailable",
  );
  expect(
    screen.getByRole("link", { name: "Try careers again" }),
  ).toHaveAttribute("href", "/jobs");
});
