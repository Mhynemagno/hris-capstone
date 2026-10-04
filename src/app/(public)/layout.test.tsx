import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

// next/font/google is a build-time transform; it has no runtime exports under Vitest.
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "inter-variable" }),
  Montserrat: () => ({ variable: "montserrat-variable" }),
}));

import PublicLayout from "./layout";

it("gives every public portal page the Inter body and Montserrat heading fonts", () => {
  render(<PublicLayout><p>Landing</p></PublicLayout>);
  expect(screen.getByText("Landing").parentElement).toHaveClass("inter-variable", "montserrat-variable", "portal-type");
});
