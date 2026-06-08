import { randomBytes } from "crypto";
import { eq, desc } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { getDb } from "@/db";
import {
  certificates,
  documentRequests,
  documentTypes,
  notifications,
  schoolYears,
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

function certificateNumber() {
  return `COG-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Math.random()
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
      certificateNumber: certificateNumber(),
      requestId: request?.id,
      studentId: student.id,
      certificateType: values.certificateType,
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
    action: "Certificate of Grades generated",
    actorRole: actor?.role ?? "registrar",
    actorUserId: actor?.id,
    entityType: "certificate",
    entityId: created.id,
    metadata: {
      requestId: request?.id,
      documentType: docType?.name ?? values.certificateType,
      schoolYear: schoolYear?.name,
    },
    hashMetadata: {
      certificateNumber: created.certificateNumber,
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
      message: `${created.certificateNumber} has been generated and is ready for registrar review.`,
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
    documentType: values.certificateType,
    status: "certificate_generated",
    subject: `LANHS DRMS certificate generated: ${created.certificateNumber}`,
    instruction: "Your Certificate of Grades has been generated. Scan the QR code on the PDF to verify authenticity.",
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
      gradeLevel: students.gradeLevelId,
      section: students.sectionId,
    })
    .from(certificates)
    .leftJoin(students, eq(certificates.studentId, students.id))
    .leftJoin(schoolYears, eq(certificates.schoolYearId, schoolYears.id))
    .where(eq(certificates.id, certificateId))
    .limit(1);

  const certificate = row[0];
  if (!certificate) {
    throw new Error("Certificate was not found.");
  }

  const grades = await getCertificateGradeRows(certificateId);
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const red = rgb(0.725, 0.109, 0.109);
  const dark = rgb(0.067, 0.094, 0.153);
  const muted = rgb(0.42, 0.45, 0.5);

  page.drawCircle({ x: 80, y: 775, size: 34, color: rgb(1, 1, 1), borderColor: red, borderWidth: 3 });
  page.drawText("LANHS", { x: 54, y: 770, size: 13, font: bold, color: red });
  page.drawText("Republic of the Philippines", { x: 140, y: 790, size: 10, font: regular, color: muted });
  page.drawText("Department of Education", { x: 140, y: 775, size: 11, font: bold, color: dark });
  page.drawText(SCHOOL_NAME, { x: 140, y: 758, size: 16, font: bold, color: red });
  page.drawText(SCHOOL_ADDRESS, { x: 140, y: 742, size: 9, font: regular, color: muted });
  page.drawLine({ start: { x: 50, y: 720 }, end: { x: 545, y: 720 }, thickness: 1.5, color: red });

  page.drawText("CERTIFICATE OF GRADES", { x: 168, y: 680, size: 18, font: bold, color: dark });
  page.drawText(`Certificate No.: ${certificate.certificateNumber}`, { x: 50, y: 645, size: 10, font: regular, color: dark });
  page.drawText(`Date Generated: ${formatDate(certificate.generatedAt)}`, { x: 365, y: 645, size: 10, font: regular, color: dark });

  const name = [certificate.firstName, certificate.middleName, certificate.lastName, certificate.suffix].filter(Boolean).join(" ");
  page.drawText(`This certifies that ${name || "the student"} has the following grade records:`, {
    x: 50,
    y: 612,
    size: 11,
    font: regular,
    color: dark,
  });
  page.drawText(`LRN: ${certificate.lrn ?? "Not set"}`, { x: 50, y: 590, size: 10, font: regular, color: dark });
  page.drawText(`School Year: ${certificate.schoolYear ?? "Not set"}`, { x: 300, y: 590, size: 10, font: regular, color: dark });

  const tableTop = 552;
  const columns = [
    { label: "Subject", x: 55 },
    { label: "Q1", x: 275 },
    { label: "Q2", x: 315 },
    { label: "Q3", x: 355 },
    { label: "Q4", x: 395 },
    { label: "Final", x: 438 },
    { label: "Remarks", x: 490 },
  ];

  page.drawRectangle({ x: 50, y: tableTop, width: 495, height: 24, color: red });
  for (const column of columns) {
    page.drawText(column.label, { x: column.x, y: tableTop + 8, size: 9, font: bold, color: rgb(1, 1, 1) });
  }

  let y = tableTop - 22;
  for (const grade of grades.slice(0, 16)) {
    page.drawText(grade.subject.slice(0, 36), { x: 55, y, size: 8, font: regular, color: dark });
    page.drawText(String(grade.quarter1 ?? ""), { x: 277, y, size: 8, font: regular, color: dark });
    page.drawText(String(grade.quarter2 ?? ""), { x: 317, y, size: 8, font: regular, color: dark });
    page.drawText(String(grade.quarter3 ?? ""), { x: 357, y, size: 8, font: regular, color: dark });
    page.drawText(String(grade.quarter4 ?? ""), { x: 397, y, size: 8, font: regular, color: dark });
    page.drawText(String(grade.finalGrade), { x: 443, y, size: 8, font: bold, color: dark });
    page.drawText(grade.remarks.slice(0, 10), { x: 490, y, size: 8, font: regular, color: dark });
    page.drawLine({ start: { x: 50, y: y - 6 }, end: { x: 545, y: y - 6 }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
    y -= 20;
  }

  const numericGrades = grades.map((grade) => Number(grade.finalGrade)).filter(Number.isFinite);
  const average = numericGrades.length
    ? (numericGrades.reduce((sum, grade) => sum + grade, 0) / numericGrades.length).toFixed(2)
    : "Not available";
  page.drawText(`General Average: ${average}`, { x: 50, y: 185, size: 11, font: bold, color: dark });
  page.drawText("Remarks: This certificate is generated from validated LANHS DRMS records.", {
    x: 50,
    y: 165,
    size: 9,
    font: regular,
    color: muted,
  });

  page.drawLine({ start: { x: 70, y: 102 }, end: { x: 215, y: 102 }, thickness: 0.8, color: dark });
  page.drawText("Registrar", { x: 112, y: 88, size: 9, font: regular, color: muted });
  page.drawLine({ start: { x: 300, y: 102 }, end: { x: 465, y: 102 }, thickness: 0.8, color: dark });
  page.drawText("School Head / Principal", { x: 338, y: 88, size: 9, font: regular, color: muted });

  const qrDataUrl = await QRCode.toDataURL(certificate.qrCodeData, { margin: 1, width: 110 });
  const qrImage = await pdf.embedPng(Buffer.from(qrDataUrl.split(",")[1] ?? "", "base64"));
  page.drawImage(qrImage, { x: 465, y: 132, width: 68, height: 68 });
  page.drawText("Scan to verify", { x: 468, y: 120, size: 8, font: bold, color: red });
  page.drawText(certificate.qrCodeData, { x: 50, y: 42, size: 7, font: regular, color: muted });
  page.drawText("This QR code can be scanned to verify certificate authenticity.", {
    x: 50,
    y: 28,
    size: 8,
    font: regular,
    color: muted,
  });

  return Buffer.from(await pdf.save());
}
