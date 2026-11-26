import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SCHOOL_NAME } from "@/lib/constants";
import { buildPublicVerificationResult } from "./verification-lookup";

describe("buildPublicVerificationResult", () => {
  const base = {
    found: true,
    certificateNumber: "GRAD-2026-001",
    studentName: "Jamie Santos",
    nameRole: "student" as const,
    documentType: "Certificate of Graduation",
    dateIssued: new Date("2026-05-20T00:00:00.000Z"),
  };

  it("returns only the approved public fields for valid records", () => {
    const result = buildPublicVerificationResult({ ...base, proof: "match" });
    const allowed = new Set(["status", "certificateNumber", "studentName", "nameRole", "documentType", "dateIssued", "issuingSchool", "reason"]);
    assert.equal(result.status, "valid");
    assert.ok(Object.keys(result).every((key) => allowed.has(key)));
    assert.ok(!("lrn" in result) && !("gradeLevel" in result) && !("purpose" in result) && !("remarks" in result));
  });

  it("maps mismatch and pending proofs to their public statuses", () => {
    assert.equal(buildPublicVerificationResult({ ...base, proof: "mismatch" }).status, "invalid");
    assert.equal(buildPublicVerificationResult({ ...base, proof: "pending" }).status, "proof_pending");
    assert.equal(buildPublicVerificationResult({ ...base, proof: "none" }).status, "proof_pending");
  });

  it("omits unknown fields for a missing reference", () => {
    const result = buildPublicVerificationResult({
      found: false, certificateNumber: null, studentName: null, nameRole: "student", documentType: null, dateIssued: null, proof: "none",
    });
    assert.equal(result.status, "not_found");
    assert.equal(result.issuingSchool, SCHOOL_NAME);
    assert.ok(!("certificateNumber" in result));
  });
});
