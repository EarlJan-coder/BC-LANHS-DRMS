import type { DashboardRole } from "./types";

export const navigationByRole: Record<DashboardRole, Array<{ label: string; href: string; icon: string }>> = {
  student: [
    { label: "Dashboard", href: "/student", icon: "LayoutDashboard" },
    { label: "Submit request", href: "/student/requests/new", icon: "FilePlus" },
    { label: "My requests", href: "/student/requests", icon: "Files" },
    { label: "Profile", href: "/student/profile", icon: "UserRound" },
    { label: "Notifications", href: "/student/notifications", icon: "Bell" },
  ],
  registrar: [
    { label: "Dashboard", href: "/registrar", icon: "LayoutDashboard" },
    { label: "Requests", href: "/registrar/requests", icon: "Inbox" },
    { label: "Student records", href: "/registrar/students", icon: "GraduationCap" },
    { label: "Grade management", href: "/registrar/grades", icon: "BookOpenCheck" },
    { label: "Bulk import", href: "/registrar/grades/import", icon: "UploadCloud" },
    { label: "Certificates", href: "/registrar/certificates", icon: "FileBadge" },
    { label: "Reports", href: "/registrar/reports", icon: "BarChart3" },
    { label: "Audit logs", href: "/registrar/audit-logs", icon: "ShieldCheck" },
  ],
  admin: [
    { label: "Dashboard", href: "/admin", icon: "LayoutDashboard" },
    { label: "Users", href: "/admin/users", icon: "Users" },
    { label: "Roles", href: "/admin/roles", icon: "KeyRound" },
    { label: "Document types", href: "/admin/document-types", icon: "FileText" },
    { label: "School years", href: "/admin/school-years", icon: "CalendarDays" },
    { label: "Grade levels", href: "/admin/grade-levels", icon: "PanelsTopLeft" },
    { label: "Subjects", href: "/admin/subjects", icon: "Library" },
    { label: "Blockchain trail", href: "/admin/blockchain", icon: "Blocks" },
    { label: "Settings", href: "/admin/settings", icon: "Settings" },
  ],
};

