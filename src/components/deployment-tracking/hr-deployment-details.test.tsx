import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const deployment = {
  id: "00000000-0000-4000-8000-000000000901", employee_id: "e1", location: "Whiteplains, EDSA", unit: null, unit_station_id: null, project: null,
  assignment_role: "Whiteplains, EDSA", starts_on: "2026-10-10", ends_on: null, status: "scheduled", notes: "Fiesta",
  deployment_type: "Special Event", event_operation: "Fiesta / Major Event", created_by_user_id: null, updated_by_user_id: null,
  created_at: "2026-10-09T10:12:00Z", updated_at: "2026-10-09T10:12:00Z",
  employee: { id: "e1", employee_number: "1-60482", first_name: "Maria", middle_name: null, last_name: "Balneg" },
  deployment_history: [{ id: 1, deployment_id: "00000000-0000-4000-8000-000000000901", actor_user_id: "u1", event_type: "created", metadata: {}, created_at: "2026-10-09T10:12:00Z", actor: { full_name: "Juan Dela Cruz" } }],
};

vi.mock("@/hooks/use-deployment-tracking", () => ({ useDeployment: () => ({ data: deployment, isLoading: false, error: null }) }));

import { HrDeploymentDetails } from "./hr-deployment-details";

describe("HrDeploymentDetails", () => {
  it("shows the assignment read-only with an Update link and readable history", () => {
    render(<HrDeploymentDetails deploymentId={deployment.id} />);
    expect(screen.getByText("Maria Balneg")).toBeVisible();
    expect(screen.getByText("Whiteplains, EDSA")).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Update" })).toHaveAttribute("href", `/hr/deployments/${deployment.id}/edit`);
    expect(screen.getByText("Deployment created by Juan Dela Cruz")).toBeVisible();
    expect(screen.queryByText(/^created$/)).not.toBeInTheDocument();
  });
});
