import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ mutateAsync: vi.fn(), useEmployeeForCurrentUser: vi.fn(), usePersonnelEntries: vi.fn() }));
vi.mock("@/hooks/use-profile-change-requests", () => ({ useSubmitProfileChangeRequest: () => ({ isPending: false, mutateAsync: mocks.mutateAsync }) }));
vi.mock("@/hooks/use-personnel-records", () => ({ useEmployeeForCurrentUser: mocks.useEmployeeForCurrentUser, usePersonnelEntries: mocks.usePersonnelEntries }));
import { ProfileChangeRequestForm } from "./profile-change-request-form";

describe("ProfileChangeRequestForm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.mutateAsync.mockResolvedValue(undefined);
    mocks.useEmployeeForCurrentUser.mockReturnValue({ isLoading: false, data: { id: "00000000-0000-4000-8000-000000000201", personal_email: "employee@example.test", phone: null, address: null, emergency_contact_name: null, emergency_contact_phone: null } });
    mocks.usePersonnelEntries.mockReturnValue({ data: [] });
  });

  it("adds a qualification proposal and submits it for approval", async () => {
    const user = userEvent.setup();
    render(<ProfileChangeRequestForm />);
    await user.type(screen.getByLabelText("Qualification name"), "Bachelor of Science");
    await user.type(screen.getByLabelText("Institution"), "Mongolian University");
    await user.type(screen.getByLabelText("Awarded on"), "2024-06-01");
    await user.click(screen.getByRole("button", { name: "Add proposal to request" }));
    expect(screen.getByRole("list", { name: "Qualification proposals" })).toHaveTextContent("Bachelor of Science");
    await user.click(screen.getByRole("button", { name: "Submit request" }));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ draft: expect.objectContaining({ changes: [expect.objectContaining({ kind: "qualification", operation: "add", requestedValue: expect.objectContaining({ name: "Bachelor of Science", institution: "Mongolian University" }) })] }) }))); 
  }, 10_000);

  it("requires at least one proposed change", async () => {
    const user = userEvent.setup();
    render(<ProfileChangeRequestForm />);
    await user.click(screen.getByRole("button", { name: "Submit request" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Change at least one contact field or add a qualification proposal.");
  });

  it("shows only supported contact and emergency-contact fields", () => {
    render(<ProfileChangeRequestForm />);

    expect(screen.queryByLabelText("Address")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Personal email")).toBeInTheDocument();
    expect(screen.getByLabelText("Phone")).toBeInTheDocument();
    expect(screen.getByLabelText("Emergency contact name")).toBeInTheDocument();
    expect(screen.getByLabelText("Emergency contact phone")).toBeInTheDocument();
  });
});
