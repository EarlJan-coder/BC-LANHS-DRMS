import { getCurrentDbUser } from "@/lib/auth";
import { SectionHeading } from "@/components/section-heading";
import { NotificationsList, type NotificationItem } from "@/components/notifications-list";
import { listUserNotifications } from "@/lib/services/notifications";
import { Pagination } from "@/components/ui/pagination";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";

export const dynamic = "force-dynamic";

export default async function RegistrarNotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = parsePage((await searchParams).page);
  // Identity is resolved here at the boundary and passed into the service.
  // Role gating for /registrar lives in the registrar layout.
  const user = await getCurrentDbUser();
  const paged = user ? await listUserNotifications(user.id, { page }) : { rows: [], total: 0, page, pageSize: PAGE_SIZE };

  const notifications: NotificationItem[] = paged.rows.map((row) => ({
    id: row.id,
    title: row.title,
    message: row.message,
    isRead: row.isRead,
    createdAt: row.createdAt.toISOString(),
  }));

  return (
    <div>
      <SectionHeading title="Notifications" description="Your notification history — every notification sent to your account." />
      <NotificationsList initialNotifications={notifications} viewerRole={user?.role ?? "registrar"} />
      <Pagination page={paged.page} totalPages={Math.ceil(paged.total / paged.pageSize)} basePath="/registrar/notifications" total={paged.total} pageSize={paged.pageSize} />
    </div>
  );
}
