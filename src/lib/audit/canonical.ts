export interface CanonicalCertificate {
  certificateNumber: string;
  studentId: string;
  schoolYear: string;
}

export interface CanonicalDocumentRequest {
  trackingNumber: string;
  documentType: string;
  status: string;
  schoolYearNeeded: string | null;
  gradeLevelNeeded: string | null;
}

export interface CanonicalStatusChange {
  referenceId: string;
  fromStatus: string;
  toStatus: string;
  actorRole: string;
}

function normalizeString(str: string | null): string | null {
  if (!str) return null;
  return str.trim().replace(/\s+/g, " ").toLowerCase();
}

export function buildCanonicalCertificate(data: {
  certificateNumber: string;
  studentId: string;
  schoolYear: string;
}): CanonicalCertificate {
  return {
    certificateNumber: data.certificateNumber,
    studentId: data.studentId,
    schoolYear: data.schoolYear,
  };
}

export function buildCanonicalDocumentRequest(data: {
  trackingNumber: string;
  documentType: string;
  status: string;
  schoolYearNeeded: string | null;
  gradeLevelNeeded: string | null;
}): CanonicalDocumentRequest {
  return {
    trackingNumber: data.trackingNumber,
    documentType: normalizeString(data.documentType) || "",
    status: normalizeString(data.status) || "",
    schoolYearNeeded: normalizeString(data.schoolYearNeeded),
    gradeLevelNeeded: normalizeString(data.gradeLevelNeeded),
  };
}

export function buildCanonicalStatusChange(data: {
  referenceId: string;
  fromStatus: string;
  toStatus: string;
  actorRole: string;
}): CanonicalStatusChange {
  return {
    referenceId: data.referenceId,
    fromStatus: normalizeString(data.fromStatus) || "",
    toStatus: normalizeString(data.toStatus) || "",
    actorRole: normalizeString(data.actorRole) || "",
  };
}