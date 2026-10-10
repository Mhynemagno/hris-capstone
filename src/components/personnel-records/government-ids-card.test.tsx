import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/hooks/use-personnel-records", () => ({
  useUpdateMyGovernmentIds: () => ({ isPending: false, mutateAsync: mocks.save }),
}));

import { GovernmentIdsCard } from "./government-ids-card";

const none = { philhealth_number: null, gsis_number: null, pagibig_number: null };

describe("GovernmentIdsCard", () => {
  beforeEach(() => mocks.save.mockReset());

  it("shows the saved numbers with dashes, or Not provided, and no SSS", () => {
    render(<GovernmentIdsCard employee={{ ...none, pagibig_number: "123456789012" }} />);
    expect(screen.getByText("1234-5678-9012")).toBeVisible();
    expect(screen.getAllByText("Not provided")).toHaveLength(2);
    expect(screen.queryByText(/SSS/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
  });

  it("lets the employee add their own numbers without an HR request", async () => {
    mocks.save.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<GovernmentIdsCard canEdit employee={none} />);

    await user.click(screen.getByRole("button", { name: "Edit government IDs" }));
    expect(screen.getByLabelText(/^Pag-IBIG number/)).toHaveAttribute("placeholder", "XXXX-XXXX-XXXX");
    await user.type(screen.getByLabelText(/^PhilHealth number/), "123456789012");
    await user.type(screen.getByLabelText(/^GSIS number/), "12345678901");
    await user.type(screen.getByLabelText(/^Pag-IBIG number/), "123456789012");
    await user.click(screen.getByRole("button", { name: "Save government IDs" }));

    expect(mocks.save).toHaveBeenCalledWith({ philhealthNumber: "123456789012", gsisNumber: "12345678901", pagibigNumber: "123456789012" });
    expect(await screen.findByRole("status")).toHaveTextContent("Government IDs saved.");
  });

  it("explains a PhilHealth number with the wrong number of digits", async () => {
    const user = userEvent.setup();
    render(<GovernmentIdsCard canEdit employee={none} />);

    await user.click(screen.getByRole("button", { name: "Edit government IDs" }));
    await user.type(screen.getByLabelText(/^PhilHealth number/), "1234");
    await user.click(screen.getByRole("button", { name: "Save government IDs" }));

    expect(screen.getByText("Enter a 12-digit PhilHealth number.")).toBeVisible();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
