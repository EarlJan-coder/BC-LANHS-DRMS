import { randomBytes } from "node:crypto";
import { count, eq, desc, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  certificates,
  documentRequests,
  documentTypes,
  notifications,
  students,
  users,
} from "@/db/schema";
import { ensureCurrentDbUser } from "@/lib/auth";
import { certificateHashMetadata } from "@/lib/audit/canonical";
import { SCHOOL_NAME } from "@/lib/constants";
import { sendWorkflowEmail } from "@/lib/email";
import type { CertificateVerificationView, CertificateView } from "@/lib/types";
import { makePaged, PAGE_SIZE, type Paged } from "@/lib/pagination";
import { AppError, composeGradeValue, formatDate, generatePrefixedId, studentFullName, ZERO_HASH } from "@/lib/utils";
import { certificateGenerateSchema } from "@/lib/validators";
import { recordAuditedAction } from "./audit-log";
import { getDocumentSignatoryTemplate } from "./document-signatory-template";
import { getDocumentTemplateWording } from "./document-template-wording";
import { getDocumentTypeTemplate } from "./document-type-templates";
import {
  manilaDateParts,
  pickCertificateTemplate,
  renderCertificatePdf,
} from "./certificate-renderer";
import { appUrl } from "./pdf-brand";

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

export interface CertificateDisplayRow {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  suffix: string | null;
  gradeLevel: string | null;
  strand: string | null;
  section: string | null;
  requestPurpose: string | null;
  generatedAt: Date;
  overrideStudentName: string | null;
  overrideGradeLevel: string | null;
  overrideStrand: string | null;
  overrideSection: string | null;
  overridePurpose: string | null;
  overrideDateGenerated: Date | null;
  overrideRegistrarName: string | null;
  overridePrincipalName: string | null;
}

export interface CertificateDisplayFields {
  name: string;
  gradeLevel: string;
  strand: string;
  section: string;
  purpose: string;
  dateGenerated: Date;
  /** Typed per certificate; "" prints no name above the signature line. */
  registrarName: string;
  principalName: string;
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
    strand: effectiveOverride(row.overrideStrand) ?? row.strand ?? "",
    section: effectiveOverride(row.overrideSection) ?? row.section ?? "",
    purpose: effectiveOverride(row.overridePurpose) ?? row.requestPurpose ?? "",
    dateGenerated: row.overrideDateGenerated ?? row.generatedAt,
    // Signatory names have no live record value: a blank override simply
    // prints no name above the signature line.
    registrarName: effectiveOverride(row.overrideRegistrarName) ?? "",
    principalName: effectiveOverride(row.overridePrincipalName) ?? "",
  };
}

function formalTitle(type: string) {
  return type.toUpperCase().replaceAll("-", " ");
}

/** Form 137 is a DepEd hardcopy record — the school never issues a
 * certificate for it (no template exists; the document itself only lives on
 * DepEd forms). Matches by document-type name, the same name-based routing
 * the rest of this file uses. */
