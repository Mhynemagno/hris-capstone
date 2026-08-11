import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RecordEntryForm } from "./record-entry-form";

describe("RecordEntryForm", () => {
  it("shows the required certification fields", () => {
    render(<RecordEntryForm employeeId="00000000-0000-0000-0000-000000000010" kind="certification" onSaved={() => undefined} />);
    expect(screen.getByLabelText(/^certificate name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/issuer/i)).toBeInTheDocument();
  });
});
