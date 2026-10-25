import { randomBytes } from "node:crypto";
import { eq, desc } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont, PDFPage } from "pdf-lib";
import { getDb } from "@/db";
import {
  certificates,
  documentRequests,
  documentTypes,
  gradeLevels,
  notifications,
  schoolYears,
  sections,
  students,
  users,
} from "@/db/schema";
import { ensureCurrentDbUser } from "@/lib/auth";
import { SCHOOL_NAME } from "@/lib/constants";
import { sendWorkflowEmail } from "@/lib/email";
import type { CertificateVerificationView, CertificateView } from "@/lib/types";
import { formatDate, generatePrefixedId, studentFullName, ZERO_HASH } from "@/lib/utils";
import { certificateGenerateSchema, certificateOverrideSchema } from "@/lib/validators";
import { recordAuditedAction } from "./audit-log";
import {
  appUrl,
  BRAND_RED,
  DARK_TEXT,
  drawCenteredText,
  drawDocumentHeader,
  drawSignatureLine,
  drawWatermark,
  drawWrappedText,
  embedQrCode,
  embedSchoolLogo,
  LIGHT_BORDER,
  MUTED_TEXT,
  PAGE_HEIGHT,
  PAGE_WIDTH,
} from "./pdf-brand";

function certificateNumber(type = "Certificate") {
  const prefix =
    type
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 6) || "CERT";

  return generatePrefixedId(prefix);
}

function verificationCode() {
  return randomBytes(16).toString("hex");
}

async function drawCertificateFooter(pdf: PDFDocument, page: PDFPage, qrCodeData: string, regular: PDFFont, bold: PDFFont) {
  drawSignatureLine(page, 70, 215, "Registrar", 112, regular);
  drawSignatureLine(page, 300, 465, "School Head / Principal", 338, regular);

  const qrImage = await embedQrCode(pdf, qrCodeData);
  page.drawImage(qrImage, { x: 465, y: 132, width: 68, height: 68 });
  page.drawText("Scan to verify", { x: 468, y: 120, size: 8, font: bold, color: BRAND_RED });
  page.drawText(qrCodeData, { x: 50, y: 42, size: 7, font: regular, color: MUTED_TEXT });
  page.drawText("This QR code can be scanned to verify certificate authenticity.", {
    x: 50,
    y: 28,
    size: 8,
    font: regular,
    color: MUTED_TEXT,
  });
}

export interface CertificateDisplayRow {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  suffix: string | null;
  gradeLevel: string | null;
  section: string | null;
  requestPurpose: string | null;
  generatedAt: Date;
  overrideStudentName: string | null;
  overrideGradeLevel: string | null;
  overrideSection: string | null;
  overridePurpose: string | null;
  overrideDateGenerated: Date | null;
}

export interface CertificateDisplayFields {
  name: string;
  gradeLevel: string;
  section: string;
  purpose: string;
  dateGenerated: Date;
}

/** A set override wins; empty or whitespace-only overrides fall back to the
 * live joined value so the PDF never renders a blank field. */
