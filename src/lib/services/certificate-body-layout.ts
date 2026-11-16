import { PDFDocument } from "pdf-lib";
import { CERT_LAYOUTS } from "@/lib/services/certificate-layouts";
import type {
  CertBlankField,
  CertFontKey,
  CertTemplateKey,
  CertTemplateLayout,
} from "@/lib/services/certificate-layouts";
import type { CertBlankValues } from "@/lib/services/certificate-renderer";
import { embedCertificateFonts } from "@/lib/services/pdf-fonts";
import type { EmbeddedCertFonts } from "@/lib/services/pdf-fonts";
import { PLACEHOLDER_FIELDS, WORST_CASE_BLANKS } from "@/lib/services/certificate-wording-defaults";
import { bodySlotWidths, deriveWordingRegions } from "@/lib/services/certificate-wording-regions";
import type { WordingRegions } from "@/lib/services/certificate-wording-regions";

export interface BodyOp {
  text: string;
  x: number;
  y: number;
  size: number;
  font: CertFontKey;
  underline?: { x: number; width: number };
}

export class TooLongBodyError extends Error {
  constructor(message = "The body wording is too long to fit on the certificate.") {
    super(message);
    this.name = "TooLongBodyError";
  }
}

export interface PlanBodyInput {
  body: string;
  fonts: EmbeddedCertFonts;
  bodyFont: CertFontKey;
  boldFont: CertFontKey;
  bodySize: number;
  firstBodyY: number;
  bodyLeading: number;
  bodyMargin: number;
  bodyIndent: number;
  rightEdge: number;
  blockBottom: number;
  values: CertBlankValues;
  slotWidth: (field: CertBlankField) => number;
  minSize?: number;
}

const DEFAULT_MIN_SIZE = 9;
const SIZE_STEP = 0.5;
const FALLBACK_SLOT_WIDTH = 60;
const RIGHT_EDGE = 524.9;
const SIGNATURE_CLEARANCE = 24;

const BOLD_VARIANT: Record<CertFontKey, CertFontKey> = {
  bookman: "bookmanBold",
  bookmanBold: "bookmanBold",
  times: "timesBold",
  timesBold: "timesBold",
  calibri: "calibriBold",
  calibriBold: "calibriBold",
  cambriaBold: "cambriaBold",
  oldEnglish: "oldEnglish",
  wingdings: "wingdings",
};

/** A value glued to a neighbouring letter or digit would read as one word, so it is forced a space. */
const ALPHANUMERIC = /[\p{L}\p{N}]/u;
const PLACEHOLDER_PATTERN = /\{\{\s*([A-Za-z]+)\s*\}\}/g;

type Run = { kind: "text"; text: string; bold: boolean } | { kind: "field"; field: CertBlankField };

interface MeasuredRun {
  text: string;
  font: CertFontKey;
  width: number;
  isValue: boolean;
  isField: boolean;
  gapBefore: number;
  /** Underscore runs stand in for a word, so they count as alphanumeric at both edges. */
  wordy: boolean;
}

function isWordChar(run: MeasuredRun, char: string): boolean {
  return run.wordy || ALPHANUMERIC.test(char);
}

function isPlaceholderField(name: string): name is CertBlankField {
  return (PLACEHOLDER_FIELDS as readonly string[]).includes(name);
}

/** Split a whitespace-free piece into text and placeholder runs sharing one bold flag. */
function tokenizePiece(piece: string, bold: boolean): Run[] {
  const runs: Run[] = [];
  let cursor = 0;
  for (const match of piece.matchAll(PLACEHOLDER_PATTERN)) {
    if (!isPlaceholderField(match[1])) continue;
    if (match.index > cursor) runs.push({ kind: "text", text: piece.slice(cursor, match.index), bold });
    runs.push({ kind: "field", field: match[1] });
    cursor = match.index + match[0].length;
  }
  if (cursor < piece.length) runs.push({ kind: "text", text: piece.slice(cursor), bold });
  return runs;
}

