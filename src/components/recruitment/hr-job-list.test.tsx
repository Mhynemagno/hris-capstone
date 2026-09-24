import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const withdraw = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/hooks/use-recruitment", () => ({
  useHrJobs: () => ({ isLoading: false, error: null, data: { rows: [
    { id: 1, title: "Draft role", status: "draft", location: null },
    { id: 2, title: "Published role", status: "published", location: "Head office" },
    { id: 3, title: "Applied draft role", status: "draft", location: null, applications: [{ count: 1 }] },
  ] } }),
  useWithdrawJobOpening: () => ({ isPending: false, mutateAsync: withdraw }),
}));

vi.mock("@/hooks/use-deletion", () => ({
  useDeletionImpact: () => ({ data: undefined, error: null, isLoading: false, refetch: vi.fn() }),
  useDeleteRecord: () => ({ error: null, isPending: false, mutateAsync: vi.fn(), reset: vi.fn() }),
}));

import { HrJobList } from "./hr-job-list";

describe("HrJobList", () => {
  it("offers deletion only for drafts and withdrawal for active openings", () => {
    render(<HrJobList />);

    expect(screen.getAllByRole("button", { name: "Delete draft" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Withdraw opening" })).toHaveLength(2);
  });

  it("asks for confirmation before withdrawing and reports success", async () => {
    const user = userEvent.setup();
    render(<HrJobList />);

    await user.click(screen.getAllByRole("button", { name: "Withdraw opening" })[0]);
    expect(withdraw).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirm withdrawal" }));

    expect(withdraw).toHaveBeenCalledWith(2);
    expect(await screen.findByRole("status")).toHaveTextContent("was withdrawn");
  });
});