function effectiveOverride(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Effective printed content for the certificate PDF and its preview/editor.
 * Overrides are display-only: they never enter the canonical verification hash. */
export function resolveCertificateDisplayFields(row: CertificateDisplayRow): CertificateDisplayFields {
  return {
    name:
      effectiveOverride(row.overrideStudentName) ??
      [row.firstName, row.middleName, row.lastName, row.suffix].filter(Boolean).join(" "),
    gradeLevel: effectiveOverride(row.overrideGradeLevel) ?? row.gradeLevel ?? "",
    section: effectiveOverride(row.overrideSection) ?? row.section ?? "",
    purpose: effectiveOverride(row.overridePurpose) ?? row.requestPurpose ?? "",
    dateGenerated: row.overrideDateGenerated ?? row.generatedAt,
  };
}

function formalTitle(type: string) {
  return type.toUpperCase().replaceAll("-", " ");
}

function genericCertificateText({
  certificateType,
  name,
  lrn,
  gradeLevel,
  section,
  schoolYear,
  purpose,
}: {
  certificateType: string;
  name: string;
  lrn: string;
  gradeLevel: string;
  section: string;
  schoolYear: string;
  purpose: string;
}) {
  const lower = certificateType.toLowerCase();
  const learner = `${name || "the student"} with LRN ${lrn}`;
  const classInfo = [gradeLevel, section].filter((value) => value && value !== "Not set").join(", ");
  const schoolYearText = schoolYear && schoolYear !== "Not set" ? ` for School Year ${schoolYear}` : "";
  const classText = classInfo ? ` in ${classInfo}` : "";

  if (lower.includes("good moral")) {
    return `This certifies that ${learner}${classText}${schoolYearText} is known to Luis Aguado National High School and, based on available school records, has shown good moral character. This certification is issued upon request for ${purpose}.`;
  }

  if (lower.includes("enrollment")) {
    return `This certifies that ${learner} is officially recorded as enrolled${classText}${schoolYearText} at Luis Aguado National High School. This certification is issued upon request for ${purpose}.`;
  }

  if (lower.includes("graduation")) {
    return `This certifies that ${learner} has completed the applicable school requirements recorded by Luis Aguado National High School. This certification is issued upon request for ${purpose}.`;
  }

  if (lower.includes("form 137")) {
    return `This certifies that ${learner} has a Form 137 related request recorded in LANHS DRMS. The official document shall be released in accordance with registrar validation and school policies. Purpose: ${purpose}.`;
  }

  if (lower.includes("diploma")) {
    return `This certifies that ${learner} has a diploma-related request recorded in LANHS DRMS. This certification is issued by the registrar for ${purpose}, subject to validation of school records.`;
  }

  return `This certifies that ${learner}${classText}${schoolYearText} has a validated school document request recorded in LANHS DRMS. This certificate is issued upon request for ${purpose}.`;
}

function privateDisplayName(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "Student";
  }

  const first = parts[0];
  const last = parts.at(-1) ?? "";
  return `${first.charAt(0)}. ${last}`;
}