/** `**` toggles bold across a paragraph (odd segments bold); an unbalanced paragraph is literal. Words may span segments. */
function parseParagraph(paragraph: string): Run[][] {
  const split = paragraph.split("**");
  const balanced = split.length % 2 === 1;
  const segments = balanced ? split : [paragraph];

  const words: Run[][] = [];
  let current: Run[] = [];
  segments.forEach((segment, index) => {
    const bold = balanced && index % 2 === 1;
    for (const piece of segment.split(/(\s+)/)) {
      if (!piece) continue;
      if (/^\s+$/.test(piece)) {
        if (current.length) words.push(current);
        current = [];
      } else {
        current.push(...tokenizePiece(piece, bold));
      }
    }
  });
  if (current.length) words.push(current);
  return words;
}

function parseParagraphs(body: string): Run[][][] {
  const normalized = body.replace(PLACEHOLDER_PATTERN, "{{$1}}");
  return normalized
    .split(/\n\s*\n/)
    .map(parseParagraph)
    .filter((words) => words.length > 0);
}

interface Word {
  runs: MeasuredRun[];
  width: number;
}

function measureWord(runs: Run[], input: PlanBodyInput, size: number): Word {
  const { fonts, bodyFont, boldFont, values, slotWidth } = input;
  const measured = runs.map((run): MeasuredRun => {
    if (run.kind === "text") {
      const font = run.bold ? boldFont : bodyFont;
      return { text: run.text, font, width: fonts[font].widthOfTextAtSize(run.text, size), isValue: false, isField: false, gapBefore: 0, wordy: false };
    }
    const value = (values[run.field] ?? "").trim();
    if (value) {
      return { text: value, font: boldFont, width: fonts[boldFont].widthOfTextAtSize(value, size), isValue: true, isField: true, gapBefore: 0, wordy: false };
    }
    const glyph = fonts[boldFont].widthOfTextAtSize("_", size);
    const text = "_".repeat(Math.max(1, Math.round(slotWidth(run.field) / glyph)));
    return { text, font: boldFont, width: fonts[boldFont].widthOfTextAtSize(text, size), isValue: false, isField: true, gapBefore: 0, wordy: true };
  });
  const space = fonts[bodyFont].widthOfTextAtSize(" ", size);
  for (let i = 1; i < measured.length; i++) {
    const prev = measured[i - 1];
    const next = measured[i];
    if ((prev.isField || next.isField) && isWordChar(prev, prev.text.slice(-1)) && isWordChar(next, next.text[0])) {
      next.gapBefore = space;
    }
  }
  return { runs: measured, width: measured.reduce((sum, run) => sum + run.gapBefore + run.width, 0) };
}

/** Greedy wrap one paragraph; returns null when a line cannot hold its words at this size. */
function wrapParagraph(words: Word[], space: number, firstWidth: number, laterWidth: number): Word[][] | null {
  const lines: Word[][] = [];
  let current: Word[] = [];
  let currentWidth = 0;
  for (const word of words) {
    const available = lines.length === 0 ? firstWidth : laterWidth;
    const joined = current.length ? currentWidth + space + word.width : word.width;
    if (current.length > 0 && joined > available) {
      lines.push(current);
      current = [word];
      currentWidth = word.width;
    } else {
      current.push(word);
      currentWidth = joined;
    }
  }
  lines.push(current);
  const overflows = lines.some((line, index) => {
    const natural = line.reduce((sum, word) => sum + word.width, 0) + space * (line.length - 1);
    return natural > (index === 0 ? firstWidth : laterWidth) + 1e-6;
  });
  return overflows ? null : lines;
}

