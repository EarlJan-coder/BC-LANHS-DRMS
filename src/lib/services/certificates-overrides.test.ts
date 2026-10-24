import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveCertificateDisplayFields } from "@/lib/services/certificates";

const liveRow = {
  firstName: "Juan",
  middleName: "Santos",
  lastName: "Dela Cruz",
  suffix: null,
  gradeLevel: "Grade 10",
  section: "Sampaguita",
  requestPurpose: "Scholarship application",
  generatedAt: new Date("2026-01-15T00:00:00Z"),
  overrideStudentName: null,
  overrideGradeLevel: null,
  overrideSection: null,
  overridePurpose: null,
  overrideDateGenerated: null,
};

describe("resolveCertificateDisplayFields", () => {
  it("falls back to the live joined values when no override is set", () => {
    const fields = resolveCertificateDisplayFields(liveRow);
    assert.equal(fields.name, "Juan Santos Dela Cruz");
    assert.equal(fields.gradeLevel, "Grade 10");
    assert.equal(fields.section, "Sampaguita");
    assert.equal(fields.purpose, "Scholarship application");
    assert.deepEqual(fields.dateGenerated, new Date("2026-01-15T00:00:00Z"));
  });

  it("prefers set overrides over the live values", () => {
    const fields = resolveCertificateDisplayFields({
      ...liveRow,
      overrideStudentName: "Juan Dela Cruz",
      overrideGradeLevel: "Grade 12",
      overrideSection: "Rosal",
      overridePurpose: "Employment requirement",
      overrideDateGenerated: new Date("2026-06-01T00:00:00Z"),
    });
    assert.equal(fields.name, "Juan Dela Cruz");
    assert.equal(fields.gradeLevel, "Grade 12");
    assert.equal(fields.section, "Rosal");
    assert.equal(fields.purpose, "Employment requirement");
    assert.deepEqual(fields.dateGenerated, new Date("2026-06-01T00:00:00Z"));
  });

  it("treats empty or whitespace-only overrides as unset (never renders blank)", () => {
    const fields = resolveCertificateDisplayFields({
      ...liveRow,
      overrideStudentName: "   ",
      overrideGradeLevel: "",
      overrideSection: "  ",
      overridePurpose: "",
    });
    assert.equal(fields.name, "Juan Santos Dela Cruz");
    assert.equal(fields.gradeLevel, "Grade 10");
    assert.equal(fields.section, "Sampaguita");
    assert.equal(fields.purpose, "Scholarship application");
  });

  it("keeps a partial override set: overridden fields win, the rest stay live", () => {
    const fields = resolveCertificateDisplayFields({
      ...liveRow,
      overridePurpose: "Transfer requirements",
    });
    assert.equal(fields.purpose, "Transfer requirements");
    assert.equal(fields.name, "Juan Santos Dela Cruz");
    assert.equal(fields.gradeLevel, "Grade 10");
  });
});
