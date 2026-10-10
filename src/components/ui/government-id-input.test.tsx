import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GovernmentIdInput } from "./government-id-input";

describe("GovernmentIdInput", () => {
  it("keeps every digit of a pasted number that contains separators", async () => {
    const user = userEvent.setup();
    render(<><label htmlFor="gsis">GSIS number</label><GovernmentIdInput id="gsis" kind="gsis" name="gsisNumber" /></>);
    await user.click(screen.getByLabelText("GSIS number"));
    await user.paste("1234-5678-901");
    expect(screen.getByLabelText("GSIS number")).toHaveValue("12345678901");
  });

  it("re-formats a pasted Pag-IBIG number with spaces and stops at 12 digits", async () => {
    const user = userEvent.setup();
    render(<><label htmlFor="pagibig">Pag-IBIG number</label><GovernmentIdInput id="pagibig" kind="pagibig" name="pagibigNumber" /></>);
    await user.click(screen.getByLabelText("Pag-IBIG number"));
    await user.paste("1234 - 5678 - 9012 - 77");
    expect(screen.getByLabelText("Pag-IBIG number")).toHaveValue("1234-5678-9012");
  });
});
