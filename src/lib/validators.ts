import { z } from "zod";
import { requestStatusEnum } from "@/db/schema";

export const documentRequestSchema = z.object({
  documentType: z.string().min(2, "Select a document type."),
  purpose: z.string().min(10, "Please describe the request purpose in at least 10 characters."),
  schoolYearNeeded: z.string().min(1, "School year needed is required."),
  gradeLevelNeeded: z.string().min(1, "Grade level needed is required."),
  remarks: z.string().optional(),
});

export const updateRequestStatusSchema = z.object({
  status: z.enum(requestStatusEnum.enumValues),
  remarks: z.string().optional(),
  registrarRemarks: z.string().optional(),
  rejectionReason: z.string().optional(),
});

export const gradeImportCommitSchema = z.object({
  fileName: z.string().min(1),
  rows: z
    .array(
      z.object({
        lrn: z.string().min(1),
        firstName: z.string(),
        lastName: z.string(),
        schoolYear: z.string().min(1),
        gradeLevel: z.string().min(1),
        section: z.string().min(1),
        subjectCode: z.string().min(1),
        subjectName: z.string().min(1),
        quarter1: z.number().nullable(),
        quarter2: z.number().nullable(),
        quarter3: z.number().nullable(),
        quarter4: z.number().nullable(),
        finalGrade: z.number().nullable(),
        remarks: z.string(),
      }),
    )
    .min(1),
});

export const studentRecordSchema = z.object({
  lrn: z.string().trim().min(1, "LRN is required."),
  firstName: z.string().trim().min(1, "First name is required."),
  middleName: z.string().trim().optional(),
  lastName: z.string().trim().min(1, "Last name is required."),
  suffix: z.string().trim().optional(),
  contactNumber: z.string().trim().optional(),
  guardianName: z.string().trim().optional(),
  guardianContact: z.string().trim().optional(),
  address: z.string().trim().optional(),
  gradeLevelId: z.string().uuid().optional().or(z.literal("")),
  sectionId: z.string().uuid().optional().or(z.literal("")),
  enrollmentStatus: z.enum(["enrolled", "alumni", "transferred", "inactive"]).default("enrolled"),
});

export const certificateGenerateSchema = z.object({
  requestId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  schoolYearId: z.string().uuid().optional(),
  certificateType: z.string().min(2).optional(),
});

export const userRoleUpdateSchema = z.object({
  role: z.enum(["student", "alumni", "registrar", "admin"]),
  status: z.enum(["active", "inactive", "suspended"]).optional(),
});

const checkboxBoolean = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => value === true || value === "true" || value === "on" || value === "1");

export const schoolYearMutationSchema = z.object({
  name: z.string().trim().min(4, "School year is required.").max(30, "School year must be 30 characters or less."),
  startsOn: z.string().trim().optional().default(""),
  endsOn: z.string().trim().optional().default(""),
  isActive: checkboxBoolean,
});

export const gradeLevelMutationSchema = z.object({
  name: z.string().trim().min(2, "Grade level is required.").max(40, "Grade level must be 40 characters or less."),
  order: z.coerce.number().int("Sort order must be a whole number.").min(0).max(99).default(0),
  isActive: checkboxBoolean,
});

export const subjectMutationSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Subject code is required.")
    .max(40, "Subject code must be 40 characters or less.")
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2, "Subject name is required.").max(120, "Subject name must be 120 characters or less."),
  gradeLevelId: z.string().uuid().optional().or(z.literal("")),
  isActive: checkboxBoolean,
});

export const sectionMutationSchema = z.object({
  name: z.string().trim().min(1, "Section name is required.").max(80, "Section name must be 80 characters or less."),
  gradeLevelId: z.string().uuid("Select a grade level."),
  schoolYearId: z.string().uuid().optional().or(z.literal("")),
  adviserName: z.string().trim().max(150, "Adviser name must be 150 characters or less.").optional().default(""),
  isActive: checkboxBoolean,
});
