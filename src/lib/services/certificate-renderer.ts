import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import type { PDFFont, PDFImage, PDFPage } from "pdf-lib";
import { embedQrCode, fitSignatureNameSize } from "@/lib/services/pdf-brand";
import { CERT_FALLBACK_FRAME, CERT_LAYOUTS } from "@/lib/services/certificate-layouts";
import type {
  CertBlankField,
  CertTemplateKey,
  CertTemplateLayout,
  CertToken,
} from "@/lib/services/certificate-layouts";
import { embedCertificateFonts } from "@/lib/services/pdf-fonts";
import type { EmbeddedCertFonts } from "@/lib/services/pdf-fonts";

/**
 * Renders certificate PDFs from the layouts extracted from the school's real
 * reference templates (see scripts/cert_layout.py). Static text, rules, and
 * images are drawn verbatim at their reference coordinates; only the fill-in
 * blanks and signatory names are dynamic. The layout's own coordinate space is
 * pdf-lib's bottom-left origin, so token `y` values are baselines directly.
 */

export const CERT_PAGE_WIDTH = 595.28;
export const CERT_PAGE_HEIGHT = 841.89;

const BODY_RIGHT = 524.9;
const BLACK = rgb(0, 0, 0);
const MIN_BLANK_SIZE = 8;

const ASSET_FILES = ["deped-seal", "school-seal-a", "school-seal-b", "footer-lockup", "icon-small"] as const;
export const CERT_ASSET_DIR = join(process.cwd(), "public", "pdf-assets");

export type CertBlankValues = Partial<Record<CertBlankField, string>>;

export interface CertificateRenderOptions {
  /** Template key, or null to render the generic fallback frame. */
  template: CertTemplateKey | null;
  blanks: CertBlankValues;
  signatureNames: { registrarName?: string; principalName?: string };
  /** Fallback mode only: document title and body paragraph text. */
  genericTitle?: string;
  genericBody?: string;
  /** Verification URL encoded into the bottom-right QR code. */
  qrUrl?: string;
}

/** Matches the certificate-type routing the body text already uses. */
export function pickCertificateTemplate(type: string, gradeLevel: string): CertTemplateKey | null {
  const value = type.toLowerCase();
  if (value.includes("good moral")) {
    return "good-moral";
  }
  if (value.includes("graduat")) {
    return "graduation";
  }
  if (value.includes("enrol") || value.includes("enroll")) {
    return /\b(11|12)\b/.test(gradeLevel) ? "enrolment-shs" : "enrolment-jhs";
  }
  return null;
}

/** Day-of-month and "Month Year" for the "Given this __ day of __" line. */
export function manilaDateParts(date: Date): { day: string; monthYear: string } {
  return {
    day: new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", day: "numeric" }).format(date),
    monthYear: new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      month: "long",
      year: "numeric",
    }).format(date),
  };
}

/** Number of underscore glyphs that tile `refWidth` in the blank's own font. */
export function placeholderUnderscores(refWidth: number, font: PDFFont, size: number): number {
  const one = font.widthOfTextAtSize("_", size);
  return Math.max(1, Math.round(refWidth / one));
}

function tokenColor(token: CertToken): ReturnType<typeof rgb> {
  if (token.kind === "text" && token.color) {
    return rgb(token.color[0], token.color[1], token.color[2]);
  }
  return BLACK;
}

/**
 * Wingdings is a symbol font: its glyphs live at the raw charcodes (0x28 =
 * phone, 0x2A = mail), not at the private-use codepoints Word's ToUnicode maps
 * them to (\uF028 / \uF02A). Shift the PUA codepoints back before drawing.
 */
function wingdingsSafe(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    out += code >= 0xf000 ? String.fromCharCode(code & 0xff) : ch;
  }
  return out;
}

function drawBlank(
  page: PDFPage,
  token: Extract<CertToken, { kind: "blank" }>,
  fonts: EmbeddedCertFonts,
  values: CertBlankValues,
  shift: number,
): number {
  const font = fonts[token.font];
  const refWidth = token.x1 - token.x;
  const x = token.x + shift;
  const value = (values[token.field] ?? "").trim();

  let covered = refWidth;
  if (!value) {
    const count = placeholderUnderscores(refWidth, font, token.size);
    page.drawText("_".repeat(count), { x, y: token.y, size: token.size, font, color: BLACK });
  } else {
    let size = token.size;
    let width = font.widthOfTextAtSize(value, size);
    const maxWidth = Math.max(20, BODY_RIGHT - x);
    while (width > maxWidth && size > MIN_BLANK_SIZE) {
      size -= 0.5;
      width = font.widthOfTextAtSize(value, size);
    }
    page.drawText(value, { x, y: token.y, size, font, color: BLACK });
    covered = Math.max(refWidth, width);
  }

  if (token.underline) {
    const ux = token.underline.x + shift;
    const uw = Math.max(token.underline.x1 - token.underline.x, covered);
    page.drawRectangle({ x: ux, y: token.underline.y, width: uw, height: token.underline.h, color: BLACK });
  }

  for (const suffix of token.suffix) {
    page.drawText(suffix.t, { x: suffix.x + shift, y: token.y, size: token.size, font, color: BLACK });
  }

  return shift + Math.max(0, covered - refWidth);
}

