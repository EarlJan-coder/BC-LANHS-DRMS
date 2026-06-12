import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { eq, desc } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont, PDFImage, PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { getDb } from "@/db";
import {
  certificates,
  documentRequests,
  documentTypes,
  gradeLevels,
  notifications,
  schoolYears,
  sections,
  studentGrades,
  students,
  subjects,
  users,
} from "@/db/schema";
import { ensureCurrentDbUser } from "@/lib/auth";
import { SCHOOL_ADDRESS, SCHOOL_NAME } from "@/lib/constants";
import { sendWorkflowEmail } from "@/lib/email";
import type { CertificateVerificationView, CertificateView, GradeRecordView } from "@/lib/types";
import { certificateGenerateSchema } from "@/lib/validators";
import { recordAuditedAction } from "./audit-log";

const LOGO_PATH = join(process.cwd(), "public", "lanhs-logo.png");
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const BRAND_RED = rgb(0.725, 0.109, 0.109);
const DARK_TEXT = rgb(0.067, 0.094, 0.153);
const MUTED_TEXT = rgb(0.42, 0.45, 0.5);
const LIGHT_BORDER = rgb(0.9, 0.9, 0.9);

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

  return `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Math.random()
    .toString(36)
    .slice(2, 7)
    .toUpperCase()}`;
}

function verificationCode() {
  return randomBytes(16).toString("hex");
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function formatDate(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 10) : "Not set";
}

async function embedSchoolLogo(pdf: PDFDocument) {
  try {
    return await pdf.embedPng(await readFile(LOGO_PATH));
  } catch {
    return null;
  }
}

function drawCenteredText(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = DARK_TEXT) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: Math.max(50, (PAGE_WIDTH - width) / 2),
    y,
    size,
    font,
    color,
  });
}

function drawWrappedText(
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

  for (const currentLine of lines) {
    page.drawText(currentLine, { x, y, size, font, color });
    y -= lineHeight;
  }

  return y;
}

