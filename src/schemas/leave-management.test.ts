import { describe, expect, it } from "vitest";

import {
  leaveAttachmentSchema,
  leaveDecisionSchema,
  leaveRequestDraftSchema,
  leaveRequestSubmissionSchema,
} from "./leave-management";

const requestId = "123e4567-e89b-42d3-a456-426614174000";
const leaveTypeId = "123e4567-e89b-42d3-a456-426614174001";
const employeeUserId = "123e4567-e89b-42d3-a456-426614174002";

describe("leave management schemas", () => {
  it("accepts a future inclusive request with a valid private attachment", () => {
    expect(leaveRequestSubmissionSchema.parse({
      requestId,
      leaveTypeId,
      startsOn: "2099-08-24",
      endsOn: "2099-08-26",
      reason: "Medical recovery.",
      attachments: [{
        objectPath: `leave-requests/${employeeUserId}/${requestId}/evidence.pdf`,
        fileName: "evidence.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
      }],
    })).toMatchObject({ startsOn: "2099-08-24", endsOn: "2099-08-26" });
  });

  it("rejects past or reversed date ranges", () => {
    expect(leaveRequestDraftSchema.safeParse({
      leaveTypeId,
      startsOn: "2000-08-24",
      endsOn: "2000-08-25",
      reason: "Past leave.",
    }).success).toBe(false);
    expect(leaveRequestDraftSchema.safeParse({
      leaveTypeId,
      startsOn: "2099-08-26",
      endsOn: "2099-08-24",
      reason: "Invalid range.",
    }).success).toBe(false);
  });

  it("rejects unsafe evidence and a blank rejection reason", () => {
    expect(leaveAttachmentSchema.safeParse({
      objectPath: "leave-requests/not-a-uuid/request/file.exe",
      fileName: "file.exe",
      mimeType: "application/x-msdownload",
      sizeBytes: 1,
    }).success).toBe(false);
    expect(leaveDecisionSchema.safeParse({ requestId, decision: "rejected", note: " " }).success).toBe(false);
  });
});
