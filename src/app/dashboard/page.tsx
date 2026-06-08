import { redirect } from "next/navigation";
import { dashboardPathForRole, getCurrentRole } from "@/lib/auth";

export default async function DashboardRedirectPage() {
  const role = await getCurrentRole();
  redirect(dashboardPathForRole(role));
}