function drawCertificateHeader(page: PDFPage, logo: PDFImage | null, regular: PDFFont, bold: PDFFont) {
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

async function drawCertificateFooter(pdf: PDFDocument, page: PDFPage, qrCodeData: string, regular: PDFFont, bold: PDFFont) {
  page.drawLine({ start: { x: 70, y: 102 }, end: { x: 215, y: 102 }, thickness: 0.8, color: DARK_TEXT });
  page.drawText("Registrar", { x: 112, y: 88, size: 9, font: regular, color: MUTED_TEXT });
  page.drawLine({ start: { x: 300, y: 102 }, end: { x: 465, y: 102 }, thickness: 0.8, color: DARK_TEXT });
  page.drawText("School Head / Principal", { x: 338, y: 88, size: 9, font: regular, color: MUTED_TEXT });

  const qrDataUrl = await QRCode.toDataURL(qrCodeData, { margin: 1, width: 110 });
  const qrImage = await pdf.embedPng(Buffer.from(qrDataUrl.split(",")[1] ?? "", "base64"));
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

function isCertificateOfGrades(type: string) {
  return type.toLowerCase().includes("certificate of grades");
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

function studentFullName(row: {
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
}) {
  return [row.firstName, row.middleName, row.lastName, row.suffix].filter(Boolean).join(" ");
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
      certificateType,
      schoolYear: schoolYear?.name,
    },
  });

  await db
    .update(certificates)
    .set({
      blockchainTxHash: audit.blockchainTransactionHash ?? undefined,
      recordHash: audit.recordHash,
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

export async function getCertificateGradeRows(certificateId: string): Promise<GradeRecordView[]> {
  const db = getDb();
  const certificate = await db.query.certificates.findFirst({
    where: eq(certificates.id, certificateId),
  });

  if (!certificate?.studentId) {
    return [];
  }

  const rows = await db
    .select({
      id: studentGrades.id,
      quarter1: studentGrades.quarter1,
      quarter2: studentGrades.quarter2,
      quarter3: studentGrades.quarter3,
      quarter4: studentGrades.quarter4,
      finalGrade: studentGrades.finalGrade,
      remarks: studentGrades.remarks,
      subject: subjects.name,
      subjectCode: subjects.code,
      schoolYear: schoolYears.name,
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      suffix: students.suffix,
    })
    .from(studentGrades)
    .leftJoin(subjects, eq(studentGrades.subjectId, subjects.id))
    .leftJoin(schoolYears, eq(studentGrades.schoolYearId, schoolYears.id))
    .leftJoin(students, eq(studentGrades.studentId, students.id))
    .where(eq(studentGrades.studentId, certificate.studentId))
    .orderBy(subjects.name);

  return rows.map((row) => ({
    id: row.id,
    studentName: [row.firstName, row.middleName, row.lastName, row.suffix].filter(Boolean).join(" ") || "Unknown student",
    subject: row.subject ?? "Unknown subject",
    subjectCode: row.subjectCode ?? "",
    quarter1: row.quarter1 ?? "",
    quarter2: row.quarter2 ?? "",
    quarter3: row.quarter3 ?? "",
    quarter4: row.quarter4 ?? "",
    finalGrade: row.finalGrade ?? "Not set",
    remarks: row.remarks ?? "Not set",
    schoolYear: row.schoolYear ?? "Not set",
  }));
}

export async function generateCertificatePdf(certificateId: string) {
  const db = getDb();
  const row = await db
    .select({
      id: certificates.id,
      certificateNumber: certificates.certificateNumber,
      certificateType: certificates.certificateType,
      qrCodeData: certificates.qrCodeData,
      generatedAt: certificates.generatedAt,
      schoolYear: schoolYears.name,
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      suffix: students.suffix,
      lrn: students.lrn,
      gradeLevel: gradeLevels.name,
      section: sections.name,
      trackingNumber: documentRequests.trackingNumber,
      requestPurpose: documentRequests.purpose,
      requestSchoolYearNeeded: documentRequests.schoolYearNeeded,
      requestGradeLevelNeeded: documentRequests.gradeLevelNeeded,
    })
    .from(certificates)
    .leftJoin(students, eq(certificates.studentId, students.id))
    .leftJoin(gradeLevels, eq(students.gradeLevelId, gradeLevels.id))
    .leftJoin(sections, eq(students.sectionId, sections.id))
    .leftJoin(documentRequests, eq(certificates.requestId, documentRequests.id))
    .leftJoin(schoolYears, eq(certificates.schoolYearId, schoolYears.id))
    .where(eq(certificates.id, certificateId))
    .limit(1);

  const certificate = row[0];
  if (!certificate) {
    throw new Error("Certificate was not found.");
  }

  const isCog = isCertificateOfGrades(certificate.certificateType);
  const grades = isCog ? await getCertificateGradeRows(certificateId) : [];
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await embedSchoolLogo(pdf);
  const name = [certificate.firstName, certificate.middleName, certificate.lastName, certificate.suffix].filter(Boolean).join(" ");
  const schoolYear = certificate.schoolYear ?? certificate.requestSchoolYearNeeded ?? "Not set";
  const gradeLevel = certificate.gradeLevel ?? certificate.requestGradeLevelNeeded ?? "Not set";
  const section = certificate.section ?? "Not set";
  const purpose = certificate.requestPurpose ?? "school record validation";
  const title = formalTitle(certificate.certificateType);
  const titleSize = title.length > 42 ? 13 : title.length > 32 ? 15 : 18;

  drawCertificateHeader(page, logo, regular, bold);
  drawCenteredText(page, title, 680, bold, titleSize);
  page.drawText(`Certificate No.: ${certificate.certificateNumber}`, { x: 50, y: 645, size: 10, font: regular, color: DARK_TEXT });
  page.drawText(`Date Generated: ${formatDate(certificate.generatedAt)}`, { x: 365, y: 645, size: 10, font: regular, color: DARK_TEXT });
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

  if (isCog) {
    page.drawText(`This certifies that ${name || "the student"} has the following grade records:`, {
      x: 50,
      y: 542,
      size: 11,
      font: regular,
      color: DARK_TEXT,
    });

    const tableTop = 514;
    const columns = [
      { label: "Subject", x: 55 },
      { label: "Q1", x: 275 },
      { label: "Q2", x: 315 },
      { label: "Q3", x: 355 },
      { label: "Q4", x: 395 },
      { label: "Final", x: 438 },
      { label: "Remarks", x: 490 },
    ];

    page.drawRectangle({ x: 50, y: tableTop, width: 495, height: 24, color: BRAND_RED });
    for (const column of columns) {
      page.drawText(column.label, { x: column.x, y: tableTop + 8, size: 9, font: bold, color: rgb(1, 1, 1) });
    }

    let y = tableTop - 22;
    for (const grade of grades.slice(0, 14)) {
      page.drawText(grade.subject.slice(0, 36), { x: 55, y, size: 8, font: regular, color: DARK_TEXT });
      page.drawText(String(grade.quarter1 ?? ""), { x: 277, y, size: 8, font: regular, color: DARK_TEXT });
      page.drawText(String(grade.quarter2 ?? ""), { x: 317, y, size: 8, font: regular, color: DARK_TEXT });
      page.drawText(String(grade.quarter3 ?? ""), { x: 357, y, size: 8, font: regular, color: DARK_TEXT });
      page.drawText(String(grade.quarter4 ?? ""), { x: 397, y, size: 8, font: regular, color: DARK_TEXT });
      page.drawText(String(grade.finalGrade), { x: 443, y, size: 8, font: bold, color: DARK_TEXT });
      page.drawText(grade.remarks.slice(0, 10), { x: 490, y, size: 8, font: regular, color: DARK_TEXT });
      page.drawLine({ start: { x: 50, y: y - 6 }, end: { x: 545, y: y - 6 }, thickness: 0.5, color: LIGHT_BORDER });
      y -= 20;
    }

    const numericGrades = grades.map((grade) => Number(grade.finalGrade)).filter(Number.isFinite);
    const average = numericGrades.length
      ? (numericGrades.reduce((sum, grade) => sum + grade, 0) / numericGrades.length).toFixed(2)
      : "Not available";
    page.drawText(`General Average: ${average}`, { x: 50, y: 185, size: 11, font: bold, color: DARK_TEXT });
    page.drawText("Remarks: This certificate is generated from validated LANHS DRMS grade records.", {
      x: 50,
      y: 165,
      size: 9,
      font: regular,
      color: MUTED_TEXT,
    });
  } else {
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
  }

  await drawCertificateFooter(pdf, page, certificate.qrCodeData, regular, bold);

  return Buffer.from(await pdf.save());
}
