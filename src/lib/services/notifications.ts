import { and, count, desc, eq, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { certificates, documentRequests, documentTypes, notifications, students, users } from "@/db/schema";
import { buildNewRequestNotification, buildRegistrationDecisionNotification } from "@/lib/notifications";
import { AppError } from "@/lib/utils";
import { makePaged, PAGE_SIZE, type Paged } from "@/lib/pagination";

/**
 * Notification reads/writes are owner-scoped: the caller's identity is resolved
 * at the boundary (API route / page) and passed in explicitly, so every
 * function here is testable outside a request scope.
 */

export async function countUnread(userId: string): Promise<number> {
  const [row] = await getDb()
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

  return Number(row?.value ?? 0);
}

/**
 * Mark one notification read on the owner's behalf. A row that is not the
 * caller's (or does not exist) is reported as "Notification not found." so the
 * API route maps it to 404 — never 403 — to avoid confirming ids. Marking an
 * already-read notification is an idempotent success.
 */
export async function markRead(userId: string, notificationId: string) {
  // Cast the id to text so malformed ids take the not-found path instead of a
  // Postgres uuid parse error (same trick as generateRequestSlipPdf).
  const updated = await getDb()
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, userId), sql`${notifications.id}::text = ${notificationId}`))
    .returning({ id: notifications.id });

  if (updated.length === 0) {
    throw new AppError("Notification not found.", 404);
  }
}

/** Mark every unread notification read; returns how many rows changed. */
export async function markAll(userId: string): Promise<number> {
  const updated = await getDb()
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
    .returning({ id: notifications.id });

  return updated.length;
}

/**
 * Fan a new document request out to every ACTIVE registrar-role user — the
 * ruled product behavior: no admin copies, no inactive/suspended accounts.
 * Returns the rows created.
 */
export async function fanOutNewRequestNotification(trackingNumber: string, documentType: string) {
  const db = getDb();
  const registrars = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "registrar"), eq(users.isActive, true), eq(users.status, "active")));

  if (registrars.length === 0) {
    return [];
  }

  const payload = buildNewRequestNotification(trackingNumber, documentType);

  return db
    .insert(notifications)
    .values(registrars.map((registrar) => ({
      userId: registrar.id,
      ...payload,
      referenceType: "document_request",
      referenceId: trackingNumber,
    })))
    .returning({ id: notifications.id, userId: notifications.userId });
}

export async function fanOutNewRegistrationNotification(_name: string, email: string) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [student] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!student) {
      throw new AppError("Registration not found.", 404);
    }

    const reviewers = await tx
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          inArray(users.role, ["registrar", "admin"]),
          eq(users.isActive, true),
          eq(users.status, "active"),
        ),
      );
    if (reviewers.length === 0) return [];

    return tx
      .insert(notifications)
      .values(
        reviewers.map((reviewer) => ({
          userId: reviewer.id,
          type: "system" as const,
          title: "New student registration",
          message: "Registration · Pending",
          referenceType: "registration",
          referenceId: student.id,
        })),
      )
      .returning({ id: notifications.id, userId: notifications.userId });
  });
}

export async function notifyRegistrationDecision(input: {
  userId: string;
  studentName: string;
  decision: "approved" | "declined";
}) {
  if (input.decision !== "approved") return [];
  return getDb()
    .insert(notifications)
    .values({
      userId: input.userId,
      ...buildRegistrationDecisionNotification(input.studentName, input.decision),
      referenceType: "registration",
      referenceId: input.userId,
    })
    .returning({ id: notifications.id, userId: notifications.userId });
}

