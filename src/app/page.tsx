import { ArrowRight, Blocks, FileCheck2, ShieldCheck, UploadCloud, UsersRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { AppLogo } from "@/components/layout/app-logo";
import { MotionReveal } from "@/components/motion-reveal";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SCHOOL_NAME } from "@/lib/constants";

const features = [
  {
    icon: FileCheck2,
    title: "Online document requests",
    copy: "Students and alumni submit requests, receive tracking numbers, and monitor status updates.",
  },
  {
    icon: UploadCloud,
    title: "XLSX grade import",
    copy: "Registrar staff validate spreadsheet rows, review errors, and save only clean grade records.",
  },
  {
    icon: ShieldCheck,
    title: "Certificate verification",
    copy: "Certificate of Grades PDFs include QR codes for public non-sensitive verification.",
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

      <section className="relative overflow-hidden bg-brand text-white">
        <Image
          src="/lanhs-logo.svg"
          alt=""
          width={520}
          height={520}
          className="pointer-events-none absolute -right-20 top-4 hidden opacity-10 lg:block"
          priority
        />
        <div className="mx-auto grid min-h-[580px] max-w-7xl content-center gap-8 px-4 py-16 sm:px-6 lg:px-8">
          <MotionReveal>
            <div className="max-w-4xl">
              <p className="text-sm font-semibold uppercase text-rose-100">{SCHOOL_NAME}</p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
                Student Records and Document Request Management System
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-rose-50">
                A secure registrar portal for online school document requests, grade records, Certificate of Grades
                PDFs, email notifications, QR verification, and blockchain-backed audit proofs.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <ButtonLink href="/sign-in" tone="secondary" className="bg-white text-brand hover:bg-rose-50">
                  Login to portal
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </ButtonLink>
                <ButtonLink href="/sign-up" className="bg-brand-dark hover:bg-red-950">
                  Register account
                </ButtonLink>
              </div>
            </div>
          </MotionReveal>
          <MotionReveal delay={0.12}>
            <div className="grid max-w-4xl gap-3 sm:grid-cols-3">
              {["Submit request", "Registrar validates", "PDF with QR proof"].map((step, index) => (
                <div key={step} className="rounded-lg border border-white/20 bg-white/10 p-4 backdrop-blur">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-bold text-brand">
                    {index + 1}
                  </span>
                  <p className="mt-3 text-sm font-semibold">{step}</p>
                </div>
              ))}
            </div>
          </MotionReveal>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-10 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        {features.map((item, index) => {
          const Icon = item.icon;

          return (
            <MotionReveal key={item.title} delay={0.05 * index}>
              <Card className="h-full p-5">
                <Icon className="h-6 w-6 text-brand" aria-hidden />
                <h2 className="mt-4 text-base font-semibold text-slate-950">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{item.copy}</p>
              </Card>
            </MotionReveal>
          );
        })}
      </section>

      <section className="border-y border-border bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-rose-50 text-brand">
              <UsersRound className="h-5 w-5" aria-hidden />
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-slate-950">Built around real registrar workflows</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              The portal separates student, registrar, and administrator responsibilities so each user sees the tools
              they need and nothing noisy.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {["Student requests", "Grade import preview", "Certificate verification"].map((item) => (
              <div key={item} className="rounded-lg border border-border bg-slate-50 p-4 text-sm font-medium text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
