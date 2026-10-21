import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  remove: vi.fn(),
  withdraw: vi.fn(),
  notify: vi.fn(),
  params: new URLSearchParams(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/hr/jobs",
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => mocks.params,
}));
vi.mock("@/components/staff-shell/staff-notify", () => ({ notifyStaff: mocks.notify }));
vi.mock("@/hooks/use-deletion", () => ({ useDeleteRecord: () => ({ mutateAsync: mocks.remove, isPending: false }) }));

const job = (id: number, title: string, status: "draft" | "published" | "closed", closes_on: string, applications: number, updated_at: string) =>
  ({ id, title, location: "San Juan City Police Station", status, closes_on, updated_at, applications: [{ count: applications }], job_qualification_criteria: [] });

vi.mock("@/hooks/use-recruitment", () => ({
  useAllHrJobs: () => ({
    isLoading: false,
    error: null,
    data: [
      job(1, "SAN JUAN CITY RECRUITMENT - CY 2026", "published", "2026-10-14", 2, "2026-10-09T00:00:00Z"),
      job(2, "Patrolman/Patrolwoman Recruitment", "closed", "2026-10-09", 0, "2026-10-08T00:00:00Z"),
      job(3, "PCpl Vacancy", "closed", "2026-09-30", 1, "2026-10-02T00:00:00Z"),
      job(4, "Be one of us", "draft", "2026-11-30", 0, "2026-09-27T00:00:00Z"),
    ],
  }),
  useWithdrawJobOpening: () => ({ mutateAsync: mocks.withdraw, isPending: false }),
}));

import { StaffJobPostings } from "./staff-job-postings";

describe("StaffJobPostings (jobpost.html)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-11T08:00:00+08:00"));
    mocks.params = new URLSearchParams();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    mocks.remove.mockReset();
    mocks.withdraw.mockReset();
    mocks.notify.mockReset();
  });

  it("shows the mockup header, tabs with counts and deadline notes", () => {
    render(<StaffJobPostings />);
    expect(screen.getByRole("heading", { level: 1, name: "RECRUITMENT OPENINGS" })).toBeInTheDocument();
    expect(screen.getByText(/two recruitment openings per calendar year/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /create recruitment/i })).toHaveAttribute("href", "/hr/jobs/new");
    for (const name of ["All 4", "Published 1", "Draft 1", "Closed 2"]) expect(screen.getByRole("button", { name })).toBeInTheDocument();
    expect(screen.getByText("Closes in 3 days")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(5);
  });

  it("filters by the status tab from the URL and by search", async () => {
    mocks.params = new URLSearchParams("status=published");
    const { unmount } = render(<StaffJobPostings />);
    expect(screen.getAllByRole("row")).toHaveLength(2);
    unmount();
    mocks.params = new URLSearchParams();
    render(<StaffJobPostings />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search job postings" }), "pcpl");
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByText("PCpl Vacancy")).toBeInTheDocument();
  });

  it("sorts by Updated, newest first by default, and toggles", async () => {
    render(<StaffJobPostings />);
    const updated = screen.getByRole("columnheader", { name: /updated/i });
    expect(updated).toHaveAttribute("aria-sort", "descending");
    await userEvent.click(within(updated).getByRole("button"));
    expect(updated).toHaveAttribute("aria-sort", "ascending");
  });

  it("links View and Edit", () => {
    render(<StaffJobPostings />);
    const row = screen.getByText("PCpl Vacancy").closest("tr")!;
    expect(within(row).getByRole("link", { name: "View Posting" })).toHaveAttribute("href", "/jobs/3");
    expect(within(row).getByRole("link", { name: "Edit Posting" })).toHaveAttribute("href", "/hr/jobs/3");
  });

  it("deletes draft and closed postings without applications", async () => {
    mocks.remove.mockResolvedValue(undefined);
    render(<StaffJobPostings />);
    const closedRow = screen.getByText("Patrolman/Patrolwoman Recruitment").closest("tr")!;
    await userEvent.click(within(closedRow).getByRole("button", { name: "Delete Posting" }));
    expect(window.confirm).toHaveBeenCalledWith("Are you sure you want to delete this posting?");
    expect(mocks.remove).toHaveBeenCalledWith({ entityId: 2 });
    expect(mocks.notify).toHaveBeenCalledWith({ title: "Posting deleted" });
  });

  it("withdraws a published posting instead of deleting it, and reports a refusal", async () => {
    mocks.withdraw.mockRejectedValue(new Error("This posting can't be withdrawn."));
    render(<StaffJobPostings />);
    const row = screen.getByText("SAN JUAN CITY RECRUITMENT - CY 2026").closest("tr")!;
    await userEvent.click(within(row).getByRole("button", { name: "Withdraw Posting" }));
    expect(mocks.withdraw).toHaveBeenCalledWith(1);
    expect(mocks.notify).toHaveBeenCalledWith({ title: "Could not withdraw posting", description: "This posting can't be withdrawn.", tone: "error" });
  });

  it("offers no delete or withdraw on a closed posting that has applications", () => {
    render(<StaffJobPostings />);
    const row = screen.getByText("PCpl Vacancy").closest("tr")!;
    expect(within(row).queryByRole("button", { name: /Delete Posting|Withdraw Posting/ })).not.toBeInTheDocument();
  });
});
