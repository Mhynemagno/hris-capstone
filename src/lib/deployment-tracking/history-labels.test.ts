import { describe, expect, it } from "vitest";

import { describeDeploymentEvent } from "./history-labels";

describe("describeDeploymentEvent", () => {
  it("names who created the deployment", () => {
    expect(describeDeploymentEvent({ event_type: "created", metadata: {} }, "Juan Dela Cruz")).toBe("Deployment created by Juan Dela Cruz");
  });

  it("spells out a status change with readable labels", () => {
    expect(describeDeploymentEvent({ event_type: "status_changed", metadata: { before: { status: "scheduled" }, after: { status: "ongoing" } } }, "Ana Reyes"))
      .toBe("Status changed from Scheduled to Ongoing by Ana Reyes");
  });

  it("describes other edits and copes with a missing actor or metadata", () => {
    expect(describeDeploymentEvent({ event_type: "updated", metadata: {} }, null)).toBe("Details updated");
    expect(describeDeploymentEvent({ event_type: "status_changed", metadata: {} }, null)).toBe("Status changed");
  });
});
