import type { ReactNode } from "react";
import { PortalShell } from "@/components/layout/portal-shell";
import { getDb } from "@/db";
import { students } from "@/db/schema";
import { getCurrentDbUser } from "@/lib/auth";
import { countUnread } from "@/lib/services/notifications";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  // Seed the notification bell with the current unread count so the first
  // render shows the right badge without waiting for the first poll.
  const user = await getCurrentDbUser();
  const unreadCount = user ? await countUnread(user.id) : 0;
  const studentType = user?.role === "student"
    ? (await getDb().query.students.findFirst({
        columns: { studentType: true },
        where: eq(students.userId, user.id),
      }))?.studentType
    : undefined;

  return (
    <PortalShell unreadCount={unreadCount} viewerRole={user?.role} studentType={studentType}>
      {children}
    </PortalShell>
  );
}
