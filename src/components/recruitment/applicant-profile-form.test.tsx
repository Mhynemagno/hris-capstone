import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const baseApplicant = {
  id: "323e4567-e89b-42d3-a456-426614174000",
  applicant_number: 202601 as number | null,
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
  profile_image_path: null as string | null,
};

const mocks = vi.hoisted(() => ({ saveProfile: vi.fn(), saveEducation: vi.fn(), notify: vi.fn(), applicant: null as unknown }));

vi.mock("@/hooks/use-recruitment", () => ({
  useApplicantProfile: () => ({ data: mocks.applicant, error: null, isLoading: false }),
  useSaveApplicantProfile: () => ({ isPending: false, mutateAsync: mocks.saveProfile }),
  useApplicantProfilePhotoUrl: () => ({ data: null, isLoading: false }),
  useRemoveMyApplicantProfilePhoto: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useReplaceMyApplicantProfilePhoto: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));
vi.mock("@/components/app-shell/applicant-toaster", () => ({ notifyApplicant: mocks.notify }));

const row = (level: string, school_name: string, degree_course: string, year_graduated: number, location: string) => ({ id: `e-${level}`, applicant_id: baseApplicant.id, level, school_name, degree_course, year_graduated, location, created_at: "", updated_at: "" });
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

const SAVE = "Save Changes & Update Profile";

function fillPrimary() {
  const primary = screen.getByRole("group", { name: "Primary Education" });
  fireEvent.change(within(primary).getByLabelText(/^Name of School/), { target: { value: "San Juan Elementary School" } });
  fireEvent.change(within(primary).getByLabelText(/^Course Completed/), { target: { value: "Primary Education" } });
  fireEvent.change(within(primary).getByLabelText(/^Year Graduated/), { target: { value: "2010" } });
  fireEvent.change(within(primary).getByLabelText(/^Location/), { target: { value: "San Juan City" } });
}

describe("ApplicantProfileForm", { timeout: 20_000 }, () => {
  beforeEach(() => {
    mocks.applicant = { ...baseApplicant };
    mocks.saveProfile.mockReset().mockResolvedValue(baseApplicant);
    mocks.saveEducation.mockReset().mockResolvedValue(undefined);
    mocks.notify.mockReset();
  });

  it("shows the profile header with the name, the photo requirement and the applicant number", () => {
    render(<ApplicantProfileForm />);
    expect(screen.getByRole("heading", { level: 1, name: "Maria Santos Reyes" })).toBeVisible();
    expect(screen.getByText(/2x2 ID Picture \(Format: JPG or PNG only, Max 5 MB\)/)).toBeVisible();
    expect(screen.getByLabelText("Upload 2x2 ID picture")).toHaveAttribute("type", "file");
    expect(screen.getByText("Applicant Number").parentElement).toHaveTextContent("2-02601");
  });

  it("shows Pending until HR accepts the application", () => {
    mocks.applicant = { ...baseApplicant, applicant_number: null };
    render(<ApplicantProfileForm />);
    expect(screen.getByText("Applicant Number").parentElement).toHaveTextContent("Pending");
    expect(screen.getByText("Issued once HR accepts your application")).toBeVisible();
  });

  it("hides the photo requirement once a photo is on file", () => {
    mocks.applicant = { ...baseApplicant, profile_image_path: "applicant-profiles/u/photo.png" };
    render(<ApplicantProfileForm />);
    expect(screen.queryByText(/2x2 ID Picture \(Format/)).not.toBeInTheDocument();
  });

  it("organizes the personal data sheet into numbered sections with required markers", () => {
    render(<ApplicantProfileForm />);
    const personal = screen.getByRole("region", { name: "I. Personal Information" });
    expect(personal).toHaveTextContent("* Required fields");
    for (const label of ["Last Name", "First Name", "Qualifier / Extension", "Date of Birth", "Place of Birth", "Citizenship", "Gender", "Civil Status", "Religion", "Mobile Number", "Email Address", "Home Address"]) {
      const control = within(personal).getByLabelText(new RegExp(`^${label.replace("/", "\\/")}`));
      expect(control).toBeRequired();
      expect(personal.querySelector(`label[for="${control.id}"]`)).toHaveTextContent(`${label} *`);
    }
    expect(within(personal).getByLabelText(/^Middle Name/)).not.toBeRequired();
    expect(within(personal).getByLabelText(/^Email Address/)).toHaveValue("maria@example.com");
    expect(within(personal).getByLabelText(/^Qualifier/)).toHaveValue("None");
    expect(within(personal).getByLabelText(/^Citizenship/)).toHaveValue("Filipino");

    const educationSection = screen.getByRole("region", { name: "II. Educational Background" });
    const levels: [string, string[]][] = [
      ["Primary Education", ["Name of School", "Course Completed", "Year Graduated", "Location"]],
      ["Secondary Education", ["Name of School", "Course / Strand", "Year Graduated", "Location"]],
      ["Tertiary / Bachelor's Degree", ["Name of Institution", "Degree / Course", "Year Graduated", "Location"]],
    ];
    for (const [level, fields] of levels) {
      const group = within(educationSection).getByRole("group", { name: level });
      for (const field of fields) expect(within(group).getByLabelText(new RegExp(`^${field.replace("/", "\\/")}`))).toBeRequired();
    }
    const graduate = within(educationSection).getByRole("group", { name: "Graduate Studies / Post-Graduate Degree" });
    expect(graduate).toHaveTextContent("Optional");
    for (const field of ["Name of Institution", "Degree / Program", "Year Graduated", "Location"]) {
      expect(within(graduate).getByLabelText(new RegExp(`^${field.replace("/", "\\/")}`))).not.toBeRequired();
    }
    const bachelors = within(educationSection).getByRole("group", { name: "Tertiary / Bachelor's Degree" });
    expect(within(bachelors).getByLabelText(/^Name of Institution/)).toHaveValue("PUP");
    expect(within(bachelors).getByLabelText(/^Year Graduated/)).toHaveValue("2020");
  });

  it("offers the religion list and keeps a typed religion that is not in it", () => {
    mocks.applicant = { ...baseApplicant, religion: "Aglipayan" };
    render(<ApplicantProfileForm />);
    const select = screen.getByLabelText(/^Religion/);
    expect(within(select).getByRole("option", { name: "Iglesia ni Cristo (INC)" })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "Jehovah's Witnesses" })).toBeInTheDocument();
    expect(select).toHaveValue("Aglipayan");
  });

  it("uses a telephone input and shows validation next to the field", async () => {
    const user = userEvent.setup();
    render(<ApplicantProfileForm />);
    expect(screen.getByLabelText(/^Mobile Number/)).toHaveAttribute("type", "tel");
    fireEvent.change(screen.getByLabelText(/^First Name/), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(/^Mobile Number/), { target: { value: "12345" } });
    await user.click(screen.getByRole("button", { name: SAVE }));
    await waitFor(() => expect(screen.getByLabelText(/^First Name/)).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByText("Enter a valid mobile number, e.g. +639171234567.")).toBeVisible();
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });

  it("requires the personal information fields and the required education levels", async () => {
    const user = userEvent.setup();
    render(<ApplicantProfileForm />);
    fireEvent.change(screen.getByLabelText(/^Place of Birth/), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(/^Citizenship/), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(/^Religion/), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(/^Date of Birth/), { target: { value: "" } });
    await user.click(screen.getByRole("button", { name: SAVE }));
    expect(await screen.findByText("Enter your place of birth.")).toBeVisible();
    expect(screen.getByText("Enter your citizenship.")).toBeVisible();
    expect(screen.getByText("Enter your religion.")).toBeVisible();
    expect(screen.getByText("Date of birth is required.")).toBeVisible();
    const primary = screen.getByRole("group", { name: "Primary Education" });
    expect(within(primary).getByText("Enter the name of the school.")).toBeVisible();
    expect(within(primary).getByText("Enter the school location.")).toBeVisible();
    expect(within(screen.getByRole("group", { name: "Graduate Studies / Post-Graduate Degree" })).queryByRole("alert")).not.toBeInTheDocument();
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });

  it("saves the personal information and each education level, then confirms with the Profile Updated notice", async () => {
    const user = userEvent.setup();
    render(<ApplicantProfileForm />);
    fillPrimary();
    fireEvent.change(screen.getByLabelText(/^Mobile Number/), { target: { value: "09998887777" } });
    await user.click(screen.getByRole("button", { name: SAVE }));
    await waitFor(() => expect(mocks.saveEducation).toHaveBeenCalled());
    expect(mocks.saveProfile.mock.calls[0]?.[0]).toMatchObject({ firstName: "Maria", phone: "+639998887777", citizenship: "Filipino", qualifier: undefined, dateOfBirth: "1998-04-12", religion: "Roman Catholic" });
    expect(mocks.saveEducation.mock.calls[0]?.[0]).toMatchObject({
      applicantId: baseApplicant.id,
      education: {
        elementary: { schoolName: "San Juan Elementary School", degreeCourse: "Primary Education", yearGraduated: 2010, location: "San Juan City" },
        college: { schoolName: "PUP", degreeCourse: "BS Criminology", yearGraduated: 2020, location: "Manila" },
      },
    });
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith({ title: "Profile Updated Successfully!", description: "Your personal and academic details have been saved." }));
  });

  it("explains a failed save with an error notice", async () => {
    const user = userEvent.setup();
    mocks.saveProfile.mockRejectedValue(new Error("Network down"));
    render(<ApplicantProfileForm />);
    fillPrimary();
    await user.click(screen.getByRole("button", { name: SAVE }));
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith({ title: "Profile not saved", description: "Network down", tone: "error" }));
  });

  it("rejects a graduation year outside 1900 to this year", async () => {
    const user = userEvent.setup();
    render(<ApplicantProfileForm />);
    fillPrimary();
    const secondary = screen.getByRole("group", { name: "Secondary Education" });
    fireEvent.change(within(secondary).getByLabelText(/^Year Graduated/), { target: { value: "1800" } });
    await user.click(screen.getByRole("button", { name: SAVE }));
    expect(await within(secondary).findByText(/^Enter a year from 1900 to/)).toBeVisible();
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });
});
