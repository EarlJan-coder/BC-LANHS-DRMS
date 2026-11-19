import { SystemSettingsPanel, type TechnicalDetail } from "@/components/system-settings-panel";
import { SectionHeading } from "@/components/section-heading";
import { getSystemHealth } from "@/lib/services/system-health";
import { getSystemSettings } from "@/lib/services/system-settings";

export const dynamic = "force-dynamic";

function presence(value: string | undefined) {
  return value ? "Set" : "Not set";
}

export default async function SystemSettingsPage() {
  const settings = await getSystemSettings();
  const statuses = await getSystemHealth();

  const technical: TechnicalDetail[] = [
    { label: "DATABASE_URL", value: presence(process.env.DATABASE_URL) },
    { label: "SESSION_SECRET", value: presence(process.env.SESSION_SECRET) },
    { label: "RESEND_API_KEY", value: presence(process.env.RESEND_API_KEY) },
    { label: "RESEND_FROM_EMAIL", value: process.env.RESEND_FROM_EMAIL ?? "(default)" },
    {
      label: "CRON_SECRET",
      value: process.env.CRON_SECRET
        ? "Set — automatic proof fixing can run"
        : "Not set — automatic proof fixing will not run",
    },
    {
      label: "Contract address",
      value: process.env.CONTRACT_ADDRESS ?? process.env.DOCUMENT_AUDIT_CONTRACT_ADDRESS ?? "Not set",
    },
  ];

  return (
    <div>
      <SectionHeading
        title="Settings"
        description="Check that everything the portal needs is working, and choose how it behaves."
      />
      <SystemSettingsPanel initialSettings={settings} initialStatuses={statuses} technical={technical} />
    </div>
  );
}
