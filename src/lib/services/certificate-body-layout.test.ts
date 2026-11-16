import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { CERT_LAYOUTS } from "@/lib/services/certificate-layouts";
import type { CertBlankField, CertTemplateKey } from "@/lib/services/certificate-layouts";
import { embedCertificateFonts } from "@/lib/services/pdf-fonts";
import type { EmbeddedCertFonts } from "@/lib/services/pdf-fonts";
import { DEFAULT_WORDING, SAMPLE_BLANKS } from "@/lib/services/certificate-wording-defaults";
import { deriveWordingRegions } from "@/lib/services/certificate-wording-regions";
import {
  TooLongBodyError,
  assertBodyFits,
  bodyFontAndSize,
  planBodyLayout,
} from "@/lib/services/certificate-body-layout";
import type { BodyOp } from "@/lib/services/certificate-body-layout";

const RIGHT_EDGE = 524.9;
const MARGIN = 72;
const INDENT = 36;

let fonts: EmbeddedCertFonts;

before(async () => {
  fonts = await embedCertificateFonts(await PDFDocument.create());
});

function plan(
  body: string,
  values: Partial<Record<CertBlankField, string>> = {},
  overrides: Partial<Parameters<typeof planBodyLayout>[0]> = {},
) {
  return planBodyLayout({
    body,
    fonts,
    bodyFont: "bookman",
    boldFont: "bookmanBold",
    bodySize: 12,
    firstBodyY: 500,
    bodyLeading: 20,
    bodyMargin: MARGIN,
    bodyIndent: INDENT,
    rightEdge: RIGHT_EDGE,
    blockBottom: 200,
    values,
    slotWidth: () => 80,
    ...overrides,
  });
}

function opWidth(op: BodyOp): number {
  return fonts[op.font].widthOfTextAtSize(op.text, op.size);
}

function lines(ops: BodyOp[]): BodyOp[][] {
  const byY = new Map<number, BodyOp[]>();
  for (const op of ops) byY.set(op.y, [...(byY.get(op.y) ?? []), op]);
  return [...byY.entries()].sort((a, b) => b[0] - a[0]).map(([, row]) => row.sort((a, b) => a.x - b.x));
}

