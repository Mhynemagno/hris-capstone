import { describe, expect, it } from "vitest";

import {
  leaveAttachmentSchema,
  leaveDecisionSchema,
  leaveRequestDraftSchema,
  leaveRequestSubmissionSchema,
} from "./leave-management";

/** A local ISO date the given number of days from today, inside the two-year leave window. */
const inDays = (days: number) => {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const soon = inDays(30);
const soonEnd = inDays(32);

const requestId = "123e4567-e89b-42d3-a456-426614174000";
const leaveTypeId = "123e4567-e89b-42d3-a456-426614174001";
const employeeUserId = "123e4567-e89b-42d3-a456-426614174002";

describe("leave management schemas", () => {
  it("accepts a future inclusive request with a valid private attachment", () => {
    expect(leaveRequestSubmissionSchema.parse({
      requestId,
      leaveTypeId,
      startsOn: soon,
      endsOn: soonEnd,
      reason: "Medical recovery.",
      attachments: [{
        objectPath: `leave-requests/${employeeUserId}/${requestId}/evidence.pdf`,
        fileName: "evidence.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
      }],
    })).toMatchObject({ startsOn: soon, endsOn: soonEnd });
  });

  it("treats notes as optional and stores blank notes as undefined", () => {
    expect(leaveRequestDraftSchema.parse({ leaveTypeId, startsOn: soon, endsOn: soon }).reason).toBeUndefined();
    expect(leaveRequestDraftSchema.parse({ leaveTypeId, startsOn: soon, endsOn: soon, reason: "   " }).reason).toBeUndefined();
    expect(leaveRequestDraftSchema.safeParse({ leaveTypeId, startsOn: soon, endsOn: soon, reason: "x".repeat(2001) }).success).toBe(false);
  });

  it("rejects a leave date more than two years ahead", () => {
    expect(leaveRequestDraftSchema.safeParse({ leaveTypeId, startsOn: "2099-08-24", endsOn: "2099-08-24" }).success).toBe(false);
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
      startsOn: soonEnd,
      endsOn: soon,
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
