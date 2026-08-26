import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { PublicCareersLanding } from "./public-careers-landing";

vi.mock("@/hooks/use-recruitment", () => ({
  usePublishedJobs: vi.fn(() => ({
    data: {
      rows: [
        {
          closes_on: "2026-10-31",
          description: "Serve the community through visible patrol work.",
          id: 7,
          location: "San Juan City",
          title: "Patrol Officer",
        },
      ],
    },
    error: null,
    isLoading: false,
  })),
}));

it("connects visitors to live career openings and the application path", () => {
  render(<PublicCareersLanding />);

  expect(
    screen.getByRole("heading", { level: 1, name: /serve san juan/i }),
  ).toBeVisible();
  expect(
    screen.getByRole("link", { name: "View Patrol Officer opening" }),
  ).toHaveAttribute("href", "/jobs/7");
  expect(
    screen.getByRole("link", { name: /explore open positions/i }),
  ).toHaveAttribute("href", "/jobs");
  expect(
    screen.getByRole("link", { name: /create an applicant account/i }),
  ).toHaveAttribute("href", "/applicant/register");
});