export async function generateCertificate(input: unknown) {
  const values = certificateGenerateSchema.parse(input);
  const db = getDb();
  const actor = await ensureCurrentDbUser();

  const request = values.requestId
    ? await db.query.documentRequests.findFirst({
        where: eq(documentRequests.id, values.requestId),
      })
    : undefined;
  const studentId = values.studentId ?? request?.studentId;

  if (!studentId) {
    throw new Error("A linked student record is required before generating a certificate.");
  }

  const student = await db.query.students.findFirst({
    where: eq(students.id, studentId),
  });

  if (!student) {
    throw new Error("Student record was not found.");
  }

  const docType = request?.documentTypeId
    ? await db.query.documentTypes.findFirst({
        where: eq(documentTypes.id, request.documentTypeId),
      })
    : undefined;
  const certificateType = values.certificateType ?? docType?.name ?? "School Certificate";
  const schoolYear =
    (values.schoolYearId
      ? await db.query.schoolYears.findFirst({ where: eq(schoolYears.id, values.schoolYearId) })
      : undefined) ??
    (request?.schoolYearNeeded
      ? await db.query.schoolYears.findFirst({ where: eq(schoolYears.name, request.schoolYearNeeded) })
      : undefined) ??
    (student.schoolYearId ? await db.query.schoolYears.findFirst({ where: eq(schoolYears.id, student.schoolYearId) }) : undefined) ??
    (await db.query.schoolYears.findFirst({ where: eq(schoolYears.isActive, true) }));

  const code = verificationCode();
  const verifyUrl = `${appUrl()}/verify-certificate/${code}`;
  const [created] = await db
    .insert(certificates)
    .values({
      certificateNumber: certificateNumber(certificateType),
      requestId: request?.id,
      studentId: student.id,
      certificateType,
      schoolYearId: schoolYear?.id,
      verificationCode: code,
      qrCodeData: verifyUrl,
      generatedBy: actor?.id,
    })
    .returning();

  await db
    .update(certificates)
    .set({
      pdfUrl: `/api/certificates/${created.id}/pdf`,
      updatedAt: new Date(),
    })
    .where(eq(certificates.id, created.id));

  const audit = await recordAuditedAction({
    referenceType: "certificate",
    referenceId: created.certificateNumber,
    action: "Certificate generated",
    actorRole: actor?.role ?? "registrar",
    actorUserId: actor?.id,
    entityType: "certificate",
    entityId: created.id,
    metadata: {
      requestId: request?.id,
      documentType: certificateType,
      schoolYear: schoolYear?.name,
    },
    hashMetadata: {
      certificateNumber: created.certificateNumber,
      studentId: student.id,
      schoolYear: schoolYear?.name ?? "",
    },
    eventType: "CERTIFICATE_ISSUED",
    previousRecordHash: ZERO_HASH,
  });

  await db
    .update(certificates)
    .set({
      blockchainTxHash: audit.blockchainTransactionHash ?? undefined,
      recordHash: audit.recordHash,
      blockNumber: audit.blockNumber ?? undefined,
      network: audit.network ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(certificates.id, created.id));

  if (request?.requestedByUserId) {
    await db.insert(notifications).values({
      userId: request.requestedByUserId,
      type: "certificate",
      title: "Certificate generated",
      message: `${created.certificateNumber} (${certificateType}) has been generated and is ready for registrar review.`,
    });
  }

  const recipient = student.email
    ? { email: student.email, name: studentFullName(student) }
    : request?.requestedByUserId
      ? await db.query.users.findFirst({ where: eq(users.id, request.requestedByUserId) }).then((user) =>
          user ? { email: user.email, name: `${user.firstName} ${user.lastName}` } : null,
        )
      : null;

  await sendWorkflowEmail({
    to: recipient?.email,
    studentName: recipient?.name ?? studentFullName(student),
    trackingNumber: request?.trackingNumber,
    documentType: certificateType,
    status: "certificate_generated",
    subject: `LANHS DRMS certificate generated: ${created.certificateNumber}`,
    instruction: `Your ${certificateType} has been generated. Scan the QR code on the PDF to verify authenticity.`,
  });

  return {
    id: created.id,
    certificateNumber: created.certificateNumber,
    verificationCode: code,
    verificationUrl: verifyUrl,
    ...audit,
  };
}

export async function listCertificateViews(limit = 100): Promise<CertificateView[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: certificates.id,
      certificateNumber: certificates.certificateNumber,
      certificateType: certificates.certificateType,
      verificationCode: certificates.verificationCode,
      blockchainTxHash: certificates.blockchainTxHash,
      generatedAt: certificates.generatedAt,
      schoolYear: schoolYears.name,
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      suffix: students.suffix,
    })
    .from(certificates)
    .leftJoin(students, eq(certificates.studentId, students.id))
    .leftJoin(schoolYears, eq(certificates.schoolYearId, schoolYears.id))
    .orderBy(desc(certificates.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    certificateNumber: row.certificateNumber,
    certificateType: row.certificateType,
    studentName: [row.firstName, row.middleName, row.lastName, row.suffix].filter(Boolean).join(" ") || "Unknown student",
    schoolYear: row.schoolYear ?? "Not set",
    verificationCode: row.verificationCode,
    verificationUrl: `${appUrl()}/verify-certificate/${row.verificationCode}`,
    blockchainStatus: row.blockchainTxHash ? "submitted" : "pending",
    blockchainTxHash: row.blockchainTxHash ?? "Pending",
    generatedAt: formatDate(row.generatedAt),
  }));
}

export async function getCertificateView(id: string) {
  const views = await listCertificateViews(200);
  return views.find((view) => view.id === id || view.certificateNumber === id || view.verificationCode === id) ?? null;
}

export async function verifyCertificate(code: string): Promise<CertificateVerificationView> {
  const db = getDb();
  const row = await db
    .select({
      certificateNumber: certificates.certificateNumber,
      certificateType: certificates.certificateType,
      blockchainTxHash: certificates.blockchainTxHash,
      generatedAt: certificates.generatedAt,
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      suffix: students.suffix,
    })
    .from(certificates)
    .leftJoin(students, eq(certificates.studentId, students.id))
    .where(eq(certificates.verificationCode, code))
    .limit(1);

  const certificate = row[0];
  if (!certificate) {
    return { valid: false };
  }

  const fullName = [certificate.firstName, certificate.middleName, certificate.lastName, certificate.suffix]
    .filter(Boolean)
    .join(" ");

  return {
    valid: true,
    certificateNumber: certificate.certificateNumber,
    studentDisplayName: privateDisplayName(fullName),
    certificateType: certificate.certificateType,
    issuedAt: formatDate(certificate.generatedAt),
    issuingSchool: SCHOOL_NAME,
    blockchainTxHash: certificate.blockchainTxHash ?? "Pending",
  };
}

