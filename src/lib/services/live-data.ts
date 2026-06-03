import { count, desc, eq, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  auditLogs,
  blockchainAuditLogs,
  documentRequests,
  documentTypes,
  gradeImportBatches,
  gradeLevels,
  notifications,
  schoolYears,
  sections,
  studentGrades,
  students,
  subjects,
  users,
  type RequestStatus,
} from "@/db/schema";
import { ensureCurrentDbUser, getCurrentProfile } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/constants";
import type {
  AuditTrailView,
  DocumentRequestView,
  DocumentTypeView,
  GradeLevelView,
  GradeRecordView,
  SchoolYearView,
  StatCard,
  StudentProfileView,
  StudentView,
  SubjectView,
  UserView,
} from "@/lib/types";

function formatDate(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 10) : "Not set";
}

function formatDateTime(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 16).replace("T", " ") : "Not set";
}

function studentName(row: {
  studentFirstName: string | null;
  studentMiddleName: string | null;
  studentLastName: string | null;
  studentSuffix: string | null;
  userFirstName: string | null;
  userLastName: string | null;
}) {
  const student = [row.studentFirstName, row.studentMiddleName, row.studentLastName, row.studentSuffix]
    .filter(Boolean)
    .join(" ");

  if (student) {
    return student;
  }

  const user = [row.userFirstName, row.userLastName].filter(Boolean).join(" ");
  return user || "Unlinked student";
}

async function currentRequestScope() {
  const db = getDb();
  const user = await ensureCurrentDbUser();

  if (!user) {
    return undefined;
  }

  const student = await db.query.students.findFirst({
    where: eq(students.userId, user.id),
  });

  return student
    ? or(eq(documentRequests.requestedByUserId, user.id), eq(documentRequests.studentId, student.id))
    : eq(documentRequests.requestedByUserId, user.id);
}

async function requestStatusCounts(whereClause?: ReturnType<typeof eq>) {
  const db = getDb();
  const rows = await db
    .select({ status: documentRequests.status, value: count() })
    .from(documentRequests)
    .where(whereClause)
    .groupBy(documentRequests.status);

  return rows.reduce(
    (acc, row) => {
      acc[row.status] = Number(row.value);
      return acc;
    },
    {} as Record<RequestStatus, number>,
  );
}

export async function listDocumentRequestViews(options: { currentUserOnly?: boolean; limit?: number } = {}) {
  const db = getDb();
  const whereClause = options.currentUserOnly ? await currentRequestScope() : undefined;
  const limit = options.limit ?? 50;

  const rows = await db
    .select({
      id: documentRequests.id,
      trackingNumber: documentRequests.trackingNumber,
      purpose: documentRequests.purpose,
      status: documentRequests.status,
      createdAt: documentRequests.createdAt,
      updatedAt: documentRequests.updatedAt,
      documentType: documentTypes.name,
      studentFirstName: students.firstName,
      studentMiddleName: students.middleName,
      studentLastName: students.lastName,
      studentSuffix: students.suffix,
      userFirstName: users.firstName,
      userLastName: users.lastName,
    })
    .from(documentRequests)
    .leftJoin(documentTypes, eq(documentRequests.documentTypeId, documentTypes.id))
    .leftJoin(students, eq(documentRequests.studentId, students.id))
    .leftJoin(users, eq(documentRequests.requestedByUserId, users.id))
    .where(whereClause)
    .orderBy(desc(documentRequests.createdAt))
    .limit(limit);

  const references = rows.map((row) => row.trackingNumber);
  const blockchainRows =
    references.length > 0
      ? await db
          .select({
            referenceId: blockchainAuditLogs.referenceId,
            status: blockchainAuditLogs.status,
            createdAt: blockchainAuditLogs.createdAt,
          })
          .from(blockchainAuditLogs)
          .where(inArray(blockchainAuditLogs.referenceId, references))
          .orderBy(desc(blockchainAuditLogs.createdAt))
      : [];

  const latestBlockchainStatus = new Map<string, DocumentRequestView["blockchainStatus"]>();
  for (const row of blockchainRows) {
    if (!latestBlockchainStatus.has(row.referenceId) && row.status !== "not_required") {
      latestBlockchainStatus.set(row.referenceId, row.status);
    }
  }

  return rows.map<DocumentRequestView>((row) => ({
    id: row.id,
    trackingNumber: row.trackingNumber,
    studentName: studentName(row),
    documentType: row.documentType ?? "Unconfigured document type",
    purpose: row.purpose,
    status: row.status,
    requestedAt: formatDate(row.createdAt),
    updatedAt: formatDate(row.updatedAt),
    blockchainStatus: latestBlockchainStatus.get(row.trackingNumber) ?? "pending",
  }));
}

