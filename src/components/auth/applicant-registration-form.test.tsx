import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({ auth: { signUp: mocks.signUp } }),
}));

import { ApplicantRegistrationForm } from "./applicant-registration-form";

function fillValidForm(overrides: { mobile?: string; qualifier?: string; confirm?: string } = {}) {
  const values: [RegExp, string][] = [[/^email/i, "applicant@example.com"], [/^mobile number/i, overrides.mobile ?? "09171234567"], [/^last name/i, "Dela Cruz"], [/^first name/i, "Juan"], [/^middle name/i, "Santos"], [/^qualifier/i, overrides.qualifier ?? "Jr."], [/^birthdate/i, "1998-04-12"], [/^password/i, "secret1"], [/^confirm password/i, overrides.confirm ?? "secret1"]];
  for (const [label, value] of values) fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("ApplicantRegistrationForm", { timeout: 20_000 }, () => {
  beforeEach(() => {
    mocks.replace.mockReset();
    mocks.refresh.mockReset();
    mocks.signUp.mockReset();
  });

  it("marks every field required and shows the greyed mobile placeholder", () => {
    render(<ApplicantRegistrationForm />);
    for (const label of ["Email", "Mobile Number", "Last Name", "First Name", "Middle Name", "Qualifier", "Birthdate", "Password", "Confirm Password"]) {
      expect(screen.getByText(label, { selector: "label" })).toHaveTextContent(`${label}*`);
    }
    expect(screen.getByLabelText(/^mobile number/i)).toHaveAttribute("placeholder", "+639XXXXXXXXX");
    expect(screen.getByRole("option", { name: "None" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "IX" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Register" })).toBeInTheDocument();
    expect(screen.queryByText("Show password")).not.toBeInTheDocument();
  });

  it("normalizes the mobile number, sends structured account metadata, and opens job openings", async () => {
    const user = userEvent.setup();
    mocks.signUp.mockResolvedValue({ data: { session: { access_token: "test" } }, error: null });

    render(<ApplicantRegistrationForm />);
    fillValidForm();
    await user.click(screen.getByRole("button", { name: "Register" }));

    expect(mocks.signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: "applicant@example.com",
      password: "secret1",
      options: expect.objectContaining({
        data: {
          first_name: "Juan",
          last_name: "Dela Cruz",
          middle_name: "Santos",
          qualifier: "Jr.",
          phone: "+639171234567",
          date_of_birth: "1998-04-12",
          full_name: "Juan Dela Cruz",
        },
      }),
    }));
    expect(mocks.signUp.mock.calls[0]?.[0].options).not.toHaveProperty("emailRedirectTo");
    expect(mocks.replace).toHaveBeenCalledWith("/jobs");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("stores no qualifier when None is chosen", async () => {
    const user = userEvent.setup();
    mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
    render(<ApplicantRegistrationForm />);
    fillValidForm({ qualifier: "None" });
    await user.click(screen.getByRole("button", { name: "Register" }));
    expect(mocks.signUp.mock.calls[0]?.[0].options.data.qualifier).toBeNull();
    expect(await screen.findByRole("status")).toHaveTextContent("Check your email");
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("carries a safe next destination through confirmation and sign-in", async () => {
    const user = userEvent.setup();
    mocks.signUp.mockResolvedValueOnce({ data: { session: null }, error: null });
    render(<ApplicantRegistrationForm loginHref="/login?next=%2Fapplicant%2Fapplications%3FjobId%3D5" nextPath="/applicant/applications?jobId=5" />);
    fillValidForm();
    await user.click(screen.getByRole("button", { name: "Register" }));
    const redirect = new URL(mocks.signUp.mock.calls[0]?.[0].options.emailRedirectTo);
    expect(redirect.pathname).toBe("/auth/callback");
    expect(redirect.searchParams.get("next")).toBe("/applicant/applications?jobId=5");
    expect(await screen.findByRole("link", { name: "Return to sign in" })).toHaveAttribute("href", "/login?next=%2Fapplicant%2Fapplications%3FjobId%3D5");
  });

  it("continues to the next destination when sign-up returns a session", async () => {
    const user = userEvent.setup();
    mocks.signUp.mockResolvedValueOnce({ data: { session: { access_token: "test" } }, error: null });
    render(<ApplicantRegistrationForm nextPath="/jobs/7" />);
    fillValidForm();
    await user.click(screen.getByRole("button", { name: "Register" }));
    expect(mocks.replace).toHaveBeenCalledWith("/jobs/7");
  });

  it("rejects an invalid mobile number and mismatched passwords", async () => {
    const user = userEvent.setup();
    render(<ApplicantRegistrationForm />);
    fillValidForm({ mobile: "12345", confirm: "different" });
    await user.click(screen.getByRole("button", { name: "Register" }));
    expect(screen.getByText("Enter a valid mobile number, e.g. +639171234567.")).toBeVisible();
    expect(screen.getByText("Passwords do not match.")).toBeVisible();
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("shows per-field errors next to each invalid field", async () => {
    const user = userEvent.setup();
    render(<ApplicantRegistrationForm />);

    await user.type(screen.getByLabelText(/^email/i), "not-an-email");
    await user.type(screen.getByLabelText(/^password/i), "123");
    await user.click(screen.getByRole("button", { name: "Register" }));

    expect(screen.getByText("First name is required.")).toBeVisible();
    expect(screen.getByLabelText(/^first name/i)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Middle name is required.")).toBeVisible();
    expect(screen.getByText("Mobile number is required.")).toBeVisible();
    expect(screen.getByText("Choose a qualifier, or None.")).toBeVisible();
    expect(screen.getByText("Birthdate is required.")).toBeVisible();
    expect(screen.getByText("Enter a valid email address.")).toBeVisible();
    expect(screen.getByText("Password must be at least 6 characters.")).toBeVisible();
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("reveals each password with the eye icon inside the field", async () => {
    const user = userEvent.setup();
    render(<ApplicantRegistrationForm />);
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute("autocomplete", "new-password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute("type", "text");
    expect(screen.getByLabelText(/^confirm password/i)).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Show confirm password" }));
    expect(screen.getByLabelText(/^confirm password/i)).toHaveAttribute("type", "text");
  });
});
