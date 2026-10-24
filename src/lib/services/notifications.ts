import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { notifications, users } from "@/db/schema";
import { ensureCurrentDbUser } from "@/lib/auth";

/** Unread notification count for the signed-in user (0 when signed out). */
export async function countUnreadNotifications(): Promise<number> {
  const db = getDb();
  const user = await ensureCurrentDbUser();
  if (!user) {
    return 0;
  }

  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)));

  return rows.length;
}

/**
 * Mark one notification read. Scoped to the current user: returns false when
 * the notification does not exist or belongs to someone else.
 */
export async function markNotificationRead(notificationId: string): Promise<boolean> {
  const db = getDb();
  const user = await ensureCurrentDbUser();
  if (!user) {
    return false;
  }

  const updated = await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, user.id)))
    .returning({ id: notifications.id });

  return updated.length > 0;
}

/** Mark every unread notification of the current user as read. */
export async function markAllNotificationsRead(): Promise<number> {
  const db = getDb();
  const user = await ensureCurrentDbUser();
  if (!user) {
    return 0;
  }

  const updated = await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)))
    .returning({ id: notifications.id });

  return updated.length;
}

/**
 * Fan out one notification copy to every active registrar (registrar-only per
 * user ruling; admins are not included). Each copy has its own read state.
 */
export async function createRegistrarNotifications(
  values: Pick<typeof notifications.$inferInsert, "type" | "title" | "message">,
): Promise<number> {
  const db = getDb();

  const registrars = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "registrar"), eq(users.status, "active"), eq(users.isActive, true)));

  if (registrars.length === 0) {
    return 0;
  }

  await db
    .insert(notifications)
    .values(registrars.map((registrar) => ({ ...values, userId: registrar.id })));

  return registrars.length;
}