export async function getDocumentRequestView(id: string, currentUserOnly = false) {
  const rows = await listDocumentRequestViews({ currentUserOnly, limit: 100 });
  return rows.find((row) => row.id === id || row.trackingNumber === id) ?? null;
}

export async function getStudentDashboardData() {
  const whereClause = await currentRequestScope();
  const counts = await requestStatusCounts(whereClause);
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  const stats: StatCard[] = [
    { label: "Total requests", value: total.toString(), helper: "All requests linked to your account", tone: "red" },
    { label: "Pending requests", value: String(counts.pending ?? 0), helper: "Awaiting registrar review", tone: "amber" },
    {
      label: "Approved requests",
      value: String((counts.approved ?? 0) + (counts.processing ?? 0)),
      helper: "Approved or processing",
      tone: "emerald",
    },
    {
      label: "Ready for pickup",
      value: String(counts.ready_for_pickup ?? 0),
      helper: "Bring a valid ID",
      tone: "rose",
    },
  ];

  return {
    stats,
    requests: await listDocumentRequestViews({ currentUserOnly: true, limit: 3 }),
    notifications: await listCurrentUserNotifications(3),
  };
}

export async function getRegistrarDashboardData() {
  const counts = await requestStatusCounts();

  const stats: StatCard[] = [
    { label: "New requests", value: String(counts.pending ?? 0), helper: "Pending registrar review", tone: "red" },
    { label: "Pending requests", value: String(counts.pending ?? 0), helper: "Need review", tone: "amber" },
    { label: "Approved requests", value: String(counts.approved ?? 0), helper: "Approved requests", tone: "emerald" },
    { label: "Rejected requests", value: String(counts.rejected ?? 0), helper: "With recorded reason", tone: "slate" },
    { label: "Ready for pickup", value: String(counts.ready_for_pickup ?? 0), helper: "Documents prepared", tone: "rose" },
    { label: "Claimed documents", value: String(counts.claimed ?? 0), helper: "Completed requests", tone: "sky" },
  ];

  return {
    stats,
    requests: await listDocumentRequestViews({ limit: 10 }),
  };
}

export async function getAdminDashboardData() {
  const db = getDb();
  const [userCount] = await db.select({ value: count() }).from(users);
  const [studentCount] = await db.select({ value: count() }).from(students);
  const [requestCount] = await db.select({ value: count() }).from(documentRequests);
  const [gradeCount] = await db.select({ value: count() }).from(studentGrades);
  const [blockchainCount] = await db.select({ value: count() }).from(blockchainAuditLogs);

  const stats: StatCard[] = [
    { label: "Total users", value: String(userCount.value), helper: "Students, staff, admins", tone: "red" },
    { label: "Total students", value: String(studentCount.value), helper: "Active and alumni records", tone: "sky" },
    { label: "Total requests", value: String(requestCount.value), helper: "Across all document types", tone: "rose" },
    { label: "Total grade records", value: String(gradeCount.value), helper: "Validated imports", tone: "emerald" },
    {
      label: "Blockchain audit entries",
      value: String(blockchainCount.value),
      helper: "Hash proofs submitted",
      tone: "slate",
    },
  ];

  return {
    stats,
    auditTrail: await listAuditTrailViews(8),
  };
}

export async function listStudentViews() {
  const db = getDb();
  const rows = await db
    .select({
      id: students.id,
      lrn: students.lrn,
      studentNumber: students.studentNumber,
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      suffix: students.suffix,
      gradeLevel: gradeLevels.name,
      section: sections.name,
      enrollmentStatus: students.enrollmentStatus,
    })
    .from(students)
    .leftJoin(gradeLevels, eq(students.gradeLevelId, gradeLevels.id))
    .leftJoin(sections, eq(students.sectionId, sections.id))
    .orderBy(desc(students.createdAt))
    .limit(100);

  return rows.map<StudentView>((row) => ({
    id: row.id,
    lrn: row.lrn,
    studentNumber: row.studentNumber,
    name: [row.firstName, row.middleName, row.lastName, row.suffix].filter(Boolean).join(" "),
    gradeLevel: row.gradeLevel ?? "Not assigned",
    section: row.section ?? "Not assigned",
    status: row.enrollmentStatus,
  }));
}