export interface CertificateEditView {
  id: string;
  certificateNumber: string;
  studentName: string;
  gradeLevel: string;
  section: string;
  purpose: string;
  /** ISO timestamp of the effective "Date Generated" (override or record). */
  dateGenerated: string;
  hasOverride: {
    studentName: boolean;
    gradeLevel: boolean;
    section: boolean;
    purpose: boolean;
    dateGenerated: boolean;
  };
}

async function loadCertificateDisplayRow(certificateId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: certificates.id,
      certificateNumber: certificates.certificateNumber,
      certificateType: certificates.certificateType,
      qrCodeData: certificates.qrCodeData,
      generatedAt: certificates.generatedAt,
      schoolYear: schoolYears.name,
      lrn: students.lrn,
      trackingNumber: documentRequests.trackingNumber,
      requestPurpose: documentRequests.purpose,
      requestSchoolYearNeeded: documentRequests.schoolYearNeeded,
      requestGradeLevelNeeded: documentRequests.gradeLevelNeeded,
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      suffix: students.suffix,
      gradeLevel: gradeLevels.name,
      section: sections.name,
      overrideStudentName: certificates.overrideStudentName,
      overrideGradeLevel: certificates.overrideGradeLevel,
      overrideSection: certificates.overrideSection,
      overridePurpose: certificates.overridePurpose,
      overrideDateGenerated: certificates.overrideDateGenerated,
    })
    .from(certificates)
    .leftJoin(students, eq(certificates.studentId, students.id))
    .leftJoin(gradeLevels, eq(students.gradeLevelId, gradeLevels.id))
    .leftJoin(sections, eq(students.sectionId, sections.id))
    .leftJoin(documentRequests, eq(certificates.requestId, documentRequests.id))
    .leftJoin(schoolYears, eq(certificates.schoolYearId, schoolYears.id))
    .where(eq(certificates.id, certificateId))
    .limit(1);

  return rows[0];
}

type CertificateDisplayDbRow = NonNullable<Awaited<ReturnType<typeof loadCertificateDisplayRow>>>;

function toDisplayRow(row: CertificateDisplayDbRow): CertificateDisplayRow {
  return {
    firstName: row.firstName,
    middleName: row.middleName,
    lastName: row.lastName,
    suffix: row.suffix,
    gradeLevel: row.gradeLevel ?? row.requestGradeLevelNeeded,
    section: row.section,
    requestPurpose: row.requestPurpose,
    generatedAt: row.generatedAt,
    overrideStudentName: row.overrideStudentName,
    overrideGradeLevel: row.overrideGradeLevel,
    overrideSection: row.overrideSection,
    overridePurpose: row.overridePurpose,
    overrideDateGenerated: row.overrideDateGenerated,
  };
}

/** Current effective PDF content for the preview/edit form. Staff only. */
export async function getCertificateEditView(certificateId: string): Promise<CertificateEditView | null> {
  const row = await loadCertificateDisplayRow(certificateId);
  if (!row) {
    return null;
  }

  const fields = resolveCertificateDisplayFields(toDisplayRow(row));

  return {
    id: row.id,
    certificateNumber: row.certificateNumber,
    studentName: fields.name,
    gradeLevel: fields.gradeLevel,
    section: fields.section,
    purpose: fields.purpose,
    dateGenerated: fields.dateGenerated.toISOString(),
    hasOverride: {
      studentName: effectiveOverride(row.overrideStudentName) !== null,
      gradeLevel: effectiveOverride(row.overrideGradeLevel) !== null,
      section: effectiveOverride(row.overrideSection) !== null,
      purpose: effectiveOverride(row.overridePurpose) !== null,
      dateGenerated: row.overrideDateGenerated !== null,
    },
  };
}

const OVERRIDE_FIELDS = ["studentName", "gradeLevel", "section", "purpose", "dateGenerated"] as const;

/** Save PDF content overrides. Provided-key semantics: a missing key leaves the
 * stored override untouched, a blank value clears it back to the live record
 * value (the schema maps blank/whitespace to undefined). */
