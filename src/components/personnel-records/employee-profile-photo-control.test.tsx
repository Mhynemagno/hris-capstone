import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  remove: vi.fn(),
  replace: vi.fn(),
  usePhotoUrl: vi.fn(),
}));

vi.mock("@/hooks/use-personnel-records", () => ({
  useEmployeeProfilePhotoUrl: mocks.usePhotoUrl,
  useRemoveMyEmployeeProfilePhoto: () => ({ isPending: false, mutateAsync: mocks.remove }),
  useReplaceMyEmployeeProfilePhoto: () => ({ isPending: false, mutateAsync: mocks.replace }),
}));

import { EmployeeProfilePhotoControl } from "./employee-profile-photo-control";

const employee = {
  id: "00000000-0000-0000-0000-000000000010",
  profile_image_path: "employees/00000000-0000-0000-0000-000000000010/123e4567-e89b-42d3-a456-826614174000.png",
};

describe("EmployeeProfilePhotoControl", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.usePhotoUrl.mockReturnValue({ data: "https://example.test/private-photo", isLoading: false });
    mocks.replace.mockResolvedValue({ cleanupError: null });
    mocks.remove.mockResolvedValue({ cleanupError: null });
  });

  it("shows a private photo and allows an employee to replace it", async () => {
    const user = userEvent.setup();
    render(<EmployeeProfilePhotoControl employee={employee} canManagePhoto />);

    expect(screen.getByAltText("Employee profile photo")).toHaveAttribute("src", "https://example.test/private-photo");
    await user.upload(screen.getByLabelText("Replace profile photo"), new File(["photo"], "profile.png", { type: "image/png" }));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(expect.any(File)));
  });

  it("keeps admin views read-only", () => {
    render(<EmployeeProfilePhotoControl employee={employee} />);

    expect(screen.getByAltText("Employee profile photo")).toBeInTheDocument();
    expect(screen.queryByLabelText("Replace profile photo")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove profile photo" })).not.toBeInTheDocument();
  });

  it("reports an unsupported upload next to the control", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<EmployeeProfilePhotoControl employee={employee} canManagePhoto />);

    await user.upload(screen.getByLabelText("Replace profile photo"), new File(["photo"], "profile.gif", { type: "image/gif" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Use a PNG, JPEG, or WebP image.");
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
