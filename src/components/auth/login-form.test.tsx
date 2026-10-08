import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoginForm } from "./login-form";

describe("LoginForm", () => {
  it("shows a pending label and disables sign-in while the native post is in flight", () => {
    render(<LoginForm nextPath="/hr" />);
    const button = screen.getByRole("button", { name: "Login" });
    const form = button.closest("form")!;
    const submitEvent = new Event("submit", { bubbles: true, cancelable: true });

    fireEvent(form, submitEvent);

    expect(submitEvent.defaultPrevented).toBe(false);
    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
  });

  it("clears the pending state when the page is restored from the back-forward cache", () => {
    render(<LoginForm nextPath="/hr" />);
    fireEvent.submit(screen.getByRole("button", { name: "Login" }).closest("form")!);
    fireEvent(window, new Event("pageshow"));
    expect(screen.getByRole("button", { name: "Login" })).toBeEnabled();
  });

  it("labels the fields, links to password recovery, and toggles the password inside its input", () => {
    render(<LoginForm nextPath="/" />);
    expect(screen.getByLabelText("Email or badge number")).toHaveAttribute("type", "text");
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    expect(screen.getByRole("link", { name: "Forgot your password?" })).toHaveAttribute("href", "/forgot-password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" }).parentElement).toContainElement(password);
  });
});
