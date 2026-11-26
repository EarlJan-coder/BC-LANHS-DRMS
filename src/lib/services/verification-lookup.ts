import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { certificates, documentRequests, documentTypes, students, users } from "@/db/schema";
import { SCHOOL_NAME } from "@/lib/constants";
import { getRecordIndices } from "@/lib/blockchain/client";
import { verifyCertificateOnChain } from "@/lib/services/blockchain-verification";
import { formatDate, studentFullName } from "@/lib/utils";

export type PublicVerificationStatus = "valid" | "proof_pending" | "invalid" | "not_found";
export type PublicVerificationResult = {
  status: PublicVerificationStatus;
  certificateNumber?: string;
  studentName?: string;
  nameRole?: "student" | "requestor";
  documentType?: string;
  dateIssued?: string;
  issuingSchool: string;
  reason?: string;
};

type PublicResultInput = {
  found: boolean;
  certificateNumber: string | null;
  studentName: string | null;
  nameRole: "student" | "requestor";
  documentType: string | null;
  dateIssued: Date | null;
  proof: "match" | "mismatch" | "pending" | "none";
};

export function buildPublicVerificationResult(input: PublicResultInput): PublicVerificationResult {
  if (!input.found) return { status: "not_found", issuingSchool: SCHOOL_NAME };

  const status: PublicVerificationStatus = input.proof === "match"
    ? "valid"
    : input.proof === "mismatch"
      ? "invalid"
      : "proof_pending";

  return {
    status,
    ...(input.certificateNumber ? { certificateNumber: input.certificateNumber } : {}),
    ...(input.studentName ? { studentName: input.studentName, nameRole: input.nameRole } : {}),
    ...(input.documentType ? { documentType: input.documentType } : {}),
    ...(input.dateIssued ? { dateIssued: formatDate(input.dateIssued) } : {}),
    issuingSchool: SCHOOL_NAME,
    ...(status === "invalid" ? { reason: "The certificate details do not match the blockchain proof." } : {}),
  };
}

export async function verifyPublicReference(query: {
  certificateNumber?: string;
  trackingNumber?: string;
  code?: string;
}): Promise<PublicVerificationResult> {
  const db = getDb();
  const certificateColumns = {
    id: certificates.id,
    certificateNumber: certificates.certificateNumber,
    certificateType: certificates.certificateType,
    generatedAt: certificates.generatedAt,
    studentFirstName: students.firstName,
    studentMiddleName: students.middleName,
    studentLastName: students.lastName,
    studentSuffix: students.suffix,
    requestId: documentRequests.id,
    requestTrackingNumber: documentRequests.trackingNumber,
    requestSchoolYearNeeded: documentRequests.schoolYearNeeded,
    requestApprovedAt: documentRequests.approvedAt,
    requestDocumentType: documentTypes.name,
    requestorFirstName: users.firstName,
    requestorLastName: users.lastName,
  };
  let certificate: Awaited<ReturnType<typeof findCertificate>> | null = null;
  if (query.code?.trim()) certificate = await findCertificate(query.code.trim(), "code");
  if (!certificate && query.certificateNumber?.trim()) certificate = await findCertificate(query.certificateNumber.trim(), "number");
  if (!certificate && query.trackingNumber?.trim()) certificate = await findCertificateByTracking(query.trackingNumber.trim());

  if (certificate) {
    const studentName = certificate.studentFirstName
      ? studentFullName({
          firstName: certificate.studentFirstName,
          middleName: certificate.studentMiddleName,
          lastName: certificate.studentLastName ?? "",
          suffix: certificate.studentSuffix,
        })
      : certificate.requestorFirstName
        ? `${certificate.requestorFirstName} ${certificate.requestorLastName ?? ""}`.trim()
        : null;
    const nameRole = certificate.studentFirstName ? "student" : "requestor";
    const proofResult = await verifyCertificateOnChain(certificate.id);
    const proof = proofResult.blockchainVerified
      ? proofResult.valid ? "match" : "mismatch"
      : "pending";

    return buildPublicVerificationResult({
      found: true,
      certificateNumber: certificate.certificateNumber,
      studentName,
      nameRole,
      documentType: certificate.certificateType || certificate.requestDocumentType,
      dateIssued: certificate.generatedAt ?? certificate.requestApprovedAt,
      proof,
    });
  }

  if (query.trackingNumber?.trim()) {
    const request = await findRequest(query.trackingNumber.trim());
    if (request) {
      const requestStudentName = request.studentFirstName
        ? studentFullName({
            firstName: request.studentFirstName,
            middleName: request.studentMiddleName,
            lastName: request.studentLastName ?? "",
            suffix: request.studentSuffix,
          })
        : request.requestorFirstName
          ? `${request.requestorFirstName} ${request.requestorLastName ?? ""}`.trim()
          : null;
      const indices = await getRecordIndices("document_request", request.trackingNumber);
      return buildPublicVerificationResult({
        found: true,
        certificateNumber: null,
        studentName: requestStudentName,
        nameRole: request.studentFirstName ? "student" : "requestor",
        documentType: request.documentType,
        dateIssued: request.approvedAt,
        proof: indices.length > 0 ? "match" : "none",
      });
    }
  }

  return buildPublicVerificationResult({
    found: false,
    certificateNumber: null,
    studentName: null,
    nameRole: "student",
    documentType: null,
    dateIssued: null,
    proof: "none",
  });

  async function findCertificate(value: string, mode: "code" | "number") {
    const rows = await db.select(certificateColumns)
      .from(certificates)
      .leftJoin(students, eq(certificates.studentId, students.id))
      .leftJoin(documentRequests, eq(certificates.requestId, documentRequests.id))
      .leftJoin(documentTypes, eq(documentRequests.documentTypeId, documentTypes.id))
      .leftJoin(users, eq(documentRequests.requestedByUserId, users.id))
      .where(mode === "code" ? eq(certificates.verificationCode, value) : eq(certificates.certificateNumber, value))
      .limit(1);
    return rows[0] ?? null;
  }

  async function findCertificateByTracking(trackingNumber: string) {
    const rows = await db.select(certificateColumns)
      .from(certificates)
      .leftJoin(students, eq(certificates.studentId, students.id))
      .leftJoin(documentRequests, eq(certificates.requestId, documentRequests.id))
      .leftJoin(documentTypes, eq(documentRequests.documentTypeId, documentTypes.id))
      .leftJoin(users, eq(documentRequests.requestedByUserId, users.id))
      .where(eq(documentRequests.trackingNumber, trackingNumber))
      .limit(1);
    return rows[0] ?? null;
  }

  async function findRequest(trackingNumber: string) {
    const rows = await db.select({
      trackingNumber: documentRequests.trackingNumber,
      approvedAt: documentRequests.approvedAt,
      documentType: documentTypes.name,
      studentFirstName: students.firstName,
      studentMiddleName: students.middleName,
      studentLastName: students.lastName,
      studentSuffix: students.suffix,
      requestorFirstName: users.firstName,
      requestorLastName: users.lastName,
    }).from(documentRequests)
      .leftJoin(students, eq(documentRequests.studentId, students.id))
      .leftJoin(users, eq(documentRequests.requestedByUserId, users.id))
      .leftJoin(documentTypes, eq(documentRequests.documentTypeId, documentTypes.id))
      .where(eq(documentRequests.trackingNumber, trackingNumber))
      .limit(1);
    return rows[0] ?? null;
  }
}
