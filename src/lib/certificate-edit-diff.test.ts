import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { changedCertificateFields } from "@/lib/certificate-edit-diff";

const loaded = {
  studentName: "Juan Santos Dela Cruz",
  gradeLevel: "12",
  strand: "ABM",
  section: "Sampaguita",
  purpose: "Scholarship application",
  dateGenerated: "2026-01-15",
  registrarName: "Ana Reyes",
  principalName: "Dr. Luis Ramos",
};

describe("changedCertificateFields", () => {
  it("returns only the field the user edited", () => {
    const current = { ...loaded, purpose: "Employment requirement" };
    assert.deepEqual(changedCertificateFields(current, loaded), {
      purpose: "Employment requirement",
    });
  });

  it("returns nothing when no field was edited", () => {
    assert.deepEqual(changedCertificateFields(loaded, loaded), {});
  });

  it("includes a field the user cleared so the server can drop its override", () => {
    const current = { ...loaded, registrarName: "" };
    assert.deepEqual(changedCertificateFields(current, loaded), { registrarName: "" });
  });
});