describe("planBodyLayout", () => {
  it("substitutes values bold with a measured underline", () => {
    const { ops, size } = plan("Hello {{name}} there", { name: "Maria Santos" });
    const op = ops.find((o) => o.text === "Maria Santos");
    assert.ok(op, "value op present");
    assert.equal(op.font, "bookmanBold");
    assert.ok(op.underline);
    assert.equal(op.underline.x, op.x);
    assert.ok(Math.abs(op.underline.width - fonts.bookmanBold.widthOfTextAtSize("Maria Santos", size)) < 0.01);
    assert.equal(ops.find((o) => o.text === "Hello")?.underline, undefined);
  });

  it("tolerates whitespace inside placeholders and keeps unknown fields literal", () => {
    const { ops } = plan("A {{ name }} {{nope}}", { name: "Ana" });
    assert.ok(ops.some((o) => o.text === "Ana" && o.underline));
    assert.ok(ops.some((o) => o.text === "{{nope}}" && !o.underline));
  });

  it("renders empty values as an underscore run of slot width", () => {
    const { ops, size } = plan("Name {{name}} end", {}, { slotWidth: () => 90 });
    const op = ops.find((o) => /^_+$/.test(o.text));
    assert.ok(op, "underscore op present");
    assert.equal(op.font, "bookmanBold");
    assert.equal(op.underline, undefined);
    const glyph = fonts.bookmanBold.widthOfTextAtSize("_", size);
    assert.ok(Math.abs(opWidth(op) - 90) <= glyph, `width ${opWidth(op)} within one glyph of 90`);
  });

  it("treats whitespace-only values as empty", () => {
    const { ops } = plan("Name {{name}}", { name: "   " });
    assert.ok(ops.some((o) => /^_+$/.test(o.text)));
  });

  it("renders **GRADUATE** bold", () => {
    const { ops } = plan("is a **GRADUATE** of the school");
    const grad = ops.find((o) => o.text === "GRADUATE");
    assert.ok(grad);
    assert.equal(grad.font, "bookmanBold");
    assert.equal(ops.find((o) => o.text === "school")?.font, "bookman");
  });

  it("treats unbalanced ** literally", () => {
    const { ops } = plan("odd **word here");
    assert.ok(ops.some((o) => o.text === "**word" && o.font === "bookman"));
  });

  it("indents each paragraph's first line and keeps later lines at the margin", () => {
    const long = Array.from({ length: 60 }, () => "word").join(" ");
    const { ops } = plan(`${long}\n\n${long}`);
    const rows = lines(ops);
    assert.ok(rows.length > 4);
    assert.equal(rows[0][0].x, MARGIN + INDENT);
    assert.equal(rows[1][0].x, MARGIN);
    const secondParagraphStart = rows.findIndex((row, i) => i > 0 && row[0].x === MARGIN + INDENT);
    assert.ok(secondParagraphStart > 1, "second paragraph starts with an indented line");
  });

  it("justifies full lines to the right edge but not each paragraph's last line", () => {
    const long = Array.from({ length: 60 }, () => "wording").join(" ");
    const { ops } = plan(`${long}\n\n${long}`);
    const rows = lines(ops);
    const firstEnd = rows[0][rows[0].length - 1].x + opWidth(rows[0][rows[0].length - 1]);
    assert.ok(Math.abs(firstEnd - RIGHT_EDGE) < 0.01, `first line ends at ${firstEnd}`);
    const last = rows[rows.length - 1];
    const lastEnd = last[last.length - 1].x + opWidth(last[last.length - 1]);
    assert.ok(lastEnd < RIGHT_EDGE - 1, "final line is not stretched");
  });

  it("places baselines at firstBodyY - k * leading", () => {
    const { ops } = plan(Array.from({ length: 50 }, () => "word").join(" "));
    const ys = lines(ops).map((row) => row[0].y);
    ys.forEach((y, k) => assert.ok(Math.abs(y - (500 - k * 20)) < 1e-9));
  });

  it("always keeps a full space between words and around values", () => {
    const body = DEFAULT_WORDING["good-moral"].body;
    const layout = CERT_LAYOUTS["good-moral"];
    const { font, size: bodySize } = bodyFontAndSize(layout, deriveWordingRegions(layout));
    const { ops, size } = plan(body, SAMPLE_BLANKS["good-moral"], {
      bodyFont: font,
      boldFont: "bookmanBold",
      bodySize,
    });
    const space = fonts.bookman.widthOfTextAtSize(" ", size);
    let wordGaps = 0;
    for (const row of lines(ops)) {
      for (let i = 1; i < row.length; i++) {
        const prev = row[i - 1];
        const gap = row[i].x - (prev.x + opWidth(prev));
        // Ops of the same word touch; any other pair is a word gap.
        if (Math.abs(gap) < 0.01) continue;
        wordGaps += 1;
        assert.ok(gap >= 0.9 * space, `gap ${gap} between "${prev.text}" and "${row[i].text}" is under a space`);
      }
    }
    assert.ok(wordGaps > 30);

    const year = ops.find((o) => o.text === "2026-2027");
    assert.ok(year);
    const row = lines(ops).find((r) => r.includes(year));
    assert.ok(row);
    const before = row[row.indexOf(year) - 1];
    assert.equal(before.text, "year");
    assert.ok(year.x - (before.x + opWidth(before)) >= 0.9 * space, "space between 'year' and the value");
    const after = row[row.indexOf(year) + 1];
    assert.equal(after?.text, ".");
    assert.ok(Math.abs(after.x - (year.x + opWidth(year))) < 0.01, "period hugs the value");
  });

  it("shrinks to fit and errors beyond the minimum", () => {
    const wordy = Array.from({ length: 75 }, () => "lorem").join(" ");
    const tight = { firstBodyY: 500, bodyLeading: 20, blockBottom: 500 - 4 * 20 };
    const full = plan(wordy);
    assert.equal(full.size, 12);
    const shrunk = plan(wordy, {}, tight);
    assert.ok(shrunk.size < 12, `size ${shrunk.size} should shrink`);
    assert.ok(Math.min(...shrunk.ops.map((o) => o.y)) >= tight.blockBottom);

    const huge = Array.from({ length: 500 }, () => "lorem").join(" ");
    assert.throws(() => plan(huge, {}, tight), TooLongBodyError);
  });

  it("fails sizes where a single unbreakable word overflows the line", () => {
    const wide = "W".repeat(60);
    assert.throws(() => plan(wide), TooLongBodyError);
  });

  it("is deterministic", () => {
    const body = DEFAULT_WORDING["enrolment-jhs"].body;
    const a = plan(body, SAMPLE_BLANKS["enrolment-jhs"]);
    const b = plan(body, SAMPLE_BLANKS["enrolment-jhs"]);
    assert.deepEqual(a, b);
  });
});

describe("bodyFontAndSize", () => {
  it("returns the dominant body font and its bold variant per template", () => {
    const expected: Record<CertTemplateKey, { font: string; boldFont: string; size: number }> = {
      "good-moral": { font: "bookman", boldFont: "bookmanBold", size: 11 },
      "good-moral-jhs": { font: "bookman", boldFont: "bookmanBold", size: 11 },
      "enrolment-jhs": { font: "bookman", boldFont: "bookmanBold", size: 12 },
      "enrolment-shs": { font: "bookman", boldFont: "bookmanBold", size: 12 },
      graduation: { font: "bookman", boldFont: "bookmanBold", size: 12 },
    };
    for (const key of Object.keys(expected) as CertTemplateKey[]) {
      const layout = CERT_LAYOUTS[key];
      assert.deepEqual(bodyFontAndSize(layout, deriveWordingRegions(layout)), expected[key], key);
    }
  });
});

describe("assertBodyFits", () => {
  it("accepts every default wording with worst-case values", async () => {
    for (const key of Object.keys(DEFAULT_WORDING) as CertTemplateKey[]) {
      await assert.doesNotReject(async () => assertBodyFits(key, DEFAULT_WORDING[key].body), key);
    }
  });

  it("rejects a body that cannot fit the block", async () => {
    const huge = Array.from({ length: 500 }, () => "lorem").join(" ");
    await assert.rejects(async () => assertBodyFits("good-moral", huge), TooLongBodyError);
  });
});
