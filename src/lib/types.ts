import type { RequestStatus, UserRole } from "@/db/schema";

export type StatCard = {
  label: string;
  value: string;
  helper: string;
  tone: "red" | "rose" | "slate" | "emerald" | "amber" | "sky";
};

export type DashboardRole = "student" | "registrar" | "admin";
export type RegistrationStatus = "pending" | "approved" | "declined";

export type PendingRegistrationView = {
  id: string;
  name: string;
  email: string;
  lrn: string;
  createdAt: string;
};

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
  registrationStatus: RegistrationStatus;
  lrn: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  name: string;
  email: string;
  phone: string;
  contactNumber: string;
  address: string;
  lastSchoolYearAttended: string;
  status: string;
  hasLinkedRecords: boolean;
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
  description: string;
  requirements: string[];
  processingDays: number;
  fee: number;
  isActive: boolean;
  status: string;
};

export type StudentProfileView = {
  name: string;
  email: string;
  lrn: string;
  contactNumber: string;
  address: string;
  lastSchoolYearAttended: string;
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
