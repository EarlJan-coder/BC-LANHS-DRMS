import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import type { PDFFont, PDFImage, PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { SCHOOL_ADDRESS, SCHOOL_NAME } from "@/lib/constants";

export const LOGO_PATH = join(process.cwd(), "public", "lanhs-logo.png");
export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;
export const BRAND_RED = rgb(0.725, 0.109, 0.109);
export const DARK_TEXT = rgb(0.067, 0.094, 0.153);
export const MUTED_TEXT = rgb(0.42, 0.45, 0.5);
export const LIGHT_BORDER = rgb(0.9, 0.9, 0.9);

export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function embedSchoolLogo(pdf: PDFDocument) {
  try {
    return await pdf.embedPng(await readFile(LOGO_PATH));
  } catch {
    return null;
  }
}

export async function embedQrCode(pdf: PDFDocument, data: string) {
  const qrDataUrl = await QRCode.toDataURL(data, { margin: 1, width: 110 });
  return pdf.embedPng(Buffer.from(qrDataUrl.split(",")[1] ?? "", "base64"));
}

export function wrapText(font: PDFFont, size: number, maxWidth: number, text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
    } else {
      if (line) {
        lines.push(line);
      }
      line = word;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines;
}

export function drawCenteredText(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = DARK_TEXT) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: Math.max(50, (PAGE_WIDTH - width) / 2),
    y,
    size,
    font,
    color,
  });
}

export function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: PDFFont,
  size: number,
  color = DARK_TEXT,
  lineHeight = 16,
) {
  for (const currentLine of wrapText(font, size, maxWidth, text)) {
    page.drawText(currentLine, { x, y, size, font, color });
    y -= lineHeight;
  }

  return y;
}

export function drawDocumentHeader(page: PDFPage, logo: PDFImage | null, regular: PDFFont, bold: PDFFont) {
  if (logo) {
    page.drawImage(logo, { x: 58, y: 742, width: 72, height: 72 });
  } else {
    page.drawCircle({ x: 94, y: 778, size: 34, color: rgb(1, 1, 1), borderColor: BRAND_RED, borderWidth: 3 });
    page.drawText("LANHS", { x: 68, y: 773, size: 13, font: bold, color: BRAND_RED });
  }

  page.drawText("Republic of the Philippines", { x: 150, y: 792, size: 10, font: regular, color: MUTED_TEXT });
  page.drawText("Department of Education", { x: 150, y: 777, size: 11, font: bold, color: DARK_TEXT });
  page.drawText(SCHOOL_NAME, { x: 150, y: 759, size: 15, font: bold, color: BRAND_RED });
  page.drawText(SCHOOL_ADDRESS, { x: 150, y: 742, size: 9, font: regular, color: MUTED_TEXT });
  page.drawLine({ start: { x: 50, y: 720 }, end: { x: 545, y: 720 }, thickness: 1.5, color: BRAND_RED });
}

export function drawSignatureLine(
  page: PDFPage,
  startX: number,
  endX: number,
  label: string,
  labelX: number,
  regular: PDFFont,
) {
  page.drawLine({ start: { x: startX, y: 102 }, end: { x: endX, y: 102 }, thickness: 0.8, color: DARK_TEXT });
  page.drawText(label, { x: labelX, y: 88, size: 9, font: regular, color: MUTED_TEXT });
}

export const WATERMARK_SIZE = 280;
export const WATERMARK_OPACITY = 0.08;

export function drawWatermark(page: PDFPage, logo: PDFImage | null) {
  if (!logo) return;
  page.drawImage(logo, {
    x: (PAGE_WIDTH - WATERMARK_SIZE) / 2,
    y: (PAGE_HEIGHT - WATERMARK_SIZE) / 2,
    width: WATERMARK_SIZE,
    height: WATERMARK_SIZE,
    opacity: WATERMARK_OPACITY,
  });
}
