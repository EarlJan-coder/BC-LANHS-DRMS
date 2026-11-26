import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import type { PDFEmbeddedPage, PDFFont, PDFImage, PDFPage } from "pdf-lib";
import { embedQrCode, fitSignatureNameSize } from "@/lib/services/pdf-brand";
import { CERT_FALLBACK_FRAME, CERT_LAYOUTS } from "@/lib/services/certificate-layouts";
import type {
  CertBlankField,
  CertFontKey,
  CertSigField,
  CertTemplateKey,
  CertTemplateLayout,
  CertToken,
} from "@/lib/services/certificate-layouts";
import { bodyFontAndSize, planBodyLayout, TooLongBodyError } from "@/lib/services/certificate-body-layout";
import type { BodyOp } from "@/lib/services/certificate-body-layout";
import { DEFAULT_WORDING, SAMPLE_BLANKS } from "@/lib/services/certificate-wording-defaults";
import type { TemplateWording } from "@/lib/services/certificate-wording-defaults";
import { bodySlotWidths, deriveWordingRegions } from "@/lib/services/certificate-wording-regions";
import type { WordingRegions } from "@/lib/services/certificate-wording-regions";
import { embedCertificateFonts } from "@/lib/services/pdf-fonts";
import type { EmbeddedCertFonts } from "@/lib/services/pdf-fonts";

/**
 * Renders certificate PDFs from the layouts extracted from the school's real
 * reference templates (see scripts/cert_layout.py). Static text, rules, and
 * images are drawn verbatim at their reference coordinates; only the fill-in
 * blanks and signatory names are dynamic. When `wording` is supplied, the body
 * region is re-typeset from it and edited titles replace their lines — unless
 * the layout's body has drifted from the default wording, in which case the
 * complete verbatim path is used. The layout's own coordinate space is
 * pdf-lib's bottom-left origin, so token `y` values are baselines directly.
 */

export const CERT_PAGE_WIDTH = 595.28;
export const CERT_PAGE_HEIGHT = 841.89;

const BODY_RIGHT = 524.9;
const BLACK = rgb(0, 0, 0);
const MIN_BLANK_SIZE = 8;
const SIGNATURE_CLEARANCE = 24;
const FALLBACK_SLOT_WIDTH = 60;
const VALUE_UNDERLINE_DROP = 2.11;
const VALUE_UNDERLINE_HEIGHT = 0.7;

/** Assets sourced as PNG files from public/pdf-assets. The logos are the
 * school's original files (the reference PDFs' embedded copies were degraded). */
const PNG_ASSET_FILES: Record<string, string> = {
  "deped-seal": "deped-seal.png",
  "icon-small": "icon-small.png",
  "deped-logo": "deped-logo_freelogovectors.net_.png",
  "lanhs-logo": "lanhs-logo.png",
};

// The Bagong Pilipinas logo ships as SVG; committed as a single-page vector
// PDF (converted with svglib, see README) and embedded as a page so it stays
// crisp at any size.
const VECTOR_ASSET_FILES: Record<string, string> = {
  "bagong-pilipinas-logo": "bagong-pilipinas-logo.pdf",
};

type EmbeddedAsset =
  | { kind: "image"; image: PDFImage }
  | { kind: "page"; page: PDFEmbeddedPage };

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
  /** Editable wording for template renders (ignored for the generic fallback,
   * and ignored entirely when the layout has drifted from the default wording
   * or the body cannot fit the block). */
  wording?: TemplateWording;
  /** Verification URL encoded into the bottom-right QR code. */
  qrUrl?: string;
}

/** Matches the certificate-type routing the body text already uses. The COE
 * and Good Moral templates have two wordings each: grades 7-10 use the
 * junior-high wording ("classified as Grade ____") and grades 11-12 the
 * senior-high wording ("classified under the Grade ____ strand"). Legacy
 * free-text grade values ("Grade 12") are parsed by their first number;
 * unparsable grades are JHS. */
