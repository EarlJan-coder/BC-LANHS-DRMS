import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { certificateOverrideSchema, profileUpdateSchema, registrationDecisionSchema } from "@/lib/validators";

describe("certificateOverrideSchema", () => {
  it("accepts the seven editable content fields", () => {
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

  it("accepts signatory names and blanks them like the other fields", () => {
    const parsed = certificateOverrideSchema.parse({
      studentName: "Juan Dela Cruz",
      registrarName: "  Ana Reyes ",
      principalName: "   ",
    });
    assert.equal(parsed.registrarName, "Ana Reyes");
    // A blank signatory name clears back to printing no name at all.
    assert.equal(parsed.principalName, undefined);
  });

  it("rejects a signatory name longer than the column allows", () => {
    assert.throws(() => certificateOverrideSchema.parse({ registrarName: "X".repeat(201) }));
    assert.throws(() => certificateOverrideSchema.parse({ principalName: "X".repeat(201) }));
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

describe("registrationDecisionSchema", () => {
  it("allows a decision with a blank note", () => {
    const parsed = registrationDecisionSchema.parse({ decision: "approved", note: "   " });
    assert.deepEqual(parsed, { decision: "approved", note: "" });
  });

  it("defaults a missing note to an empty string", () => {
    assert.deepEqual(registrationDecisionSchema.parse({ decision: "declined" }), {
      decision: "declined",
      note: "",
    });
  });

  it("still rejects an unknown decision or an over-long note", () => {
    assert.throws(() => registrationDecisionSchema.parse({ decision: "pending", note: "" }));
    assert.throws(() => registrationDecisionSchema.parse({ decision: "approved", note: "x".repeat(2001) }));
  });
});

describe("profileUpdateSchema", () => {
  it("accepts the last school year and structured address fields", () => {
    const parsed = profileUpdateSchema.parse({
      lastSchoolYearAttended: " 2025-2026 ",
      addressCity: " Tanza ",
      addressBarangay: " Biga ",
      addressStreetLine: " 123 Mabini St. ",
    });
    assert.deepEqual(parsed, {
      lastSchoolYearAttended: "2025-2026",
      addressCity: "Tanza",
      addressBarangay: "Biga",
      addressStreetLine: "123 Mabini St.",
    });
  });

  it("rejects a blank last school year or address part", () => {
    assert.throws(() => profileUpdateSchema.parse({ lastSchoolYearAttended: "   " }));
    assert.throws(() => profileUpdateSchema.parse({ addressCity: "Tanza", addressBarangay: " " }));
    assert.throws(() => profileUpdateSchema.parse({ addressStreetLine: "" }));
  });

  it("caps the last school year at 40 characters", () => {
    assert.throws(() => profileUpdateSchema.parse({ lastSchoolYearAttended: "x".repeat(41) }));
  });

  it("keeps contact number and email optional", () => {
    assert.deepEqual(profileUpdateSchema.parse({}), {});
    assert.deepEqual(profileUpdateSchema.parse({ contactNumber: "09171234567" }), {
      contactNumber: "09171234567",
    });
  });
});
