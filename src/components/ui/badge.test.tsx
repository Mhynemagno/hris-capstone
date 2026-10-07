import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { Badge } from "./badge";

it.each([
  ["success", "text-success"],
  ["warning", "text-warning"],
  ["info", "text-primary"],
  ["neutral", "text-secondary-foreground"],
  ["danger", "text-destructive"],
] as const)("renders the %s variant with its status colour", (variant, colour) => {
  render(<Badge variant={variant}>Label</Badge>);
  expect(screen.getByText("Label")).toHaveClass(colour);
});
