import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HrJobList } from "./hr-job-list";

vi.mock("@/hooks/use-recruitment", () => ({
  useHrJobs: () => ({ isLoading: false, error: null, data: { rows: [
    { id: 1, title: "Draft role", status: "draft", location: null },
    { id: 2, title: "Published role", status: "published", location: "Head office" },
  ] } }),
  useDeleteDraftJobOpening: () => ({ isPending: false, mutate: vi.fn() }),
  useWithdrawJobOpening: () => ({ isPending: false, mutate: vi.fn() }),
}));

describe("HrJobList", () => {
  it("offers deletion only for drafts and withdrawal for active openings", () => {
    render(<HrJobList />);

    expect(screen.getByRole("button", { name: "Delete draft" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Withdraw opening" })).toBeInTheDocument();
  });
});
