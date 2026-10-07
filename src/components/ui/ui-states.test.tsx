import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { Button } from "./button";

import { EmptyTableState } from "./empty-table-state";
import { ErrorState } from "./error-state";
import { FormField } from "./form-field";
import { LoadingState } from "./loading-state";

describe("shared UI states", () => {
  it("announces loading status", () => {
    render(<LoadingState label="Loading employee records" />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading employee records",
    );
  });

  it("presents an actionable error message", () => {
    render(<ErrorState message="Unable to load employee records" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to load employee records",
    );
  });

  it("renders a table's empty-state message", () => {
    render(
      <table>
        <tbody>
          <tr>
            <EmptyTableState colSpan={3} message="No employees found" />
          </tr>
        </tbody>
      </table>,
    );

    expect(screen.getByText("No employees found")).toBeInTheDocument();
  });

  it("connects a field label to its input", () => {
    render(
      <FormField htmlFor="email" label="Email address">
        <input id="email" />
      </FormField>,
    );

    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
  });
});

it("offers a retry from an error state", async () => {
  const onRetry = vi.fn();
  render(<ErrorState message="Network down" onRetry={onRetry} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Network down");
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

it("disables a loading button and marks it busy", () => {
  render(<Button loading>Save</Button>);
  const button = screen.getByRole("button", { name: /save/i });
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute("aria-busy", "true");
});
