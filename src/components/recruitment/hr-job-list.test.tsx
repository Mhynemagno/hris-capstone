import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HrJobList } from "./hr-job-list";

vi.mock("@/hooks/use-recruitment", () => ({
  useHrJobs: () => ({ isLoading: false, error: null, data: { rows: [
    { id: 1, title: "Draft role", status: "draft", location: null },
    { id: 2, title: "Published role", status: "published", location: "Head office" },
    { id: 3, title: "Applied draft role", status: "draft", location: null, applications: [{ count: 1 }] },
  ] } }),
  useDeleteDraftJobOpening: () => ({ isPending: false, mutate: vi.fn() }),
  useWithdrawJobOpening: () => ({ isPending: false, mutate: vi.fn() }),
}));

describe("HrJobList", () => {
  it("offers deletion only for drafts and withdrawal for active openings", () => {
    render(<HrJobList />);

    expect(screen.getAllByRole("button", { name: "Delete draft" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Withdraw opening" })).toHaveLength(2);
  });
});
