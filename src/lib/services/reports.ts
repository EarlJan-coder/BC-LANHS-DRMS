import { and, desc, eq, gte, lte } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont, PDFPage } from "pdf-lib";
import { getDb } from "@/db";
import {
  certificates,
  documentRequests,
  documentTypes,
  requestStatusEnum,
  students,
  type RequestStatus,
} from "@/db/schema";
import { SCHOOL_NAME } from "@/lib/constants";
import {
  BRAND_RED,
  DARK_TEXT,
  MUTED_TEXT,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  drawCenteredText,
  drawDocumentHeader,
  drawSignatureLine,
  drawWatermark,
  embedSchoolLogo,
  appUrl,
} from "@/lib/services/pdf-brand";
import { drawTable, type TableColumn } from "@/lib/services/pdf-table";
import { statusLabel } from "@/lib/utils";
import { paginateRows, PAGE_SIZE } from "@/lib/pagination";

export const REPORT_KEYS = [
  "request-summary",
  "claimed-documents",
  "generated-certificates",
  "student-records",
] as const;

export type ReportKey = (typeof REPORT_KEYS)[number];

export type ReportRange = {
  from?: Date;
  to?: Date;
  fromLabel?: string;
  toLabel?: string;
};

/** Row filters shared by the on-screen tables and every exported PDF.
 *
 * - `documentType` matches `documentTypes.name` on request reports and
 *   `certificates.certificateType` on generated certificates.
 * - `status` is a document request status; it only applies to the request-based
 *   reports (student records use the separate student status enum and are
 *   intentionally left unfiltered). */
export type ReportFilters = {
  documentType?: string;
  status?: RequestStatus;
};

export type ReportData = {
  key: ReportKey;
  title: string;
  helper: string;
  reportTitle: string;
  periodNoun: string;
  periodLabel: string;
  total: number;
  columns: TableColumn[];
  rows: string[][];
  page?: number;
  pageSize?: number;
};

const REPORT_META: Record<
  ReportKey,
  { title: string; helper: string; reportTitle: string; periodNoun: string }
> = {
  "request-summary": {
    title: "Request summary",
    helper: "Total document requests",
    reportTitle: "Request Summary Report",
    periodNoun: "document requests",
  },
  "claimed-documents": {
    title: "Claimed documents",
    helper: "Completed registrar releases",
    reportTitle: "Claimed Documents Report",
    periodNoun: "claimed documents",
  },
  "generated-certificates": {
    title: "Generated certificates",
    helper: "School document PDFs",
    reportTitle: "Generated Certificates Report",
    periodNoun: "generated certificates",
  },
  "student-records": {
    title: "Student records",
    helper: "Students and alumni in database",
    reportTitle: "Student Records Report",
    periodNoun: "student records",
  },
};

export function isReportKey(value: string): value is ReportKey {
  return (REPORT_KEYS as readonly string[]).includes(value);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(value: string | undefined, edge: "start" | "end"): { date: Date; label: string } | undefined {
  if (!value || !DATE_RE.test(value)) {
    return undefined;
  }
  const date = new Date(edge === "start" ? `${value}T00:00:00.000Z` : `${value}T23:59:59.999Z`);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return { date, label: value };
}

/** Parses `?from=YYYY-MM-DD&to=YYYY-MM-DD` into an inclusive UTC-day range.
 * Invalid dates are ignored; a reversed range is swapped so it stays usable. */
export function parseReportRange(from?: string, to?: string): ReportRange {
  let start = parseDay(from, "start");
  let end = parseDay(to, "end");

  if (start && end && start.date.getTime() > end.date.getTime()) {
    [start, end] = [parseDay(to, "start"), parseDay(from, "end")];
  }

  return {
    from: start?.date,
    to: end?.date,
    fromLabel: start?.label,
    toLabel: end?.label,
  };
}

const MONTH_ABBREVIATIONS = [
  "Jan.",
  "Feb.",
  "Mar.",
  "Apr.",
  "May",
  "Jun.",
  "Jul.",
  "Aug.",
  "Sep.",
  "Oct.",
  "Nov.",
  "Dec.",
];

/** Formats an ISO day (`YYYY-MM-DD`) for display, e.g. "Nov. 11, 2026".
 * Unparseable values pass through untouched. */
export function formatReportDate(value: string) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!parts) return value;
  const [, year, month, day] = parts;
  const label = MONTH_ABBREVIATIONS[Number(month) - 1];
  if (!label) return value;
  return `${label} ${Number(day)}, ${year}`;
}

/** Formats a timestamp for display, e.g. "Nov. 11, 2026 09:01". */
export function formatReportDateTime(value: Date) {
  const iso = value.toISOString();
  return `${formatReportDate(iso.slice(0, 10))} ${iso.slice(11, 16)}`;
}

