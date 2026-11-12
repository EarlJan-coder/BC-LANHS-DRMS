import type { ReactNode } from "react";
import { PortalShell } from "@/components/layout/portal-shell";
import { getCurrentDbUser } from "@/lib/auth";
import { countUnread } from "@/lib/services/notifications";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  // Seed the notification bell with the current unread count so the first
  // render shows the right badge without waiting for the first poll.
  const user = await getCurrentDbUser();
  const unreadCount = user ? await countUnread(user.id) : 0;

  return (
    <PortalShell unreadCount={unreadCount} viewerRole={user?.role}>
      {children}
    </PortalShell>
  );
}
