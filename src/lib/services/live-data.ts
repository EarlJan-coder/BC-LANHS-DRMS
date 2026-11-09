import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { getDb } from "@/db";
import {
  auditLogs,
  blockchainAuditLogs,
  certificates,
  documentRequests,
  documentTypes,
  notifications,
  requestStatusHistory,
  students,
  users,
  type RequestStatus,
} from "@/db/schema";
import { ensureCurrentDbUser, getCurrentProfile } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/constants";
import type {
  AuditTrailView,
  DocumentRequestView,
  DocumentTypeView,
  StatCard,
  StudentProfileView,
  StudentView,
  UserView,
} from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";
import { makePaged, PAGE_SIZE, type Paged } from "@/lib/pagination";

type PageOptions = { page: number; pageSize?: number };

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

type DocumentRequestDbRow = {
  id: string;
  trackingNumber: string;
  purpose: string;
  status: RequestStatus;
  createdAt: Date;
  updatedAt: Date;
  schoolYearNeeded: string | null;
  gradeLevelNeeded: string | null;
  remarks: string | null;
  registrarRemarks: string | null;
  documentType: string | null;
  lrn: string | null;
  studentFirstName: string | null;
  studentMiddleName: string | null;
  studentLastName: string | null;
  studentSuffix: string | null;
  userFirstName: string | null;
  userLastName: string | null;
};

const documentRequestSelection = {
  id: documentRequests.id,
  trackingNumber: documentRequests.trackingNumber,
  purpose: documentRequests.purpose,
  status: documentRequests.status,
  createdAt: documentRequests.createdAt,
  updatedAt: documentRequests.updatedAt,
  schoolYearNeeded: documentRequests.schoolYearNeeded,
  gradeLevelNeeded: documentRequests.gradeLevelNeeded,
  remarks: documentRequests.remarks,
  registrarRemarks: documentRequests.registrarRemarks,
  documentType: documentTypes.name,
  lrn: students.lrn,
  studentFirstName: students.firstName,
  studentMiddleName: students.middleName,
  studentLastName: students.lastName,
  studentSuffix: students.suffix,
  userFirstName: users.firstName,
  userLastName: users.lastName,
};

function mapDocumentRequestView(
  row: DocumentRequestDbRow,
  blockchainStatus: DocumentRequestView["blockchainStatus"] = "pending",
): DocumentRequestView {
  return {
    id: row.id,
    trackingNumber: row.trackingNumber,
    lrn: row.lrn ?? undefined,
    studentName: studentName(row),
    documentType: row.documentType ?? "Unconfigured document type",
    purpose: row.purpose,
    schoolYearNeeded: row.schoolYearNeeded ?? "Not set",
    gradeLevelNeeded: row.gradeLevelNeeded ?? "Not set",
    remarks: row.remarks ?? "None",
    registrarRemarks: row.registrarRemarks ?? "None",
    status: row.status,
    requestedAt: formatDate(row.createdAt),
    updatedAt: formatDate(row.updatedAt),
    blockchainStatus,
  };
}

async function latestBlockchainStatuses(references: string[]) {
  const db = getDb();
  const rows = references.length > 0
    ? await db
      .select({
        referenceId: blockchainAuditLogs.referenceId,
        blockchainStatus: blockchainAuditLogs.blockchainStatus,
      })
      .from(blockchainAuditLogs)
      .where(inArray(blockchainAuditLogs.referenceId, references))
      .orderBy(desc(blockchainAuditLogs.createdAt))
    : [];

  const statuses = new Map<string, DocumentRequestView["blockchainStatus"]>();
  for (const row of rows) {
    if (!statuses.has(row.referenceId) && row.blockchainStatus !== "not_required") {
      statuses.set(row.referenceId, row.blockchainStatus);
    }
  }
  return statuses;
}

