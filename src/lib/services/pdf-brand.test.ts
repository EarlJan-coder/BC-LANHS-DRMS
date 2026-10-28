import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { drawSignatureName, fitSignatureNameSize } from "@/lib/services/pdf-brand";

const font = await (await PDFDocument.create()).embedFont(StandardFonts.HelveticaBold);

describe("fitSignatureNameSize", () => {
  it("keeps the preferred size when the name fits the signature block", () => {
    assert.equal(fitSignatureNameSize(font, "Ana Reyes", 145), 10);
  });

  it("shrinks a name until it fits the signature block", () => {
    const name = "Maria Concepcion Villanueva-Santos";
    // Deliberately narrower than the name at the preferred size.
    const blockWidth = font.widthOfTextAtSize(name, 10) * 0.8;
    const size = fitSignatureNameSize(font, name, blockWidth);
    assert.ok(size < 10);
    assert.ok(font.widthOfTextAtSize(name, size) <= blockWidth);
  });

  it("never shrinks below the floor even when the name cannot fit", () => {
    assert.equal(fitSignatureNameSize(font, "X".repeat(500), 100), 7);
  });
});

describe("drawSignatureName", () => {
  it("centers the name over its signature block at the preferred size", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]);
    const layout = drawSignatureName(page, "Ana Reyes", 70, 215, 108, font);
    const width = font.widthOfTextAtSize("Ana Reyes", 10);
    assert.deepEqual(layout, { x: 70 + (215 - 70 - width) / 2, size: 10 });
  });

  it("draws nothing when no name was typed", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]);
    assert.equal(drawSignatureName(page, "   ", 70, 215, 108, font), null);
  });
});
