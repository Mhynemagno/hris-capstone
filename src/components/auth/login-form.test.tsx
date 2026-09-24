import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoginForm } from "./login-form";

describe("LoginForm", () => {
  it("shows a pending label and disables sign-in while the native post is in flight", () => {
    render(<LoginForm nextPath="/hr" />);
    const button = screen.getByRole("button", { name: "Sign in" });
    const form = button.closest("form")!;
    const submitEvent = new Event("submit", { bubbles: true, cancelable: true });

    fireEvent(form, submitEvent);

    expect(submitEvent.defaultPrevented).toBe(false);
    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
  });

  it("clears the pending state when the page is restored from the back-forward cache", () => {
    render(<LoginForm nextPath="/hr" />);
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form")!);
    fireEvent(window, new Event("pageshow"));
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });
});