export async function updateCertificateOverrides(certificateId: string, input: unknown): Promise<CertificateEditView | null> {
  const db = getDb();
  const actor = await ensureCurrentDbUser();

  const existing = await db.query.certificates.findFirst({
    where: eq(certificates.id, certificateId),
  });

  if (!existing) {
    throw new Error("Certificate not found.");
  }

  const raw = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const provided = OVERRIDE_FIELDS.filter((field) => field in raw);
  if (provided.length === 0) {
    throw new Error("No editable fields were provided.");
  }

  const parsed = certificateOverrideSchema.parse(input);

  const updates: Partial<typeof certificates.$inferInsert> = {};
  if (provided.includes("studentName")) updates.overrideStudentName = parsed.studentName ?? null;
  if (provided.includes("gradeLevel")) updates.overrideGradeLevel = parsed.gradeLevel ?? null;
  if (provided.includes("section")) updates.overrideSection = parsed.section ?? null;
  if (provided.includes("purpose")) updates.overridePurpose = parsed.purpose ?? null;
  if (provided.includes("dateGenerated")) updates.overrideDateGenerated = parsed.dateGenerated ?? null;

  await db
    .update(certificates)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(certificates.id, certificateId));

  const schoolYear = existing.schoolYearId
    ? await db.query.schoolYears.findFirst({ where: eq(schoolYears.id, existing.schoolYearId) })
    : undefined;

  // Overrides change only the printed PDF content. The canonical hash metadata
  // stays identical to issuance, so the record hash is logged unchanged and the
  // certificate's verification hash is not recomputed.
  await recordAuditedAction({
    referenceType: "certificate",
    referenceId: existing.certificateNumber,
    action: "Certificate PDF content updated",
    actorRole: actor?.role ?? "registrar",
    actorUserId: actor?.id,
    entityType: "certificate",
    entityId: existing.id,
    metadata: { changedFields: provided },
    hashMetadata: {
      certificateNumber: existing.certificateNumber,
      studentId: existing.studentId ?? "",
      schoolYear: schoolYear?.name ?? "",
    },
    previousRecordHash: existing.recordHash ?? ZERO_HASH,
  });

  return getCertificateEditView(certificateId);
}

export async function generateCertificatePdf(certificateId: string) {
  const certificate = await loadCertificateDisplayRow(certificateId);
  if (!certificate) {
    throw new Error("Certificate was not found.");
  }

  const display = resolveCertificateDisplayFields(toDisplayRow(certificate));
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await embedSchoolLogo(pdf);
  const name = display.name;
  const schoolYear = certificate.schoolYear ?? certificate.requestSchoolYearNeeded ?? "Not set";
  const gradeLevel = display.gradeLevel || "Not set";
  const section = display.section || "Not set";
  const purpose = display.purpose || "school record validation";
  const title = formalTitle(certificate.certificateType);
  const titleSize = title.length > 42 ? 13 : title.length > 32 ? 15 : 18;

  drawDocumentHeader(page, logo, regular, bold);
  drawCenteredText(page, title, 680, bold, titleSize);
  page.drawText(`Certificate No.: ${certificate.certificateNumber}`, { x: 50, y: 645, size: 10, font: regular, color: DARK_TEXT });
  page.drawText(`Date Generated: ${formatDate(display.dateGenerated)}`, { x: 365, y: 645, size: 10, font: regular, color: DARK_TEXT });
  page.drawText(`Tracking No.: ${certificate.trackingNumber ?? "Not linked"}`, { x: 50, y: 628, size: 9, font: regular, color: MUTED_TEXT });

  page.drawRectangle({ x: 50, y: 586, width: 495, height: 26, color: rgb(1, 1, 1), borderColor: LIGHT_BORDER, borderWidth: 0.8 });
  page.drawText(`Student: ${name || "Not set"}`, { x: 60, y: 596, size: 10, font: bold, color: DARK_TEXT });
  page.drawText(`LRN: ${certificate.lrn ?? "Not set"}`, { x: 365, y: 596, size: 10, font: regular, color: DARK_TEXT });
  page.drawText(`Grade/Section: ${[gradeLevel, section].filter((value) => value !== "Not set").join(" - ") || "Not set"}`, {
    x: 60,
    y: 570,
    size: 10,
    font: regular,
    color: DARK_TEXT,
  });
  page.drawText(`School Year: ${schoolYear}`, { x: 365, y: 570, size: 10, font: regular, color: DARK_TEXT });

  page.drawRectangle({ x: 50, y: 250, width: 495, height: 300, color: rgb(1, 1, 1), borderColor: LIGHT_BORDER, borderWidth: 0.8 });
  const body = genericCertificateText({
    certificateType: certificate.certificateType,
    name,
    lrn: certificate.lrn ?? "Not set",
    gradeLevel,
    section,
    schoolYear,
    purpose,
  });

  let y = drawWrappedText(page, body, 72, 520, 450, regular, 12, DARK_TEXT, 20);
  y -= 18;
  page.drawText("This document is generated from validated LANHS DRMS records.", {
    x: 72,
    y,
    size: 10,
    font: regular,
    color: MUTED_TEXT,
  });
  page.drawText(`Purpose: ${purpose.slice(0, 72)}`, { x: 72, y: 292, size: 9, font: regular, color: MUTED_TEXT });

  await drawCertificateFooter(pdf, page, certificate.qrCodeData, regular, bold);

  drawWatermark(page, logo);

  return Buffer.from(await pdf.save());
}

