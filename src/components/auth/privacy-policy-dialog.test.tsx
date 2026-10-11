import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PrivacyPolicyDialog } from "./privacy-policy-dialog";

describe("PrivacyPolicyDialog", () => {
  it("shows the data privacy notice and closes", async () => {
    render(<PrivacyPolicyDialog />);
    await userEvent.click(screen.getByRole("button", { name: "Privacy Policy" }));
    const dialog = await screen.findByRole("dialog", { name: "Data Privacy Notice" });
    expect(dialog).toHaveTextContent("Information we collect");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Data Privacy Notice" })).not.toBeInTheDocument();
  });
});
