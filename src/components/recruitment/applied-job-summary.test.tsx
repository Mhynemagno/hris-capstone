import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AppliedJob } from "@/lib/types/database";

import { AppliedJobSummary } from "./applied-job-summary";

const job: AppliedJob = {
  id: 1,
  title: "Investigator",
  description: "Handles case files for the station.",
  location: "Main station",
  closes_on: "2026-10-31",
  status: "closed",
  departments: { name: "Intelligence Section" },
  ranks: { name: "Police Corporal", code: "PCpl" },
  job_qualification_criteria: [
    { id: "c2", kind: "skill", requirement: "Report writing", is_required: false, ordinal: 2 },
    { id: "c1", kind: "education", requirement: "Bachelor's degree", is_required: true, ordinal: 1 },
  ],
};

describe("AppliedJobSummary", () => {
  it("shows the job, department, rank, and details the applicant applied for", () => {
    render(<AppliedJobSummary job={job} status="Under Review" submittedAt="2026-09-20T08:00:00Z" />);

    expect(screen.getByRole("heading", { name: "What you applied for" })).toBeInTheDocument();
    expect(screen.getByText("Investigator")).toBeInTheDocument();
    expect(screen.getByText("Intelligence Section")).toBeInTheDocument();
    expect(screen.getByText("PCpl — Police Corporal")).toBeInTheDocument();
    expect(screen.getByText("Main station")).toBeInTheDocument();
    expect(screen.getByText("Handles case files for the station.")).toBeInTheDocument();
    expect(screen.getByText("Under Review")).toBeInTheDocument();
  });

  it("lists the qualification criteria in order and marks the required ones", () => {
    render(<AppliedJobSummary job={job} status="Under Review" submittedAt="2026-09-20T08:00:00Z" />);

    const items = within(screen.getByRole("list", { name: "Qualifications" })).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(["Bachelor's degree (required)", "Report writing"]);
  });

  it("explains when the job details are no longer available", () => {
    render(<AppliedJobSummary job={null} status="Submitted" submittedAt="2026-09-20T08:00:00Z" />);

    expect(screen.getByText(/job details are no longer available/i)).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
  });
});
