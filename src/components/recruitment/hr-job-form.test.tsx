import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ save: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/hooks/use-recruitment", () => ({ useSaveJobOpening: () => ({ isPending: false, mutateAsync: mocks.save }) }));

import { HrJobForm } from "./hr-job-form";

async function fillValidJobOpening(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Title/), "Community Safety Officer");
  await user.type(screen.getByLabelText(/Location/), "San Juan City Police Station");
  await user.type(screen.getByLabelText(/Deadline of Application/), "2026-10-31");
  await user.type(screen.getByLabelText(/Description/), "Support community safety and coordinate public outreach programs.");
  await user.selectOptions(screen.getByLabelText(/Qualification 1/), "At least 2 years of police service");
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
  });

  it("has no department or rank fields and requires title, location, and deadline of application", async () => {
    const user = userEvent.setup();
    render(<HrJobForm />);

    expect(screen.queryByLabelText(/Department/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Rank/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Title/)).toBeRequired();
    expect(screen.getByLabelText(/Location/)).toBeRequired();
    expect(screen.getByLabelText(/Deadline of Application/)).toBeRequired();

    await user.click(screen.getByRole("button", { name: "Save draft" }));

    expect(await screen.findByText("Enter a location of at least 2 characters.")).toBeInTheDocument();
    expect(screen.getByText("Enter a title of at least 2 characters.")).toBeInTheDocument();
    expect(screen.getByText("Choose the deadline of application.")).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("uploads an optional posting image with the save and shows a preview", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => "blob:preview");
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    render(<HrJobForm />);
    await fillValidJobOpening(user);
    const file = new File(["image"], "poster.png", { type: "image/png" });

    await user.upload(screen.getByLabelText(/^Image/), file);

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
    await user.upload(screen.getByLabelText(/^Image/), new File(["gif"], "poster.gif", { type: "image/gif" }));
    expect(screen.getByText("Use a PNG, JPEG, or WebP image.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove image" }));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ jobId: 8, image: { remove: true } })));
    vi.unstubAllEnvs();
  });
});
