import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("@/hooks/use-recruitment", () => ({
  useApplicantProfilePhotoUrl: () => ({ data: null, isLoading: false }),
  useRemoveMyApplicantProfilePhoto: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useReplaceMyApplicantProfilePhoto: () => ({ isPending: false, mutateAsync: mocks.replace }),
}));

import { ApplicantProfilePhotoControl } from "./applicant-profile-photo-control";

const applicantId = "323e4567-e89b-42d3-a456-426614174000";

describe("ApplicantProfilePhotoControl", () => {
  it("shows the default avatar and a compact upload button instead of the native file field", () => {
    render(<ApplicantProfilePhotoControl applicant={{ id: applicantId, profile_image_path: null }} />);

    expect(screen.getByAltText("Default profile avatar")).toBeInTheDocument();
    const input = screen.getByLabelText("Upload profile photo");
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveClass("sr-only");
    expect(screen.getByRole("button", { name: "Upload photo" })).toHaveAttribute("aria-controls", input.id);
    expect(screen.queryByRole("button", { name: "Remove profile photo" })).not.toBeInTheDocument();
  });

  it("opens the hidden file input from the button and uploads the chosen image", async () => {
    const user = userEvent.setup();
    mocks.replace.mockResolvedValue({ cleanupError: null });
    render(<ApplicantProfilePhotoControl applicant={{ id: applicantId, profile_image_path: null }} />);

    const input = screen.getByLabelText<HTMLInputElement>("Upload profile photo");
    const click = vi.spyOn(input, "click");
    await user.click(screen.getByRole("button", { name: "Upload photo" }));
    expect(click).toHaveBeenCalled();

    await user.upload(input, new File(["png"], "me.png", { type: "image/png" }));
    expect(mocks.replace).toHaveBeenCalledWith(expect.objectContaining({ name: "me.png" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Profile photo updated.");
  });

  it("offers to change or remove an existing photo", () => {
    render(<ApplicantProfilePhotoControl applicant={{ id: applicantId, profile_image_path: `applicants/${applicantId}/photo.png` }} />);

    expect(screen.getByLabelText("Replace profile photo")).toHaveAttribute("type", "file");
    expect(screen.getByRole("button", { name: "Change photo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove profile photo" })).toBeInTheDocument();
  });
});
