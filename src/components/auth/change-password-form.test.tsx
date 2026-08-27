import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChangePasswordForm } from "./change-password-form";

describe("ChangePasswordForm", () => {
  it("does not submit until password confirmation matches", async () => {
    const user = userEvent.setup();
    const onChangePassword = vi.fn();
    render(<ChangePasswordForm onChangePassword={onChangePassword} />);

    await user.type(screen.getByLabelText(/^new password/i), "long-enough-password");
    await user.type(screen.getByLabelText(/confirm new password/i), "different-password");
    await user.click(screen.getByRole("button", { name: /change password/i }));

    expect(onChangePassword).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/match/i);
  });
});
