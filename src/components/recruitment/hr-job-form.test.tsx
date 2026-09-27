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
});
