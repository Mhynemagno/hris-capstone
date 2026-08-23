import { describe, expect, it } from "vitest";

import { queryKeys } from "@/lib/query-keys";

import {
  profileChangeContactChangeSchema,
  profileChangeDecisionSchema,
  profileChangeRequestFiltersSchema,
  profileChangeSubmissionSchema,
} from "./profile-change-requests";

const requestId = "123e4567-e89b-42d3-a456-426614174000";
const employeeUserId = "123e4567-e89b-42d3-a456-426614174001";
const qualificationId = "123e4567-e89b-42d3-a456-426614174002";

const qualification = {
  name: "Bachelor of Science",
  institution: "National University",
  qualificationLevel: "Bachelor",
  fieldOfStudy: "Public Administration",
  awardedOn: "2024-06-01",
  notes: "Verified transcript",
};

describe("profile change request schemas", () => {
  it("normalizes an employee's contact and qualification proposal before submission", () => {
    expect(profileChangeSubmissionSchema.parse({
      requestId,
      note: " Updated contact and qualification details. ",
      changes: [
        {
          kind: "contact",
          field: "phone",
          originalValue: "+976 111 1111",
          requestedValue: " +976 222 2222 ",
        },
        {
          kind: "qualification",
          operation: "edit",
          qualificationId,
          originalValue: qualification,
          requestedValue: { ...qualification, institution: " Updated National University " },
        },
        {
          kind: "qualification",
          operation: "add",
          originalValue: null,
          requestedValue: qualification,
        },
        {
          kind: "qualification",
          operation: "remove",
          qualificationId,
          originalValue: qualification,
          requestedValue: null,
        },
      ],
      documents: [{
        objectPath: `profile-change-requests/${employeeUserId}/${requestId}/123e4567-e89b-42d3-a456-426614174003.pdf`,
        fileName: " evidence.pdf ",
        mimeType: "application/pdf",
        sizeBytes: 1024,
      }],
    })).toMatchObject({
      requestId,
      note: "Updated contact and qualification details.",
      changes: expect.arrayContaining([
        expect.objectContaining({ kind: "contact", field: "phone", requestedValue: "+976 222 2222" }),
        expect.objectContaining({ kind: "qualification", operation: "edit", requestedValue: expect.objectContaining({ institution: "Updated National University" }) }),
      ]),
      documents: [expect.objectContaining({ fileName: "evidence.pdf" })],
    });
  });

  it("rejects empty, protected, malformed, and unsafe requests", () => {
    expect(profileChangeSubmissionSchema.safeParse({ requestId, changes: [], documents: [] }).success).toBe(false);
    expect(profileChangeContactChangeSchema.safeParse({
      kind: "contact", field: "employmentStatus", originalValue: "active", requestedValue: "inactive",
    }).success).toBe(false);
    expect(profileChangeSubmissionSchema.safeParse({
      requestId,
      changes: [{ kind: "qualification", operation: "remove", originalValue: qualification, requestedValue: null }],
      documents: [],
    }).success).toBe(false);
    expect(profileChangeSubmissionSchema.safeParse({
      requestId,
      changes: [{ kind: "contact", field: "address", originalValue: null, requestedValue: "New address" }],
      documents: [{ objectPath: "private-documents/other-user.pdf", fileName: "payload.exe", mimeType: "application/x-msdownload", sizeBytes: 1 }],
    }).success).toBe(false);
  });

  it("requires a reason for rejection and keeps request caches scoped by filters", () => {
    expect(profileChangeDecisionSchema.safeParse({ requestId, decision: "rejected" }).success).toBe(false);
    expect(profileChangeDecisionSchema.parse({ requestId, decision: "approved" })).toEqual({ requestId, decision: "approved" });
    expect(profileChangeRequestFiltersSchema.parse({ page: "2", pageSize: "500", status: "pending", search: " applicant " })).toEqual({ page: 2, pageSize: 100, status: "pending", search: "applicant" });
    expect(queryKeys.profileChangeRequests.adminQueue({ page: 2, status: "pending" })).toEqual([
      "profile-change-requests", "admin-queue", { page: 2, status: "pending" },
    ]);
  });
});
