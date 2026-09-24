import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const applicant = {
  id: "323e4567-e89b-42d3-a456-426614174000",
  applicant_number: 12345,
  first_name: "Maria",
  middle_name: null,
  last_name: "Reyes",
  qualifier: null,
  place_of_birth: null,
  date_of_birth: null,
  gender: null,
  civil_status: null,
  religion: null,
  phone: null,
  address: null,
  profile_image_path: null,
};

vi.mock("@/hooks/use-recruitment", () => ({
  useApplicantProfile: () => ({
    data: applicant,
    error: null,
    isLoading: false,
  }),
  useSaveApplicantProfile: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useApplicantProfileDocuments: () => ({ data: [], error: null, isLoading: false }),
  useSaveApplicantProfileDocuments: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useApplicantProfilePhotoUrl: () => ({ data: null, isLoading: false }),
  useRemoveMyApplicantProfilePhoto: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useReplaceMyApplicantProfilePhoto: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

import { ApplicantProfileForm } from "./applicant-profile-form";

describe("ApplicantProfileForm", () => {
  it("collects the approved personal details and displays the permanent applicant number", () => {
    render(<ApplicantProfileForm />);

    expect(screen.getByText("Applicant number")).toBeInTheDocument();
    expect(screen.getByText("0-12345")).toBeInTheDocument();
    expect(screen.getByLabelText("Place of birth")).toBeInTheDocument();
    expect(screen.getByLabelText("Date of birth")).toBeInTheDocument();
    expect(screen.getByLabelText("Civil status")).toBeInTheDocument();
    expect(screen.getByLabelText("Gender")).toBeInTheDocument();
    expect(screen.queryByLabelText("Sex")).not.toBeInTheDocument();
  });

  it("uses a telephone input and shows validation next to the field", async () => {
    const user = userEvent.setup();
    render(<ApplicantProfileForm />);

    expect(screen.getByLabelText("Phone")).toHaveAttribute("type", "tel");
    await user.clear(screen.getByLabelText(/^first name/i));
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(screen.getByLabelText(/^first name/i)).toHaveAttribute("aria-invalid", "true"));
  });
});
