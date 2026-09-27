import { describe, expect, it } from "vitest";

import { APPLICANT_EDUCATION_LEVELS, APPLICANT_PROFILE_DOCUMENT_KINDS, applicantEducationSchema, applicantPersonalDataSheetSchema, applicantPhotoDocumentFileSchema } from "./applicant-portal";

const entry = (school: string) => ({ schoolName: school, degreeCourse: "Course", yearGraduated: "2015", location: "Manila" });
const blank = { schoolName: "", degreeCourse: "", yearGraduated: "", location: "" };
const education = { elementary: entry("Primary School"), secondary: entry("High School"), college: entry("University"), graduate: blank };

const personal = {
  firstName: "Maria", middleName: "", lastName: "Reyes", qualifier: "None", dateOfBirth: "1998-04-12", placeOfBirth: "Quezon City",
  citizenship: "Filipino", gender: "female", civilStatus: "single", religion: "Roman Catholic", phone: "09171234567", address: "12 Mabini St.", education,
};

function issuePaths(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return (result.error?.issues ?? []).map((issue) => issue.path.join("."));
}

describe("applicant portal schemas", () => {
  it("labels the education levels as the tester requested", () => {
    expect(APPLICANT_EDUCATION_LEVELS.map(({ label, required }) => [label, required])).toEqual([
      ["Primary", true], ["Secondary", true], ["Bachelor's Degree", true], ["Graduate Degree", false],
    ]);
  });

  it("lists the five required documents", () => {
    expect(APPLICANT_PROFILE_DOCUMENT_KINDS.map(({ kind }) => kind)).toEqual(["resume", "psa", "photo", "eligibility", "diploma"]);
  });

  it("accepts a complete personal data sheet and stores None as no qualifier", () => {
    const parsed = applicantPersonalDataSheetSchema.parse(personal);
    expect(parsed).toMatchObject({ qualifier: undefined, citizenship: "Filipino", phone: "+639171234567", dateOfBirth: "1998-04-12" });
    expect(applicantPersonalDataSheetSchema.parse({ ...personal, qualifier: "Jr." }).qualifier).toBe("Jr.");
  });

  it("requires the personal information fields", () => {
    const result = applicantPersonalDataSheetSchema.safeParse({
      ...personal, qualifier: "", dateOfBirth: "", placeOfBirth: "", citizenship: "", gender: "", civilStatus: "", religion: "", phone: "", address: "",
    });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toEqual(expect.arrayContaining(["qualifier", "dateOfBirth", "placeOfBirth", "citizenship", "gender", "civilStatus", "religion", "phone", "address"]));
  });

  it("requires every field of Primary, Secondary and Bachelor's Degree", () => {
    const result = applicantEducationSchema.safeParse({ ...education, secondary: { ...entry("High School"), degreeCourse: "", location: "" } });
    expect(issuePaths(result)).toEqual(["secondary.degreeCourse", "secondary.location"]);
  });

  it("allows a blank Graduate Degree but not a partly filled one", () => {
    expect(applicantEducationSchema.safeParse(education).success).toBe(true);
    const result = applicantEducationSchema.safeParse({ ...education, graduate: { ...blank, schoolName: "UP Diliman" } });
    expect(issuePaths(result)).toEqual(["graduate.degreeCourse", "graduate.yearGraduated", "graduate.location"]);
  });

  it("accepts only PNG or JPEG files for the 2x2 picture", () => {
    expect(applicantPhotoDocumentFileSchema.safeParse(new File(["png"], "photo.png", { type: "image/png" })).success).toBe(true);
    expect(applicantPhotoDocumentFileSchema.safeParse(new File(["jpg"], "photo.jpg", { type: "image/jpeg" })).success).toBe(true);
    expect(applicantPhotoDocumentFileSchema.safeParse(new File(["pdf"], "photo.pdf", { type: "application/pdf" })).success).toBe(false);
  });
});
