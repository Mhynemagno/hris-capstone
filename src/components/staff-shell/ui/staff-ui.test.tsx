import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StaffModal } from "./staff-modal";
import { StaffSlideOver } from "./staff-slide-over";
import { StaffTableCard } from "./staff-table-card";

describe("staff UI primitives", () => {
  it("opens a titled modal that closes on Escape", async () => {
    const onClose = vi.fn();
    render(<StaffModal onClose={onClose} open subtitle="Approve or Decline application with required HR notes" title="Review Leave Request"><p>Body</p></StaffModal>);
    expect(screen.getByRole("dialog", { name: "Review Leave Request" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("opens a slide-over with a close button", async () => {
    const onClose = vi.fn();
    render(<StaffSlideOver onClose={onClose} open title="Create Deployment"><p>Form</p></StaffSlideOver>);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("pages a table", async () => {
    const onPageChange = vi.fn();
    render(<StaffTableCard pager={{ page: 1, pageSize: 10, total: 23, noun: "leave requests", onPageChange }} title="Leave Request Queue"><table><tbody /></table></StaffTableCard>);
    expect(screen.getByText("Showing 1–10 of 23 leave requests")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("says when there is nothing to page", () => {
    render(<StaffTableCard pager={{ page: 1, pageSize: 10, total: 0, noun: "postings", onPageChange: vi.fn() }} title="Postings"><table><tbody /></table></StaffTableCard>);
    expect(screen.getByText("Showing 0 of 0 postings")).toBeInTheDocument();
  });
});
