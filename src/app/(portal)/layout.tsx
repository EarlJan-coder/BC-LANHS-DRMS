import type { ReactNode } from "react";
import { PortalShell } from "@/components/layout/portal-shell";

export const dynamic = "force-dynamic";

export default function PortalLayout({ children }: { children: ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
