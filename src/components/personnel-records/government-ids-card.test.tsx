import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/hooks/use-personnel-records", () => ({
  useUpdateMyGovernmentIds: () => ({ isPending: false, mutateAsync: mocks.save }),
}));

import { GovernmentIdsCard } from "./government-ids-card";

describe("GovernmentIdsCard", () => {
  beforeEach(() => mocks.save.mockReset());

  it("shows the saved numbers with dashes, or Not provided", () => {
    render(<GovernmentIdsCard employee={{ sss_number: "3412345678", philhealth_number: null }} />);
    expect(screen.getByText("34-1234567-8")).toBeVisible();
    expect(screen.getByText("Not provided")).toBeVisible();
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
  });

  it("lets the employee add their own numbers without an HR request", async () => {
    mocks.save.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<GovernmentIdsCard canEdit employee={{ sss_number: null, philhealth_number: null }} />);

    await user.click(screen.getByRole("button", { name: "Edit government IDs" }));
    await user.type(screen.getByLabelText(/^SSS number/), "34-1234567-8");
    await user.type(screen.getByLabelText(/^PhilHealth number/), "123456789012");
    await user.click(screen.getByRole("button", { name: "Save government IDs" }));

    expect(mocks.save).toHaveBeenCalledWith({ sssNumber: "3412345678", philhealthNumber: "123456789012" });
    expect(await screen.findByRole("status")).toHaveTextContent("Government IDs saved.");
  });

  it("explains a PhilHealth number with the wrong number of digits", async () => {
    const user = userEvent.setup();
    render(<GovernmentIdsCard canEdit employee={{ sss_number: null, philhealth_number: null }} />);

    await user.click(screen.getByRole("button", { name: "Edit government IDs" }));
    await user.type(screen.getByLabelText(/^PhilHealth number/), "1234");
    await user.click(screen.getByRole("button", { name: "Save government IDs" }));

    expect(screen.getByText("Enter a 12-digit PhilHealth number.")).toBeVisible();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
