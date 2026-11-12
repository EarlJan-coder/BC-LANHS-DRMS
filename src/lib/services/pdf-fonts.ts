import { readFile } from "node:fs/promises";
import { join } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import type { PDFDocument, PDFFont } from "pdf-lib";
import type { CertFontKey } from "@/lib/services/certificate-layouts";

/**
 * TrueType faces used by the reference certificate templates in public/pdf/.
 * They are the school's real document fonts (Microsoft/Monotype), copied from
 * the Windows font directory into assets/fonts so server-side rendering is
 * pixel-faithful. NOTE: these are commercial fonts bundled for a school
 * capstone; revisit licensing before any public/commercial release.
 */
const FONT_FILES: Record<CertFontKey, string> = {
  bookman: "bookman-regular.ttf",
  bookmanBold: "bookman-bold.ttf",
  oldEnglish: "old-english-text-mt.ttf",
  cambriaBold: "cambria-bold.ttf",
  times: "times-new-roman-regular.ttf",
  timesBold: "times-new-roman-bold.ttf",
  calibri: "calibri-regular.ttf",
  calibriBold: "calibri-bold.ttf",
  wingdings: "wingdings.ttf",
};

export const CERT_FONT_DIR = join(process.cwd(), "assets", "fonts");

const bytesCache = new Map<CertFontKey, Promise<Uint8Array>>();

function loadFontBytes(key: CertFontKey): Promise<Uint8Array> {
  let cached = bytesCache.get(key);
  if (!cached) {
    cached = readFile(join(CERT_FONT_DIR, FONT_FILES[key]));
    bytesCache.set(key, cached);
  }
  return cached;
}

export type EmbeddedCertFonts = Record<CertFontKey, PDFFont>;

export async function embedCertificateFonts(pdf: PDFDocument): Promise<EmbeddedCertFonts> {
  pdf.registerFontkit(fontkit);
  const entries = await Promise.all(
    (Object.keys(FONT_FILES) as CertFontKey[]).map(async (key) => {
      return [key, await pdf.embedFont(await loadFontBytes(key))] as const;
    }),
  );
  return Object.fromEntries(entries) as EmbeddedCertFonts;
}
