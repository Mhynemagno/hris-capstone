import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-personnel-records", () => ({
  useEmployeeForCurrentUser: () => ({ data: null, isLoading: false, error: null }),
  usePersonnelEntries: () => ({ data: undefined }),
}));

import EmployeeProfilePage from "./page";

describe("EmployeeProfilePage", () => {
  it("titles the page and keeps the request, history and password actions", async () => {
    render(<EmployeeProfilePage />);

    expect(await screen.findByRole("heading", { name: "My Profile 201" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Request Profile Change" })).toHaveAttribute("href", "/employee/profile/change-request");
    expect(screen.getByRole("link", { name: "Request History" })).toHaveAttribute("href", "/employee/profile/change-requests");
    expect(screen.getByRole("link", { name: "Change Password" })).toHaveAttribute("href", "/employee/profile/security");
  });
});
