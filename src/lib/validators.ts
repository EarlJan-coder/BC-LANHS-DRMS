import { z } from "zod";
import { requestStatusEnum } from "@/db/schema";

export const documentRequestSchema = z.object({
  documentType: z.string().min(2, "Select a document type."),
  purpose: z.string().min(10, "Please describe the request purpose in at least 10 characters."),
});

export const updateRequestStatusSchema = z.object({
  status: z.enum(requestStatusEnum.enumValues),
  remarks: z.string().optional(),
  rejectionReason: z.string().optional(),
});

export const gradeImportCommitSchema = z.object({
  fileName: z.string().min(1),
  rows: z
    .array(
      z.object({
        lrn: z.string().min(1),
        studentNumber: z.string().min(1),
        schoolYear: z.string().min(1),
        gradeLevel: z.string().min(1),
        section: z.string().min(1),
        subject: z.string().min(1),
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
  lrn: z.string().min(1, "LRN is required."),
  studentNumber: z.string().min(1, "Student number is required."),
  firstName: z.string().min(1, "First name is required."),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required."),
  suffix: z.string().optional(),
  contactNumber: z.string().optional(),
  guardianName: z.string().optional(),
  guardianContact: z.string().optional(),
  address: z.string().optional(),
  gradeLevelId: z.string().uuid().optional().or(z.literal("")),
  sectionId: z.string().uuid().optional().or(z.literal("")),
  enrollmentStatus: z.string().min(1).default("enrolled"),
});
