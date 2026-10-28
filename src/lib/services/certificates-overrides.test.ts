import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildOverrideUpdates, resolveCertificateDisplayFields } from "@/lib/services/certificates";

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
  overrideRegistrarName: null,
  overridePrincipalName: null,
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

describe("resolveCertificateDisplayFields signatory names", () => {
  it("prints no signatory name when none has been typed", () => {
    const fields = resolveCertificateDisplayFields(liveRow);
    assert.equal(fields.registrarName, "");
    assert.equal(fields.principalName, "");
  });

  it("uses the typed signatory names", () => {
    const fields = resolveCertificateDisplayFields({
      ...liveRow,
      overrideRegistrarName: "Ana Reyes",
      overridePrincipalName: "Dr. Luis Ramos",
    });
    assert.equal(fields.registrarName, "Ana Reyes");
    assert.equal(fields.principalName, "Dr. Luis Ramos");
  });

  it("treats blank signatory names as not typed", () => {
    const fields = resolveCertificateDisplayFields({
      ...liveRow,
      overrideRegistrarName: "   ",
      overridePrincipalName: "",
    });
    assert.equal(fields.registrarName, "");
    assert.equal(fields.principalName, "");
  });
});

describe("buildOverrideUpdates", () => {
  it("maps typed signatory names to their columns", () => {
    assert.deepEqual(
      buildOverrideUpdates(["registrarName", "principalName"], {
        registrarName: "Ana Reyes",
        principalName: "Dr. Luis Ramos",
      }),
      { overrideRegistrarName: "Ana Reyes", overridePrincipalName: "Dr. Luis Ramos" },
    );
  });

  it("clears a provided blank name to null and leaves absent fields untouched", () => {
    const updates = buildOverrideUpdates(["registrarName"], {});
    assert.deepEqual(updates, { overrideRegistrarName: null });
    assert.equal("overridePrincipalName" in updates, false);
    assert.equal("overrideStudentName" in updates, false);
  });
});
