import { getCurrentDbUser } from "@/lib/auth";
import { SectionHeading } from "@/components/section-heading";
import { NotificationsList, type NotificationItem } from "@/components/notifications-list";
import { listUserNotifications } from "@/lib/services/notifications";

export const dynamic = "force-dynamic";

export default async function RegistrarNotificationsPage() {
  // Identity is resolved here at the boundary and passed into the service.
  // Role gating for /registrar lives in the registrar layout.
  const user = await getCurrentDbUser();
  const rows = user ? await listUserNotifications(user.id) : [];

  const notifications: NotificationItem[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    message: row.message,
    isRead: row.isRead,
    createdAt: row.createdAt.toISOString(),
  }));

  return (
    <div>
      <SectionHeading title="Notifications" description="Your notification history — every notification sent to your account." />
      <NotificationsList initialNotifications={notifications} />
    </div>
  );
}
