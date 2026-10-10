import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ submit: vi.fn(), reports: [] as Array<Record<string, unknown>>, url: vi.fn() }));
vi.mock("@/hooks/use-deployment-tracking", () => ({
  useDeploymentReports: () => ({ isLoading: false, error: null, data: mocks.reports }),
  useSubmitDeploymentReport: () => ({ isPending: false, mutateAsync: mocks.submit }),
}));
vi.mock("@/queries/deployment-tracking", () => ({ getDeploymentReportUrl: mocks.url }));

import { DeploymentReports } from "./deployment-reports";

const deploymentId = "00000000-0000-4000-8000-000000002791";

describe("DeploymentReports", () => {
  beforeEach(() => { mocks.submit.mockReset(); mocks.reports = []; });

  it("lists submitted reports with a link to the proof", () => {
    mocks.reports = [{ id: "r1", deployment_id: deploymentId, notes: "Attended the whole event", object_path: `deployments/${deploymentId}/a.pdf`, file_name: "report.pdf", mime_type: "application/pdf", size_bytes: 10, submitted_by_user_id: "u", created_at: "2026-10-10T08:00:00Z" }];
    render(<DeploymentReports deploymentId={deploymentId} />);
    expect(screen.getByRole("heading", { name: "Reports / proof of attendance" })).toBeInTheDocument();
    expect(screen.getByText("Attended the whole event")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View report.pdf" })).toBeInTheDocument();
  });

  it("requires a file and submits it with the notes", async () => {
    const user = userEvent.setup();
    mocks.submit.mockResolvedValue("r1");
    render(<DeploymentReports deploymentId={deploymentId} />);
    expect(screen.getByText("No report submitted yet.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Submit report" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Attach the report or proof of attendance.");
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText(/^Report or proof/), file);
    await user.type(screen.getByLabelText("Notes"), "Present all day");
    await user.click(screen.getByRole("button", { name: "Submit report" }));
    expect(mocks.submit).toHaveBeenCalledWith({ deploymentId, notes: "Present all day", file });
    expect(await screen.findByRole("status")).toHaveTextContent("Report submitted.");
  });
});
