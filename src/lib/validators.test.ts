import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { certificateOverrideSchema } from "@/lib/validators";

describe("certificateOverrideSchema", () => {
  it("accepts the five editable content fields", () => {
    const parsed = certificateOverrideSchema.parse({
      studentName: "Juan Dela Cruz",
      gradeLevel: "Grade 10",
      section: "Sampaguita",
      purpose: "Scholarship application",
      dateGenerated: "2026-10-24",
    });
    assert.deepEqual(parsed, {
      studentName: "Juan Dela Cruz",
      gradeLevel: "Grade 10",
      section: "Sampaguita",
      purpose: "Scholarship application",
      dateGenerated: new Date("2026-10-24"),
    });
  });

  it("trims string fields and treats empty strings as clearing the override", () => {
    const parsed = certificateOverrideSchema.parse({
      studentName: "  Juan Dela Cruz  ",
      gradeLevel: "",
      section: "   ",
      purpose: "  Scholarship application  ",
    });
    assert.equal(parsed.studentName, "Juan Dela Cruz");
    // Empty/whitespace strings clear the override (fall back to the record value).
    assert.equal(parsed.gradeLevel, undefined);
    assert.equal(parsed.section, undefined);
    assert.equal(parsed.purpose, "Scholarship application");
  });

  it("strips non-editable fields (school year, certificate number, certificate type)", () => {
    const parsed = certificateOverrideSchema.parse({
      studentName: "Juan Dela Cruz",
      schoolYear: "2026-2027",
      certificateNumber: "CERT-123",
      certificateType: "good-moral",
    });
    assert.equal("schoolYear" in parsed, false);
    assert.equal("certificateNumber" in parsed, false);
    assert.equal("certificateType" in parsed, false);
  });

  it("rejects an invalid date", () => {
    assert.throws(() => certificateOverrideSchema.parse({ dateGenerated: "not-a-date" }));
  });
});
