import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildCanonicalCertificate,
  buildCanonicalDocumentRequest,
  buildCanonicalStatusChange,
} from "./canonical";
import { createRecordHashFromCanonical, stableJson } from "./hash";

describe("canonical hashing", () => {
  it("certificate: same input produces same hash", () => {
    const c1 = buildCanonicalCertificate({
      certificateNumber: "CERT-20260912-ABC123",
      studentId: "student-1",
      schoolYear: "2025-2026",
    });
    const c2 = buildCanonicalCertificate({
      certificateNumber: "CERT-20260912-ABC123",
      studentId: "student-1",
      schoolYear: "2025-2026",
    });
    assert.equal(createRecordHashFromCanonical(c1), createRecordHashFromCanonical(c2));
  });

  it("certificate: different fields produce different hash", () => {
    const c1 = buildCanonicalCertificate({
      certificateNumber: "CERT-20260912-ABC123",
      studentId: "student-1",
      schoolYear: "2025-2026",
    });
    const c2 = buildCanonicalCertificate({
      certificateNumber: "CERT-20260912-ABC123",
      studentId: "student-2",
      schoolYear: "2025-2026",
    });
    assert.notEqual(createRecordHashFromCanonical(c1), createRecordHashFromCanonical(c2));
  });

  it("document request: same input produces same hash", () => {
    const d1 = buildCanonicalDocumentRequest({ trackingNumber: "REQ-123", documentType: "Form 137", status: "approved", schoolYearNeeded: "2025-2026", gradeLevelNeeded: "Grade 10" });
    const d2 = buildCanonicalDocumentRequest({ trackingNumber: "REQ-123", documentType: "Form 137", status: "approved", schoolYearNeeded: "2025-2026", gradeLevelNeeded: "Grade 10" });
    assert.equal(createRecordHashFromCanonical(d1), createRecordHashFromCanonical(d2));
  });

  it("status change: same input produces same hash", () => {
    const s1 = buildCanonicalStatusChange({ referenceId: "REQ-123", fromStatus: "pending", toStatus: "approved", actorRole: "registrar" });
    const s2 = buildCanonicalStatusChange({ referenceId: "REQ-123", fromStatus: "pending", toStatus: "approved", actorRole: "registrar" });
    assert.equal(createRecordHashFromCanonical(s1), createRecordHashFromCanonical(s2));
  });

  it("stableJson: sorts object keys alphabetically", () => {
    const obj1 = { b: 2, a: 1 };
    const obj2 = { a: 1, b: 2 };
    assert.equal(stableJson(obj1), stableJson(obj2));
  });

  it("stableJson: handles nested objects", () => {
    const obj1 = { outer: { b: 2, a: 1 } };
    const obj2 = { outer: { a: 1, b: 2 } };
    assert.equal(stableJson(obj1), stableJson(obj2));
  });

  it("stableJson: handles arrays", () => {
    const arr1 = [3, 1, 2];
    const arr2 = [3, 1, 2];
    assert.equal(stableJson(arr1), stableJson(arr2));
  });
});
