import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdministrationFormPanel } from "./administration-form-panel";
import { PaginatedTableControls } from "./paginated-table-controls";

describe("administration shared controls", () => {
  it("moves through a known 20-row page range", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<PaginatedTableControls page={2} pageSize={20} totalCount={45} onPageChange={onPageChange} />);

    await user.click(screen.getByRole("button", { name: /next page/i }));

    expect(onPageChange).toHaveBeenCalledWith(3);
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
  });

  it("disables unavailable page changes", () => {
    render(<PaginatedTableControls page={1} pageSize={20} totalCount={10} onPageChange={() => undefined} />);

    expect(screen.getByRole("button", { name: /previous page/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next page/i })).toBeDisabled();
  });

  it("provides an accessible form panel", () => {
    render(
      <AdministrationFormPanel open onOpenChange={() => undefined} title="Invite account" description="Send an account invitation.">
        <form><button type="submit">Send invitation</button></form>
      </AdministrationFormPanel>,
    );

    expect(screen.getByRole("heading", { name: "Invite account" })).toBeInTheDocument();
    expect(screen.getByText("Send an account invitation.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
  });
});
