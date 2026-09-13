export interface CanonicalCertificate {
  certificateNumber: string;
  studentId: string;
  schoolYear: string;
  grades: CanonicalGrade[];
}

export interface CanonicalGrade {
  subjectCode: string;
  quarter1: string | null;
  quarter2: string | null;
  quarter3: string | null;
  quarter4: string | null;
  finalGrade: string | null;
  remarks: string | null;
}

export interface CanonicalDocumentRequest {
  trackingNumber: string;
  documentType: string;
  status: string;
  schoolYearNeeded: string | null;
  gradeLevelNeeded: string | null;
}

export interface CanonicalGradeBatch {
  batchNumber: string;
  fileName: string;
  schoolYear: string;
  savedRows: number;
  unmatchedRows: number;
}

export interface CanonicalStatusChange {
  referenceId: string;
  fromStatus: string;
  toStatus: string;
  actorRole: string;
}

function normalizeNumber(num: number | string | null): string | null {
  if (num === null || num === undefined) return null;
  const n = typeof num === "string" ? parseFloat(num) : num;
  return Number.isFinite(n) ? n.toFixed(2) : null;
}

function normalizeString(str: string | null): string | null {
  if (!str) return null;
  return str.trim().replace(/\s+/g, " ").toLowerCase();
}

function sortByKey<T>(arr: T[], keyFn: ((item: T) => string) | keyof T): T[] {
  const accessor = typeof keyFn === "function" ? keyFn : (item: T) => String(item[keyFn]);
  return [...arr].sort((a, b) => accessor(a).localeCompare(accessor(b)));
}

export function buildCanonicalCertificate(data: {
  certificateNumber: string;
  studentId: string;
  schoolYear: string;
  grades: Array<{
    subjectCode: string;
    quarter1: number | string | null;
    quarter2: number | string | null;
    quarter3: number | string | null;
    quarter4: number | string | null;
    finalGrade: number | string | null;
    remarks: string | null;
  }>;
}): CanonicalCertificate {
  return {
    certificateNumber: data.certificateNumber,
    studentId: data.studentId,
    schoolYear: data.schoolYear,
    grades: sortByKey(
      data.grades.map((g) => ({
        subjectCode: normalizeString(g.subjectCode) || "",
        quarter1: normalizeNumber(g.quarter1),
        quarter2: normalizeNumber(g.quarter2),
        quarter3: normalizeNumber(g.quarter3),
        quarter4: normalizeNumber(g.quarter4),
        finalGrade: normalizeNumber(g.finalGrade),
        remarks: normalizeString(g.remarks),
      })),
      "subjectCode"
    ),
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

export function buildCanonicalGradeBatch(data: {
  batchNumber: string;
  fileName: string;
  schoolYear: string;
  savedRows: number;
  unmatchedRows: number;
}): CanonicalGradeBatch {
  return {
    batchNumber: data.batchNumber,
    fileName: data.fileName,
    schoolYear: data.schoolYear,
    savedRows: data.savedRows,
    unmatchedRows: data.unmatchedRows,
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