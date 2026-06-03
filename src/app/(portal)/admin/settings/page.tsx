import { Database, Mail, Settings, ShieldCheck } from "lucide-react";
import { SectionHeading } from "@/components/section-heading";
import { Card } from "@/components/ui/card";
import { listAdminSettingStatuses } from "@/lib/services/live-data";

const icons = {
  Database,
  Authentication: ShieldCheck,
  Email: Mail,
  Blockchain: Settings,
};

const copy = {
  Database: "PostgreSQL connection through DATABASE_URL.",
  Authentication: "Clerk keys and metadata roles for protected routes.",
  Email: "Resend sender and notification templates.",
  Blockchain: "RPC URL, contract address, and retry handling for pending proofs.",
};

export default async function SystemSettingsPage() {
  const settings = await listAdminSettingStatuses();

  return (
    <div>
      <SectionHeading title="System settings" description="Deployment-ready environment areas for Vercel and local development." />
      <div className="grid gap-4 md:grid-cols-2">
        {settings.map((item) => {
          const Icon = icons[item.title as keyof typeof icons];

          return (
            <Card key={item.title} className="p-5">
              <Icon className="h-6 w-6 text-brand" aria-hidden />
              <div className="mt-4 flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-950">{item.title}</h2>
                <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-brand ring-1 ring-rose-100">
                  {item.value}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-500">{copy[item.title as keyof typeof copy]}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
