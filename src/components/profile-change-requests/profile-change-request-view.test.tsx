import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({ useProfileChangeRequest: vi.fn(), useMyProfileChangeRequests: vi.fn(), useCancelProfileChangeRequest: vi.fn(), useProfileChangeDocumentUrl: vi.fn(), useDecideProfileChangeRequest: vi.fn() }));
vi.mock("@/hooks/use-profile-change-requests", () => hooks);
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { ProfileChangeRequestList } from "./profile-change-request-list";
import { ProfileChangeRequestView } from "./profile-change-request-view";

const requestId = "00000000-0000-4000-8000-000000000301";

describe("ProfileChangeRequestView", () => {
  it("shows what the employee asked to change and the reviewer's decision", () => {
    hooks.useProfileChangeRequest.mockReturnValue({ isLoading: false, error: null, data: {
      id: requestId, status: "rejected", note: "New number", decision_reason: "Attach proof of the new number.", created_at: "2026-09-15T08:00:00Z", decided_at: "2026-09-16T08:00:00Z",
      profile_change_request_documents: [],
      profile_change_request_changes: [{ id: "c1", request_id: requestId, ordinal: 1, kind: "contact", field_key: "phone", operation: null, qualification_id: null, original_value: "09170000000", requested_value: "09171234567", created_at: "" }],
    } });

    render(<ProfileChangeRequestView requestId={requestId} />);

    expect(hooks.useProfileChangeRequest).toHaveBeenCalledWith(requestId);
    const change = screen.getByRole("heading", { name: "Phone" }).closest("li")!;
    expect(within(change).getByText("Previous value")).toBeInTheDocument();
    expect(within(change).getByText("09170000000")).toBeInTheDocument();
    expect(within(change).getByText("09171234567")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Decision" })).toHaveTextContent("Rejected. Your profile was not changed.");
    expect(screen.getByText("Attach proof of the new number.")).toBeInTheDocument();
    expect(screen.getByText("New number")).toBeInTheDocument();
  });
});

describe("ProfileChangeRequestList", () => {
  it("links each request to its detail view", () => {
    hooks.useMyProfileChangeRequests.mockReturnValue({ isLoading: false, error: null, data: { rows: [{ id: requestId, status: "approved", note: null, decision_reason: null, created_at: "2026-09-15T08:00:00Z" }], count: 1 } });
    hooks.useCancelProfileChangeRequest.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });

    render(<ProfileChangeRequestList />);

    expect(screen.getByRole("link", { name: /^view approved request/i })).toHaveAttribute("href", `/employee/profile/change-requests/${requestId}`);
  });
});
