import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { clerkConfigured, dashboardPathForRole, getCurrentRole, roleCanAccessPath } from "@/lib/auth";
import { getRequestEligibility } from "@/lib/services/document-requests";
import { LrnReminderBanner } from "@/components/lrn-reminder-banner";

export default async function StudentRoleLayout({ children }: { children: ReactNode }) {
  if (clerkConfigured()) {
    const role = await getCurrentRole();
    if (!roleCanAccessPath(role, "/student")) {
      redirect(dashboardPathForRole(role));
    }
  }

  const eligibility = await getRequestEligibility();

  if (!eligibility.eligible && eligibility.reason) {
    return (
      <>
        <LrnReminderBanner reason={eligibility.reason} />
        {children}
      </>
    );
  }

  return children;
}
