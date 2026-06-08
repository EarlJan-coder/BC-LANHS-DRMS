import type { RequestStatus, UserRole } from "@/db/schema";

export type StatCard = {
  label: string;
  value: string;
  helper: string;
  tone: "red" | "rose" | "slate" | "emerald" | "amber" | "sky";
};

export type NavigationItem = {
  label: string;
  href: string;
  icon: string;
};

export type DashboardRole = "student" | "registrar" | "admin";

export type DocumentRequestView = {
  id: string;
  trackingNumber: string;
  lrn?: string;
  studentName: string;
  documentType: string;
  purpose: string;
  schoolYearNeeded: string;
  gradeLevelNeeded: string;
  remarks: string;
  registrarRemarks: string;
  status: RequestStatus;
  requestedAt: string;
  updatedAt: string;
  blockchainStatus: "pending" | "submitted" | "failed" | "verified";
};

export type AuditTrailView = {
  id: string;
  action: string;
  referenceId: string;
  actorRole: string;
  hash: string;
  status: "not_required" | "pending" | "submitted" | "failed" | "verified";
  transactionHash: string;
  createdAt: string;
};

export type StudentView = {
  id: string;
  lrn: string;
  name: string;
  gradeLevel: string;
  section: string;
  status: string;
};

export type UserView = {
  id: string;
  name: string;
  email: string;
  role: string;
  rawRole: UserRole;
  status: string;
  rawStatus: string;
};

export type DocumentTypeView = {
  id: string;
  name: string;
  code: string;
  processingDays: number;
  status: string;
};

export type SchoolYearView = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  status: string;
};

export type GradeLevelView = {
  id: string;
  gradeLevel: string;
  sections: string;
  status: string;
};

export type SubjectView = {
  id: string;
  code: string;
  name: string;
  gradeLevel: string;
};

export type GradeRecordView = {
  id: string;
  studentId?: string;
  studentName: string;
  subject: string;
  subjectCode?: string;
  quarter1?: string;
  quarter2?: string;
  quarter3?: string;
  quarter4?: string;
  finalGrade: string;
  remarks: string;
  schoolYear: string;
};

export type StudentProfileView = {
  name: string;
  email: string;
  lrn: string;
  gradeAndSection: string;
  contactNumber: string;
  guardian: string;
  address: string;
};

export type GradeImportRow = {
  lrn: string;
  firstName: string;
  lastName: string;
  schoolYear: string;
  gradeLevel: string;
  section: string;
  subjectCode: string;
  subjectName: string;
  quarter1: number | null;
  quarter2: number | null;
  quarter3: number | null;
  quarter4: number | null;
  finalGrade: number | null;
  remarks: string;
};

export type GradeImportError = {
  rowNumber: number;
  fieldName: string;
  message: string;
  rawData?: Record<string, unknown>;
};

export type GradeImportValidation = {
  totalRows: number;
  validRows: GradeImportRow[];
  errors: GradeImportError[];
  duplicateKeys: string[];
};

export type CertificateView = {
  id: string;
  certificateNumber: string;
  certificateType: string;
  studentName: string;
  schoolYear: string;
  verificationCode: string;
  verificationUrl: string;
  blockchainStatus: string;
  blockchainTxHash: string;
  generatedAt: string;
};

export type CertificateVerificationView = {
  valid: boolean;
  certificateNumber?: string;
  studentDisplayName?: string;
  certificateType?: string;
  issuedAt?: string;
  issuingSchool?: string;
  blockchainTxHash?: string;
};
