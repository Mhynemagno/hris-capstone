import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmployeeAccountPicker } from "./employee-account-picker";

describe("EmployeeAccountPicker", () => {
  it("takes HR to a prefilled personnel-record form for an unlinked Employee account", () => {
    render(
      <EmployeeAccountPicker
        accounts={[{
          profile_id: "00000000-0000-4000-8000-000000001604",
          first_name: "Ariun",
          last_name: "Bold",
          full_name: "Ariun Bold",
          email: "candidate.employee@example.test",
        }]}
      />,
    );

    expect(screen.getByRole("heading", { name: /accounts awaiting personnel record/i })).toBeInTheDocument();
    expect(screen.getByText("candidate.employee@example.test")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /create record for ariun bold/i })).toHaveAttribute(
      "href",
      "/hr/employees/new?profileId=00000000-0000-4000-8000-000000001604",
    );
  });
});
