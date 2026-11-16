import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { PDFDocument, PDFRawStream, StandardFonts } from "pdf-lib";
import type { PDFArray, PDFStream } from "pdf-lib";
import { CERT_LAYOUTS } from "@/lib/services/certificate-layouts";
import type { CertTemplateKey, CertToken } from "@/lib/services/certificate-layouts";
import { composeGradeValue } from "@/lib/utils";
import { embedCertificateFonts } from "@/lib/services/pdf-fonts";
import {
  CERT_PAGE_WIDTH,
  manilaDateParts,
  pickCertificateTemplate,
  placeholderUnderscores,
  planWordingDraw,
  renderCertificatePdf,
  renderSampleCertificate,
} from "@/lib/services/certificate-renderer";
import { DEFAULT_WORDING, SAMPLE_BLANKS } from "@/lib/services/certificate-wording-defaults";

function blankFields(key: CertTemplateKey): string[] {
  return CERT_LAYOUTS[key].lines
    .flat()
    .flatMap((token) => (token.kind === "blank" ? [token.field] : []));
}

/** Body wording of a template, normalized so glyph-level token splitting is invisible. */
function bodyText(key: CertTemplateKey): string {
  const layout = CERT_LAYOUTS[key];
  return layout.bodyLineIndices
    .flatMap((index) => layout.lines[index])
    .map((token) => (token.kind === "blank" ? `[${token.field}]` : token.kind === "text" ? token.t : ""))
    .join("")
    .replace(/\s+/g, "");
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

  it("uses the junior-high good moral wording for grades 7-10", () => {
    assert.equal(pickCertificateTemplate("Good Moral Certificate", "7"), "good-moral-jhs");
    assert.equal(pickCertificateTemplate("Good Moral Certificate", "9 - Diamond"), "good-moral-jhs");
    assert.equal(pickCertificateTemplate("Good Moral Certificate", "10"), "good-moral-jhs");
    assert.equal(pickCertificateTemplate("Good Moral Certificate", "Grade 8"), "good-moral-jhs");
    // Unparsable grades fall back to the junior-high wording.
    assert.equal(pickCertificateTemplate("Good Moral Certificate", "unknown"), "good-moral-jhs");
  });

  it("keeps the strand good moral wording for grade 11/12", () => {
    assert.equal(pickCertificateTemplate("Good Moral Certificate", "11"), "good-moral");
    assert.equal(pickCertificateTemplate("Good Moral Certificate", "11 - ABM"), "good-moral");
    assert.equal(pickCertificateTemplate("Good Moral Certificate", "Grade 12"), "good-moral");
    assert.equal(pickCertificateTemplate("Good Moral Certificate", "12"), "good-moral");
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

  it("gives the junior-high good moral template the same blank slots", () => {
    assert.deepEqual(blankFields("good-moral-jhs"), ["name", "grade", "schoolYear", "day", "month"]);
  });

  it("uses the junior-high wording in the good moral body", () => {
    assert.equal(
      bodyText("good-moral-jhs"),
      "Thisistocertifythat[name]isabonafidestudentofLuisAguadoNationalHighSchoolclassifiedasGrade[grade]fortheschoolyear[schoolYear].",
    );
    assert.equal(
      bodyText("good-moral"),
      "Thisistocertifythat[name]isabonafidestudentofLuisAguadoNationalHighSchoolclassifiedundertheGrade[grade]strandfortheschoolyear[schoolYear].",
    );
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
    assert.equal(composeGradeValue("11", "ABM"), "11 - ABM");
    assert.equal(composeGradeValue("9", "Sampaguita"), "9 - Sampaguita");
    assert.equal(composeGradeValue("12", "HUMSS"), "12 - HUMSS");
    assert.equal(composeGradeValue("9", ""), "9");
  });

  it("strips a legacy 'Grade ' prefix so templates never print it twice", () => {
    assert.equal(composeGradeValue("Grade 12", "ABM"), "12 - ABM");
    assert.equal(composeGradeValue("grade 10", null), "10");
    assert.equal(composeGradeValue(null, "Sampaguita"), "Sampaguita");
    assert.equal(composeGradeValue(undefined, undefined), "");
  });
});

describe("renderCertificatePdf", () => {
  it("renders every reference template to a PDF buffer", async () => {
    for (const template of ["good-moral", "good-moral-jhs", "enrolment-jhs", "enrolment-shs", "graduation"] as const) {
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

const TEST_NAMES = { registrarName: "Test Registrar", principalName: "Test Principal" };

/**
 * The page's draw operators as the decompressed content stream. pdf-lib's raw
 * byte output is not stable run-to-run (asset embedding interleaving renumbers
 * objects), but the drawn operators are, so "same rendering" comparisons use
 * these bytes.
 */
async function drawStream(bytes: Uint8Array): Promise<Buffer> {
  const doc = await PDFDocument.load(bytes);
  const contents = doc.getPage(0).node.Contents();
  const streams = contents instanceof PDFRawStream ? [contents] : (contents as PDFArray).asArray().map((ref) => doc.context.lookup(ref) as PDFStream);
  return Buffer.concat(streams.map((stream) => inflateSync(Buffer.from((stream as PDFRawStream).getContents()))));
}

describe("renderSampleCertificate", () => {
  it("renders every template with default wording as a valid PDF", async () => {
    for (const template of Object.keys(DEFAULT_WORDING) as CertTemplateKey[]) {
      const bytes = await renderSampleCertificate(template, DEFAULT_WORDING[template], TEST_NAMES);
      assert.equal(Buffer.from(bytes.slice(0, 5)).toString("latin1"), "%PDF-", `${template} header`);
      assert.ok(bytes.length > 15000, `${template} renders`);
    }
  });

  it("reflects edited wording", async () => {
    const defaults = DEFAULT_WORDING["good-moral"];
    const baseline = await renderSampleCertificate("good-moral", defaults, TEST_NAMES);
    const editedBody = await renderSampleCertificate(
      "good-moral",
      { ...defaults, body: defaults.body.replace("school year {{schoolYear}}.", "school year {{schoolYear}} **EXTRA**.") },
      TEST_NAMES,
    );
    const editedTitle = await renderSampleCertificate("good-moral", { ...defaults, title: "CERTIFICATE OF ATTAINMENT" }, TEST_NAMES);
    assert.notDeepEqual(await drawStream(editedBody), await drawStream(baseline), "edited body changes the drawing");
    assert.notDeepEqual(await drawStream(editedTitle), await drawStream(baseline), "edited title changes the drawing");
  });
});

describe("renderCertificatePdf wording integration", () => {
  it("keeps the verbatim path when wording is absent", async () => {
    const options = { template: "good-moral" as const, blanks: {}, signatureNames: TEST_NAMES };
    const without = await renderCertificatePdf(options);
    const explicit = await renderCertificatePdf({ ...options, wording: undefined });
    assert.equal(Buffer.from(without.slice(0, 5)).toString("latin1"), "%PDF-");
    assert.deepEqual(await drawStream(explicit), await drawStream(without), "an absent wording draws exactly like no wording");
  });

  it("re-typesets the body when the wording matches the layout", async () => {
    const options = { template: "good-moral" as const, blanks: SAMPLE_BLANKS["good-moral"], signatureNames: TEST_NAMES };
    const verbatim = await renderCertificatePdf(options);
    const typeset = await renderCertificatePdf({ ...options, wording: DEFAULT_WORDING["good-moral"] });
    assert.notDeepEqual(await drawStream(typeset), await drawStream(verbatim), "the body is re-typeset from the wording");
  });

  it("ignores the wording for the generic fallback frame", async () => {
    const options = {
      template: null,
      blanks: {},
      signatureNames: TEST_NAMES,
      genericTitle: "CERTIFICATE OF RECOGNITION",
      genericBody: "This certifies that the student has a validated record.",
    };
    const without = await renderCertificatePdf(options);
    const withWording = await renderCertificatePdf({ ...options, wording: DEFAULT_WORDING["good-moral"] });
    assert.deepEqual(await drawStream(withWording), await drawStream(without), "the generic frame ignores the wording");
  });

  it("falls back to the complete verbatim path when the layout has drifted", async () => {
    // Simulate a regenerated layout whose body letters no longer match
    // DEFAULT_WORDING: the wording (including edits) must be ignored entirely.
    const token = CERT_LAYOUTS["good-moral"].lines[7].find(
      (candidate): candidate is Extract<CertToken, { kind: "text" }> => candidate.kind === "text",
    );
    assert.ok(token);
    const original = token.t;
    try {
      token.t = "X";
      const options = { template: "good-moral" as const, blanks: SAMPLE_BLANKS["good-moral"], signatureNames: TEST_NAMES };
      const verbatim = await renderCertificatePdf(options);
      const drifted = await renderCertificatePdf({
        ...options,
        wording: { ...DEFAULT_WORDING["good-moral"], title: "IGNORED TITLE", registrarTitle: "IGNORED REGISTRAR" },
      });
      assert.deepEqual(await drawStream(drifted), await drawStream(verbatim), "drift draws exactly the verbatim path");
    } finally {
      token.t = original;
    }
  });
});

describe("planWordingDraw", () => {
  it("re-typesets the body and keeps unedited title and signatory titles verbatim", async () => {
    const fonts = await embedCertificateFonts(await PDFDocument.create());
    const plan = planWordingDraw(CERT_LAYOUTS["good-moral"], "good-moral", DEFAULT_WORDING["good-moral"], fonts, SAMPLE_BLANKS["good-moral"]);
    assert.ok(plan);
    assert.deepEqual([...plan.skipLines].sort((a, b) => a - b), [7, 8, 9, 10, 11, 12, 13, 14], "only the body region is replaced");
    assert.equal(plan.redraws.length, 0, "unedited title and signatory titles stay verbatim");
    assert.ok(plan.bodyOps.length > 0, "the body is planned from the wording");
  });

  it("skips an empty title and centers an edited one on the page", async () => {
    const fonts = await embedCertificateFonts(await PDFDocument.create());
    const layout = CERT_LAYOUTS["good-moral"];

    const empty = planWordingDraw(layout, "good-moral", { ...DEFAULT_WORDING["good-moral"], title: "" }, fonts, SAMPLE_BLANKS["good-moral"]);
    assert.ok(empty);
    assert.ok(empty.skipLines.has(6), "the title line is skipped");
    assert.equal(empty.redraws.length, 0, "an empty title draws nothing");

    const edited = planWordingDraw(
      layout,
      "good-moral",
      { ...DEFAULT_WORDING["good-moral"], title: "CERTIFICATE OF ATTAINMENT" },
      fonts,
      SAMPLE_BLANKS["good-moral"],
    );
    assert.ok(edited);
    assert.ok(edited.skipLines.has(6));
    assert.deepEqual(edited.redraws, [
      { text: "CERTIFICATE OF ATTAINMENT", centerX: CERT_PAGE_WIDTH / 2, y: 625.18, size: 16, font: "bookmanBold" },
    ]);
  });

  it("skips or recenters edited signatory titles on their own line", async () => {
    const fonts = await embedCertificateFonts(await PDFDocument.create());
    const layout = CERT_LAYOUTS["good-moral"];

    const cleared = planWordingDraw(
      layout,
      "good-moral",
      { ...DEFAULT_WORDING["good-moral"], registrarTitle: "" },
      fonts,
      SAMPLE_BLANKS["good-moral"],
    );
    assert.ok(cleared);
    assert.ok(cleared.skipLines.has(16), "the registrar title line is skipped");
    assert.equal(cleared.redraws.length, 0, "an empty signatory title draws nothing");

    const edited = planWordingDraw(
      layout,
      "good-moral",
      { ...DEFAULT_WORDING["good-moral"], principalTitle: "Head Teacher" },
      fonts,
      SAMPLE_BLANKS["good-moral"],
    );
    assert.ok(edited);
    assert.ok(edited.skipLines.has(18), "the principal title line is skipped");
    assert.equal(edited.redraws.length, 1);
    const [redraw] = edited.redraws;
    assert.equal(redraw.text, "Head Teacher");
    assert.equal(redraw.y, 192.63, "the line's own baseline");
    assert.equal(redraw.font, "bookman");
    assert.equal(redraw.size, 11);
    // Centered on the original line's own visual center, with real font metrics.
    const line = layout.lines[18].filter((t): t is Extract<CertToken, { kind: "text" }> => t.kind === "text");
    const minX = Math.min(...line.map((t) => t.x));
    const maxX = Math.max(...line.map((t) => t.x + fonts[t.font].widthOfTextAtSize(t.t, t.size)));
    assert.ok(Math.abs(redraw.centerX - (minX + maxX) / 2) < 0.01, `centerX ${redraw.centerX} vs ${(minX + maxX) / 2}`);
  });

  it("returns null when the layout body has drifted from the default wording", async () => {
    const fonts = await embedCertificateFonts(await PDFDocument.create());
    const layout = structuredClone(CERT_LAYOUTS["good-moral"]);
    const token = layout.lines[7].find(
      (candidate): candidate is Extract<CertToken, { kind: "text" }> => candidate.kind === "text",
    );
    assert.ok(token);
    token.t = "X";
    assert.equal(planWordingDraw(layout, "good-moral", DEFAULT_WORDING["good-moral"], fonts, SAMPLE_BLANKS["good-moral"]), null);
    assert.ok(planWordingDraw(CERT_LAYOUTS["good-moral"], "good-moral", DEFAULT_WORDING["good-moral"], fonts, SAMPLE_BLANKS["good-moral"]));
  });
});
