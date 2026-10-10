import { describe, expect, it } from "vitest";

import { computePerformanceRubric, gradeForTotal, servicePoints } from "./performance-rubric";

describe("servicePoints", () => {
  it("follows the client's years-of-service rubric", () => {
    expect([0, 1, 3, 4, 6, 7, 9, 10, 14, 15, 30].map(servicePoints)).toEqual([5, 15, 15, 25, 25, 35, 35, 45, 45, 50, 50]);
  });
});

describe("gradeForTotal", () => {
  it("maps total points to the grade equivalent and descriptive rating", () => {
    expect(gradeForTotal(95)).toMatchObject({ grade: "1.00", rating: "Outstanding", ratingValue: 5 });
    expect(gradeForTotal(80)).toMatchObject({ grade: "1.50", rating: "Very Satisfactory", ratingValue: 4 });
    expect(gradeForTotal(79)).toMatchObject({ grade: "2.00", rating: "Satisfactory", ratingValue: 3 });
    expect(gradeForTotal(60)).toMatchObject({ grade: "2.50", rating: "Unsatisfactory", ratingValue: 2 });
    expect(gradeForTotal(59)).toMatchObject({ grade: "3.00", rating: "Poor", ratingValue: 1 });
  });
});

describe("computePerformanceRubric", () => {
  it("adds service points to capped course points", () => {
    const result = computePerformanceRubric({
      employmentStartedOn: "2014-01-15",
      asOf: "2026-10-10",
      certifications: [
        { name: "Public Safety Basic Recruit Course (PSBRC)", category: "mandatory_course", expires_on: null },
        { name: "Public Safety Junior Leadership Course (PSJLC)", category: "mandatory_course", expires_on: null },
        { name: "Public Safety Senior Leadership Course (PSSLC)", category: "mandatory_course", expires_on: null },
        { name: "Special Weapons and Tactics (SWAT) Course", category: "specialized_training", expires_on: null },
        { name: "Special Weapons and Tactics (SWAT) Course", category: "specialized_training", expires_on: null },
      ],
    });
    expect(result).toMatchObject({ yearsOfService: 12, servicePoints: 45, mandatoryCount: 3, mandatoryPoints: 30, specializedCount: 1, specializedPoints: 10, totalPoints: 85, grade: "1.50", rating: "Very Satisfactory" });
  });

  it("ignores expired courses and uncategorised records", () => {
    const result = computePerformanceRubric({
      employmentStartedOn: "2026-03-01",
      asOf: "2026-10-10",
      certifications: [
        { name: "Cybercrime Investigation Seminar", category: "specialized_training", expires_on: "2026-01-01" },
        { name: "Leadership and Management Course", category: null, expires_on: null },
      ],
    });
    expect(result).toMatchObject({ yearsOfService: 0, servicePoints: 5, specializedCount: 0, totalPoints: 5, rating: "Poor" });
  });
});
