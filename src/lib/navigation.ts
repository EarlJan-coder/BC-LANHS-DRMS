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
  Array<{ label: string; href: string; icon: string; section?: string }>
> = {
  student: [
    { section: "Overview", label: "Dashboard", href: "/student/dashboard", icon: "LayoutDashboard" },
    { section: "Requests", label: "Submit request", href: "/student/requests/new", icon: "FilePlus" },
    { section: "Requests", label: "My requests", href: "/student/requests", icon: "Files" },
    { section: "Account", label: "Profile", href: "/student/profile", icon: "UserRound" },
  ],
  registrar: [
    { section: "Overview", label: "Dashboard", href: "/registrar/dashboard", icon: "LayoutDashboard" },
    { section: "Workflow", label: "Requests", href: "/registrar/requests", icon: "Inbox" },
    { section: "Workflow", label: "Registrations", href: "/registrar/registrations", icon: "UserRoundCheck" },
    { section: "Records", label: "Student records", href: "/registrar/students", icon: "GraduationCap" },
    { section: "Records", label: "Certificates", href: "/registrar/certificates", icon: "FileBadge" },
    { section: "Insights", label: "Reports", href: "/registrar/reports", icon: "BarChart3" },
    { section: "Insights", label: "Logs", href: "/registrar/audit-logs", icon: "ShieldCheck" },
  ],
  admin: [
    { section: "Overview", label: "Dashboard", href: "/admin/dashboard", icon: "LayoutDashboard" },
    { section: "Student services", label: "Requests", href: "/admin/requests", icon: "Inbox" },
    { section: "Student services", label: "Registrations", href: "/admin/registrations", icon: "UserRoundCheck" },
    { section: "Student services", label: "Certificates", href: "/admin/certificates", icon: "FileBadge" },
    { section: "Student services", label: "Reports", href: "/admin/reports", icon: "BarChart3" },
    { section: "Administration", label: "User management", href: "/admin/users", icon: "Users" },
    { section: "Administration", label: "Document types", href: "/admin/document-types", icon: "FileText" },
    { section: "Administration", label: "Document template", href: "/admin/document-template", icon: "FileSignature" },
    { section: "System", label: "Blockchain trail", href: "/admin/blockchain", icon: "Blocks" },
    { section: "System", label: "Settings", href: "/admin/settings", icon: "Settings" },
  ],
};
