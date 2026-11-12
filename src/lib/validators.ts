import { z } from "zod";
import { requestStatusEnum } from "@/db/schema";

export const documentRequestSchema = z.object({
  documentType: z.string().min(2, "Select a document type."),
  purpose: z.string().min(10, "Please describe the request purpose in at least 10 characters."),
  gradeLevelNeeded: z.string().min(1, "Grade level needed is required."),
  sectionNeeded: z.string().trim().max(40, "Section must be 40 characters or fewer.").optional().default(""),
  remarks: z.string().optional(),
});

export const updateRequestStatusSchema = z.object({
  status: z.enum(requestStatusEnum.enumValues),
  remarks: z.string().optional(),
  registrarRemarks: z.string().optional(),
  rejectionReason: z.string().optional(),
});

// Student self-service profile edit. Address parts are composed server-side
// into students.address; each part is optional but must be non-blank when sent
// (the form sends all three together — the service rejects partial addresses).
export const profileUpdateSchema = z.object({
  contactNumber: z.string().trim().max(30).optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(191).optional(),
  lastSchoolYearAttended: z
    .string()
    .trim()
    .min(1, "Last school year attended is required.")
    .max(40, "Last school year attended must be 40 characters or fewer.")
    .optional(),
  addressCity: z.string().trim().min(1, "City is required.").max(100).optional(),
  addressBarangay: z.string().trim().min(1, "Barangay is required.").max(100).optional(),
  addressStreetLine: z.string().trim().min(1, "House no. / street is required.").max(500).optional(),
});

export const studentRecordSchema = z.object({
  lrn: z.string().trim().min(1, "LRN is required."),
  firstName: z.string().trim().min(1, "First name is required."),
  middleName: z.string().trim().optional(),
  lastName: z.string().trim().min(1, "Last name is required."),
  suffix: z.string().trim().optional(),
  email: z.union([z.string().trim().email("Enter a valid email address.").max(191), z.literal("")]).optional(),
  contactNumber: z.string().trim().optional(),
  address: z.string().trim().optional(),
  lastSchoolYearAttended: z.string().trim().max(40).optional(),
  enrollmentStatus: z.enum(["enrolled", "alumni", "transferred", "inactive"]).default("enrolled"),
  registrationStatus: z.enum(["pending", "approved", "declined"]).optional(),
  registrationNote: z.string().trim().max(2000).optional(),
});

export const certificateGenerateSchema = z.object({
  requestId: z.string().uuid(),
  certificateType: z.string().min(2).optional(),
});

// PDF content overrides for certificate preview/edit. Deliberately excludes
// school year / certificate number / type (blockchain hash inputs).
// Empty or whitespace-only strings clear the override (undefined = live value).
// registrarName / principalName are signatory names typed per certificate;
// clearing them prints no name above the signature line.
const overrideField = z
  .string()
  .transform((value) => (value.trim() === "" ? undefined : value.trim()))
  .optional();

// Signatory names are capped at their column width (200) so an over-long paste
// is rejected as a clean validation error instead of a raw database error.
const overrideSignatoryName = z
  .string()
  .max(200, "Signatory names must be 200 characters or fewer.")
  .transform((value) => (value.trim() === "" ? undefined : value.trim()))
  .optional();

export const certificateOverrideSchema = z.object({
  studentName: overrideField,
  gradeLevel: overrideField,
  section: overrideField,
  purpose: overrideField,
  registrarName: overrideSignatoryName,
  principalName: overrideSignatoryName,
  dateGenerated: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.coerce.date().optional(),
    )
    .optional(),
});

export type CertificateOverrideValues = z.infer<typeof certificateOverrideSchema>;

export const userRoleUpdateSchema = z.object({
  role: z.enum(["student", "registrar", "admin"]),
  status: z.enum(["active", "inactive", "suspended"]).optional(),
});

export const userCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(191),
  firstName: z.string().trim().min(1, "First name is required.").max(100),
  lastName: z.string().trim().min(1, "Last name is required.").max(100),
  role: z.enum(["registrar", "admin"]),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72),
});

export const userPasswordResetSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters.").max(72),
});

export const registrationDecisionSchema = z.object({
  decision: z.enum(["approved", "declined"]),
  note: z.string().trim().max(2000, "The note must be 2,000 characters or fewer.").default(""),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(72),
  newPassword: z.string().min(8, "Password must be at least 8 characters.").max(72),
});

const checkboxBoolean = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => value === true || value === "true" || value === "on" || value === "1");

export const documentTypeMutationSchema = z.object({
  name: z.string().trim().min(2, "Document type name is required.").max(120, "Document type name must be 120 characters or less."),
  code: z.string().trim().min(2, "Document type code is required.").max(40, "Document type code must be 40 characters or less.").transform((value) => value.toUpperCase()),
  description: z.string().trim().max(500, "Description must be 500 characters or less.").optional().default(""),
  requirements: z.array(z.string()).optional().default([]),
  processingDays: z.coerce.number().int("Processing days must be a whole number.").min(0).max(365).default(3),
  fee: z.coerce.number().min(0, "Fee must be a positive number.").max(999999.99).default(0),
  isActive: checkboxBoolean,
});
