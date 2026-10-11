import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Combobox } from "./combobox";

describe("Combobox", () => {
  it("passes extra classes to its text input (Capstone UI input size)", () => {
    render(<Combobox aria-label="Employee" id="employee" inputClassName="text-xs" onValueChange={vi.fn()} options={[]} value={null} />);
    expect(screen.getByRole("combobox", { name: "Employee" })).toHaveClass("text-xs");
  });
});
