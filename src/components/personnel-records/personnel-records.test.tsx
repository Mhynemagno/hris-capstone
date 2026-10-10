import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RecordEntryForm } from "./record-entry-form";

vi.mock("@/hooks/use-personnel-records", () => ({
  useUnitStations: () => ({ data: [{ id: 1, name: "San Juan Police Station", is_active: true }], error: null }),
}));

describe("RecordEntryForm", () => {
  it("shows the certification / training fields without an issuer", () => {
    render(<RecordEntryForm employeeId="00000000-0000-0000-0000-000000000010" kind="certification" onSaved={() => undefined} />);
    expect(screen.getByLabelText(/^certification \/ training/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^completion date/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/issuer/i)).not.toBeInTheDocument();
  });
});
