import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/layout/portal-shell";
import { ensureCurrentDbUser } from "@/lib/auth";
import { formatUnreadCount } from "@/lib/notifications";
import { navigationByRole } from "@/lib/navigation";
import { countUnreadNotifications } from "@/lib/services/notifications";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const user = await ensureCurrentDbUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Only roles whose nav has a badge item (registrar) pay for the count query.
  const badgeRole = user.role === "registrar" || user.role === "admin" ? user.role : null;
  const hasBadge = badgeRole ? (navigationByRole[badgeRole]?.some((item) => item.badge) ?? false) : false;
  const unreadCount = hasBadge ? formatUnreadCount(await countUnreadNotifications()) : null;

  return (
    <PortalShell
      user={{ firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role }}
      unreadCount={unreadCount}
    >
      {children}
    </PortalShell>
  );
}
