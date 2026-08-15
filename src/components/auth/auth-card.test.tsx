import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthCard } from "./auth-card";

describe("AuthCard", () => {
  it("provides a branded main landmark around authentication content", () => {
    render(<AuthCard description="Secure access" title="Sign in"><p>Form content</p></AuthCard>);

    expect(screen.getByRole("main")).toHaveTextContent("San Juan City Police");
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByTestId("brand-command-accent")).toBeInTheDocument();
  });
});