export function pickCertificateTemplate(type: string, gradeLevel: string): CertTemplateKey | null {
  const value = type.toLowerCase();
  const grade = Number.parseInt((gradeLevel.match(/\d+/) ?? [])[0] ?? "", 10);
  const seniorHigh = grade === 11 || grade === 12;
  if (value.includes("good moral")) {
    return seniorHigh ? "good-moral" : "good-moral-jhs";
  }
  if (value.includes("graduat")) {
    return "graduation";
  }
  if (value.includes("enrol") || value.includes("enroll")) {
    return seniorHigh ? "enrolment-shs" : "enrolment-jhs";
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

/** The most frequent (font, size) among a line's text tokens. */
function dominantTextStyle(tokens: CertToken[]): { font: CertFontKey; size: number } | null {
  const counts = new Map<string, { font: CertFontKey; size: number; count: number }>();
  for (const token of tokens) {
    if (token.kind !== "text") continue;
    const key = `${token.font}@${token.size}`;
    const entry = counts.get(key) ?? { font: token.font, size: token.size, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  let best: { font: CertFontKey; size: number; count: number } | undefined;
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) best = entry;
  }
  return best ? { font: best.font, size: best.size } : null;
}

/** Body-region letters: text tokens verbatim, blanks as `{{field}}` placeholders. */
function bodyRegionLetters(layout: CertTemplateLayout, regions: WordingRegions): string {
  let letters = "";
  for (let index = regions.bodyLines.first; index <= regions.bodyLines.last; index++) {
    for (const token of layout.lines[index] ?? []) {
      if (token.kind === "text") {
        letters += token.t;
      } else if (token.kind === "blank") {
        letters += `{{${token.field}}}`;
      }
    }
  }
  return letters;
}

/** Spaces, `*` bold markers, and newlines are invisible to the drift check. */
function stripWordingNoise(text: string): string {
  return text.replace(/[\s*]/g, "");
}

/** Which wording field replaces each signatory's title line. */
const SIGNATORY_WORDING: Record<CertSigField, keyof TemplateWording> = {
  registrarName: "registrarTitle",
  principalName: "principalTitle",
};

export interface WordingDrawPlan {
  /** Layout lines replaced by the wording; skipped while drawing the lines. */
  skipLines: Set<number>;
  /** Replacement draws for edited title / signatory title lines. */
  redraws: WordingTextDraw[];
  /** Re-typeset body draws (filled values underlined). */
  bodyOps: BodyOp[];
}

interface WordingTextDraw {
  text: string;
  centerX: number;
  y: number;
  size: number;
  font: CertFontKey;
}

/**
 * Plans how `wording` replaces the layout's own text: the body region is always
 * re-typeset from the wording, while the title and signatory title lines stay
 * verbatim until edited (`""` drops a line). Returns null when the layout's
 * body letters no longer match the default wording (layout drift), or when the
 * body cannot fit the block even at minimum size: the caller must fall back to
 * the complete verbatim path.
 */
export function planWordingDraw(
  layout: CertTemplateLayout,
  template: CertTemplateKey,
  wording: TemplateWording,
  fonts: EmbeddedCertFonts,
  values: CertBlankValues,
): WordingDrawPlan | null {
  const regions = deriveWordingRegions(layout);
  const defaults = DEFAULT_WORDING[template];
  if (stripWordingNoise(bodyRegionLetters(layout, regions)) !== stripWordingNoise(defaults.body)) {
    return null;
  }

  const skipLines = new Set<number>();
  const redraws: WordingTextDraw[] = [];

  for (let index = regions.bodyLines.first; index <= regions.bodyLines.last; index++) {
    skipLines.add(index);
  }

  const titleTokens = layout.lines[regions.titleLine] ?? [];
  if (wording.title !== defaults.title) {
    skipLines.add(regions.titleLine);
    const style = wording.title ? dominantTextStyle(titleTokens) : null;
    const y = titleTokens.find((token) => token.kind === "text")?.y;
    if (style && y !== undefined) {
      redraws.push({ text: wording.title, centerX: CERT_PAGE_WIDTH / 2, y, ...style });
    }
  }

  for (const { field, line } of regions.signatoryTitles) {
    const key = SIGNATORY_WORDING[field];
    const value = wording[key];
    if (value === defaults[key]) continue;
    skipLines.add(line);
    if (!value) continue;
    const tokens = layout.lines[line] ?? [];
    const style = dominantTextStyle(tokens);
    const y = tokens.find((token) => token.kind === "text")?.y;
    if (!style || y === undefined) continue;
    // Center on the line's own visual center so the redraw follows the layout.
    let minX = Infinity;
    let maxX = -Infinity;
    for (const token of tokens) {
      if (token.kind !== "text") continue;
      minX = Math.min(minX, token.x);
      maxX = Math.max(maxX, token.x + fonts[token.font].widthOfTextAtSize(token.t, token.size));
    }
    redraws.push({ text: value, centerX: (minX + maxX) / 2, y, ...style });
  }

  const widths = bodySlotWidths(layout, regions);
  const { font, boldFont, size } = bodyFontAndSize(layout, regions);
  const sigNameYs = layout.lines.flat().flatMap((token) => (token.kind === "sigName" ? [token.y] : []));
  const blockBottom = Math.min(...sigNameYs) - SIGNATURE_CLEARANCE;
  let bodyOps: BodyOp[];
  try {
    bodyOps = planBodyLayout({
      body: wording.body,
      fonts,
      bodyFont: font,
      boldFont,
      bodySize: size,
      firstBodyY: layout.firstBodyY,
      bodyLeading: layout.bodyLeading,
      bodyMargin: layout.bodyMargin,
      bodyIndent: layout.bodyIndent,
      rightEdge: BODY_RIGHT,
      blockBottom,
      values,
      slotWidth: (field) => widths[field] ?? FALLBACK_SLOT_WIDTH,
    }).ops;
  } catch (error) {
    // A stored fill-in value can exceed the WORST_CASE_BLANKS envelope; the
    // body cannot be re-typeset, so fall back to the complete verbatim path.
    if (error instanceof TooLongBodyError) return null;
    throw error;
  }

  return { skipLines, redraws, bodyOps };
}

async function embedAssets(pdf: PDFDocument): Promise<Record<string, EmbeddedAsset>> {
  const out: Record<string, EmbeddedAsset> = {};
  for (const [asset, file] of Object.entries(PNG_ASSET_FILES)) {
    try {
      out[asset] = { kind: "image", image: await pdf.embedPng(await readFile(join(CERT_ASSET_DIR, file))) };
    } catch {
      // Asset missing: skip it rather than failing the certificate.
    }
  }
  for (const [asset, file] of Object.entries(VECTOR_ASSET_FILES)) {
    try {
      const [embedded] = await pdf.embedPdf(await readFile(join(CERT_ASSET_DIR, file)), [0]);
      if (embedded) {
        out[asset] = { kind: "page", page: embedded };
      }
    } catch {
      // Asset missing: skip it rather than failing the certificate.
    }
  }
  return out;
}

/** Aspect-fit (contain) placement centered inside the target box. */
function fitContain(srcW: number, srcH: number, boxW: number, boxH: number) {
  const scale = Math.min(boxW / srcW, boxH / srcH) || 1;
  const w = srcW * scale;
  const h = srcH * scale;
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h };
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
      const asset = assets[token.asset];
      if (asset) {
        // Assets extracted from the references are drawn into their exact
        // (possibly stretched) box, matching the reference placement 1:1.
        // Supplied logo originals keep their aspect ratio inside the box.
        const exact = asset.kind === "image" && (token.asset === "deped-seal" || token.asset === "icon-small");
        const srcW = asset.kind === "image" ? asset.image.width : asset.page.width;
        const srcH = asset.kind === "image" ? asset.image.height : asset.page.height;
        const fit = exact ? { x: 0, y: 0, w: token.w, h: token.h } : fitContain(srcW, srcH, token.w, token.h);
        const x = token.x + fit.x;
        const y = token.y + fit.y;
        if (asset.kind === "image") {
          page.drawImage(asset.image, { x, y, width: fit.w, height: fit.h });
        } else {
          page.drawPage(asset.page, { x, y, xScale: fit.w / srcW, yScale: fit.h / srcH });
        }
      }
    }
  }

  const bodyLines = new Set(layout.bodyLineIndices);
  const wordingPlan =
    options.template && options.wording
      ? planWordingDraw(layout, options.template, options.wording, fonts, options.blanks)
      : null;
  layout.lines.forEach((tokens, index) => {
    if (!tokens.length) {
      return;
    }
    if (generic && (bodyLines.has(index) || index === layout.titleLineIndex)) {
      return;
    }
    if (wordingPlan?.skipLines.has(index)) {
      return;
    }
    drawLineTokens(page, tokens, fonts, options.blanks, options.signatureNames);
  });

  if (wordingPlan) {
    for (const op of wordingPlan.bodyOps) {
      page.drawText(op.text, { x: op.x, y: op.y, size: op.size, font: fonts[op.font], color: BLACK });
      if (op.underline) {
        page.drawRectangle({
          x: op.underline.x,
          y: op.y - VALUE_UNDERLINE_DROP,
          width: op.underline.width,
          height: VALUE_UNDERLINE_HEIGHT,
          color: BLACK,
        });
      }
    }
    for (const redraw of wordingPlan.redraws) {
      const width = fonts[redraw.font].widthOfTextAtSize(redraw.text, redraw.size);
      page.drawText(redraw.text, {
        x: redraw.centerX - width / 2,
        y: redraw.y,
        size: redraw.size,
        font: fonts[redraw.font],
        color: BLACK,
      });
    }
  }

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

/**
 * Renders a template sample with its wording and SAMPLE_BLANKS values and no QR
 * code — the surface used for wording previews and manual QA.
 */
export function renderSampleCertificate(
  template: CertTemplateKey,
  wording: TemplateWording,
  names: { registrarName?: string; principalName?: string },
  blanks: CertBlankValues = SAMPLE_BLANKS[template],
): Promise<Uint8Array> {
  return renderCertificatePdf({
    template,
    blanks,
    signatureNames: names,
    wording,
  });
}
