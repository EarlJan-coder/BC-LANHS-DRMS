import { Bell } from "lucide-react";
import { SectionHeading } from "@/components/section-heading";
import { Card } from "@/components/ui/card";
import { listCurrentUserNotifications } from "@/lib/services/live-data";

export default async function StudentNotificationsPage() {
  const notifications = await listCurrentUserNotifications();

  return (
    <div>
      <SectionHeading title="Notifications" description="System and registrar updates for your document requests." />
      <div className="grid gap-3">
        {notifications.length === 0 ? (
          <Card className="p-4 text-sm text-slate-500">No notifications yet.</Card>
        ) : (
          notifications.map((notification) => (
            <Card key={notification.id} className="flex items-start gap-3 p-4">
              <Bell className="mt-0.5 h-5 w-5 text-brand" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                <p className="mt-1 text-sm text-slate-700">{notification.message}</p>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
