import { act, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { notifySuccess, Toaster } from "./toaster";

it("announces success toasts as a status message", async () => {
  render(<Toaster />);
  act(() => notifySuccess("Moved to Interview · applicant notified"));
  expect(await screen.findByRole("status")).toHaveTextContent("Moved to Interview · applicant notified");
});
