import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const applicant = {
  id: "323e4567-e89b-42d3-a456-426614174000",
  applicant_number: 202601,
  first_name: "Maria",
  middle_name: "Santos",
  last_name: "Reyes",
  qualifier: null,
  place_of_birth: "Quezon City",
  date_of_birth: "1998-04-12",
  citizenship: null,
  gender: "female",
  civil_status: "single",
  religion: "Roman Catholic",
  phone: "+639171234567",
  address: "12 Mabini St., Quezon City",
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

const row = (level: string, school_name: string, degree_course: string, year_graduated: number, location: string) => ({ id: `e-${level}`, applicant_id: applicant.id, level, school_name, degree_course, year_graduated, location, created_at: "", updated_at: "" });
const education = [
  row("secondary", "Quezon City High School", "Junior High School", 2014, "Quezon City"),
  row("college", "PUP", "BS Criminology", 2020, "Manila"),
];

vi.mock("@/hooks/use-applicant-portal", () => ({
  useMyAccountEmail: () => ({ data: "maria@example.com" }),
  useMyApplicantEducation: () => ({ data: education, isLoading: false }),
  useSaveMyApplicantEducation: () => ({ isPending: false, mutateAsync: mocks.saveEducation }),
}));

import { ApplicantProfileForm } from "./applicant-profile-form";

const educationFields = ["Name of school", "Course completed", "Year graduated", "Location"];

function fillPrimary() {
  const primary = screen.getByRole("group", { name: "Primary" });
  fireEvent.change(within(primary).getByLabelText(/^Name of school/), { target: { value: "San Juan Elementary School" } });
  fireEvent.change(within(primary).getByLabelText(/^Course completed/), { target: { value: "Primary Education" } });
  fireEvent.change(within(primary).getByLabelText(/^Year graduated/), { target: { value: "2010" } });
  fireEvent.change(within(primary).getByLabelText(/^Location/), { target: { value: "San Juan City" } });
}

describe("ApplicantProfileForm", { timeout: 20_000 }, () => {
  beforeEach(() => {
    mocks.saveProfile.mockReset().mockResolvedValue(applicant);
    mocks.saveEducation.mockReset().mockResolvedValue(undefined);
  });

  it("organizes the personal data sheet into numbered sections with required markers", () => {
    render(<ApplicantProfileForm />);

    expect(screen.getByText("2-02601")).toBeInTheDocument();
    const personal = screen.getByRole("region", { name: "I. Personal Information" });
    for (const label of ["Last name", "First name", "Qualifier", "Date of birth", "Place of birth", "Citizenship", "Gender", "Civil status", "Religion", "Mobile number", "Email", "Home address"]) {
      const control = within(personal).getByLabelText(new RegExp(`^${label}`));
      expect(control).toBeRequired();
      expect(personal.querySelector(`label[for="${control.id}"]`)).toHaveTextContent(`${label}*`);
    }
    expect(within(personal).getByLabelText(/^Middle name/)).not.toBeRequired();
    expect(within(personal).getByLabelText(/^Email/)).toHaveValue("maria@example.com");
    expect(within(personal).getByLabelText(/^Qualifier/)).toHaveValue("None");
    expect(within(personal).getByLabelText(/^Citizenship/)).toHaveValue("Filipino");

    const educationSection = screen.getByRole("region", { name: "II. Educational Background" });
    for (const level of ["Primary", "Secondary", "Bachelor's Degree"]) {
      const group = within(educationSection).getByRole("group", { name: level });
      for (const field of educationFields) expect(within(group).getByLabelText(new RegExp(`^${field}`))).toBeRequired();
    }
    const graduate = within(educationSection).getByRole("group", { name: "Graduate Degree (optional)" });
    for (const field of educationFields) expect(within(graduate).getByLabelText(new RegExp(`^${field}`))).not.toBeRequired();
    const bachelors = within(educationSection).getByRole("group", { name: "Bachelor's Degree" });
    expect(within(bachelors).getByLabelText(/^Name of school/)).toHaveValue("PUP");
    expect(within(bachelors).getByLabelText(/^Year graduated/)).toHaveValue("2020");
    expect(within(bachelors).getByLabelText(/^Location/)).toHaveValue("Manila");
    expect(screen.queryByText("College / Tertiary")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Sex")).not.toBeInTheDocument();
  });

  it("uses a telephone input and shows validation next to the field", async () => {
    const user = userEvent.setup();
    render(<ApplicantProfileForm />);

    expect(screen.getByLabelText(/^Mobile number/)).toHaveAttribute("type", "tel");
    fireEvent.change(screen.getByLabelText(/^first name/i), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(/^Mobile number/), { target: { value: "12345" } });
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(screen.getByLabelText(/^first name/i)).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByText("Enter a valid mobile number, e.g. +639171234567.")).toBeVisible();
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });

  it("requires the personal information fields and the required education levels", async () => {
    const user = userEvent.setup();
    render(<ApplicantProfileForm />);

    fireEvent.change(screen.getByLabelText(/^Place of birth/), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(/^Citizenship/), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(/^Religion/), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(/^Date of birth/), { target: { value: "" } });
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByText("Enter your place of birth.")).toBeVisible();
    expect(screen.getByText("Enter your citizenship.")).toBeVisible();
    expect(screen.getByText("Enter your religion.")).toBeVisible();
    expect(screen.getByText("Date of birth is required.")).toBeVisible();
    const primary = screen.getByRole("group", { name: "Primary" });
    expect(within(primary).getByText("Enter the name of the school.")).toBeVisible();
    expect(within(primary).getByText("Enter the school location.")).toBeVisible();
    expect(within(screen.getByRole("group", { name: "Graduate Degree (optional)" })).queryByRole("alert")).not.toBeInTheDocument();
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });

  it("saves the personal information and each education level", async () => {
    const user = userEvent.setup();
    render(<ApplicantProfileForm />);
    fillPrimary();
    fireEvent.change(screen.getByLabelText(/^Mobile number/), { target: { value: "09998887777" } });
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(mocks.saveEducation).toHaveBeenCalled());
    expect(mocks.saveProfile.mock.calls[0]?.[0]).toMatchObject({ firstName: "Maria", phone: "+639998887777", citizenship: "Filipino", qualifier: undefined, dateOfBirth: "1998-04-12" });
    expect(mocks.saveEducation.mock.calls[0]?.[0]).toMatchObject({
      applicantId: applicant.id,
      education: {
        elementary: { schoolName: "San Juan Elementary School", degreeCourse: "Primary Education", yearGraduated: 2010, location: "San Juan City" },
        college: { schoolName: "PUP", degreeCourse: "BS Criminology", yearGraduated: 2020, location: "Manila" },
      },
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Profile saved.");
  });

  it("rejects a graduation year outside 1900 to this year", async () => {
    const user = userEvent.setup();
    render(<ApplicantProfileForm />);
    fillPrimary();
    const secondary = screen.getByRole("group", { name: "Secondary" });
    fireEvent.change(within(secondary).getByLabelText(/^Year graduated/), { target: { value: "1800" } });
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await within(secondary).findByText(/^Enter a year from 1900 to/)).toBeVisible();
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });
});
