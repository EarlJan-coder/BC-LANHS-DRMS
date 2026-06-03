import { ArrowRight, Blocks, FileCheck2, ShieldCheck, UploadCloud } from "lucide-react";
import Link from "next/link";
import { AppLogo } from "@/components/layout/app-logo";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SCHOOL_NAME } from "@/lib/constants";

const workflows = [
  {
    icon: FileCheck2,
    title: "Online document requests",
    copy: "Students and alumni submit requests, receive tracking numbers, and follow status updates.",
  },
  {
    icon: UploadCloud,
    title: "Bulk grade import",
    copy: "Registrar staff validate Excel or CSV grade files before records are saved.",
  },
  {
    icon: Blocks,
    title: "Blockchain audit proofs",
    copy: "Important actions are hashed and recorded on-chain without exposing private student data.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <AppLogo />
          <nav className="hidden items-center gap-2 sm:flex">
            <Link href="/about" className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:text-brand">
              About
            </Link>
            <ButtonLink href="/sign-in" tone="secondary">
              Login
            </ButtonLink>
            <ButtonLink href="/sign-up">Register</ButtonLink>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-14">
        <div className="flex flex-col justify-center">
          <p className="text-sm font-semibold uppercase text-brand">{SCHOOL_NAME}</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold text-slate-950 sm:text-5xl">
            Student Records and Document Request Management System
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
            A full-stack school registrar system for document requests, grade records, certificate preparation,
            staff workflows, and privacy-preserving blockchain audit logs.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/student">
              Student dashboard
              <ArrowRight className="h-4 w-4" aria-hidden />
            </ButtonLink>
            <ButtonLink href="/registrar" tone="secondary">
              Registrar workspace
            </ButtonLink>
            <ButtonLink href="/admin" tone="secondary">
              Admin console
            </ButtonLink>
          </div>
        </div>

        <Card className="p-5">
          <div className="rounded-lg bg-brand p-5 text-white">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-8 w-8" aria-hidden />
              <div>
                <p className="text-sm font-medium text-rose-100">Current workflow</p>
                <p className="text-xl font-semibold">Request LANHS-20260603-A8K2Q</p>
              </div>
            </div>
            <div className="mt-6 grid gap-3">
              {["Submitted", "Under Review", "Approved", "Ready for Pickup"].map((step, index) => (
                <div key={step} className="flex items-center gap-3 rounded-md bg-white/10 px-3 py-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-semibold text-brand">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 pb-12 sm:px-6 md:grid-cols-3 lg:px-8">
        {workflows.map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.title} className="p-5">
              <Icon className="h-6 w-6 text-brand" aria-hidden />
              <h2 className="mt-4 text-base font-semibold text-slate-950">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{item.copy}</p>
            </Card>
          );
        })}
      </section>
    </main>
  );
}

