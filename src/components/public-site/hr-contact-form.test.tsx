import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ save: vi.fn() }));

vi.mock("@/hooks/use-public-site", () => ({ useSavePublicContact: () => ({ isPending: false, mutateAsync: mocks.save }) }));

import { HrContactForm } from "./hr-contact-form";

describe("HrContactForm", () => {
  beforeEach(() => vi.resetAllMocks());

  it("checks the value against the chosen type before saving", async () => {
    const user = userEvent.setup();
    render(<HrContactForm onCancel={vi.fn()} onSaved={vi.fn()} />);
    await user.selectOptions(screen.getByLabelText(/^Type/), "email");
    await user.type(screen.getByLabelText(/^Label/), "HR email");
    await user.type(screen.getByLabelText(/^Contact details/), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Save contact" }));
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("adds a visible phone contact", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    mocks.save.mockResolvedValue({ id: "c1", label: "HR Office" });
    render(<HrContactForm onCancel={vi.fn()} onSaved={onSaved} />);
    expect(screen.getByLabelText("Show on the public landing page")).toBeChecked();
    await user.type(screen.getByLabelText(/^Label/), "HR Office");
    await user.type(screen.getByLabelText(/^Contact details/), "(02) 8123-4567");
    await user.click(screen.getByRole("button", { name: "Save contact" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({ input: { kind: "phone", label: "HR Office", value: "(02) 8123-4567", isVisible: true }, contactId: undefined }));
    expect(onSaved).toHaveBeenCalledWith("HR Office was added.");
  });
});
