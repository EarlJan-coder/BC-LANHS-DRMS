import type { notifications } from "@/db/schema";

type NewNotification = typeof notifications.$inferInsert;

export function buildNewRequestNotification(
  trackingNumber: string,
  documentType: string,
): Pick<NewNotification, "type" | "title" | "message"> {
  void trackingNumber;
  void documentType;
  return {
    type: "request",
    title: "New document request submitted",
    message: "Request · Pending",
  };
}

export function buildRegistrationDecisionNotification(
  studentName: string,
  decision: "approved" | "declined",
): Pick<NewNotification, "type" | "title" | "message"> {
  void studentName;
  const status = decision === "approved" ? "Approved" : "Declined";
  return {
    type: "system",
    title: `Registration ${status.toLowerCase()}`,
    message: `Registration · ${status}`,
  };
}

/** Badge label for the sidebar: null = no badge, "99+" = cap. */
export function formatUnreadCount(count: number): string | null {
  if (count <= 0) {
    return null;
  }
  return count >= 100 ? "99+" : String(count);
}
