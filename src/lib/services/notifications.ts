import { and, count, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { notifications, users } from "@/db/schema";
import { buildNewRequestNotification } from "@/lib/notifications";
import { AppError } from "@/lib/utils";

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
    .values(registrars.map((registrar) => ({ userId: registrar.id, ...payload })))
    .returning({ id: notifications.id, userId: notifications.userId });
}

/** Newest-first listing of one user's notifications. */
export async function listUserNotifications(userId: string, limit = 20) {
  return getDb()
    .select({
      id: notifications.id,
      title: notifications.title,
      message: notifications.message,
      isRead: notifications.isRead,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}
