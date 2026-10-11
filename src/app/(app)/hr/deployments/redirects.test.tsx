import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));

import UpdateDeploymentPage from "./[deploymentId]/edit/page";
import NewDeploymentPage from "./new/page";

describe("deployment pages open the side panel instead", () => {
  it("sends New deployment to the create panel", () => {
    expect(() => NewDeploymentPage()).toThrow("REDIRECT /hr/deployments?create=1");
  });

  it("sends Update deployment to the edit panel", async () => {
    await expect(UpdateDeploymentPage({ params: Promise.resolve({ deploymentId: "abc" }) })).rejects.toThrow("REDIRECT /hr/deployments?edit=abc");
  });
});
