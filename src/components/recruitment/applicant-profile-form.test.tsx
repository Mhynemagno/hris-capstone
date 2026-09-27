import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const applicant = {
  id: "323e4567-e89b-42d3-a456-426614174000",
  applicant_number: 12345,
  first_name: "Maria",
  middle_name: "Santos",
  last_name: "Reyes",
  qualifier: null,
  place_of_birth: null,
  date_of_birth: null,
  gender: null,
  civil_status: null,
  religion: null,
  phone: "+639171234567",
  address: null,
  profile_image_path: null,
};

const mocks = vi.hoisted(() => ({ saveProfile: vi.fn(), saveEducation: vi.fn() }));

vi.mock("@/hooks/use-recruitment", () => ({
  useApplicantProfile: () => ({ data: applicant, error: null, isLoading: false }),
  useSaveApplicantProfile: () => ({ isPending: false, mutateAsync: mocks.saveProfile }),
  useApplicantProfilePhotoUrl: () => ({ data: null, isLoading: false }),
  useRemoveMyApplicantProfilePhoto: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useReplaceMyApplicantProfilePhoto: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

const education = [{ id: "e1", applicant_id: applicant.id, level: "college", school_name: "PUP", degree_course: "BS Criminology", year_graduated: 2020, created_at: "", updated_at: "" }];

vi.mock("@/hooks/use-applicant-portal", () => ({
  useMyAccountEmail: () => ({ data: "maria@example.com" }),
  useMyApplicantEducation: () => ({ data: education, isLoading: false }),
  useSaveMyApplicantEducation: () => ({ isPending: false, mutateAsync: mocks.saveEducation }),
}));

import { ApplicantProfileForm } from "./applicant-profile-form";

describe("ApplicantProfileForm", { timeout: 20_000 }, () => {
  beforeEach(() => {
    mocks.saveProfile.mockReset().mockResolvedValue(applicant);
    mocks.saveEducation.mockReset().mockResolvedValue(undefined);
  });

  it("organizes the personal data sheet into numbered sections", () => {
    render(<ApplicantProfileForm />);

    expect(screen.getByText("0-12345")).toBeInTheDocument();
    const personal = screen.getByRole("region", { name: "I. Personal Information" });
    for (const label of ["Last name", "First name", "Middle name", "Qualifier", "Date of birth", "Place of birth", "Gender", "Civil status", "Religion", "Mobile number", "Email", "Home address"]) {
      expect(within(personal).getByLabelText(new RegExp(`^${label}`))).toBeInTheDocument();
    }
    expect(within(personal).getByLabelText("Email")).toHaveValue("maria@example.com");
    expect(within(personal).getByLabelText("Qualifier")).toHaveValue("");
    const educationSection = screen.getByRole("region", { name: "II. Educational Background" });
    expect(within(educationSection).getByRole("group", { name: "Elementary" })).toBeInTheDocument();
    expect(within(educationSection).getByRole("group", { name: "Secondary" })).toBeInTheDocument();
    const college = within(educationSection).getByRole("group", { name: "College / Tertiary" });
    expect(within(college).getByLabelText("Name of school")).toHaveValue("PUP");
    expect(within(college).getByLabelText("Year graduated")).toHaveValue("2020");
    expect(screen.queryByLabelText("Sex")).not.toBeInTheDocument();
  });

  it("uses a telephone input and shows validation next to the field", async () => {
    const user = userEvent.setup();
    render(<ApplicantProfileForm />);

    expect(screen.getByLabelText("Mobile number")).toHaveAttribute("type", "tel");
    fireEvent.change(screen.getByLabelText(/^first name/i), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "12345" } });
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(screen.getByLabelText(/^first name/i)).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByText("Enter a valid mobile number, e.g. +639171234567.")).toBeVisible();
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });

  it("saves the personal information and each education level", async () => {
    const user = userEvent.setup();
    render(<ApplicantProfileForm />);
    const elementary = screen.getByRole("group", { name: "Elementary" });
    fireEvent.change(within(elementary).getByLabelText("Name of school"), { target: { value: "San Juan Elementary School" } });
    fireEvent.change(within(elementary).getByLabelText("Year graduated"), { target: { value: "2008" } });
    fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "09998887777" } });
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(mocks.saveEducation).toHaveBeenCalled());
    expect(mocks.saveProfile.mock.calls[0]?.[0]).toMatchObject({ firstName: "Maria", phone: "+639998887777" });
    expect(mocks.saveEducation.mock.calls[0]?.[0]).toMatchObject({
      applicantId: applicant.id,
      education: {
        elementary: { schoolName: "San Juan Elementary School", yearGraduated: 2008 },
        college: { schoolName: "PUP", degreeCourse: "BS Criminology", yearGraduated: 2020 },
      },
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Profile saved.");
  });

  it("rejects a graduation year outside 1900 to this year", async () => {
    const user = userEvent.setup();
    render(<ApplicantProfileForm />);
    const secondary = screen.getByRole("group", { name: "Secondary" });
    fireEvent.change(within(secondary).getByLabelText("Year graduated"), { target: { value: "1800" } });
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await within(secondary).findByText(/^Enter a year from 1900 to/)).toBeVisible();
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });
});
