import type { DashboardRole } from "./types";

/**
 * Reports whether a nav item should be highlighted for the current path.
 *
 * An exact match always wins, and a prefix only counts on a path-segment
 * boundary. Without those two rules, `/student/requests/new` (Submit request)
 * would also light up its parent item `/student/requests` (My requests),
 * leaving two items highlighted at once.
 */
export function isNavItemActive(
  pathname: string,
  href: string,
  items: Array<{ href: string }>,
): boolean {
  if (pathname === href) return true;
  if (items.some((item) => item.href === pathname)) return false;
  return pathname.startsWith(`${href}/`);
}

export const navigationByRole: Record<
  DashboardRole,
  Array<{ label: string; href: string; icon: string }>
> = {
  student: [
    { label: "Dashboard", href: "/student/dashboard", icon: "LayoutDashboard" },
    { label: "Submit request", href: "/student/requests/new", icon: "FilePlus" },
    { label: "My requests", href: "/student/requests", icon: "Files" },
    { label: "Profile", href: "/student/profile", icon: "UserRound" },
  ],
  registrar: [
    { label: "Dashboard", href: "/registrar/dashboard", icon: "LayoutDashboard" },
    { label: "Requests", href: "/registrar/requests", icon: "Inbox" },
    { label: "Registrations", href: "/registrar/registrations", icon: "UserRoundCheck" },
    { label: "Student records", href: "/registrar/students", icon: "GraduationCap" },
    { label: "Certificates", href: "/registrar/certificates", icon: "FileBadge" },
    { label: "Reports", href: "/registrar/reports", icon: "BarChart3" },
    { label: "Logs", href: "/registrar/audit-logs", icon: "ShieldCheck" },
  ],
  admin: [
    { label: "Dashboard", href: "/admin/dashboard", icon: "LayoutDashboard" },
    { label: "Registrations", href: "/admin/registrations", icon: "UserRoundCheck" },
    { label: "Users", href: "/admin/users", icon: "Users" },
    { label: "Document types", href: "/admin/document-types", icon: "FileText" },
    { label: "Document template", href: "/admin/document-template", icon: "FileSignature" },
    { label: "Blockchain trail", href: "/admin/blockchain", icon: "Blocks" },
    { label: "Settings", href: "/admin/settings", icon: "Settings" },
  ],
};
