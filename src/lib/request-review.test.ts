import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildRequestReviewRows } from "./request-review";

describe("buildRequestReviewRows", () => {
  it("shows SHS request details in order and labels the grade", () => {
    const rows = buildRequestReviewRows({
      documentType: "Good Moral Certificate",
      reason: "Other",
      purpose: "College scholarship application requirement",
      gradeLevel: "11",
      strandNeeded: "ABM",
      sectionNeeded: "",
      remarks: "",
    });
    assert.deepEqual(rows.map((row) => row.label), ["Document type", "Reason for requesting", "Purpose", "Grade level", "Strand", "Section", "Remarks"]);
    assert.equal(rows.find((row) => row.label === "Grade level")?.value, "Grade 11");
    assert.equal(rows.find((row) => row.label === "Section")?.value, "Not set");
    assert.equal(rows.find((row) => row.label === "Remarks")?.value, "None");
  });

  it("shows purpose only for the Other reason", () => {
    const rows = buildRequestReviewRows({
      documentType: "Certificate of Enrollment",
      reason: "Transfer to another school",
      purpose: "Transfer to another school",
      gradeLevel: "10",
      strandNeeded: "",
      sectionNeeded: "Mabini",
      remarks: "",
    });
    assert.ok(!rows.some((row) => row.label === "Purpose"));
  });
});
