import type { ReactNode } from "react";
import { PortalShell } from "@/components/layout/portal-shell";
import { getCurrentDbUser } from "@/lib/auth";
import { navigationByRole } from "@/lib/navigation";
import { countUnread } from "@/lib/services/notifications";
import type { DashboardRole } from "@/lib/types";

export const dynamic = "force-dynamic";

// DashboardRole (the nav keys) matches UserRole one-to-one now that the
// alumni role is gone.
const dashboardRoleFor: Record<string, DashboardRole | undefined> = {
  admin: "admin",
  registrar: "registrar",
  student: "student",
};

export default async function PortalLayout({ children }: { children: ReactNode }) {
  // Unread badge is a server-rendered count: the client only calls
  // router.refresh() after mark-one/mark-all to round-trip the new value.
  const user = await getCurrentDbUser();
  const navRole = user ? dashboardRoleFor[user.role] : undefined;
  const hasBadgeNav = navRole ? navigationByRole[navRole].some((item) => item.badge) : false;
  const unreadCount = user && hasBadgeNav ? await countUnread(user.id) : undefined;

  return <PortalShell unreadCount={unreadCount}>{children}</PortalShell>;
}
