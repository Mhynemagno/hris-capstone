import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ usePublishedJob: vi.fn(), getUser: vi.fn(), push: vi.fn() }));

vi.mock("@/hooks/use-recruitment", () => ({ usePublishedJob: mocks.usePublishedJob }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/supabase/client", () => ({ createBrowserSupabaseClient: () => ({ auth: { getUser: mocks.getUser } }) }));

import { PublicJobDetail } from "./public-job-detail";

const job = {
  id: 9,
  title: "Patrolman",
  description: "Serve the community through visible patrol work.",
  location: "San Juan City",
  closes_on: "2026-09-29",
  image_path: "job-openings/9/0b8f2c1e-1111-4222-8333-944455556666.png",
  job_qualification_criteria: [{ id: "c1", ordinal: 1, requirement: "Bachelor's degree", is_required: true }],
};

describe("PublicJobDetail", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");
    mocks.usePublishedJob.mockReturnValue({ data: job, error: null, isLoading: false });
  });

  it("shows the title, posting image, description and sends signed-out visitors to registration after they accept the privacy notice", async () => {
    const user = userEvent.setup();
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    render(<PublicJobDetail jobId={9} />);

    expect(screen.getByRole("heading", { level: 1, name: "Patrolman" })).toBeVisible();
    expect(screen.getByRole("img", { name: "Patrolman job posting" })).toHaveAttribute("src", expect.stringContaining("/storage/v1/object/public/job-posting-images/job-openings/9/"));
    expect(screen.getByText("Serve the community through visible patrol work.")).toBeVisible();
    expect(screen.getByText(/Deadline of Application: September 29, 2026/)).toBeVisible();
    await waitFor(() => expect(mocks.getUser).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Apply now" }));
    expect(await screen.findByRole("dialog", { name: "Data Privacy Notice" })).toBeVisible();
    const agree = screen.getByRole("button", { name: "I Agree & Continue" });
    expect(agree).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /I have read and agree/ }));
    await user.click(agree);
    expect(mocks.push).toHaveBeenCalledWith(`/applicant/register?next=${encodeURIComponent("/applicant/apply/9")}`);
  });

  it("does not continue when the privacy notice is cancelled", async () => {
    const user = userEvent.setup();
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    render(<PublicJobDetail jobId={9} />);

    await user.click(screen.getByRole("button", { name: "Apply now" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("sends signed-in applicants to the application after they accept the privacy notice", async () => {
    const user = userEvent.setup();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    render(<PublicJobDetail jobId={9} />);

    await waitFor(() => expect(mocks.getUser).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Apply now" }));
    await user.click(await screen.findByRole("checkbox", { name: /I have read and agree/ }));
    await user.click(screen.getByRole("button", { name: "I Agree & Continue" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/applicant/apply/9"));
  });

  it("lists the General Requirements, including older criteria", () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    mocks.usePublishedJob.mockReturnValue({ data: { ...job, job_qualification_criteria: [
      { id: "c3", ordinal: 3, kind: "other", requirement: "Filipino Citizen", is_required: true },
      { id: "c1", ordinal: 1, kind: "education", requirement: "Baccalaureate Degree", is_required: true },
      { id: "c2", ordinal: 2, kind: "eligibility", requirement: "Licensed Criminologist", is_required: true },
      { id: "c4", ordinal: 4, kind: "experience", requirement: "At least 2 years of police service", is_required: false },
    ] }, error: null, isLoading: false });
    render(<PublicJobDetail jobId={9} />);

    const section = screen.getByRole("region", { name: "General Requirements" });
    expect(section).toHaveTextContent("Requirement 1: EducationBaccalaureate Degree");
    expect(section).toHaveTextContent("Requirement 2: EligibilityLicensed Criminologist");
    expect(screen.getByRole("heading", { name: "Other requirements" })).toBeInTheDocument();
    expect(screen.getByText("Filipino Citizen")).toBeInTheDocument();
    expect(screen.getByText("Experience: At least 2 years of police service (preferred)")).toBeInTheDocument();
    expect(screen.queryByText("Qualifications")).not.toBeInTheDocument();
  });

  it("omits the image when the posting has none", () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    mocks.usePublishedJob.mockReturnValue({ data: { ...job, image_path: null }, error: null, isLoading: false });
    render(<PublicJobDetail jobId={9} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
