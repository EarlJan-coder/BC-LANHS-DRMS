import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { clerkConfigured, dashboardPathForRole, getCurrentRole, roleCanAccessPath } from "@/lib/auth";

export default async function RegistrarRoleLayout({ children }: { children: ReactNode }) {
  if (clerkConfigured()) {
    const role = await getCurrentRole();
    if (!roleCanAccessPath(role, "/registrar")) {
      redirect(dashboardPathForRole(role));
    }
  }

  return children;
}
