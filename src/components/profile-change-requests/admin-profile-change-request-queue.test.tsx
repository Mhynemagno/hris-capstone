import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({ useAdminProfileChangeRequests: vi.fn() }));
vi.mock("@/hooks/use-profile-change-requests", () => hooks);
const navigation = vi.hoisted(() => ({ replace: vi.fn(), search: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/profile-change-requests",
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

beforeEach(() => { navigation.replace.mockReset(); navigation.search = ""; });

import { AdminProfileChangeRequestQueue } from "./admin-profile-change-request-queue";

describe("AdminProfileChangeRequestQueue", () => {
  it("defaults to all statuses (pending included) and offers only Approved and Rejected besides", () => {
    hooks.useAdminProfileChangeRequests.mockReturnValue({
      data: { rows: [{ id: "00000000-0000-4000-8000-000000000001", status: "pending", created_at: "2026-09-15T08:00:00Z", note: "New address" }], count: 1 },
      error: null,
      isLoading: false,
    });

    render(<AdminProfileChangeRequestQueue />);

    const status = screen.getByRole("combobox", { name: "Status" });
    expect(status).toHaveValue("");
    expect([...(status as HTMLSelectElement).options].map((option) => option.text)).toEqual(["All statuses", "Approved", "Rejected"]);
    expect(hooks.useAdminProfileChangeRequests).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
    expect(screen.getByRole("link", { name: /review request/i })).toBeInTheDocument();
  });

  it("writes a selected status to the URL and resets its page", async () => {
    const user = userEvent.setup();
    navigation.search = "page=3";
    hooks.useAdminProfileChangeRequests.mockReturnValue({ data: { rows: [], count: 0 }, error: null, isLoading: false });

    render(<AdminProfileChangeRequestQueue />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "approved");

    expect(navigation.replace).toHaveBeenCalledWith("/admin/profile-change-requests?status=approved", { scroll: false });
  });
});