export async function getStudentRecordFormOptions() {
  const db = getDb();
  const [gradeLevelRows, sectionRows] = await Promise.all([
    db
      .select({
        id: gradeLevels.id,
        name: gradeLevels.name,
      })
      .from(gradeLevels)
      .orderBy(gradeLevels.order),
    db
      .select({
        id: sections.id,
        name: sections.name,
        gradeLevelId: sections.gradeLevelId,
        gradeLevelName: gradeLevels.name,
      })
      .from(sections)
      .leftJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
      .orderBy(sections.name),
  ]);

  return {
    gradeLevels: gradeLevelRows,
    sections: sectionRows.map((section) => ({
      id: section.id,
      name: section.gradeLevelName ? `${section.gradeLevelName} - ${section.name}` : section.name,
      gradeLevelId: section.gradeLevelId,
    })),
  };
}

export async function getCurrentStudentProfile() {
  const db = getDb();
  const user = await ensureCurrentDbUser();
  const profile = await getCurrentProfile();

  if (!user) {
    return {
      name: `${profile.firstName} ${profile.lastName}`,
      email: profile.email,
      lrn: "Not linked",
      studentNumber: "Not linked",
      gradeAndSection: "Not linked",
      contactNumber: "Not set",
      guardian: "Not set",
    } satisfies StudentProfileView;
  }

  const row = await db
    .select({
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      suffix: students.suffix,
      lrn: students.lrn,
      studentNumber: students.studentNumber,
      contactNumber: students.contactNumber,
      guardianName: students.guardianName,
      gradeLevel: gradeLevels.name,
      section: sections.name,
    })
    .from(students)
    .leftJoin(gradeLevels, eq(students.gradeLevelId, gradeLevels.id))
    .leftJoin(sections, eq(students.sectionId, sections.id))
    .where(eq(students.userId, user.id))
    .limit(1);

  const student = row[0];

  if (!student) {
    return {
      name: `${profile.firstName} ${profile.lastName}`,
      email: profile.email,
      lrn: "No student profile linked",
      studentNumber: "No student profile linked",
      gradeAndSection: "No student profile linked",
      contactNumber: "Not set",
      guardian: "Not set",
    } satisfies StudentProfileView;
  }

  return {
    name: [student.firstName, student.middleName, student.lastName, student.suffix].filter(Boolean).join(" "),
    email: profile.email,
    lrn: student.lrn,
    studentNumber: student.studentNumber,
    gradeAndSection: [student.gradeLevel, student.section].filter(Boolean).join(", ") || "Not assigned",
    contactNumber: student.contactNumber ?? "Not set",
    guardian: student.guardianName ?? "Not set",
  } satisfies StudentProfileView;
}