async function currentRequestScope() {
  const db = getDb();
  const user = await ensureCurrentDbUser();

  if (!user) {
    return eq(documentRequests.id, "00000000-0000-0000-0000-000000000000");
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

export function listDocumentRequestViews(options: { currentUserOnly?: boolean; q?: string; status?: RequestStatus; documentType?: string } & PageOptions): Promise<Paged<DocumentRequestView>>;
export function listDocumentRequestViews(options?: { currentUserOnly?: boolean; limit?: number; all?: true; q?: string; status?: RequestStatus; documentType?: string }): Promise<DocumentRequestView[]>;
export async function listDocumentRequestViews(options: { currentUserOnly?: boolean; limit?: number; all?: true; page?: number; pageSize?: number; q?: string; status?: RequestStatus; documentType?: string } = {}): Promise<DocumentRequestView[] | Paged<DocumentRequestView>> {
  const db = getDb();
  const conditions: SQL[] = [];
  if (options.currentUserOnly) {
    const scope = await currentRequestScope();
    if (scope) conditions.push(scope);
  }
  if (options.status) conditions.push(eq(documentRequests.status, options.status));
  if (options.documentType?.trim()) conditions.push(ilike(documentTypes.name, `%${options.documentType.trim()}%`));
  const query = options.q?.trim();
  if (query) {
    const pattern = `%${query}%`;
    const textMatch = or(
      ilike(documentRequests.trackingNumber, pattern),
      ilike(documentRequests.purpose, pattern),
      ilike(students.lrn, pattern),
      ilike(documentTypes.name, pattern),
      ilike(sql`concat_ws(' ', ${students.firstName}, ${students.middleName}, ${students.lastName}, ${students.suffix}, ${users.firstName}, ${users.lastName})`, pattern),
    );
    if (textMatch) conditions.push(textMatch);
  }
  const whereClause = conditions.length ? and(...conditions) : undefined;
  const baseQuery = db
    .select(documentRequestSelection)
    .from(documentRequests)
    .leftJoin(documentTypes, eq(documentRequests.documentTypeId, documentTypes.id))
    .leftJoin(students, eq(documentRequests.studentId, students.id))
    .leftJoin(users, eq(documentRequests.requestedByUserId, users.id))
    .where(whereClause)
    .orderBy(desc(documentRequests.createdAt));

  let total = 0;
  let rows: Awaited<typeof baseQuery>;
  if (options.page !== undefined) {
    const [countRow] = await db
      .select({ value: count() })
      .from(documentRequests)
      .leftJoin(documentTypes, eq(documentRequests.documentTypeId, documentTypes.id))
      .leftJoin(students, eq(documentRequests.studentId, students.id))
      .leftJoin(users, eq(documentRequests.requestedByUserId, users.id))
      .where(whereClause);
    total = Number(countRow?.value ?? 0);
    const pageSize = options.pageSize ?? PAGE_SIZE;
    const page = makePaged([], total, options.page, pageSize).page;
    rows = await baseQuery.limit(pageSize).offset((page - 1) * pageSize);
  } else if (options.all) {
    rows = await baseQuery;
  } else {
    rows = await baseQuery.limit(options.limit ?? 50);
  }

  const latestStatuses = await latestBlockchainStatuses(rows.map((row) => row.trackingNumber));
  const views = rows.map((row) => mapDocumentRequestView(row, latestStatuses.get(row.trackingNumber) ?? "pending"));
  if (options.page !== undefined) return makePaged(views, total, options.page, options.pageSize);
  return views;
}

export async function getDocumentRequestView(id: string, currentUserOnly = false) {
  const db = getDb();
  const scope = currentUserOnly ? await currentRequestScope() : undefined;
  const identity = or(eq(documentRequests.id, id), eq(documentRequests.trackingNumber, id));
  const rows = await db
    .select(documentRequestSelection)
    .from(documentRequests)
    .leftJoin(documentTypes, eq(documentRequests.documentTypeId, documentTypes.id))
    .leftJoin(students, eq(documentRequests.studentId, students.id))
    .leftJoin(users, eq(documentRequests.requestedByUserId, users.id))
    .where(scope ? and(identity, scope) : identity)
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const statuses = await latestBlockchainStatuses([row.trackingNumber]);
  return mapDocumentRequestView(row, statuses.get(row.trackingNumber) ?? "pending");
}

export async function listRequestStatusHistoryViews(requestId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: requestStatusHistory.id,
      fromStatus: requestStatusHistory.fromStatus,
      toStatus: requestStatusHistory.toStatus,
      remarks: requestStatusHistory.remarks,
      createdAt: requestStatusHistory.createdAt,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(requestStatusHistory)
    .leftJoin(users, eq(requestStatusHistory.actorUserId, users.id))
    .where(eq(requestStatusHistory.requestId, requestId))
    .orderBy(desc(requestStatusHistory.createdAt));

  return rows.map((row) => ({
    id: row.id,
    fromStatus: row.fromStatus ?? "new",
    toStatus: row.toStatus ?? "pending",
    remarks: row.remarks ?? "No remarks",
    actorUserName: [row.firstName, row.lastName].filter(Boolean).join(" ") || "System",
    createdAt: formatDateTime(row.createdAt),
  }));
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
    { label: "Under review", value: String(counts.under_review ?? 0), helper: "Being validated", tone: "sky" },
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
  const [certificateCount] = await db.select({ value: count() }).from(certificates);
  const [blockchainCount] = await db.select({ value: count() }).from(blockchainAuditLogs);

  const stats: StatCard[] = [
    { label: "Total users", value: String(userCount.value), helper: "Students, staff, admins", tone: "red" },
    { label: "Total students", value: String(studentCount.value), helper: "Active and alumni records", tone: "sky" },
    { label: "Total requests", value: String(requestCount.value), helper: "Across all document types", tone: "rose" },
    { label: "Certificates", value: String(certificateCount.value), helper: "Generated PDFs", tone: "amber" },
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

export function listStudentViews(options: PageOptions): Promise<Paged<StudentView>>;
export function listStudentViews(options?: { all?: true }): Promise<StudentView[]>;
export async function listStudentViews(options: PageOptions | { all?: true } = {}): Promise<StudentView[] | Paged<StudentView>> {
  const db = getDb();
  const baseQuery = db
    .select({
      id: students.id,
      userId: students.userId,
      lrn: students.lrn,
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      suffix: students.suffix,
      email: students.email,
      userEmail: users.email,
      registrationStatus: users.registrationStatus,
      contactNumber: students.contactNumber,
      address: students.address,
      enrollmentStatus: students.enrollmentStatus,
      hasLinkedRecords: sql<boolean>`exists (select 1 from document_requests where document_requests.student_id = ${students.id}) or exists (select 1 from certificates where certificates.student_id = ${students.id})`,
    })
    .from(students)
    .leftJoin(users, eq(students.userId, users.id))
    .orderBy(desc(students.createdAt));
  let rows: Awaited<typeof baseQuery>;
  let total = 0;
  if ("page" in options) {
    const [row] = await db.select({ value: count() }).from(students);
    total = Number(row?.value ?? 0);
    const pageSize = options.pageSize ?? PAGE_SIZE;
    const page = makePaged([], total, options.page, pageSize).page;
    rows = await baseQuery.limit(pageSize).offset((page - 1) * pageSize);
  } else if (options.all) {
    rows = await baseQuery;
  } else {
    rows = await baseQuery.limit(100);
  }

  const views = rows.map<StudentView>((row) => ({
    id: row.id,
    accountLinked: Boolean(row.userId),
    registrationStatus: row.registrationStatus ?? "pending",
    lrn: row.lrn,
    firstName: row.firstName,
    middleName: row.middleName ?? "",
    lastName: row.lastName,
    suffix: row.suffix ?? "",
    name: [row.firstName, row.middleName, row.lastName, row.suffix].filter(Boolean).join(" "),
    email: row.email ?? row.userEmail ?? "",
    phone: row.contactNumber ?? "",
    contactNumber: row.contactNumber ?? "",
    address: row.address ?? "",
    status: row.enrollmentStatus,
    hasLinkedRecords: row.hasLinkedRecords,
  }));
  if ("page" in options) return makePaged(views, total, options.page, options.pageSize);
  return views;
}

export async function getStudentDetailView(id: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: students.id,
      userId: students.userId,
      lrn: students.lrn,
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      suffix: students.suffix,
      email: students.email,
      userEmail: users.email,
      contactNumber: students.contactNumber,
      address: students.address,
      status: students.status,
    })
    .from(students)
    .leftJoin(users, eq(students.userId, users.id))
    .where(eq(students.id, id))
    .limit(1);

  const student = rows[0];
  if (!student) {
    return null;
  }

  const requestScope = student.userId
    ? or(eq(documentRequests.studentId, student.id), eq(documentRequests.requestedByUserId, student.userId))
    : eq(documentRequests.studentId, student.id);
  const requestRows = await db
    .select(documentRequestSelection)
    .from(documentRequests)
    .leftJoin(documentTypes, eq(documentRequests.documentTypeId, documentTypes.id))
    .leftJoin(students, eq(documentRequests.studentId, students.id))
    .leftJoin(users, eq(documentRequests.requestedByUserId, users.id))
    .where(requestScope)
    .orderBy(desc(documentRequests.createdAt));
  const requestStatuses = await latestBlockchainStatuses(requestRows.map((row) => row.trackingNumber));
  const requests = requestRows.map((row) => mapDocumentRequestView(row, requestStatuses.get(row.trackingNumber) ?? "pending"));

  const certificateRows = await db
    .select({
      id: certificates.id,
      certificateNumber: certificates.certificateNumber,
      certificateType: certificates.certificateType,
      verificationCode: certificates.verificationCode,
      generatedAt: certificates.generatedAt,
    })
    .from(certificates)
    .where(eq(certificates.studentId, id))
    .orderBy(desc(certificates.createdAt));

  return {
    profile: {
      id: student.id,
      lrn: student.lrn,
      name: [student.firstName, student.middleName, student.lastName, student.suffix].filter(Boolean).join(" "),
      email: student.email ?? student.userEmail ?? "Not set",
      contactNumber: student.contactNumber ?? "Not set",
      address: student.address ?? "Not set",
      status: student.status,
    },
    requests,
    certificates: certificateRows.map((certificate) => ({
      id: certificate.id,
      certificateNumber: certificate.certificateNumber,
      certificateType: certificate.certificateType,
      verificationCode: certificate.verificationCode,
      generatedAt: formatDate(certificate.generatedAt),
    })),
  };
}

export async function getCurrentStudentProfile() {
  const db = getDb();
  // getCurrentProfile throws 401 when signed out, so there is no null-user
  // path to handle here.
  const profile = await getCurrentProfile();

  const row = await db
    .select({
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      suffix: students.suffix,
      lrn: students.lrn,
      contactNumber: students.contactNumber,
      address: students.address,
    })
    .from(students)
    .where(eq(students.userId, profile.userId))
    .limit(1);

  const student = row[0];

  if (!student) {
    return {
      name: `${profile.firstName} ${profile.lastName}`,
      email: profile.email,
      lrn: "No student profile linked",
      contactNumber: "Not set",
      address: "Not set",
      hasStudentRecord: false,
    } satisfies StudentProfileView;
  }

  return {
    name: [student.firstName, student.middleName, student.lastName, student.suffix].filter(Boolean).join(" "),
    email: profile.email,
    lrn: student.lrn,
    contactNumber: student.contactNumber ?? "Not set",
    address: student.address ?? "Not set",
    hasStudentRecord: true,
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

export function listUserViews(options: PageOptions): Promise<Paged<UserView>>;
export function listUserViews(options?: { all?: true }): Promise<UserView[]>;
export async function listUserViews(options: PageOptions | { all?: true } = {}): Promise<UserView[] | Paged<UserView>> {
  const db = getDb();
  const baseQuery = db.select().from(users).orderBy(desc(users.createdAt));
  let rows: Awaited<typeof baseQuery>;
  let total = 0;
  if ("page" in options) {
    const [row] = await db.select({ value: count() }).from(users);
    total = Number(row?.value ?? 0);
    const pageSize = options.pageSize ?? PAGE_SIZE;
    const page = makePaged([], total, options.page, pageSize).page;
    rows = await baseQuery.limit(pageSize).offset((page - 1) * pageSize);
  } else if (options.all) {
    rows = await baseQuery;
  } else {
    rows = await baseQuery.limit(100);
  }

  const views = rows.map<UserView>((row) => ({
    id: row.id,
    name: `${row.firstName} ${row.lastName}`,
    email: row.email,
    role: ROLE_LABELS[row.role],
    rawRole: row.role,
    status: row.status === "active" && row.isActive ? "Active" : row.status,
    rawStatus: row.status,
  }));
  if ("page" in options) return makePaged(views, total, options.page, options.pageSize);
  return views;
}

export async function listDocumentTypeViews() {
  const db = getDb();
  const rows = await db.select().from(documentTypes).orderBy(documentTypes.name);

  return rows.map<DocumentTypeView>((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description ?? "",
    requirements: row.requirements,
    processingDays: row.processingDays,
    fee: Number(row.fee),
    isActive: row.isActive,
    status: row.isActive ? "Active" : "Inactive",
  }));
}

export function listAuditTrailViews(options: PageOptions): Promise<Paged<AuditTrailView>>;
export function listAuditTrailViews(options?: number | { all?: true }): Promise<AuditTrailView[]>;
export async function listAuditTrailViews(options: number | PageOptions | { all?: true } = 50): Promise<AuditTrailView[] | Paged<AuditTrailView>> {
  const db = getDb();
  const pageOptions = typeof options === "object" && "page" in options ? options : undefined;
  const all = typeof options === "object" && "all" in options && options.all;
  const limit = typeof options === "number" ? options : 50;
  const [blockchainCount] = await db.select({ value: count() }).from(blockchainAuditLogs);
  if (Number(blockchainCount?.value ?? 0) > 0) {
    const total = Number(blockchainCount.value);
    const baseQuery = db
      .select({
        id: blockchainAuditLogs.id,
        action: blockchainAuditLogs.action,
        referenceId: blockchainAuditLogs.referenceId,
        actorRole: blockchainAuditLogs.actorRole,
        hash: blockchainAuditLogs.recordHash,
        status: blockchainAuditLogs.blockchainStatus,
        transactionHash: blockchainAuditLogs.blockchainTxHash,
        createdAt: blockchainAuditLogs.createdAt,
      })
      .from(blockchainAuditLogs)
      .orderBy(desc(blockchainAuditLogs.createdAt));
    let rows: Awaited<typeof baseQuery>;
    if (pageOptions) {
      const pageSize = pageOptions.pageSize ?? PAGE_SIZE;
      const page = makePaged([], total, pageOptions.page, pageSize).page;
      rows = await baseQuery.limit(pageSize).offset((page - 1) * pageSize);
    } else if (all) {
      rows = await baseQuery;
    } else {
      rows = await baseQuery.limit(limit);
    }
    const views = rows.map<AuditTrailView>((row) => ({
      id: row.id,
      action: row.action,
      referenceId: row.referenceId,
      actorRole: row.actorRole,
      hash: row.hash,
      status: row.status,
      transactionHash: row.transactionHash ?? "Pending",
      createdAt: formatDateTime(row.createdAt),
    }));
    if (pageOptions) return makePaged(views, total, pageOptions.page, pageOptions.pageSize);
    return all ? views : views.slice(0, limit);
  }

  const [localCount] = await db.select({ value: count() }).from(auditLogs);
  const total = Number(localCount?.value ?? 0);
  const localQuery = db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      referenceId: auditLogs.entityId,
      actorRole: auditLogs.actorRole,
      hash: auditLogs.recordHash,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt));
  let localRows: Awaited<typeof localQuery>;
  if (pageOptions) {
    const pageSize = pageOptions.pageSize ?? PAGE_SIZE;
    const page = makePaged([], total, pageOptions.page, pageSize).page;
    localRows = await localQuery.limit(pageSize).offset((page - 1) * pageSize);
  } else if (all) {
    localRows = await localQuery;
  } else {
    localRows = await localQuery.limit(limit);
  }

  const views = localRows.map<AuditTrailView>((row) => ({
    id: row.id,
    action: row.action,
    referenceId: row.referenceId,
    actorRole: row.actorRole,
    hash: row.hash,
    status: "pending",
    transactionHash: "Pending",
    createdAt: formatDateTime(row.createdAt),
  }));
  if (pageOptions) return makePaged(views, total, pageOptions.page, pageOptions.pageSize);
  return all ? views : views.slice(0, limit);
}

export async function getReportSummaryCards() {
  const db = getDb();
  const [requestCount] = await db.select({ value: count() }).from(documentRequests);
  const [claimedCount] = await db
    .select({ value: count() })
    .from(documentRequests)
    .where(eq(documentRequests.status, "claimed"));
  const [studentCount] = await db.select({ value: count() }).from(students);
  const [certificateCount] = await db.select({ value: count() }).from(certificates);

  return [
    { title: "Request summary", value: String(requestCount.value), helper: "Total document requests" },
    { title: "Claimed documents", value: String(claimedCount.value), helper: "Completed registrar releases" },
    { title: "Generated certificates", value: String(certificateCount.value), helper: "School document PDFs" },
    { title: "Student records", value: String(studentCount.value), helper: "Students and alumni in database" },
  ];
}

export async function listAdminSettingStatuses() {
  return [
    { title: "Database", value: process.env.DATABASE_URL ? "Configured" : "Missing" },
    { title: "Authentication", value: process.env.SESSION_SECRET ? "Configured" : "Missing" },
    { title: "Email", value: process.env.RESEND_API_KEY ? "Configured" : "Missing" },
    { title: "Blockchain", value: process.env.CONTRACT_ADDRESS || process.env.DOCUMENT_AUDIT_CONTRACT_ADDRESS ? "Configured" : "Missing" },
  ];
}

export async function getBlockchainAuditStats() {
  const db = getDb();
  const rows = await db
    .select({ status: blockchainAuditLogs.blockchainStatus, value: count() })
    .from(blockchainAuditLogs)
    .groupBy(blockchainAuditLogs.blockchainStatus);

  const stats = rows.reduce(
    (acc, row) => {
      acc[row.status] = Number(row.value);
      return acc;
    },
    {} as Record<string, number>,
  );

  return {
    total: Object.values(stats).reduce((sum, v) => sum + v, 0),
    pending: stats.pending ?? 0,
    submitted: stats.submitted ?? 0,
    failed: stats.failed ?? 0,
    verified: stats.verified ?? 0,
  };
}