export async function reissueCertificate(certificateId: string, reason?: string) {
  const db = getDb();
  const actor = await ensureCurrentDbUser();

  const existing = await db.query.certificates.findFirst({
    where: eq(certificates.id, certificateId),
  });

  if (!existing) {
    throw new Error("Certificate not found.");
  }

  const previousHash = existing.recordHash ?? ZERO_HASH;

  const schoolYear = existing.schoolYearId
    ? await db.query.schoolYears.findFirst({ where: eq(schoolYears.id, existing.schoolYearId) })
    : undefined;

  const audit = await recordAuditedAction({
    referenceType: "certificate",
    referenceId: existing.certificateNumber,
    action: "Certificate reissued",
    actorRole: actor?.role ?? "registrar",
    actorUserId: actor?.id,
    entityType: "certificate",
    entityId: existing.id,
    metadata: {
      reason: reason ?? "Reissued by registrar",
      previousHash,
    },
    hashMetadata: {
      certificateNumber: existing.certificateNumber,
      studentId: existing.studentId ?? "",
      schoolYear: schoolYear?.name ?? "",
    },
    eventType: "CERTIFICATE_REISSUED",
    previousRecordHash: previousHash,
  });

  await db
    .update(certificates)
    .set({
      blockchainTxHash: audit.blockchainTransactionHash ?? existing.blockchainTxHash,
      recordHash: audit.recordHash,
      blockNumber: audit.blockNumber ?? existing.blockNumber,
      network: audit.network ?? existing.network,
      updatedAt: new Date(),
    })
    .where(eq(certificates.id, existing.id));

  return {
    id: existing.id,
    certificateNumber: existing.certificateNumber,
    ...audit,
  };
}

export async function voidCertificate(certificateId: string, reason: string) {
  const db = getDb();
  const actor = await ensureCurrentDbUser();

  const existing = await db.query.certificates.findFirst({
    where: eq(certificates.id, certificateId),
  });

  if (!existing) {
    throw new Error("Certificate not found.");
  }

  const previousHash = existing.recordHash ?? ZERO_HASH;

  const schoolYear = existing.schoolYearId
    ? await db.query.schoolYears.findFirst({ where: eq(schoolYears.id, existing.schoolYearId) })
    : undefined;

  const audit = await recordAuditedAction({
    referenceType: "certificate",
    referenceId: existing.certificateNumber,
    action: "Certificate voided",
    actorRole: actor?.role ?? "admin",
    actorUserId: actor?.id,
    entityType: "certificate",
    entityId: existing.id,
    metadata: {
      reason,
      previousHash,
    },
    hashMetadata: {
      certificateNumber: existing.certificateNumber,
      studentId: existing.studentId ?? "",
      schoolYear: schoolYear?.name ?? "",
    },
    eventType: "CERTIFICATE_VOIDED",
    previousRecordHash: previousHash,
  });

  await db
    .update(certificates)
    .set({
      recordHash: audit.recordHash,
      updatedAt: new Date(),
    })
    .where(eq(certificates.id, existing.id));

  return {
    id: existing.id,
    certificateNumber: existing.certificateNumber,
    ...audit,
  };
}
