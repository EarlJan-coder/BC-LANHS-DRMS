import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { dashboardPathForRole, getCurrentRole, roleCanAccessPath } from "@/lib/auth";

export default async function AdminRoleLayout({ children }: { children: ReactNode }) {
  const role = await getCurrentRole();
  if (!roleCanAccessPath(role, "/admin")) {
    redirect(dashboardPathForRole(role));
  }

  return children;
}