export function formatPeriodLabel(range: ReportRange) {
  if (range.fromLabel && range.toLabel) {
    return `${formatReportDate(range.fromLabel)} to ${formatReportDate(range.toLabel)}`;
  }
  if (range.fromLabel) {
    return `From ${formatReportDate(range.fromLabel)}`;
  }
  if (range.toLabel) {
    return `Up to ${formatReportDate(range.toLabel)}`;
  }
  return "All time";
}

/** Parses `?documentType=&status=` into row filters. Blank values and
 * unknown statuses are ignored so a stale link never breaks the page. */
export function parseReportFilters(documentType?: string, status?: string): ReportFilters {
  const trimmedType = documentType?.trim();
  const trimmedStatus = status?.trim();
  const isRequestStatus =
    !!trimmedStatus &&
    (requestStatusEnum.enumValues as readonly string[]).includes(trimmedStatus);

  return {
    documentType: trimmedType || undefined,
    status: isRequestStatus ? (trimmedStatus as RequestStatus) : undefined,
  };
}

function personName(row: {
  studentFirstName?: string | null;
  studentMiddleName?: string | null;
  studentLastName?: string | null;
  studentSuffix?: string | null;
}) {
  const name = [row.studentFirstName, row.studentMiddleName, row.studentLastName, row.studentSuffix]
    .filter(Boolean)
    .join(" ");
  return name || "\u2014";
}

