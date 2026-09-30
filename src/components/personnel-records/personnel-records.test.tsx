import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RecordEntryForm } from "./record-entry-form";

describe("RecordEntryForm", () => {
  it("shows the certification / training fields without an issuer", () => {
    render(<RecordEntryForm employeeId="00000000-0000-0000-0000-000000000010" kind="certification" onSaved={() => undefined} />);
    expect(screen.getByLabelText(/^certification \/ training/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^completion date/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/issuer/i)).not.toBeInTheDocument();
  });
});
