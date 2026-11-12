import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { CERT_LAYOUTS } from "@/lib/services/certificate-layouts";
import type { CertTemplateKey } from "@/lib/services/certificate-layouts";
import { composeGradeValue } from "@/lib/utils";
import {
  manilaDateParts,
  pickCertificateTemplate,
  placeholderUnderscores,
  renderCertificatePdf,
} from "@/lib/services/certificate-renderer";

function blankFields(key: CertTemplateKey): string[] {
  return CERT_LAYOUTS[key].lines
    .flat()
    .flatMap((token) => (token.kind === "blank" ? [token.field] : []));
}

describe("pickCertificateTemplate", () => {
  it("routes the three reference certificate types to their templates", () => {
    assert.equal(pickCertificateTemplate("Good Moral Certificate", "11"), "good-moral");
    assert.equal(pickCertificateTemplate("Certificate of Graduation", "12"), "graduation");
    assert.equal(pickCertificateTemplate("Certificate of Enrolment", "9"), "enrolment-jhs");
    // Legacy free-text grade values route by their first number.
    assert.equal(pickCertificateTemplate("Certificate of Enrolment", "Grade 12"), "enrolment-shs");
    assert.equal(pickCertificateTemplate("Certificate of Enrolment", "Grade 9"), "enrolment-jhs");
    // Unparsable grades fall back to the junior-high wording.
    assert.equal(pickCertificateTemplate("Certificate of Enrolment", "unknown"), "enrolment-jhs");
  });

  it("uses the senior-high enrolment wording for grade 11/12", () => {
    assert.equal(pickCertificateTemplate("Certificate of Enrollment", "11 - STEM"), "enrolment-shs");
    assert.equal(pickCertificateTemplate("Certificate of Enrollment", "12"), "enrolment-shs");
    assert.equal(pickCertificateTemplate("Certificate of Enrollment", "9 - Diamond"), "enrolment-jhs");
    assert.equal(pickCertificateTemplate("Certificate of Enrollment", "10"), "enrolment-jhs");
  });

  it("returns null for certificate types without a reference template", () => {
    assert.equal(pickCertificateTemplate("Form 137", "11"), null);
    assert.equal(pickCertificateTemplate("Diploma", ""), null);
    assert.equal(pickCertificateTemplate("Certificate of Recognition", "9"), null);
  });
});

describe("CERT_LAYOUTS", () => {
  it("exposes the four reference templates with the expected blank slots", () => {
    assert.deepEqual(blankFields("good-moral"), ["name", "grade", "schoolYear", "day", "month"]);
    assert.deepEqual(blankFields("enrolment-jhs"), ["name", "lrn", "schoolYear", "grade", "purpose"]);
    assert.deepEqual(blankFields("enrolment-shs"), ["name", "lrn", "schoolYear", "grade", "purpose"]);
    assert.deepEqual(blankFields("graduation"), ["name", "schoolYear"]);
  });

  it("marks the body lines used by the generic fallback", () => {
    for (const key of Object.keys(CERT_LAYOUTS) as CertTemplateKey[]) {
      const layout = CERT_LAYOUTS[key];
      assert.ok(layout.bodyLineIndices.length > 0, `${key} has body lines`);
      assert.ok(layout.firstBodyY > 0, `${key} has a body baseline`);
      assert.ok(layout.bodyLeading > 10 && layout.bodyLeading < 30, `${key} leading`);
    }
  });
});

describe("placeholderUnderscores", () => {
  it("round-trips the reference underscore run widths", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    for (const count of [7, 13, 18]) {
      const width = font.widthOfTextAtSize("_".repeat(count), 11);
      assert.equal(placeholderUnderscores(width, font, 11), count);
    }
    assert.equal(placeholderUnderscores(0.5, font, 11), 1);
  });
});

describe("manilaDateParts", () => {
  it("formats day and month in Asia/Manila regardless of server timezone", () => {
    const noon = manilaDateParts(new Date("2026-11-12T04:00:00Z"));
    assert.equal(noon.day, "12");
    assert.equal(noon.monthYear, "November 2026");

    // 20:00 UTC on Nov 12 is already 04:00 on Nov 13 in Manila.
    const late = manilaDateParts(new Date("2026-11-12T20:00:00Z"));
    assert.equal(late.day, "13");
    assert.equal(late.monthYear, "November 2026");
  });
});

describe("composeGradeValue", () => {
  it("composes the grade with the strand or section qualifier", () => {
    assert.equal(composeGradeValue("11", "Academic-Track"), "11 - Academic-Track");
    assert.equal(composeGradeValue("9", "Sampaguita"), "9 - Sampaguita");
    assert.equal(composeGradeValue("12", "Technical-Track"), "12 - Technical-Track");
    assert.equal(composeGradeValue("9", ""), "9");
  });

  it("strips a legacy 'Grade ' prefix so templates never print it twice", () => {
    assert.equal(composeGradeValue("Grade 12", "Academic-Track"), "12 - Academic-Track");
    assert.equal(composeGradeValue("grade 10", null), "10");
    assert.equal(composeGradeValue(null, "Sampaguita"), "Sampaguita");
    assert.equal(composeGradeValue(undefined, undefined), "");
  });
});

describe("renderCertificatePdf", () => {
  it("renders every reference template to a PDF buffer", async () => {
    for (const template of ["good-moral", "enrolment-jhs", "enrolment-shs", "graduation"] as const) {
      const bytes = await renderCertificatePdf({
        template,
        blanks: { name: "Test Student", schoolYear: "2026-2027" },
        signatureNames: { registrarName: "Test Registrar", principalName: "Test Principal" },
      });
      assert.ok(bytes.length > 15000, `${template} renders`);
      assert.equal(Buffer.from(bytes.slice(0, 5)).toString("latin1"), "%PDF-");
    }
  });

  it("renders the generic fallback frame for unknown certificate types", async () => {
    const bytes = await renderCertificatePdf({
      template: null,
      blanks: {},
      signatureNames: { principalName: "Test Principal" },
      genericTitle: "CERTIFICATE OF RECOGNITION",
      genericBody: "This certifies that the student has a validated record.",
    });
    assert.equal(Buffer.from(bytes.slice(0, 5)).toString("latin1"), "%PDF-");
  });
});
