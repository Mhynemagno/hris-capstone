import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoginForm } from "./login-form";

describe("LoginForm", () => {
  it("shows a pending label and disables sign-in while the native post is in flight", () => {
    render(<LoginForm mode="employee" nextPath="/hr" />);
    const button = screen.getByRole("button", { name: "Login" });
    const form = button.closest("form")!;
    const submitEvent = new Event("submit", { bubbles: true, cancelable: true });

    fireEvent(form, submitEvent);

    expect(submitEvent.defaultPrevented).toBe(false);
    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
  });

  it("clears the pending state when the page is restored from the back-forward cache", () => {
    render(<LoginForm mode="employee" nextPath="/hr" />);
    fireEvent.submit(screen.getByRole("button", { name: "Login" }).closest("form")!);
    fireEvent(window, new Event("pageshow"));
    expect(screen.getByRole("button", { name: "Login" })).toBeEnabled();
  });

  it("labels the fields, links to password recovery, and toggles the password inside its input", () => {
    render(<LoginForm mode="employee" nextPath="/" />);
    expect(screen.getByLabelText("Badge Number")).toHaveAttribute("type", "text");
    expect(screen.queryByLabelText("Email or badge number")).not.toBeInTheDocument();
    expect(document.querySelector('input[name="as"]')).toHaveValue("employee");
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    expect(screen.getByRole("link", { name: "Forgot your password?" })).toHaveAttribute("href", "/forgot-password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" }).parentElement).toContainElement(password);
  });

  it("asks applicants for their email address and offers Remember me", () => {
    render(<LoginForm mode="applicant" nextPath="/" />);
    const email = screen.getByLabelText("Email Address");
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("name", "identifier");
    expect(email).toHaveAttribute("placeholder", "juan.delacruz@email.com");
    const remember = screen.getByRole("checkbox", { name: "Remember me on this device" });
    expect(remember).toBeChecked();
    expect(remember).toHaveAttribute("name", "remember");
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");
    expect(screen.getByRole("button", { name: "Login" })).toBeInTheDocument();
    const password = screen.getByLabelText("Password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
  });

  it("shows the applicant's notice and error above the fields", () => {
    render(<LoginForm error="We could not sign you in." mode="applicant" nextPath="/" notice="Email confirmed. Please log in." />);
    expect(screen.getByRole("status")).toHaveTextContent("Email confirmed. Please log in.");
    expect(screen.getByRole("alert")).toHaveTextContent("We could not sign you in.");
  });
});
