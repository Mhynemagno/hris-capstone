import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ search: "", replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
  usePathname: () => "/hr/applications",
  useSearchParams: () => new URLSearchParams(nav.search),
}));
const applicants = [
  { user_id: "u1", applicant_id: "a1", applicant_number: 12345, first_name: "Ana", middle_name: null, last_name: "Reyes", qualifier: null, full_name: null, email: "ana@example.test", phone: "09171234567", registered_at: "2026-09-01T00:00:00Z", email_confirmed: true, account_active: true, application_count: 1, latest_application_id: "app-1", latest_application_status: "Interview", latest_job_title: "Patrol", latest_submitted_at: "2026-09-02T00:00:00Z" },
  { user_id: "u2", applicant_id: "a2", applicant_number: 202602, first_name: "Ben", middle_name: null, last_name: "Cruz", qualifier: null, full_name: null, email: "ben@example.test", phone: null, registered_at: "2026-09-05T00:00:00Z", email_confirmed: false, account_active: false, application_count: 0, latest_application_id: null, latest_application_status: null, latest_job_title: null, latest_submitted_at: null },
];
const actions = vi.hoisted(() => ({ reactivate: vi.fn(), send: vi.fn() }));
vi.mock("@/hooks/use-applicant-portal", () => ({
  useHrRegisteredApplicants: () => ({ isLoading: false, error: null, refetch: vi.fn(), data: applicants }),
  useReactivateApplicantAccount: () => ({ isPending: false, mutateAsync: actions.reactivate }),
  useSendApplicantCredentials: () => ({ isPending: false, mutateAsync: actions.send }),
}));
vi.mock("@/components/ui/toaster", () => ({ notifySuccess: vi.fn() }));

import type { HrRegisteredApplicant } from "@/lib/types/database";

import { HrRegisteredApplicants, RegisteredApplicantDrawer } from "./hr-registered-applicants";

describe("HrRegisteredApplicants", () => {
  beforeEach(() => { nav.search = ""; nav.push.mockReset(); actions.reactivate.mockReset().mockResolvedValue(undefined); actions.send.mockReset().mockResolvedValue(undefined); });

  it("lists every account with its latest stage and an unconfirmed-email badge", () => {
    render(<HrRegisteredApplicants />);
    expect(screen.getByRole("link", { name: "Reyes, Ana" })).toHaveAttribute("href", "/hr/applications/app-1");
    expect(within(screen.getByRole("row", { name: /Cruz, Ben/ })).getByText("Unconfirmed")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Cruz, Ben/ })).getByText("Pending")).toBeInTheDocument();
  });

  it("filters to accounts that have not applied", () => {
    nav.search = "applied=not-yet";
    render(<HrRegisteredApplicants />);
    expect(screen.queryByRole("link", { name: "Reyes, Ana" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cruz, Ben" })).toBeInTheDocument();
  });

  it("opens a contact drawer for someone who has not applied", async () => {
    render(<HrRegisteredApplicants />);
    await userEvent.click(screen.getByRole("button", { name: "Cruz, Ben" }));
    const drawer = screen.getByRole("dialog", { name: "Cruz, Ben" });
    expect(drawer).toHaveTextContent("ben@example.test");
    expect(drawer).toHaveTextContent("Not confirmed");
    expect(drawer).toHaveTextContent("2-02602");
    expect(drawer).not.toHaveTextContent("Not assigned yet");
  });

  it("shows every registered applicant's number in the list", () => {
    render(<HrRegisteredApplicants />);
    expect(within(screen.getByRole("row", { name: /Reyes, Ana/ })).getByText("0-12345")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Cruz, Ben/ })).getByText("2-02602")).toBeInTheDocument();
  });

  it("lets HR reactivate a deactivated account and send new credentials once it is active", async () => {
    render(<HrRegisteredApplicants />);
    await userEvent.click(screen.getByRole("button", { name: "Cruz, Ben" }));
    const drawer = screen.getByRole("dialog", { name: "Cruz, Ben" });
    expect(drawer).toHaveTextContent("Deactivated");
    expect(within(drawer).getByRole("button", { name: "Send new credentials" })).toBeDisabled();
    await userEvent.click(within(drawer).getByRole("button", { name: "Reactivate account" }));
    expect(actions.reactivate).toHaveBeenCalledWith("u2");
  });

  it("sends new credentials to an active applicant's email", async () => {
    render(<RegisteredApplicantDrawer applicant={applicants[0] as HrRegisteredApplicant} onClose={vi.fn()} />);
    const drawer = screen.getByRole("dialog", { name: "Reyes, Ana" });
    expect(within(drawer).queryByRole("button", { name: "Reactivate account" })).not.toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole("button", { name: "Send new credentials" }));
    expect(actions.send).toHaveBeenCalledWith("ana@example.test");
  });
});