export async function listCurrentUserNotifications(limit = 20) {
  const db = getDb();
  const user = await ensureCurrentDbUser();

  if (!user) {
    return [];
  }

  return db
    .select({
      id: notifications.id,
      title: notifications.title,
      message: notifications.message,
      isRead: notifications.isRead,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function listUserViews() {
  const db = getDb();
  const rows = await db.select().from(users).orderBy(desc(users.createdAt)).limit(100);

  return rows.map<UserView>((row) => ({
    id: row.id,
    name: `${row.firstName} ${row.lastName}`,
    email: row.email,
    role: ROLE_LABELS[row.role],
    status: row.isActive ? "Active" : "Inactive",
  }));
}

export async function listDocumentTypeViews() {
  const db = getDb();
  const rows = await db.select().from(documentTypes).orderBy(documentTypes.name);

  return rows.map<DocumentTypeView>((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    processingDays: row.processingDays,
    status: row.isActive ? "Active" : "Inactive",
  }));
}

export async function listSchoolYearViews() {
  const db = getDb();
  const rows = await db.select().from(schoolYears).orderBy(desc(schoolYears.createdAt));

  return rows.map<SchoolYearView>((row) => ({
    id: row.id,
    name: row.name,
    startsOn: formatDate(row.startsOn),
    endsOn: formatDate(row.endsOn),
    status: row.isActive ? "Active" : "Closed",
  }));
}

export async function listGradeLevelViews() {
  const db = getDb();
  const rows = await db
    .select({
      id: gradeLevels.id,
      gradeLevel: gradeLevels.name,
      status: gradeLevels.isActive,
      sections: sql<number>`cast(count(${sections.id}) as int)`,
    })
    .from(gradeLevels)
    .leftJoin(sections, eq(gradeLevels.id, sections.gradeLevelId))
    .groupBy(gradeLevels.id)
    .orderBy(gradeLevels.order);

  return rows.map<GradeLevelView>((row) => ({
    id: row.id,
    gradeLevel: row.gradeLevel,
    sections: String(row.sections),
    status: row.status ? "Active" : "Inactive",
  }));
}

export async function listSubjectViews() {
  const db = getDb();
  const rows = await db
    .select({
      id: subjects.id,
      code: subjects.code,
      name: subjects.name,
      gradeLevel: gradeLevels.name,
    })
    .from(subjects)
    .leftJoin(gradeLevels, eq(subjects.gradeLevelId, gradeLevels.id))
    .orderBy(subjects.name);

  return rows.map<SubjectView>((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    gradeLevel: row.gradeLevel ?? "Not assigned",
  }));
}

export async function listGradeRecordViews(limit = 50) {
  const db = getDb();
  const rows = await db
    .select({
      id: studentGrades.id,
      finalGrade: studentGrades.finalGrade,
      remarks: studentGrades.remarks,
      subject: subjects.name,
      schoolYear: schoolYears.name,
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      suffix: students.suffix,
    })
    .from(studentGrades)
    .leftJoin(students, eq(studentGrades.studentId, students.id))
    .leftJoin(subjects, eq(studentGrades.subjectId, subjects.id))
    .leftJoin(schoolYears, eq(studentGrades.schoolYearId, schoolYears.id))
    .orderBy(desc(studentGrades.createdAt))
    .limit(limit);

  return rows.map<GradeRecordView>((row) => ({
    id: row.id,
    studentName: [row.firstName, row.middleName, row.lastName, row.suffix].filter(Boolean).join(" ") || "Unknown student",
    subject: row.subject ?? "Unknown subject",
    finalGrade: row.finalGrade ?? "Not set",
    remarks: row.remarks ?? "Not set",
    schoolYear: row.schoolYear ?? "Not set",
  }));
}

export async function listAuditTrailViews(limit = 50) {
  const db = getDb();
  const rows = await db
    .select({
      id: blockchainAuditLogs.id,
      action: blockchainAuditLogs.action,
      referenceId: blockchainAuditLogs.referenceId,
      actorRole: blockchainAuditLogs.actorRole,
      hash: blockchainAuditLogs.recordHash,
      status: blockchainAuditLogs.status,
      transactionHash: blockchainAuditLogs.blockchainTxHash,
      createdAt: blockchainAuditLogs.createdAt,
    })
    .from(blockchainAuditLogs)
    .orderBy(desc(blockchainAuditLogs.createdAt))
    .limit(limit);

  if (rows.length > 0) {
    return rows.map<AuditTrailView>((row) => ({
      id: row.id,
      action: row.action,
      referenceId: row.referenceId,
      actorRole: row.actorRole,
      hash: row.hash,
      status: row.status,
      transactionHash: row.transactionHash ?? "Pending",
      createdAt: formatDateTime(row.createdAt),
    }));
  }

  const localRows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      referenceId: auditLogs.entityId,
      actorRole: auditLogs.actorRole,
      hash: auditLogs.recordHash,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  return localRows.map<AuditTrailView>((row) => ({
    id: row.id,
    action: row.action,
    referenceId: row.referenceId,
    actorRole: row.actorRole,
    hash: row.hash,
    status: "pending",
    transactionHash: "Pending",
    createdAt: formatDateTime(row.createdAt),
  }));
}

export async function getReportSummaryCards() {
  const db = getDb();
  const [requestCount] = await db.select({ value: count() }).from(documentRequests);
  const [claimedCount] = await db
    .select({ value: count() })
    .from(documentRequests)
    .where(eq(documentRequests.status, "claimed"));
  const [batchCount] = await db.select({ value: count() }).from(gradeImportBatches);
  const [studentCount] = await db.select({ value: count() }).from(students);

  return [
    { title: "Request summary", value: String(requestCount.value), helper: "Total document requests" },
    { title: "Claimed documents", value: String(claimedCount.value), helper: "Completed registrar releases" },
    { title: "Grade import batches", value: String(batchCount.value), helper: "Validated and saved imports" },
    { title: "Student records", value: String(studentCount.value), helper: "Students and alumni in database" },
  ];
}

export async function listAdminSettingStatuses() {
  return [
    { title: "Database", value: process.env.DATABASE_URL ? "Configured" : "Missing" },
    { title: "Authentication", value: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? "Configured" : "Missing" },
    { title: "Email", value: process.env.RESEND_API_KEY ? "Configured" : "Missing" },
    { title: "Blockchain", value: process.env.DOCUMENT_AUDIT_CONTRACT_ADDRESS ? "Configured" : "Missing" },
  ];
}