export function isForm137DocumentType(name: string | null | undefined): boolean {
  return (name ?? "").toLowerCase().includes("form 137");
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

/** True once any certificate row exists for the request; gates the generate button. */
export async function hasCertificateForRequest(requestId: string): Promise<boolean> {
  const rows = await getDb()
    .select({ id: certificates.id })
    .from(certificates)
    .where(eq(certificates.requestId, requestId))
    .limit(1);
  return rows.length > 0;
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
  if (!request) {
    throw new Error("Document request was not found.");
  }

  const docType = request.documentTypeId
    ? await db.query.documentTypes.findFirst({
        where: eq(documentTypes.id, request.documentTypeId),
      })
    : undefined;
  // Refuse before any record, audit, or email work happens. The approval
  // flow skips this call for Form 137 entirely; this guard is what stops
  // a direct POST /api/certificates.
  if (isForm137DocumentType(docType?.name) || isForm137DocumentType(values.certificateType)) {
    throw new AppError("Form 137 is a DepEd hardcopy record; no certificate is generated for it.", 422);
  }

  const studentId = request.studentId;

  if (!studentId) {
    throw new Error("A linked student record is required before generating a certificate.");
  }

  const student = await db.query.students.findFirst({
    where: eq(students.id, studentId),
  });

  if (!student) {
    throw new Error("Student record was not found.");
  }

  const certificateType = values.certificateType ?? docType?.name ?? "School Certificate";
  const schoolYear = request?.schoolYearNeeded ?? "";

  const code = verificationCode();
  const verifyUrl = `${appUrl()}/verify-certificate/${code}`;
  const [created] = await db
    .insert(certificates)
    .values({
      certificateNumber: certificateNumber(certificateType),
      requestId: request?.id,
      studentId: student.id,
      certificateType,
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
      schoolYear,
    },
    hashMetadata: certificateHashMetadata({
      certificateNumber: created.certificateNumber,
      studentId: student.id,
      schoolYearNeeded: request?.schoolYearNeeded ?? null,
    }),
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
      message: "Certificate · Generated",
      referenceType: "certificate",
      referenceId: created.id,
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

export function listCertificateViews(options: { page: number; pageSize?: number }): Promise<Paged<CertificateView>>;
export function listCertificateViews(options?: number | { all?: true }): Promise<CertificateView[]>;
export async function listCertificateViews(options: number | { page?: number; pageSize?: number; all?: true } = 100): Promise<CertificateView[] | Paged<CertificateView>> {
  const db = getDb();
  const baseQuery = db
    .select({
      id: certificates.id,
      requestId: certificates.requestId,
      certificateNumber: certificates.certificateNumber,
      certificateType: certificates.certificateType,
      verificationCode: certificates.verificationCode,
      blockchainTxHash: certificates.blockchainTxHash,
      generatedAt: certificates.generatedAt,
      schoolYearNeeded: documentRequests.schoolYearNeeded,
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      suffix: students.suffix,
    })
    .from(certificates)
    .leftJoin(students, eq(certificates.studentId, students.id))
    .leftJoin(documentRequests, eq(certificates.requestId, documentRequests.id))
    .orderBy(desc(certificates.createdAt));
  let rows: Awaited<typeof baseQuery>;
  let total = 0;
  if (typeof options === "object" && options.page !== undefined) {
    const [row] = await db.select({ value: count() }).from(certificates);
    total = Number(row?.value ?? 0);
    const pageSize = options.pageSize ?? PAGE_SIZE;
    const page = makePaged([], total, options.page, pageSize).page;
    rows = await baseQuery.limit(pageSize).offset((page - 1) * pageSize);
  } else if (typeof options === "object" && options.all) {
    rows = await baseQuery;
  } else {
    rows = await baseQuery.limit(typeof options === "number" ? options : 100);
  }

  const views = rows.map((row) => ({
    id: row.id,
    requestId: row.requestId,
    certificateNumber: row.certificateNumber,
    certificateType: row.certificateType,
    studentName: [row.firstName, row.middleName, row.lastName, row.suffix].filter(Boolean).join(" ") || "Unknown student",
    schoolYear: row.schoolYearNeeded ?? "Not set",
    verificationCode: row.verificationCode,
    verificationUrl: `${appUrl()}/verify-certificate/${row.verificationCode}`,
    blockchainStatus: row.blockchainTxHash ? "submitted" : "pending",
    blockchainTxHash: row.blockchainTxHash ?? "Pending",
    generatedAt: formatDate(row.generatedAt),
  }));
  if (typeof options === "object" && options.page !== undefined) return makePaged(views, total, options.page, options.pageSize);
  return views;
}

export async function getCertificateView(id: string) {
  const rows = await getDb()
    .select({
      id: certificates.id,
      requestId: certificates.requestId,
      certificateNumber: certificates.certificateNumber,
      certificateType: certificates.certificateType,
      verificationCode: certificates.verificationCode,
      blockchainTxHash: certificates.blockchainTxHash,
      generatedAt: certificates.generatedAt,
      schoolYearNeeded: documentRequests.schoolYearNeeded,
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      suffix: students.suffix,
    })
    .from(certificates)
    .leftJoin(students, eq(certificates.studentId, students.id))
    .leftJoin(documentRequests, eq(certificates.requestId, documentRequests.id))
    .where(
      or(
        sql`${certificates.id}::text = ${id}`,
        eq(certificates.certificateNumber, id),
        eq(certificates.verificationCode, id),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    requestId: row.requestId,
    certificateNumber: row.certificateNumber,
    certificateType: row.certificateType,
    studentName: [row.firstName, row.middleName, row.lastName, row.suffix].filter(Boolean).join(" ") || "Unknown student",
    schoolYear: row.schoolYearNeeded ?? "Not set",
    verificationCode: row.verificationCode,
    verificationUrl: `${appUrl()}/verify-certificate/${row.verificationCode}`,
    blockchainStatus: row.blockchainTxHash ? "submitted" : "pending",
    blockchainTxHash: row.blockchainTxHash ?? "Pending",
    generatedAt: formatDate(row.generatedAt),
  } satisfies CertificateView;
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
  strand: string;
  section: string;
  purpose: string;
  /** ISO timestamp of the effective "Date Generated" (override or record). */
  dateGenerated: string;
  /** Typed per certificate; "" prints no name above the signature line. */
  registrarName: string;
  principalName: string;
  hasOverride: {
    studentName: boolean;
    gradeLevel: boolean;
    strand: boolean;
    section: boolean;
    purpose: boolean;
    dateGenerated: boolean;
    registrarName: boolean;
    principalName: boolean;
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
      lrn: students.lrn,
      trackingNumber: documentRequests.trackingNumber,
      requestPurpose: documentRequests.purpose,
      requestSchoolYearNeeded: documentRequests.schoolYearNeeded,
      requestGradeLevelNeeded: documentRequests.gradeLevelNeeded,
      requestStrandNeeded: documentRequests.strandNeeded,
      requestSectionNeeded: documentRequests.sectionNeeded,
      requestDocumentTypeId: documentRequests.documentTypeId,
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      suffix: students.suffix,
      overrideStudentName: certificates.overrideStudentName,
      overrideGradeLevel: certificates.overrideGradeLevel,
      overrideStrand: certificates.overrideStrand,
      overrideSection: certificates.overrideSection,
      overridePurpose: certificates.overridePurpose,
      overrideDateGenerated: certificates.overrideDateGenerated,
      overrideRegistrarName: certificates.overrideRegistrarName,
      overridePrincipalName: certificates.overridePrincipalName,
    })
    .from(certificates)
    .leftJoin(students, eq(certificates.studentId, students.id))
    .leftJoin(documentRequests, eq(certificates.requestId, documentRequests.id))
    .leftJoin(documentTypes, eq(documentRequests.documentTypeId, documentTypes.id))
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
    gradeLevel: row.requestGradeLevelNeeded,
    strand: row.requestStrandNeeded,
    section: row.requestSectionNeeded,
    requestPurpose: row.requestPurpose,
    generatedAt: row.generatedAt,
    overrideStudentName: row.overrideStudentName,
    overrideGradeLevel: row.overrideGradeLevel,
    overrideStrand: row.overrideStrand,
    overrideSection: row.overrideSection,
    overridePurpose: row.overridePurpose,
    overrideDateGenerated: row.overrideDateGenerated,
    overrideRegistrarName: row.overrideRegistrarName,
    overridePrincipalName: row.overridePrincipalName,
  };
}

/** Current effective PDF content for the preview/edit form. Staff only. */
export async function getCertificateEditView(certificateId: string): Promise<CertificateEditView | null> {
  const row = await loadCertificateDisplayRow(certificateId);
  if (!row) {
    return null;
  }

  const fields = resolveCertificateDisplayFields(toDisplayRow(row));
  const template = await getDocumentSignatoryTemplate();
  const record = {
    studentName: [row.firstName, row.middleName, row.lastName, row.suffix].filter(Boolean).join(" "),
    gradeLevel: row.requestGradeLevelNeeded ?? "",
    strand: row.requestStrandNeeded ?? "",
    section: row.requestSectionNeeded ?? "",
    purpose: row.requestPurpose ?? "",
    dateGenerated: row.generatedAt,
  };

  return {
    id: row.id,
    certificateNumber: row.certificateNumber,
    studentName: fields.name,
    gradeLevel: fields.gradeLevel,
    strand: fields.strand,
    section: fields.section,
    purpose: fields.purpose,
    dateGenerated: fields.dateGenerated.toISOString(),
    registrarName: fields.registrarName || template.registrarName,
    principalName: fields.principalName || template.principalName,
    hasOverride: resolveCertificateEditFlags({ ...fields, studentName: fields.name }, record, template),
  };
}

/**
 * "Edited" means the printed value differs from what the record (or the admin
 * signatory template) would print with no override. A stored override that
 * matches the record prints the identical PDF, so it must not show a pill —
 * this also keeps full-form saves of the past from flagging every field.
 */
export function resolveCertificateEditFlags(
  effective: {
    studentName: string;
    gradeLevel: string;
    strand: string;
    section: string;
    purpose: string;
    dateGenerated: Date;
    registrarName: string;
    principalName: string;
  },
  record: {
    studentName: string;
    gradeLevel: string;
    strand: string;
    section: string;
    purpose: string;
    dateGenerated: Date;
  },
  template: { registrarName: string; principalName: string },
): CertificateEditView["hasOverride"] {
  return {
    studentName: effective.studentName !== record.studentName,
    gradeLevel: effective.gradeLevel !== record.gradeLevel,
    strand: effective.strand !== record.strand,
    section: effective.section !== record.section,
    purpose: effective.purpose !== record.purpose,
    dateGenerated: effective.dateGenerated.getTime() !== record.dateGenerated.getTime(),
    registrarName: effective.registrarName !== "" && effective.registrarName !== template.registrarName,
    principalName: effective.principalName !== "" && effective.principalName !== template.principalName,
  };
}

export async function generateCertificatePdf(certificateId: string) {
  const certificate = await loadCertificateDisplayRow(certificateId);
  if (!certificate) {
    throw new Error("Certificate was not found.");
  }

  const display = resolveCertificateDisplayFields(toDisplayRow(certificate));
  const signatories = await getDocumentSignatoryTemplate();
  const name = display.name;
  const schoolYear = certificate.requestSchoolYearNeeded ?? "";
  const gradeLevel = display.gradeLevel || "";
  const section = display.section || "";
  const purpose = display.purpose || "school record validation";
  const { day, monthYear } = manilaDateParts(display.dateGenerated);
  let template = pickCertificateTemplate(certificate.certificateType, gradeLevel);
  const wordingMap = await getDocumentTemplateWording();
  let wording = template ? wordingMap[template] : undefined;
  // Preserve the official certificate routing. Saved per-type wording applies
  // to custom document types that do not have a built-in certificate layout.
  if (!template && certificate.requestDocumentTypeId) {
    const custom = await getDocumentTypeTemplate(certificate.requestDocumentTypeId);
    if (custom) {
      template = custom.layoutKey;
      wording = custom.wording;
    }
  }

  return Buffer.from(
    await renderCertificatePdf({
      template,
      blanks: {
        name,
        grade: composeGradeValue(gradeLevel, display.strand || section),
        schoolYear,
        lrn: certificate.lrn ?? "",
        purpose,
        day,
        month: monthYear,
      },
      signatureNames: {
        registrarName: display.registrarName || signatories.registrarName,
        principalName: display.principalName || signatories.principalName,
      },
      genericTitle: formalTitle(certificate.certificateType),
      genericBody: genericCertificateText({
        certificateType: certificate.certificateType,
        name,
        lrn: certificate.lrn ?? "Not set",
        gradeLevel,
        section,
        schoolYear,
        purpose,
      }),
      wording,
      qrUrl: certificate.qrCodeData,
      certificateNumber: certificate.certificateNumber,
    }),
  );
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
      schoolYear: "",
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
      schoolYear: "",
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
