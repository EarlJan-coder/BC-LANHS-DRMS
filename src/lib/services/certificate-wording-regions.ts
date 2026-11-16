import type {
  CertBlankField,
  CertSigField,
  CertTemplateLayout,
  CertToken,
} from "@/lib/services/certificate-layouts";

export interface WordingRegions {
  titleLine: number;
  bodyLines: { first: number; last: number };
  signatoryTitles: Array<{ field: CertSigField; line: number }>;
}

const SIGNATORY_TITLE_MIN_GAP = 12;
const SIGNATORY_TITLE_MAX_GAP = 25;

function sigNameTokens(line: CertToken[]): Extract<CertToken, { kind: "sigName" }>[] {
  return line.filter((token): token is Extract<CertToken, { kind: "sigName" }> => token.kind === "sigName");
}

function isTextLine(line: CertToken[]): boolean {
  return line.length > 0 && line.every((token) => token.kind === "text");
}

export function deriveWordingRegions(layout: CertTemplateLayout): WordingRegions {
  const { lines, titleLineIndex } = layout;
  const firstSigLine = lines.findIndex((line) => sigNameTokens(line).length > 0);
  const bodyLast = firstSigLine === -1 ? lines.length - 1 : firstSigLine - 1;

  const signatoryTitles: WordingRegions["signatoryTitles"] = [];
  lines.forEach((line, index) => {
    const sigNames = sigNameTokens(line);
    if (sigNames.length !== 1) return;
    const [sigName] = sigNames;
    const titleIndex = lines.findIndex((candidate, candidateIndex) => {
      if (candidateIndex <= index || !isTextLine(candidate)) return false;
      const gap = sigName.y - candidate[0].y;
      return gap >= SIGNATORY_TITLE_MIN_GAP && gap <= SIGNATORY_TITLE_MAX_GAP;
    });
    if (titleIndex === -1) return;
    signatoryTitles.push({ field: sigName.field, line: titleIndex });
  });

  return {
    titleLine: titleLineIndex,
    bodyLines: { first: titleLineIndex + 1, last: bodyLast },
    signatoryTitles,
  };
}

export function bodySlotWidths(
  layout: CertTemplateLayout,
  regions: WordingRegions,
): Partial<Record<CertBlankField, number>> {
  const widths: Partial<Record<CertBlankField, number>> = {};
  for (let index = regions.bodyLines.first; index <= regions.bodyLines.last; index++) {
    for (const token of layout.lines[index] ?? []) {
      if (token.kind !== "blank") continue;
      const width = Math.round((token.x1 - token.x) * 100) / 100;
      widths[token.field] = Math.max(widths[token.field] ?? 0, width);
    }
  }
  return widths;
}
