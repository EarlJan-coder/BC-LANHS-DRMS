import { SectionHeading } from "@/components/section-heading";
import { NotificationsList } from "@/components/notifications-list";
import { listCurrentUserNotifications } from "@/lib/services/live-data";

export default async function RegistrarNotificationsPage() {
  const notifications = await listCurrentUserNotifications(50);

  return (
    <div>
      <SectionHeading
        title="Notifications"
        description="New document requests and system updates. Click a notification to mark it as read."
      />
      <NotificationsList
        initialNotifications={notifications.map((notification) => ({
          ...notification,
          createdAt: notification.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
