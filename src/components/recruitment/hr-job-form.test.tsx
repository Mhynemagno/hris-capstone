import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ save: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/hooks/use-administration", () => ({
  useDepartmentOptions: () => ({ data: [{ id: 1, name: "Operations", is_active: true }], isLoading: false, error: null }),
  usePositionOptions: () => ({ data: [{ id: 2, department_id: 1, title: "Patrolman", is_active: true }], isLoading: false, error: null }),
}));
vi.mock("@/hooks/use-recruitment", () => ({ useSaveJobOpening: () => ({ isPending: false, mutateAsync: mocks.save }) }));

import { HrJobForm } from "./hr-job-form";

async function fillValidJobOpening(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText(/Department/), "1");
  await user.selectOptions(screen.getByLabelText(/Position/), "2");
  await user.type(screen.getByLabelText(/Title/), "Community Safety Officer");
  await user.type(screen.getByLabelText(/Description/), "Support community safety and coordinate public outreach programs.");
  await user.type(screen.getByLabelText(/Qualification 1/), "Relevant professional experience");
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
});
