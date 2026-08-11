import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmployeeForm } from "./employee-form";

describe("EmployeeForm", () => {
  it("exposes labelled official record fields and a save action", () => {
    render(<EmployeeForm onSaved={() => undefined} />);

    expect(screen.getByLabelText(/employee number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/employment start date/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save employee/i })).toBeInTheDocument();
  });
});
