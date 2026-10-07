import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ withdraw: vi.fn(), search: "", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, push: vi.fn() }),
  usePathname: () => "/hr/jobs",
  useSearchParams: () => new URLSearchParams(mocks.search),
}));
vi.mock("@/components/deletion/delete-record-dialog", () => ({ DeleteRecordDialog: ({ entityId }: { entityId: number | null }) => (entityId ? <div role="alertdialog">Delete draft {entityId}</div> : null) }));
vi.mock("@/components/ui/toaster", () => ({ notifySuccess: vi.fn() }));
vi.mock("@/hooks/use-recruitment", () => ({
  useAllHrJobs: () => ({ isLoading: false, error: null, refetch: vi.fn(), data: [
    { id: 1, title: "Patrol North", location: "San Juan", status: "published", closes_on: "2099-12-31", updated_at: "2026-10-02T00:00:00Z", applications: [{ count: 4 }], job_qualification_criteria: [] },
    { id: 2, title: "Draft Opening", location: "San Juan", status: "draft", closes_on: "2099-12-31", updated_at: "2026-10-01T00:00:00Z", applications: [{ count: 0 }], job_qualification_criteria: [] },
  ] }),
  useWithdrawJobOpening: () => ({ isPending: false, mutateAsync: mocks.withdraw }),
}));

import { HrJobPostings } from "./hr-job-postings";

describe("HrJobPostings", () => {
  beforeEach(() => { mocks.search = ""; mocks.withdraw.mockReset(); });

  it("lists postings in a table with application counts linking to the applications list", () => {
    render(<HrJobPostings />);
    expect(screen.getByRole("heading", { level: 1, name: "Job postings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New job posting" })).toHaveAttribute("href", "/hr/jobs/new");
    expect(screen.getByRole("link", { name: "4 applications for Patrol North" })).toHaveAttribute("href", "/hr/applications?job=1&quick=all");
    expect(screen.getByRole("tab", { name: /Draft.*1/ })).toBeInTheDocument();
  });

  it("withdraws through a confirmation dialog", async () => {
    mocks.withdraw.mockResolvedValue(undefined);
    render(<HrJobPostings />);
    await userEvent.click(screen.getByRole("button", { name: "Actions for Patrol North" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Withdraw" }));
    const dialog = screen.getByRole("alertdialog", { name: "Withdraw “Patrol North”?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Withdraw" }));
    expect(mocks.withdraw).toHaveBeenCalledWith(1);
  });

  it("offers Delete draft only for an empty draft", async () => {
    render(<HrJobPostings />);
    await userEvent.click(screen.getByRole("button", { name: "Actions for Draft Opening" }));
    expect(await screen.findByRole("menuitem", { name: "Delete draft" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Withdraw" })).not.toBeInTheDocument();
  });

  it("explains when filters match nothing", () => {
    mocks.search = "q=zzz";
    render(<HrJobPostings />);
    expect(screen.getByText("No job postings match")).toBeInTheDocument();
  });
});