export async function getNotificationDetail(userId: string, notificationId: string) {
  const db = getDb();
  const [notification] = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), sql`${notifications.id}::text = ${notificationId}`))
    .limit(1);

  if (!notification) throw new AppError("Notification not found.", 404);

  const notificationSummary = {
    title: notification.title,
    message: notification.message,
    createdAt: notification.createdAt.toISOString(),
  };
  if (!notification.referenceType || !notification.referenceId) {
    return { kind: "message" as const, record: notificationSummary };
  }

  if (notification.referenceType === "registration") {
    const [owner] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
    const [registration] = await db
      .select({
        id: users.id,
        email: users.email,
        lrn: users.lrn,
        firstName: users.firstName,
        middleName: users.middleName,
        lastName: users.lastName,
        registrationStatus: users.registrationStatus,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(sql`${users.id}::text = ${notification.referenceId}`)
      .limit(1);
    if (!registration || !owner || (owner.role === "student" && registration.id !== userId)) {
      throw new AppError("Notification not found.", 404);
    }
    return {
      kind: "registration" as const,
      record: {
        id: registration.id,
        name: [registration.firstName, registration.middleName, registration.lastName].filter(Boolean).join(" "),
        email: registration.email,
        lrn: registration.lrn ?? "",
        registrationStatus: registration.registrationStatus,
        createdAt: registration.createdAt.toISOString(),
        notification: notificationSummary,
      },
    };
  }

  if (notification.referenceType === "document_request") {
    const [owner] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
    const [row] = await db
      .select({
        id: documentRequests.id,
        trackingNumber: documentRequests.trackingNumber,
        purpose: documentRequests.purpose,
        schoolYearNeeded: documentRequests.schoolYearNeeded,
        gradeLevelNeeded: documentRequests.gradeLevelNeeded,
        strandNeeded: documentRequests.strandNeeded,
        sectionNeeded: documentRequests.sectionNeeded,
        status: documentRequests.status,
        remarks: documentRequests.remarks,
        registrarRemarks: documentRequests.registrarRemarks,
        requestedByUserId: documentRequests.requestedByUserId,
        studentUserId: students.userId,
        studentName: sql<string>`concat_ws(' ', ${students.firstName}, ${students.middleName}, ${students.lastName}, ${students.suffix})`,
        documentType: documentTypes.name,
      })
      .from(documentRequests)
      .leftJoin(students, eq(documentRequests.studentId, students.id))
      .leftJoin(documentTypes, eq(documentRequests.documentTypeId, documentTypes.id))
      .where(
        or(
          sql`${documentRequests.id}::text = ${notification.referenceId}`,
          eq(documentRequests.trackingNumber, notification.referenceId),
        ),
      )
      .limit(1);
    if (
      !row ||
      !owner ||
      (owner.role === "student" && row.requestedByUserId !== userId && row.studentUserId !== userId)
    ) {
      throw new AppError("Notification not found.", 404);
    }
    const record = {
      id: row.id,
      trackingNumber: row.trackingNumber,
      purpose: row.purpose,
      schoolYearNeeded: row.schoolYearNeeded,
      gradeLevelNeeded: row.gradeLevelNeeded,
      strandNeeded: row.strandNeeded,
      sectionNeeded: row.sectionNeeded,
      status: row.status,
      remarks: row.remarks,
      registrarRemarks: row.registrarRemarks,
      studentName: row.studentName,
      documentType: row.documentType,
    };
    return { kind: "request" as const, record: { ...record, notification: notificationSummary } };
  }

  if (notification.referenceType === "certificate") {
    const [owner] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
    const [row] = await db
      .select({
        id: certificates.id,
        certificateNumber: certificates.certificateNumber,
        certificateType: certificates.certificateType,
        verificationCode: certificates.verificationCode,
        generatedAt: certificates.generatedAt,
        studentUserId: students.userId,
        requestedByUserId: documentRequests.requestedByUserId,
        studentName: sql<string>`concat_ws(' ', ${students.firstName}, ${students.middleName}, ${students.lastName}, ${students.suffix})`,
      })
      .from(certificates)
      .leftJoin(students, eq(certificates.studentId, students.id))
      .leftJoin(documentRequests, eq(certificates.requestId, documentRequests.id))
      .where(
        or(
          sql`${certificates.id}::text = ${notification.referenceId}`,
          eq(certificates.certificateNumber, notification.referenceId),
        ),
      )
      .limit(1);
    if (
      !row ||
      !owner ||
      (owner.role === "student" && row.requestedByUserId !== userId && row.studentUserId !== userId)
    ) {
      throw new AppError("Notification not found.", 404);
    }
    const record = {
      id: row.id,
      certificateNumber: row.certificateNumber,
      certificateType: row.certificateType,
      verificationCode: row.verificationCode,
      generatedAt: row.generatedAt,
      studentName: row.studentName,
    };
    return { kind: "certificate" as const, record: { ...record, notification: notificationSummary } };
  }

  return { kind: "message" as const, record: notificationSummary };
}

/** Newest-first listing of one user's notifications. */
async function listUserNotificationsRows(userId: string, limit?: number, offset = 0) {
  const query = getDb()
    .select({
      id: notifications.id,
      title: notifications.title,
      message: notifications.message,
      isRead: notifications.isRead,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt));
  return limit === undefined ? query : query.limit(limit).offset(offset);
}

export function listUserNotifications(userId: string, options: { page: number; pageSize?: number }): Promise<Paged<Awaited<ReturnType<typeof listUserNotificationsRows>>[number]>>;
export function listUserNotifications(userId: string, limit?: number): Promise<Awaited<ReturnType<typeof listUserNotificationsRows>>>;
export async function listUserNotifications(userId: string, options: number | { page?: number; pageSize?: number } = 20) {
  if (typeof options === "object" && options.page !== undefined) {
    const [countRow] = await getDb().select({ value: count() }).from(notifications).where(eq(notifications.userId, userId));
    const total = Number(countRow?.value ?? 0);
    const pageSize = options.pageSize ?? PAGE_SIZE;
    const page = makePaged([], total, options.page, pageSize).page;
    const rows = await listUserNotificationsRows(userId, pageSize, (page - 1) * pageSize);
    return makePaged(rows, total, page, pageSize);
  }
  return listUserNotificationsRows(userId, typeof options === "number" ? options : 20);
}
