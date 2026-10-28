import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["student", "registrar", "admin"]);
export const accountStatusEnum = pgEnum("account_status", ["active", "inactive", "suspended"]);
export const studentTypeEnum = pgEnum("student_type", ["current", "alumni", "transferee"]);
export const studentStatusEnum = pgEnum("student_status", ["enrolled", "alumni", "transferred", "inactive"]);
export const requestStatusEnum = pgEnum("request_status", [
  "pending",
  "under_review",
  "approved",
  "rejected",
  "processing",
  "ready_for_pickup",
  "claimed",
  "cancelled",
]);
export const blockchainStatusEnum = pgEnum("blockchain_status", [
  "not_required",
  "pending",
  "submitted",
  "failed",
  "verified",
]);
export const notificationTypeEnum = pgEnum("notification_type", ["request", "certificate", "system", "audit"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lrn: varchar("lrn", { length: 30 }),
    email: varchar("email", { length: 191 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    middleName: varchar("middle_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    role: userRoleEnum("role").notNull().default("student"),
    status: accountStatusEnum("status").notNull().default("active"),
    isActive: boolean("is_active").notNull().default(true),
    tokenVersion: integer("token_version").notNull().default(0),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    uniqueIndex("users_lrn_idx").on(table.lrn),
    index("users_role_idx").on(table.role),
    index("users_status_idx").on(table.status),
  ],
);

export const schoolYears = pgTable(
  "school_years",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 30 }).notNull(),
    startsOn: timestamp("starts_on", { withTimezone: true }),
    endsOn: timestamp("ends_on", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("school_years_name_idx").on(table.name)],
);

export const gradeLevels = pgTable(
  "grade_levels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 40 }).notNull(),
    order: integer("order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("grade_levels_name_idx").on(table.name)],
);

export const sections = pgTable(
  "sections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 80 }).notNull(),
    gradeLevelId: uuid("grade_level_id").references(() => gradeLevels.id),
    schoolYearId: uuid("school_year_id").references(() => schoolYears.id),
    adviserName: varchar("adviser_name", { length: 150 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sections_grade_level_id_idx").on(table.gradeLevelId),
    index("sections_school_year_id_idx").on(table.schoolYearId),
    uniqueIndex("sections_grade_level_year_name_idx").on(table.gradeLevelId, table.schoolYearId, table.name),
  ],
);

export const students = pgTable(
  "students",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id),
    lrn: varchar("lrn", { length: 30 }).notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    middleName: varchar("middle_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    suffix: varchar("suffix", { length: 20 }),
    birthDate: timestamp("birth_date", { withTimezone: true }),
    gender: varchar("gender", { length: 30 }),
    email: varchar("email", { length: 191 }),
    contactNumber: varchar("contact_number", { length: 30 }),
    address: text("address"),
    guardianName: varchar("guardian_name", { length: 150 }),
    guardianContact: varchar("guardian_contact", { length: 30 }),
    gradeLevelId: uuid("grade_level_id").references(() => gradeLevels.id),
    sectionId: uuid("section_id").references(() => sections.id),
    schoolYearId: uuid("school_year_id").references(() => schoolYears.id),
    studentType: studentTypeEnum("student_type").notNull().default("current"),
    status: studentStatusEnum("status").notNull().default("enrolled"),
    enrollmentStatus: varchar("enrollment_status", { length: 40 }).notNull().default("enrolled"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("students_lrn_idx").on(table.lrn),
    index("students_user_id_idx").on(table.userId),
    index("students_grade_level_idx").on(table.gradeLevelId),
    index("students_section_idx").on(table.sectionId),
  ],
);

export const authRateLimits = pgTable(
  "auth_rate_limits",
  {
    bucketKey: varchar("bucket_key", { length: 64 }).primaryKey(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("auth_rate_limits_updated_idx").on(table.updatedAt)],
);

export const documentTypes = pgTable(
  "document_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    code: varchar("code", { length: 40 }).notNull(),
    description: text("description"),
    requirements: jsonb("requirements").$type<string[]>().notNull().default([]),
    processingDays: integer("processing_days").notNull().default(3),
    fee: numeric("fee", { precision: 10, scale: 2 }).notNull().default("0"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("document_types_code_idx").on(table.code),
    uniqueIndex("document_types_name_idx").on(table.name),
  ],
);

export const documentRequests = pgTable(
  "document_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    trackingNumber: varchar("tracking_number", { length: 40 }).notNull(),
    studentId: uuid("student_id").references(() => students.id),
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id),
    documentTypeId: uuid("document_type_id").references(() => documentTypes.id),
    purpose: text("purpose").notNull(),
    schoolYearNeeded: varchar("school_year_needed", { length: 40 }),
    gradeLevelNeeded: varchar("grade_level_needed", { length: 40 }),
    remarks: text("remarks"),
    status: requestStatusEnum("status").notNull().default("pending"),
    registrarRemarks: text("registrar_remarks"),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectedBy: uuid("rejected_by").references(() => users.id),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    generatedDocumentUrl: text("generated_document_url"),
    readyForPickupAt: timestamp("ready_for_pickup_at", { withTimezone: true }),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("document_requests_tracking_number_idx").on(table.trackingNumber),
    index("document_requests_student_id_idx").on(table.studentId),
    index("document_requests_requested_by_idx").on(table.requestedByUserId),
    index("document_requests_status_idx").on(table.status),
  ],
);

export const requestStatusHistory = pgTable(
  "request_status_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id").notNull().references(() => documentRequests.id),
    fromStatus: requestStatusEnum("from_status"),
    toStatus: requestStatusEnum("to_status").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    remarks: text("remarks"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("request_status_history_request_id_idx").on(table.requestId)],
);

export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    certificateNumber: varchar("certificate_number", { length: 60 }).notNull(),
    requestId: uuid("request_id").references(() => documentRequests.id),
    studentId: uuid("student_id").references(() => students.id),
    certificateType: varchar("certificate_type", { length: 120 }).notNull(),
    schoolYearId: uuid("school_year_id").references(() => schoolYears.id),
    pdfUrl: text("pdf_url"),
    verificationCode: varchar("verification_code", { length: 80 }).notNull(),
    qrCodeData: text("qr_code_data").notNull(),
    generatedBy: uuid("generated_by").references(() => users.id),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    blockchainTxHash: varchar("blockchain_tx_hash", { length: 90 }),
    recordHash: varchar("record_hash", { length: 66 }),
    blockNumber: bigint("block_number", { mode: "number" }),
    network: varchar("network", { length: 40 }),
    // PDF content overrides: null = render the live joined value. Never used
    // for school year / certificate number / type (blockchain hash inputs).
    overrideStudentName: varchar("override_student_name", { length: 200 }),
    overrideGradeLevel: varchar("override_grade_level", { length: 100 }),
    overrideSection: varchar("override_section", { length: 100 }),
    overridePurpose: text("override_purpose"),
    overrideDateGenerated: timestamp("override_date_generated", { withTimezone: true }),
    // Signatory names typed per certificate in the preview editor. There is no
    // live record value behind these: null renders no name above the signature
    // line. Display-only, like the overrides above.
    overrideRegistrarName: varchar("override_registrar_name", { length: 200 }),
    overridePrincipalName: varchar("override_principal_name", { length: 200 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("certificates_number_idx").on(table.certificateNumber),
    uniqueIndex("certificates_verification_code_idx").on(table.verificationCode),
    index("certificates_student_idx").on(table.studentId),
    index("certificates_request_idx").on(table.requestId),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id),
    type: notificationTypeEnum("type").notNull().default("system"),
    title: varchar("title", { length: 160 }).notNull(),
    message: text("message").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("notifications_user_id_idx").on(table.userId)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    actorRole: userRoleEnum("actor_role").notNull(),
    action: varchar("action", { length: 120 }).notNull(),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: varchar("entity_id", { length: 120 }).notNull(),
    description: text("description"),
    metadata: jsonb("metadata"),
    recordHash: varchar("record_hash", { length: 66 }).notNull(),
    ipAddress: varchar("ip_address", { length: 80 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_actor_id_idx").on(table.actorUserId),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
    index("audit_logs_action_idx").on(table.action),
  ],
);

export const blockchainAuditLogs = pgTable(
  "blockchain_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    auditLogId: uuid("audit_log_id").references(() => auditLogs.id),
    referenceType: varchar("reference_type", { length: 80 }).notNull().default("system"),
    referenceId: varchar("reference_id", { length: 120 }).notNull(),
    action: varchar("action", { length: 120 }).notNull(),
    actorRole: userRoleEnum("actor_role").notNull(),
    recordHash: varchar("record_hash", { length: 66 }).notNull(),
    blockchainTxHash: varchar("blockchain_tx_hash", { length: 90 }),
    contractAddress: varchar("contract_address", { length: 60 }),
    blockchainStatus: blockchainStatusEnum("blockchain_status").notNull().default("pending"),
    blockNumber: bigint("block_number", { mode: "number" }),
    network: varchar("network", { length: 40 }),
    errorMessage: text("error_message"),
    retryCount: integer("retry_count").notNull().default(0),
    lastRetryAt: timestamp("last_retry_at", { withTimezone: true }),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("blockchain_audit_logs_reference_id_idx").on(table.referenceId),
    index("blockchain_audit_logs_status_idx").on(table.blockchainStatus),
  ],
);

export const usersRelations = relations(users, ({ one, many }) => ({
  studentProfile: one(students, {
    fields: [users.id],
    references: [students.userId],
  }),
  requests: many(documentRequests),
  notifications: many(notifications),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  user: one(users, {
    fields: [students.userId],
    references: [users.id],
  }),
  gradeLevel: one(gradeLevels, {
    fields: [students.gradeLevelId],
    references: [gradeLevels.id],
  }),
  section: one(sections, {
    fields: [students.sectionId],
    references: [sections.id],
  }),
  schoolYear: one(schoolYears, {
    fields: [students.schoolYearId],
    references: [schoolYears.id],
  }),
  requests: many(documentRequests),
  certificates: many(certificates),
}));

export const documentRequestsRelations = relations(documentRequests, ({ one, many }) => ({
  student: one(students, {
    fields: [documentRequests.studentId],
    references: [students.id],
  }),
  documentType: one(documentTypes, {
    fields: [documentRequests.documentTypeId],
    references: [documentTypes.id],
  }),
  statusHistory: many(requestStatusHistory),
  certificates: many(certificates),
}));

export const certificatesRelations = relations(certificates, ({ one }) => ({
  student: one(students, {
    fields: [certificates.studentId],
    references: [students.id],
  }),
  request: one(documentRequests, {
    fields: [certificates.requestId],
    references: [documentRequests.id],
  }),
  schoolYear: one(schoolYears, {
    fields: [certificates.schoolYearId],
    references: [schoolYears.id],
  }),
}));

export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type RequestStatus = (typeof requestStatusEnum.enumValues)[number];
export type BlockchainStatus = (typeof blockchainStatusEnum.enumValues)[number];
