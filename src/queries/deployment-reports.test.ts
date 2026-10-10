import { beforeEach, describe, expect, it, vi } from "vitest";

const deploymentId = "00000000-0000-4000-8000-000000002791";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), upload: vi.fn(), remove: vi.fn(), bucket: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    rpc: mocks.rpc,
    storage: { from: (bucket: string) => { mocks.bucket(bucket); return { upload: mocks.upload, remove: mocks.remove }; } },
  }),
}));

import { submitDeploymentReport } from "./deployment-tracking";

describe("submitDeploymentReport", () => {
  beforeEach(() => { mocks.rpc.mockReset(); mocks.upload.mockReset(); mocks.remove.mockReset(); mocks.bucket.mockReset(); });

  it("uploads the proof under the deployment and submits the report", async () => {
    mocks.upload.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ data: "r1", error: null });
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    await submitDeploymentReport({ deploymentId, notes: "Attended", file });
    expect(mocks.bucket).toHaveBeenCalledWith("deployment-reports");
    const path = mocks.upload.mock.calls[0]![0] as string;
    expect(path).toMatch(new RegExp(`^deployments/${deploymentId}/[0-9a-f-]{36}\.jpg$`));
    expect(mocks.rpc).toHaveBeenCalledWith("submit_deployment_report", { target_deployment_id: deploymentId, target_notes: "Attended", target_document: { objectPath: path, fileName: "photo.jpg", mimeType: "image/jpeg", sizeBytes: 3 } });
  });

  it("asks for a file and cleans up when the report is refused", async () => {
    await expect(submitDeploymentReport({ deploymentId, notes: "", file: null })).rejects.toThrow("Attach the report or proof of attendance.");
    mocks.upload.mockResolvedValue({ error: null });
    mocks.remove.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "You can only report on your own deployment." } });
    await expect(submitDeploymentReport({ deploymentId, file: new File(["x"], "r.pdf", { type: "application/pdf" }) })).rejects.toThrow("You can only report on your own deployment.");
    expect(mocks.remove).toHaveBeenCalledWith([mocks.upload.mock.calls[0]![0]]);
  });
});
