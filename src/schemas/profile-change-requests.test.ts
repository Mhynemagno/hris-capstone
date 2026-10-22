import { describe, expect, it } from "vitest";

import { queryKeys } from "@/lib/query-keys";

import {
  personalFieldError,
  profileChangeContactChangeSchema,
  profileChangeDecisionSchema,
  profileChangeQualificationSnapshotSchema,
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
        {
          kind: "certification",
          operation: "add",
          originalValue: null,
          requestedValue: { name: "Public Safety Basic Recruit Course (PSBRC)", issuer: null, credentialId: null, issuedOn: "2024-06-01", expiresOn: null, notes: null },
        },
        {
          kind: "training",
          operation: "add",
          originalValue: null,
          requestedValue: { courseName: "Field Training Program (FTP)", provider: "National Police Training Institute (NPTI)", completedOn: "2024-06-01", expiresOn: null, hours: 80, notes: null },
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
        expect.objectContaining({ kind: "certification", requestedValue: expect.objectContaining({ name: "Public Safety Basic Recruit Course (PSBRC)" }) }),
        expect.objectContaining({ kind: "training", requestedValue: expect.objectContaining({ courseName: "Field Training Program (FTP)", hours: 80 }) }),
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
      changes: [{ kind: "contact", field: "phone", originalValue: null, requestedValue: "+976 99112233" }],
      documents: [],
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

  it("accepts corrections to every HR-entered personal field and validates each value", () => {
    const valid = (field: string, requestedValue: string | null) => profileChangeContactChangeSchema.safeParse({ kind: "contact", field, originalValue: null, requestedValue }).success;
    expect(valid("address", "12 Mabini St., Quezon City")).toBe(true);
    expect(valid("firstName", "Juan Miguel")).toBe(true);
    expect(valid("dateOfBirth", "1990-02-14")).toBe(true);
    expect(valid("dateOfBirth", "2999-01-01")).toBe(false);
    expect(valid("employmentStartedOn", "not a date")).toBe(false);
    expect(valid("gender", "male")).toBe(true);
    expect(valid("gender", "unknown")).toBe(false);
    expect(valid("civilStatus", "married")).toBe(true);
    expect(valid("emergencyContactRelationship", "sibling")).toBe(true);
    expect(valid("employeeNumber", "1-23456")).toBe(true);
    expect(valid("employeeNumber", "20261015")).toBe(true);
    expect(valid("employeeNumber", "12345")).toBe(false);
    expect(valid("gsisNumber", "12345678901")).toBe(true);
    expect(valid("pagibigNumber", "1234")).toBe(false);
    expect(valid("middleName", null)).toBe(true);
    expect(valid("lastName", null)).toBe(false);
    expect(valid("salary", "1")).toBe(false);
  });

  it("keeps an eligibility rating between 0 and 100 percent", () => {
    const base = { name: "NAPOLCOM PNP Entrance Examination", institution: null, qualificationLevel: null, fieldOfStudy: null, awardedOn: "2014-10-01", notes: null };
    expect(profileChangeQualificationSnapshotSchema.parse({ ...base, rating: 85 })).toMatchObject({ rating: 85 });
    expect(profileChangeQualificationSnapshotSchema.safeParse({ ...base, rating: 101 }).success).toBe(false);
    expect(personalFieldError("firstName", "x".repeat(81))).toBe("Names can have at most 80 characters.");
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
