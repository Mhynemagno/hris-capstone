import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-recruitment", () => ({
  useApplicantProfilePhotoUrl: () => ({ data: null, isLoading: false }),
  useRemoveMyApplicantProfilePhoto: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useReplaceMyApplicantProfilePhoto: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

import { ApplicantProfilePhotoControl } from "./applicant-profile-photo-control";

describe("ApplicantProfilePhotoControl", () => {
  it("shows the default avatar and a labelled optional upload control", () => {
    render(<ApplicantProfilePhotoControl applicant={{ id: "323e4567-e89b-42d3-a456-426614174000", profile_image_path: null }} />);

    expect(screen.getByAltText("Default profile avatar")).toBeInTheDocument();
    expect(screen.getByLabelText("Upload profile photo")).toBeInTheDocument();
  });
});
