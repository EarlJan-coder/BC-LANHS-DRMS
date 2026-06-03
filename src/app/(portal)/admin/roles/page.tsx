import { ShieldCheck } from "lucide-react";
import { SectionHeading } from "@/components/section-heading";
import { Card } from "@/components/ui/card";

const roles = [
  { name: "Student / Alumni", access: "Requests, profile, notifications" },
  { name: "Registrar / Staff", access: "Requests, records, grades, reports, audit logs" },
  { name: "Administrator", access: "Users, roles, setup tables, blockchain trail, settings" },
];

export default function RoleManagementPage() {
  return (
    <div>
      <SectionHeading title="Role management" description="Role-based navigation and server authorization structure." />
      <div className="grid gap-4 md:grid-cols-3">
        {roles.map((role) => (
          <Card key={role.name} className="p-5">
            <ShieldCheck className="h-6 w-6 text-brand" aria-hidden />
            <h2 className="mt-4 text-base font-semibold text-slate-950">{role.name}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{role.access}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

