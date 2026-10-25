import type { notifications } from "@/db/schema";

type NewNotification = typeof notifications.$inferInsert;

export function buildNewRequestNotification(
  trackingNumber: string,
  documentType: string,
): Pick<NewNotification, "type" | "title" | "message"> {
  return {
    type: "request",
    title: "New document request submitted",
    message: `${trackingNumber} (${documentType}) is awaiting registrar review.`,
  };
}

/** Badge label for the sidebar: null = no badge, "99+" = cap. */
export function formatUnreadCount(count: number): string | null {
  if (count <= 0) {
    return null;
  }
  return count >= 100 ? "99+" : String(count);
}
