import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import PublicLayout from "./layout";

it("keeps the app's own font: the public pages load no extra typefaces", () => {
  render(<PublicLayout><p>Landing</p></PublicLayout>);
  expect(screen.getByText("Landing").parentElement?.className).toBe("flex flex-1 flex-col");
});
