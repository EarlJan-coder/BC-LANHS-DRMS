import type { DashboardRole } from "./types";

export const navigationByRole: Record<DashboardRole, Array<{ label: string; href: string; icon: string; badge?: boolean }>> = {
  student: [
    { label: "Dashboard", href: "/student/dashboard", icon: "LayoutDashboard" },
    { label: "Submit request", href: "/student/requests/new", icon: "FilePlus" },
    { label: "My requests", href: "/student/requests", icon: "Files" },
    { label: "Notifications", href: "/student/notifications", icon: "Bell" },
    { label: "Profile", href: "/student/profile", icon: "UserRound" },
  ],
  registrar: [
    { label: "Dashboard", href: "/registrar/dashboard", icon: "LayoutDashboard" },
    { label: "Requests", href: "/registrar/requests", icon: "Inbox" },
    { label: "Notifications", href: "/registrar/notifications", icon: "Bell", badge: true },
    { label: "Student records", href: "/registrar/students", icon: "GraduationCap" },
    { label: "Certificates", href: "/registrar/certificates", icon: "FileBadge" },
    { label: "Reports", href: "/registrar/reports", icon: "BarChart3" },
    { label: "Audit logs", href: "/registrar/audit-logs", icon: "ShieldCheck" },
  ],
  admin: [
    { label: "Dashboard", href: "/admin/dashboard", icon: "LayoutDashboard" },
    { label: "Users", href: "/admin/users", icon: "Users" },
    { label: "Academic setup", href: "/admin/academic-setup", icon: "Library" },
    { label: "Document types", href: "/admin/document-types", icon: "FileText" },
    { label: "School years", href: "/admin/school-years", icon: "CalendarDays" },
    { label: "Grade levels", href: "/admin/grade-levels", icon: "PanelsTopLeft" },
    { label: "Sections", href: "/admin/sections", icon: "Blocks" },
    { label: "Blockchain trail", href: "/admin/blockchain", icon: "Blocks" },
    { label: "Settings", href: "/admin/settings", icon: "Settings" },
  ],
};