function typesetAtSize(input: PlanBodyInput, paragraphs: Run[][][], size: number): BodyOp[] | null {
  const { fonts, bodyFont, bodyMargin, bodyIndent, rightEdge, firstBodyY, bodyLeading, blockBottom } = input;
  const space = fonts[bodyFont].widthOfTextAtSize(" ", size);
  const firstWidth = rightEdge - bodyMargin - bodyIndent;
  const laterWidth = rightEdge - bodyMargin;

  const ops: BodyOp[] = [];
  let lineIndex = 0;
  for (const paragraph of paragraphs) {
    const words = paragraph.map((runs) => measureWord(runs, input, size));
    const lines = wrapParagraph(words, space, firstWidth, laterWidth);
    if (!lines) return null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const y = firstBodyY - lineIndex * bodyLeading;
      if (y < blockBottom) return null;
      const lineWidth = i === 0 ? firstWidth : laterWidth;
      const natural = line.reduce((sum, word) => sum + word.width, 0) + space * (line.length - 1);
      const isParagraphEnd = i === lines.length - 1;
      const extra = isParagraphEnd || line.length < 2 ? 0 : Math.max(0, (lineWidth - natural) / (line.length - 1));

      let cursor = bodyMargin + (i === 0 ? bodyIndent : 0);
      for (const word of line) {
        for (const run of word.runs) {
          cursor += run.gapBefore;
          const op: BodyOp = { text: run.text, x: cursor, y, size, font: run.font };
          if (run.isValue) op.underline = { x: cursor, width: run.width };
          ops.push(op);
          cursor += run.width;
        }
        cursor += space + extra;
      }
      lineIndex += 1;
    }
  }
  return ops;
}

export function planBodyLayout(input: PlanBodyInput): { ops: BodyOp[]; size: number } {
  const minSize = input.minSize ?? DEFAULT_MIN_SIZE;
  const paragraphs = parseParagraphs(input.body);
  if (paragraphs.length === 0) return { ops: [], size: input.bodySize };

  for (let size = input.bodySize; size >= Math.min(minSize, input.bodySize) - 1e-9; size -= SIZE_STEP) {
    const ops = typesetAtSize(input, paragraphs, size);
    if (ops) return { ops, size };
  }
  throw new TooLongBodyError();
}

/** The dominant (font, size) of the body region's non-blank text tokens, plus its bold variant. */
export function bodyFontAndSize(
  layout: CertTemplateLayout,
  regions: WordingRegions,
): { font: CertFontKey; boldFont: CertFontKey; size: number } {
  const counts = new Map<string, { font: CertFontKey; size: number; count: number }>();
  for (let index = regions.bodyLines.first; index <= regions.bodyLines.last; index++) {
    for (const token of layout.lines[index] ?? []) {
      if (token.kind !== "text") continue;
      const key = `${token.font}@${token.size}`;
      const entry = counts.get(key) ?? { font: token.font, size: token.size, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
  }
  let best: { font: CertFontKey; size: number; count: number } | undefined;
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) best = entry;
  }
  if (!best) throw new Error("Layout has no body text tokens.");
  return { font: best.font, boldFont: BOLD_VARIANT[best.font], size: best.size };
}

/** Plans `body` with worst-case values against the template's real geometry; throws TooLongBodyError if it cannot fit. */
export async function assertBodyFits(templateKey: CertTemplateKey, body: string): Promise<void> {
  const layout = CERT_LAYOUTS[templateKey];
  const regions = deriveWordingRegions(layout);
  const widths = bodySlotWidths(layout, regions);
  const { font, boldFont, size } = bodyFontAndSize(layout, regions);

  const sigNameYs = layout.lines.flat().flatMap((token) => (token.kind === "sigName" ? [token.y] : []));
  const blockBottom = Math.min(...sigNameYs) - SIGNATURE_CLEARANCE;

  const fonts = await embedCertificateFonts(await PDFDocument.create());
  planBodyLayout({
    body,
    fonts,
    bodyFont: font,
    boldFont,
    bodySize: size,
    firstBodyY: layout.firstBodyY,
    bodyLeading: layout.bodyLeading,
    bodyMargin: layout.bodyMargin,
    bodyIndent: layout.bodyIndent,
    rightEdge: RIGHT_EDGE,
    blockBottom,
    values: WORST_CASE_BLANKS,
    slotWidth: (field) => widths[field] ?? FALLBACK_SLOT_WIDTH,
  });
}
