import type { RequestStatus, UserRole } from "@/db/schema";

export type StatCard = {
  label: string;
  value: string;
  helper: string;
  tone: "red" | "rose" | "slate" | "emerald" | "amber" | "sky";
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
  accountLinked: boolean;
  lrn: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  name: string;
  contactNumber: string;
  address: string;
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

export type StudentProfileView = {
  name: string;
  email: string;
  lrn: string;
  contactNumber: string;
  address: string;
  hasStudentRecord: boolean;
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
