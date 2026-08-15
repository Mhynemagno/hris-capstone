import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

describe("ApplicantRegistrationForm", () => {
  it("collects name parts and sends structured account metadata", async () => {
    const user = userEvent.setup();
    mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });

    render(<ApplicantRegistrationForm />);

    await user.type(screen.getByRole("textbox", { name: "First name" }), "Applicant");
    await user.type(screen.getByRole("textbox", { name: "Last name" }), "One");
    await user.type(screen.getByRole("textbox", { name: "Email" }), "applicant@example.com");
    await user.type(screen.getByLabelText("Password"), "secret1");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(mocks.signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: "applicant@example.com",
      password: "secret1",
      options: expect.objectContaining({
        data: {
          first_name: "Applicant",
          last_name: "One",
          full_name: "Applicant One",
        },
      }),
    }));
  });
});
