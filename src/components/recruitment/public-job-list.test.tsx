import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { PublicJobList } from "./public-job-list";

const usePublishedJobs = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-recruitment", () => ({ usePublishedJobs }));

it("labels each job-opening link with its role", () => {
  usePublishedJobs.mockReturnValue({
    data: {
      rows: [
        {
          closes_on: null,
          description: "Coordinate community safety programmes.",
          id: 12,
          location: "San Juan City",
          title: "Community Liaison Officer",
        },
      ],
    },
    error: null,
    isLoading: false,
  });

  render(<PublicJobList pageSize={3} />);

  expect(
    screen.getByRole("link", {
      name: "View Community Liaison Officer opening",
    }),
  ).toHaveAttribute("href", "/jobs/12");
  expect(usePublishedJobs).toHaveBeenCalledWith({ page: 1, pageSize: 3 });
});

it("gives visitors a helpful empty careers message", () => {
  usePublishedJobs.mockReturnValue({
    data: { rows: [] },
    error: null,
    isLoading: false,
  });

  render(<PublicJobList />);

  expect(
    screen.getByRole("status", { name: /no published openings/i }),
  ).toBeVisible();
});
