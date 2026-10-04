import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const base = { created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" };
  return {
    rows: [
      { ...base, id: "11111111-1111-4111-8111-111111111111", label: "HR Office", kind: "phone", value: "(02) 8123-4567", sort_order: 1, is_visible: true },
      { ...base, id: "22222222-2222-4222-8222-222222222222", label: "Email desk", kind: "email", value: "hr@example.test", sort_order: 2, is_visible: false },
      { ...base, id: "33333333-3333-4333-8333-333333333333", label: "Front desk", kind: "hours", value: "Mon to Fri, 8 AM to 5 PM", sort_order: 3, is_visible: true },
    ],
    save: vi.fn(),
    remove: vi.fn(),
    reorder: vi.fn(),
  };
});

vi.mock("@/hooks/use-public-site", () => ({
  useHrContacts: () => ({ data: mocks.rows, error: null, isLoading: false }),
  useSavePublicContact: () => ({ isPending: false, mutateAsync: mocks.save }),
  useDeletePublicContact: () => ({ isPending: false, mutateAsync: mocks.remove }),
  useReorderPublicContacts: () => ({ isPending: false, mutateAsync: mocks.reorder }),
}));

import { HrContactsPanel } from "./hr-contacts-panel";

const [first, second, third] = mocks.rows.map((row) => row.id);

describe("HrContactsPanel", () => {
  beforeEach(() => {
    mocks.save.mockReset().mockResolvedValue({});
    mocks.remove.mockReset().mockResolvedValue(undefined);
    mocks.reorder.mockReset().mockResolvedValue(undefined);
  });

  it("moves a contact with up and down buttons that stop at either end", async () => {
    const user = userEvent.setup();
    render(<HrContactsPanel />);
    expect(screen.getByRole("button", { name: "Move HR Office up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Front desk down" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Move HR Office down" }));
    expect(mocks.reorder).toHaveBeenCalledWith([second, first, third]);
  });

  it("hides a visible contact without changing anything else", async () => {
    const user = userEvent.setup();
    render(<HrContactsPanel />);
    expect(screen.getByText("Hidden")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Hide HR Office" }));
    expect(mocks.save).toHaveBeenCalledWith({ contactId: first, input: { kind: "phone", label: "HR Office", value: "(02) 8123-4567", isVisible: false } });
    expect(await screen.findByText("HR Office is now hidden from the landing page.")).toBeVisible();
  });

  it("explains a reorder refused because the list changed elsewhere", async () => {
    const user = userEvent.setup();
    mocks.reorder.mockRejectedValue(new Error("The contact list changed. Reload the page and try again."));
    render(<HrContactsPanel />);
    await user.click(screen.getByRole("button", { name: "Move Front desk up" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The contact list changed. Reload the page and try again.");
  });

  it("asks before deleting a contact", async () => {
    const user = userEvent.setup();
    render(<HrContactsPanel />);
    await user.click(screen.getByRole("button", { name: "Delete Email desk" }));
    expect(mocks.remove).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(mocks.remove).toHaveBeenCalledWith(second);
    expect(await screen.findByText("Email desk was deleted.")).toBeVisible();
  });
});
