import { Blocks, Database, Mail, ShieldCheck } from "lucide-react";
import { AppLogo } from "@/components/layout/app-logo";
import { Card } from "@/components/ui/card";
import { SCHOOL_NAME } from "@/lib/constants";

const items = [
  { icon: Database, title: "PostgreSQL records", copy: "Student, request, grade, notification, and audit tables are modeled with Drizzle ORM." },
  { icon: Mail, title: "Email notifications", copy: "Resend integration is prepared for request confirmation and status updates." },
  { icon: Blocks, title: "Blockchain proof", copy: "Only reference IDs, actions, actor roles, timestamps, and hashes are submitted on-chain." },
  { icon: ShieldCheck, title: "Role-based access", copy: "Student, registrar, and administrator workspaces are separated through Clerk and server checks." },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <AppLogo />
        <div className="mt-10">
          <p className="text-sm font-semibold uppercase text-brand">{SCHOOL_NAME}</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">About the system</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
            LANHS DRMS supports registrar workflows for document requests, student records, bulk grade import,
            certificate generation, and immutable audit verification while keeping private student information off
            the blockchain.
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {items.map((item) => {
            const Icon = item.icon;

            return (
              <Card key={item.title} className="p-5">
                <Icon className="h-6 w-6 text-brand" aria-hidden />
                <h2 className="mt-4 text-base font-semibold text-slate-950">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{item.copy}</p>
              </Card>
            );
          })}
        </div>
      </div>
    </main>
  );
}

