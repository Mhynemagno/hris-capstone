import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ search: "", replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
  usePathname: () => "/hr/applications",
  useSearchParams: () => new URLSearchParams(nav.search),
}));
const rows = [
  { id: "11111111-0000-0000-0000-000000000001", applicant_id: "a1", job_opening_id: 1, status: "Final Evaluation", stage_result: "scheduled", submitted_at: "2026-10-01T00:00:00Z", ai_score_status: "completed", ai_score: 82, applicant_name: "Ana Reyes", applicant_number: 12345, job_title: "Patrol North" },
  { id: "11111111-0000-0000-0000-000000000002", applicant_id: "a2", job_opening_id: 1, status: "Application Submission", stage_result: "pending", submitted_at: "2026-10-03T00:00:00Z", ai_score_status: "failed", ai_score: null, applicant_name: "Carlo Diaz", applicant_number: 12346, job_title: "Patrol North" },
];
vi.mock("@/hooks/use-recruitment", () => ({
  useAllHrApplications: () => ({ isLoading: false, error: null, refetch: vi.fn(), data: rows }),
  useAllHrJobs: () => ({ data: [{ id: 1, title: "Patrol North" }] }),
}));
vi.mock("@/hooks/use-applicant-portal", () => ({ useHrRegisteredApplicants: () => ({ isLoading: false, error: null, data: [] }) }));

import { HrApplications } from "./hr-applications";

describe("HrApplications", () => {
  beforeEach(() => { nav.search = ""; nav.replace.mockReset(); });

  it("shows the job posting, stage and AI match, best match first", () => {
    render(<HrApplications />);
    const [first, second] = screen.getAllByRole("row").slice(1);
    expect(within(first!).getByRole("link", { name: "Ana Reyes" })).toHaveAttribute("href", "/hr/applications/11111111-0000-0000-0000-000000000001");
    expect(first).toHaveTextContent("Patrol North");
    expect(first).toHaveTextContent("82");
    expect(second).toHaveTextContent("Analysis failed");
    expect(screen.getByText("1–2 of 2 applications")).toBeInTheDocument();
  });

  it("puts filters in the URL", async () => {
    render(<HrApplications />);
    await userEvent.selectOptions(screen.getByLabelText("Stage"), "Panel Interview");
    expect(nav.replace).toHaveBeenCalledWith("/hr/applications?stage=Panel+Interview", { scroll: false });
  });

  it("shows removable chips for active filters", () => {
    nav.search = "stage=Application+Submission&job=1";
    render(<HrApplications />);
    expect(screen.getByRole("button", { name: "Remove filter Stage: Application Submission" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove filter Job: Patrol North" })).toBeInTheDocument();
  });

  it("shows a Status column with the client's status words and the stage underneath", () => {
    render(<HrApplications />);
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Stage" })).not.toBeInTheDocument();
    const [first, second] = screen.getAllByRole("row").slice(1);
    expect(first).toHaveTextContent("Scheduled");
    expect(first).toHaveTextContent("Final Evaluation");
    expect(second).toHaveTextContent("Pending / For Evaluation");
  });

  it("opens the application from the row menu instead of moving stages there", async () => {
    render(<HrApplications />);
    await userEvent.click(screen.getByRole("button", { name: "Actions for Ana Reyes" }));
    expect(await screen.findByRole("menuitem", { name: "Open application" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /^Move to / })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Mark as not selected" })).not.toBeInTheDocument();
  });
});