function humanStatus(status: string) {
  return status
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function rangeFilters(column: Parameters<typeof gte>[0], range: ReportRange) {
  const conditions = [];
  if (range.from) {
    conditions.push(gte(column, range.from));
  }
  if (range.to) {
    conditions.push(lte(column, range.to));
  }
  return conditions;
}

export async function getReportData(
  key: ReportKey,
  range: ReportRange,
  filters: ReportFilters = {},
): Promise<ReportData> {
  const db = getDb();
  const meta = REPORT_META[key];
  const periodLabel = formatPeriodLabel(range);

  let columns: TableColumn[] = [];
  let rows: string[][] = [];

  if (key === "request-summary") {
    columns = [
      { header: "Tracking No.", width: 112 },
      { header: "Document Type", width: 104 },
      { header: "Student", width: 120 },
      { header: "Status", width: 83 },
      { header: "Requested", width: 76, align: "right" },
    ];
    const conditions = rangeFilters(documentRequests.createdAt, range);
    if (filters.documentType) conditions.push(eq(documentTypes.name, filters.documentType));
    if (filters.status) conditions.push(eq(documentRequests.status, filters.status));
    const records = await db
      .select({
        trackingNumber: documentRequests.trackingNumber,
        documentTypeName: documentTypes.name,
        studentFirstName: students.firstName,
        studentMiddleName: students.middleName,
        studentLastName: students.lastName,
        studentSuffix: students.suffix,
        status: documentRequests.status,
        requestedAt: documentRequests.createdAt,
      })
      .from(documentRequests)
      .leftJoin(students, eq(documentRequests.studentId, students.id))
      .leftJoin(documentTypes, eq(documentRequests.documentTypeId, documentTypes.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(documentRequests.createdAt));

    rows = records.map((row) => [
      row.trackingNumber,
      row.documentTypeName ?? "\u2014",
      personName(row),
      statusLabel(row.status),
      formatReportDate(row.requestedAt.toISOString().slice(0, 10)),
    ]);
  } else if (key === "claimed-documents") {
    columns = [
      { header: "Tracking No.", width: 130 },
      { header: "Document Type", width: 130 },
      { header: "Student", width: 155 },
      { header: "Claimed", width: 80, align: "right" },
    ];
    const conditions = [eq(documentRequests.status, "claimed"), ...rangeFilters(documentRequests.claimedAt, range)];
    if (filters.documentType) conditions.push(eq(documentTypes.name, filters.documentType));
    if (filters.status) conditions.push(eq(documentRequests.status, filters.status));
    const records = await db
      .select({
        trackingNumber: documentRequests.trackingNumber,
        documentTypeName: documentTypes.name,
        studentFirstName: students.firstName,
        studentMiddleName: students.middleName,
        studentLastName: students.lastName,
        studentSuffix: students.suffix,
        claimedAt: documentRequests.claimedAt,
      })
      .from(documentRequests)
      .leftJoin(students, eq(documentRequests.studentId, students.id))
      .leftJoin(documentTypes, eq(documentRequests.documentTypeId, documentTypes.id))
      .where(and(...conditions))
      .orderBy(desc(documentRequests.claimedAt));

    rows = records.map((row) => [
      row.trackingNumber,
      row.documentTypeName ?? "\u2014",
      personName(row),
      row.claimedAt ? formatReportDate(row.claimedAt.toISOString().slice(0, 10)) : "Not set",
    ]);
  } else if (key === "generated-certificates") {
    columns = [
      { header: "Certificate No.", width: 140 },
      { header: "Type", width: 130 },
      { header: "Student", width: 145 },
      { header: "Generated", width: 80, align: "right" },
    ];
    const conditions = rangeFilters(certificates.generatedAt, range);
    if (filters.documentType) conditions.push(eq(certificates.certificateType, filters.documentType));
    const records = await db
      .select({
        certificateNumber: certificates.certificateNumber,
        certificateType: certificates.certificateType,
        studentFirstName: students.firstName,
        studentMiddleName: students.middleName,
        studentLastName: students.lastName,
        studentSuffix: students.suffix,
        generatedAt: certificates.generatedAt,
      })
      .from(certificates)
      .leftJoin(students, eq(certificates.studentId, students.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(certificates.generatedAt));

    rows = records.map((row) => [
      row.certificateNumber,
      row.certificateType,
      personName(row),
      formatReportDate(row.generatedAt.toISOString().slice(0, 10)),
    ]);
  } else {
    columns = [
      { header: "LRN", width: 140 },
      { header: "Student", width: 180 },
      { header: "Status", width: 100 },
      { header: "Added", width: 80, align: "right" },
    ];
    const conditions = rangeFilters(students.createdAt, range);
    const records = await db
      .select({
        lrn: students.lrn,
        studentFirstName: students.firstName,
        studentMiddleName: students.middleName,
        studentLastName: students.lastName,
        studentSuffix: students.suffix,
        status: students.status,
        createdAt: students.createdAt,
      })
      .from(students)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(students.createdAt));

    rows = records.map((row) => [
      row.lrn,
      personName(row),
      humanStatus(row.status),
      formatReportDate(row.createdAt.toISOString().slice(0, 10)),
    ]);
  }

  return {
    key,
    title: meta.title,
    helper: meta.helper,
    reportTitle: meta.reportTitle,
    periodNoun: meta.periodNoun,
    periodLabel,
    total: rows.length,
    columns,
    rows,
  };
}

export async function listReports(
  range: ReportRange,
  pages: Partial<Record<ReportKey, number>> = {},
  filters: ReportFilters = {},
): Promise<ReportData[]> {
  const reports = await Promise.all(REPORT_KEYS.map((key) => getReportData(key, range, filters)));
  return reports.map((report) => {
    const paged = paginateRows(report.rows, pages[report.key] ?? 1, PAGE_SIZE);
    return { ...report, rows: paged.rows, page: paged.page, pageSize: paged.pageSize };
  });
}

// PDF layout constants (A4 to match the documents interface).
const PAGE1_TABLE_TOP = 548;
const CONT_HEADER_RULE_Y = 792;
const CONT_TABLE_TOP = 772;
const TABLE_BOTTOM = 150;
const CONTENT_LEFT = 50;

function drawContinuationHeader(page: PDFPage, bold: PDFFont, title: string) {
  page.drawText(SCHOOL_NAME, { x: CONTENT_LEFT, y: 806, size: 11, font: bold, color: BRAND_RED });
  const titleWidth = bold.widthOfTextAtSize(title, 9);
  page.drawText(title, { x: 545 - titleWidth, y: 806, size: 9, font: bold, color: DARK_TEXT });
  page.drawLine({
    start: { x: CONTENT_LEFT, y: CONT_HEADER_RULE_Y },
    end: { x: 545, y: CONT_HEADER_RULE_Y },
    thickness: 1.2,
    color: BRAND_RED,
  });
}

export async function renderReportPdf(
  key: ReportKey,
  range: ReportRange,
  filters: ReportFilters = {},
): Promise<Uint8Array> {
  const data = await getReportData(key, range, filters);
  const pdfDoc = await PDFDocument.create();
  const [regular, bold] = await Promise.all([
    pdfDoc.embedFont(StandardFonts.Helvetica),
    pdfDoc.embedFont(StandardFonts.HelveticaBold),
  ]);
  const logo = await embedSchoolLogo(pdfDoc);

  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  // Page 1 branded header + title block (mirrors the documents interface).
  drawDocumentHeader(page, logo, regular, bold);
  drawCenteredText(page, data.reportTitle, 684, bold, 18, BRAND_RED);
  drawCenteredText(page, `${SCHOOL_NAME} · Registrar`, 666, regular, 9, MUTED_TEXT);

  const metaY = 646;
  page.drawText(`Coverage period: ${data.periodLabel}`, {
    x: CONTENT_LEFT,
    y: metaY,
    size: 9,
    font: regular,
    color: MUTED_TEXT,
  });
  const generatedLabel = `Generated: ${formatReportDateTime(new Date())}`;
  page.drawText(generatedLabel, {
    x: 545 - regular.widthOfTextAtSize(generatedLabel, 9),
    y: metaY,
    size: 9,
    font: regular,
    color: MUTED_TEXT,
  });

  // Summary box.
  const boxTop = 630;
  const boxHeight = 66;
  page.drawRectangle({
    x: CONTENT_LEFT,
    y: boxTop - boxHeight,
    width: 495,
    height: boxHeight,
    color: rgb(1, 1, 1),
    borderColor: BRAND_RED,
    borderWidth: 0.8,
  });
  const countLabel = "TOTAL RECORDS IN PERIOD";
  page.drawText(countLabel, {
    x: 64,
    y: boxTop - 22,
    size: 8,
    font: regular,
    color: MUTED_TEXT,
  });
  page.drawText(String(data.total), {
    x: 64,
    y: boxTop - 54,
    size: 26,
    font: bold,
    color: BRAND_RED,
  });
  // Anchor the heading clear of the count label: at 8pt the label runs to
  // ~x=179, so a fixed x=175 used to collide with it.
  const headingX = 64 + regular.widthOfTextAtSize(countLabel, 8) + 24;
  page.drawText(data.helper, { x: headingX, y: boxTop - 30, size: 11, font: bold, color: DARK_TEXT });
  page.drawText(data.periodNoun.charAt(0).toUpperCase() + data.periodNoun.slice(1), {
    x: headingX,
    y: boxTop - 48,
    size: 9,
    font: regular,
    color: MUTED_TEXT,
  });

  const result = drawTable({
    currentPage: page,
    x: CONTENT_LEFT,
    top: PAGE1_TABLE_TOP,
    bottom: TABLE_BOTTOM,
    columns: data.columns,
    rows: data.rows,
    regular,
    bold,
    onNewPage: () => {
      const next = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawContinuationHeader(next, bold, data.reportTitle);
      return { page: next, top: CONT_TABLE_TOP };
    },
    emptyLabel: "No records for the selected period.",
  });

  // Signature block pinned to the bottom of the last page (matches the slip).
  const lastPage = result.page;
  drawSignatureLine(
    lastPage,
    70,
    215,
    "Prepared by",
    70 + (145 - regular.widthOfTextAtSize("Prepared by", 9)) / 2,
    regular,
  );
  drawSignatureLine(
    lastPage,
    300,
    465,
    "Registrar",
    300 + (165 - regular.widthOfTextAtSize("Registrar", 9)) / 2,
    regular,
  );

  // Footer + watermark on every page.
  const pages = pdfDoc.getPages();
  const footerNote = `Generated by LANHS DRMS \u00b7 ${data.reportTitle}`;
  for (let index = 0; index < pages.length; index += 1) {
    const current = pages[index];
    drawWatermark(current, logo);
    current.drawText(footerNote, {
      x: CONTENT_LEFT,
      y: 62,
      size: 8,
      font: regular,
      color: MUTED_TEXT,
    });
    current.drawText(`Coverage period: ${data.periodLabel}`, {
      x: CONTENT_LEFT,
      y: 46,
      size: 8,
      font: regular,
      color: MUTED_TEXT,
    });
    const pageLabel = `Page ${index + 1} of ${pages.length}`;
    current.drawText(pageLabel, {
      x: 545 - bold.widthOfTextAtSize(pageLabel, 8),
      y: 46,
      size: 8,
      font: bold,
      color: MUTED_TEXT,
    });
    current.drawText(appUrl(), {
      x: CONTENT_LEFT,
      y: 32,
      size: 7,
      font: regular,
      color: MUTED_TEXT,
    });
  }

  return pdfDoc.save();
}

/** Renders every report under the same period + filters and merges the pages
 * into a single branded PDF — one section per report, in `REPORT_KEYS` order,
 * each keeping its own title block, summary box, and signature lines. */
export async function renderAllReportsPdf(
  range: ReportRange,
  filters: ReportFilters = {},
): Promise<Uint8Array> {
  const combined = await PDFDocument.create();

  for (const key of REPORT_KEYS) {
    const sectionBytes = await renderReportPdf(key, range, filters);
    const section = await PDFDocument.load(sectionBytes);
    const pages = await combined.copyPages(section, section.getPageIndices());
    for (const page of pages) combined.addPage(page);
  }

  return combined.save();
}
