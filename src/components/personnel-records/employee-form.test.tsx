import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EmployeeForm } from "./employee-form";

describe("EmployeeForm", () => {
  it("exposes labelled official record fields and a save action", () => {
    render(<EmployeeForm onSaved={() => undefined} />);

    expect(screen.getByLabelText(/badge number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^rank/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/unit.*station/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Place of birth")).toBeInTheDocument();
    expect(screen.getByLabelText("Date of birth")).toBeInTheDocument();
    expect(screen.getByLabelText("Civil status")).toBeInTheDocument();
    expect(screen.getByLabelText(/employment start date/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save employee/i })).toHaveClass("w-full");
  });

  it("prefills and binds a selected Employee account when creating its first personnel record", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <EmployeeForm
        account={{
          profile_id: "00000000-0000-4000-8000-000000001604",
          first_name: "Ariun",
          last_name: "Bold",
          full_name: "Ariun Bold",
          email: "candidate.employee@example.test",
        }}
        onSaved={onSaved}
      />,
    );

    expect(screen.getByLabelText(/first name/i)).toHaveValue("Ariun");
    expect(screen.getByLabelText(/last name/i)).toHaveValue("Bold");
    expect(screen.getByLabelText(/personal email/i)).toHaveValue("candidate.employee@example.test");
    expect(container.querySelector('input[name="profileId"]')).toHaveValue("00000000-0000-4000-8000-000000001604");

    await user.type(screen.getByLabelText(/badge number/i), "EMP-0099");
    await user.type(screen.getByLabelText(/employment start date/i), "2024-01-01");
    await user.click(screen.getByRole("button", { name: /save employee/i }));

    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
      profileId: "00000000-0000-4000-8000-000000001604",
      firstName: "Ariun",
      lastName: "Bold",
      personalEmail: "candidate.employee@example.test",
    }));
  });
});
