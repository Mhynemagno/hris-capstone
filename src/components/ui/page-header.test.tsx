import { render, screen } from "@testing-library/react";
import Link from "next/link";
import { expect, it } from "vitest";

import { PageHeader } from "./page-header";

it("presents a page purpose and its primary action", () => {
  render(
    <PageHeader
      action={<Link href="/jobs">Browse all openings</Link>}
      description="Apply securely for a role serving San Juan."
      eyebrow="Careers"
      title="Current openings"
    />,
  );

  expect(
    screen.getByRole("heading", { level: 1, name: "Current openings" }),
  ).toBeVisible();
  expect(screen.getByText("Careers")).toBeVisible();
  expect(
    screen.getByRole("link", { name: "Browse all openings" }),
  ).toHaveAttribute("href", "/jobs");
});