function drawLineTokens(
  page: PDFPage,
  tokens: CertToken[],
  fonts: EmbeddedCertFonts,
  values: CertBlankValues,
  signatureNames: { registrarName?: string; principalName?: string },
): void {
  const ordered = [...tokens].sort((a, b) => (a.kind === "sigName" ? a.centerX : a.x) - (b.kind === "sigName" ? b.centerX : b.x));
  let shift = 0;
  for (const token of ordered) {
    if (token.kind === "text") {
      page.drawText(token.font === "wingdings" ? wingdingsSafe(token.t) : token.t, {
        x: token.x + shift,
        y: token.y,
        size: token.size,
        font: fonts[token.font],
        color: tokenColor(token),
      });
    } else if (token.kind === "blank") {
      shift = drawBlank(page, token, fonts, values, shift);
    } else if (token.kind === "sigName") {
      const name = (signatureNames[token.field] ?? "").trim();
      if (!name) {
        continue;
      }
      const font = fonts[token.font];
      const size = fitSignatureNameSize(font, name, token.maxWidth, token.size, MIN_BLANK_SIZE);
      const width = font.widthOfTextAtSize(name, size);
      page.drawText(name, {
        x: token.centerX - width / 2,
        y: token.y,
        size,
        font,
        color: BLACK,
      });
    }
  }
}

/** Greedy word wrap followed by justified drawing (last line left-aligned). */
function drawJustifiedBody(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  startBaseline: number,
  leading: number,
  margin: number,
  indent: number,
): void {
  const maxWidth = BODY_RIGHT - margin;
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[][] = [];
  let current: string[] = [];
  for (const word of words) {
    const width = font.widthOfTextAtSize(current.length ? `${current.join(" ")} ${word}` : word, size);
    if (current.length > 0 && width > maxWidth - (lines.length === 0 ? indent : 0)) {
      lines.push(current);
      current = [word];
    } else {
      current.push(word);
    }
  }
  if (current.length) {
    lines.push(current);
  }

  let y = startBaseline;
  lines.forEach((line, index) => {
    const x = margin + (index === 0 ? indent : 0);
    const natural = font.widthOfTextAtSize(line.join(" "), size);
    const gaps = line.length - 1;
    const extra = index === lines.length - 1 || gaps <= 0 ? 0 : (maxWidth - (index === 0 ? indent : 0) - natural) / gaps;
    let cursor = x;
    for (const word of line) {
      page.drawText(word, { x: cursor, y, size, font, color: BLACK });
      cursor += font.widthOfTextAtSize(word, size) + font.widthOfTextAtSize(" ", size) + extra;
    }
    y -= leading;
  });
}

async function embedAssets(pdf: PDFDocument): Promise<Record<string, PDFImage>> {
  const out: Record<string, PDFImage> = {};
  for (const asset of ASSET_FILES) {
    try {
      out[asset] = await pdf.embedPng(await readFile(join(CERT_ASSET_DIR, `${asset}.png`)));
    } catch {
      // Asset missing: skip it rather than failing the certificate.
    }
  }
  return out;
}

export async function renderCertificatePdf(options: CertificateRenderOptions): Promise<Uint8Array> {
  const layout: CertTemplateLayout = CERT_LAYOUTS[options.template ?? CERT_FALLBACK_FRAME];
  const generic = options.template === null;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([CERT_PAGE_WIDTH, CERT_PAGE_HEIGHT]);
  const [fonts, assets] = await Promise.all([embedCertificateFonts(pdf), embedAssets(pdf)]);

  // Decorative layer first: rules and images, verbatim from the reference.
  for (const token of layout.decor) {
    if (token.kind === "rule") {
      page.drawRectangle({
        x: token.x,
        y: token.y,
        width: token.x1 - token.x,
        height: token.h,
        color: BLACK,
      });
    } else if (token.kind === "image") {
      const image = assets[token.asset];
      if (image) {
        page.drawImage(image, { x: token.x, y: token.y, width: token.w, height: token.h });
      }
    }
  }

  const bodyLines = new Set(layout.bodyLineIndices);
  layout.lines.forEach((tokens, index) => {
    if (!tokens.length) {
      return;
    }
    if (generic && (bodyLines.has(index) || index === layout.titleLineIndex)) {
      return;
    }
    drawLineTokens(page, tokens, fonts, options.blanks, options.signatureNames);
  });

  if (generic) {
    const titleToken = layout.lines[layout.titleLineIndex]?.find((t) => t.kind === "text" && t.size >= 15);
    const titleSize = titleToken && titleToken.kind === "text" ? titleToken.size : 18;
    const titleY = layout.lines[layout.titleLineIndex]?.[0]?.y ?? layout.firstBodyY + 60;
    const title = options.genericTitle ?? "CERTIFICATE";
    const titleFont = fonts.bookmanBold;
    const width = titleFont.widthOfTextAtSize(title, titleSize);
    page.drawText(title, {
      x: (CERT_PAGE_WIDTH - width) / 2,
      y: titleY,
      size: titleSize,
      font: titleFont,
      color: BLACK,
    });
    if (options.genericBody) {
      drawJustifiedBody(
        page,
        options.genericBody,
        fonts.bookman,
        12,
        layout.firstBodyY,
        layout.bodyLeading,
        layout.bodyMargin,
        layout.bodyIndent,
      );
    }
  }

  if (options.qrUrl) {
    const qr = await embedQrCode(pdf, options.qrUrl);
    page.drawImage(qr, { x: 491, y: 14, width: 48, height: 48 });
  }

  return pdf.save();
}
