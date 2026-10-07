import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ save: vi.fn(), replace: vi.fn(), notify: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/components/ui/toaster", () => ({ notifySuccess: mocks.notify }));
vi.mock("@/hooks/use-recruitment", () => ({ useSaveJobOpening: () => ({ isPending: false, mutateAsync: mocks.save }) }));

import { HrJobForm } from "./hr-job-form";

async function fillValidJobOpening(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Title/), "Community Safety Officer");
  await user.type(screen.getByLabelText(/Location/), "San Juan City Police Station");
  await user.type(screen.getByLabelText(/Deadline of Application/), "2026-10-31");
  await user.type(screen.getByLabelText(/Description/), "Support community safety and coordinate public outreach programs.");
  await user.selectOptions(screen.getByLabelText(/Requirement 1: Education/), "Baccalaureate Degree");
  await user.selectOptions(screen.getByLabelText(/Requirement 2: Eligibility/), "NAPOLCOM PNP Entrance Examination");
}

describe("HrJobForm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.save.mockResolvedValue({ id: 55 });
  });

  it("returns to job openings after a successful publish", async () => {
    const user = userEvent.setup();
    render(<HrJobForm />);
    await fillValidJobOpening(user);

    await user.click(screen.getByRole("button", { name: "Publish opening" }));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/hr/jobs"));
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({ status: "published" }) }));
  });

  it("keeps the form open after saving a draft", async () => {
    const user = userEvent.setup();
    render(<HrJobForm />);
    await fillValidJobOpening(user);

    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({ status: "draft" }) })));
    expect(mocks.replace).not.toHaveBeenCalled();
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith("Draft saved."));
  });

  it("groups the form into Details, Requirements and Image with actions in a side panel", () => {
    render(<HrJobForm />);
    for (const heading of ["Details", "Requirements", "Image"]) expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    const panel = screen.getByRole("complementary", { name: "Posting status" });
    expect(within(panel).getByText("Draft")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Save draft" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Publish opening" })).toBeInTheDocument();
  });

  it("links a published posting to the public site", () => {
    render(<HrJobForm job={{ id: 7, title: "Patrol", description: "x".repeat(30), location: "San Juan", closes_on: "2099-12-31", status: "published", department_id: null, rank_id: null, published_at: null, created_by_user_id: null, created_at: "", updated_at: "", job_qualification_criteria: [], applications: [{ count: 2 }] }} />);
    expect(screen.getByRole("link", { name: "View on public site" })).toHaveAttribute("href", "/jobs/7");
    expect(screen.getByText("2 applications")).toBeInTheDocument();
  });

  it("has no department or rank fields and requires title, location, and deadline of application", async () => {
    const user = userEvent.setup();
    render(<HrJobForm />);

    expect(screen.queryByLabelText(/Department/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Rank/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Position/)).toHaveValue("PAT — Patrolman / Patrolwoman");
    expect(screen.getByLabelText(/^Position/)).toHaveAttribute("readonly");
    expect(screen.getByLabelText(/Title/)).toBeRequired();
    expect(screen.getByLabelText(/Location/)).toBeRequired();
    expect(screen.getByLabelText(/Deadline of Application/)).toBeRequired();

    await user.click(screen.getByRole("button", { name: "Save draft" }));

    expect(await screen.findByText("Enter a location of at least 2 characters.")).toBeInTheDocument();
    expect(screen.getByText("Enter a title of at least 2 characters.")).toBeInTheDocument();
    expect(screen.getByText("Choose the deadline of application.")).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("saves the General Requirements as education, eligibility and the checked other requirements", async () => {
    const user = userEvent.setup();
    render(<HrJobForm />);
    expect(screen.getByRole("heading", { name: "Requirements" })).toBeInTheDocument();
    expect(screen.queryByText("Qualification criteria")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add criterion" })).not.toBeInTheDocument();
    const education = screen.getByLabelText(/Requirement 1: Education/);
    expect([...education.querySelectorAll("option")].map((option) => option.textContent)).toEqual(["Select education", "Baccalaureate Degree", "Others"]);
    const eligibility = screen.getByLabelText(/Requirement 2: Eligibility/);
    expect([...eligibility.querySelectorAll("option")].map((option) => option.textContent)).toEqual([
      "Select eligibility",
      "NAPOLCOM PNP Entrance Examination",
      "Licensed Criminologist",
      "Bar or Board Examination / RA 1080",
      "Civil Service Eligibility to College Honor Graduates (PD 907)",
      "Civil Service Professional Examination",
      "Others",
    ]);
    for (const name of ["Filipino Citizen", "No pending criminal case", "Minimum height requirement"]) {
      expect(screen.getByRole("checkbox", { name })).toBeChecked();
    }

    await fillValidJobOpening(user);
    await user.selectOptions(education, "Others");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Specify the education requirement.")).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();

    await user.click(screen.getByLabelText(/Specify education/));
    await user.paste("Master's degree in Public Administration");
    await user.click(screen.getByRole("checkbox", { name: "Minimum height requirement" }));
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({
        criteria: [
          { ordinal: 1, kind: "education", requirement: "Master's degree in Public Administration", isRequired: true },
          { ordinal: 2, kind: "eligibility", requirement: "NAPOLCOM PNP Entrance Examination", isRequired: true },
          { ordinal: 3, kind: "other", requirement: "Filipino Citizen", isRequired: true },
          { ordinal: 4, kind: "other", requirement: "No pending criminal case", isRequired: true },
        ],
      }),
    })));
  }, 15_000);

  it("keeps an older opening's unlisted criteria when editing it", async () => {
    const user = userEvent.setup();
    const criterion = (ordinal: number, kind: "education" | "eligibility" | "experience" | "other", requirement: string) => ({ id: `9b8f2c1e-1111-4222-8333-94445555666${ordinal}`, job_opening_id: 8, ordinal, kind, requirement, is_required: true, created_at: "" });
    const job = { id: 8, title: "Patrolman", description: "Serve the community through visible patrol work.", location: "San Juan City", closes_on: "2026-10-31", status: "draft" as const, image_path: null, department_id: null, rank_id: null, published_at: null, created_by_user_id: "u1", created_at: "", updated_at: "", job_qualification_criteria: [
      criterion(1, "education", "Baccalaureate degree in Criminology"),
      criterion(2, "eligibility", "NAPOLCOM PNP Entrance Examination"),
      criterion(3, "experience", "At least 2 years of police service"),
      criterion(4, "other", "Filipino citizen"),
    ] };
    render(<HrJobForm job={job} />);

    expect(screen.getByLabelText(/Requirement 1: Education/)).toHaveValue("Baccalaureate degree in Criminology");
    expect(screen.getByLabelText(/Requirement 2: Eligibility/)).toHaveValue("NAPOLCOM PNP Entrance Examination");
    expect(screen.getByRole("checkbox", { name: "Filipino Citizen" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "No pending criminal case" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "At least 2 years of police service" })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({
      jobId: 8,
      input: expect.objectContaining({
        criteria: [
          { ordinal: 1, kind: "education", requirement: "Baccalaureate degree in Criminology", isRequired: true },
          { ordinal: 2, kind: "eligibility", requirement: "NAPOLCOM PNP Entrance Examination", isRequired: true },
          { ordinal: 3, kind: "other", requirement: "Filipino Citizen", isRequired: true },
          { ordinal: 4, kind: "experience", requirement: "At least 2 years of police service", isRequired: true },
        ],
      }),
    })));
  });

  it("uploads an optional posting image with the save and shows a preview", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => "blob:preview");
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    render(<HrJobForm />);
    await fillValidJobOpening(user);
    const file = new File(["image"], "poster.png", { type: "image/png" });

    await user.upload(screen.getByLabelText(/^Posting image/), file);

    expect(screen.getByRole("img", { name: "Job posting image preview" })).toHaveAttribute("src", "blob:preview");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ image: { file } })));
  });

  it("rejects an unsupported image type and removes a saved image on save", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    const user = userEvent.setup({ applyAccept: false });
    const job = { id: 8, title: "Patrolman", description: "Serve the community through visible patrol work.", location: "San Juan City", closes_on: "2026-10-31", status: "draft" as const, image_path: "job-openings/8/0b8f2c1e-1111-4222-8333-944455556666.png", department_id: null, rank_id: null, published_at: null, created_by_user_id: "u1", created_at: "", updated_at: "", job_qualification_criteria: [{ id: "9b8f2c1e-1111-4222-8333-944455556666", job_opening_id: 8, ordinal: 1, kind: "experience" as const, requirement: "At least 2 years of police service", is_required: true, created_at: "" }] };
    render(<HrJobForm job={job} />);

    expect(screen.getByRole("img", { name: "Job posting image preview" })).toHaveAttribute("src", expect.stringContaining("/job-posting-images/job-openings/8/"));
    await user.upload(screen.getByLabelText(/^Posting image/), new File(["gif"], "poster.gif", { type: "image/gif" }));
    expect(screen.getByText("Use a PNG, JPEG, or WebP image.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove image" }));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/Requirement 1: Education/), "Baccalaureate Degree");
    await user.selectOptions(screen.getByLabelText(/Requirement 2: Eligibility/), "Licensed Criminologist");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ jobId: 8, image: { remove: true } })));
    vi.unstubAllEnvs();
  });
});
