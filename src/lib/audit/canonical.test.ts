import { describe, test, expect } from "vitest";
import { 
  buildCanonicalCertificate,
  buildCanonicalDocumentRequest,
  buildCanonicalGradeBatch,
  buildCanonicalStatusChange,
} from "./canonical";
import { createRecordHashFromCanonical, stableJson } from "./hash";

describe("canonical hashing", () => {
  test("certificate: same input produces same hash", () => {
    const c1 = buildCanonicalCertificate({
      certificateNumber: "CERT-20260912-ABC123",
      studentId: "student-1",
      schoolYear: "2025-2026",
      grades: [
        { subjectCode: "MATH", quarter1: 95, quarter2: 96, quarter3: 97, quarter4: 98, finalGrade: 96.5, remarks: "Passed" },
        { subjectCode: "ENG", quarter1: 90, quarter2: 91, quarter3: 92, quarter4: 93, finalGrade: 91.5, remarks: "Passed" },
      ],
    });
    const c2 = buildCanonicalCertificate({
      certificateNumber: "CERT-20260912-ABC123",
      studentId: "student-1",
      schoolYear: "2025-2026",
      grades: [
        { subjectCode: "ENG", quarter1: 90, quarter2: 91, quarter3: 92, quarter4: 93, finalGrade: 91.5, remarks: "Passed" },
        { subjectCode: "MATH", quarter1: 95, quarter2: 96, quarter3: 97, quarter4: 98, finalGrade: 96.5, remarks: "Passed" },
      ],
    });
    expect(createRecordHashFromCanonical(c1)).toBe(createRecordHashFromCanonical(c2));
  });

  test("certificate: different order produces same hash", () => {
    const c1 = buildCanonicalCertificate({
      certificateNumber: "CERT-20260912-ABC123",
      studentId: "student-1",
      schoolYear: "2025-2026",
      grades: [
        { subjectCode: "MATH", quarter1: 95, quarter2: 96, quarter3: 97, quarter4: 98, finalGrade: 96.5, remarks: "Passed" },
        { subjectCode: "ENG", quarter1: 90, quarter2: 91, quarter3: 92, quarter4: 93, finalGrade: 91.5, remarks: "Passed" },
      ],
    });
    const c2 = buildCanonicalCertificate({
      certificateNumber: "CERT-20260912-ABC123",
      studentId: "student-1",
      schoolYear: "2025-2026",
      grades: [
        { subjectCode: "ENG", quarter1: 90, quarter2: 91, quarter3: 92, quarter4: 93, finalGrade: 91.5, remarks: "Passed" },
        { subjectCode: "MATH", quarter1: 95, quarter2: 96, quarter3: 97, quarter4: 98, finalGrade: 96.5, remarks: "Passed" },
      ],
    });
    expect(createRecordHashFromCanonical(c1)).toBe(createRecordHashFromCanonical(c2));
  });

  test("certificate: number precision normalized", () => {
    const c1 = buildCanonicalCertificate({
      certificateNumber: "CERT-20260912-ABC123",
      studentId: "student-1",
      schoolYear: "2025-2026",
      grades: [{ subjectCode: "MATH", quarter1: 95, quarter2: null, quarter3: null, quarter4: null, finalGrade: 95, remarks: null }],
    });
    const c2 = buildCanonicalCertificate({
      certificateNumber: "CERT-20260912-ABC123",
      studentId: "student-1",
      schoolYear: "2025-2026",
      grades: [{ subjectCode: "MATH", quarter1: 95, quarter2: null, quarter3: null, quarter4: null, finalGrade: "95.00", remarks: null }],
    });
    expect(createRecordHashFromCanonical(c1)).toBe(createRecordHashFromCanonical(c2));
  });

  test("certificate: null vs undefined handled", () => {
    const c1 = buildCanonicalCertificate({
      certificateNumber: "CERT-20260912-ABC123",
      studentId: "student-1",
      schoolYear: "2025-2026",
      grades: [{ subjectCode: "MATH", quarter1: null, quarter2: null, quarter3: null, quarter4: null, finalGrade: null, remarks: null }],
    });
    const c2 = buildCanonicalCertificate({
      certificateNumber: "CERT-20260912-ABC123",
      studentId: "student-1",
      schoolYear: "2025-2026",
      grades: [{ subjectCode: "MATH", quarter1: undefined, quarter2: undefined, quarter3: undefined, quarter4: undefined, finalGrade: undefined, remarks: undefined }],
    });
    expect(createRecordHashFromCanonical(c1)).toBe(createRecordHashFromCanonical(c2));
  });

  test("document request: same input produces same hash", () => {
    const d1 = buildCanonicalDocumentRequest({ trackingNumber: "REQ-123", documentType: "Form 137", status: "approved", schoolYearNeeded: "2025-2026", gradeLevelNeeded: "Grade 10" });
    const d2 = buildCanonicalDocumentRequest({ trackingNumber: "REQ-123", documentType: "Form 137", status: "approved", schoolYearNeeded: "2025-2026", gradeLevelNeeded: "Grade 10" });
    expect(createRecordHashFromCanonical(d1)).toBe(createRecordHashFromCanonical(d2));
  });

  test("grade batch: same input produces same hash", () => {
    const g1 = buildCanonicalGradeBatch({ batchNumber: "BATCH-1", fileName: "grades.csv", schoolYear: "2025-2026", savedRows: 100, unmatchedRows: 2 });
    const g2 = buildCanonicalGradeBatch({ batchNumber: "BATCH-1", fileName: "grades.csv", schoolYear: "2025-2026", savedRows: 100, unmatchedRows: 2 });
    expect(createRecordHashFromCanonical(g1)).toBe(createRecordHashFromCanonical(g2));
  });

  test("status change: same input produces same hash", () => {
    const s1 = buildCanonicalStatusChange({ referenceId: "REQ-123", fromStatus: "pending", toStatus: "approved", actorRole: "registrar" });
    const s2 = buildCanonicalStatusChange({ referenceId: "REQ-123", fromStatus: "pending", toStatus: "approved", actorRole: "registrar" });
    expect(createRecordHashFromCanonical(s1)).toBe(createRecordHashFromCanonical(s2));
  });

  test("stableJson: sorts object keys alphabetically", () => {
    const obj1 = { b: 2, a: 1 };
    const obj2 = { a: 1, b: 2 };
    expect(stableJson(obj1)).toBe(stableJson(obj2));
  });

  test("stableJson: handles nested objects", () => {
    const obj1 = { outer: { b: 2, a: 1 } };
    const obj2 = { outer: { a: 1, b: 2 } };
    expect(stableJson(obj1)).toBe(stableJson(obj2));
  });

  test("stableJson: handles arrays", () => {
    const arr1 = [3, 1, 2];
    const arr2 = [3, 1, 2];
    expect(stableJson(arr1)).toBe(stableJson(arr2));
  });
});