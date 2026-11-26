import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Check,
  Clock3,
  FileCheck2,
  FilePlus2,
  LockKeyhole,
  QrCode,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { AppLogo } from "@/components/layout/app-logo";
import { MotionReveal } from "@/components/motion-reveal";
import { ButtonLink } from "@/components/ui/button";
import { PendingLink } from "@/components/ui/pending-link";
import { SCHOOL_NAME } from "@/lib/constants";

const features = [
  {
    icon: FilePlus2,
    number: "01",
    title: "Request online",
    copy: "Send a document request from your phone or computer, without making an extra trip just to get started.",
  },
  {
    icon: Clock3,
    number: "02",
    title: "Know what comes next",
    copy: "Follow your request with its tracking number and see status updates as the registrar reviews it.",
  },
  {
    icon: QrCode,
    number: "03",
    title: "Verify with a scan",
    copy: "Check a school certificate using its number or scan the QR code printed on the document.",
    href: "/verify",
  },
  {
    icon: LockKeyhole,
    number: "04",
    title: "Records handled with care",
    copy: "Role-based access supports student and registrar workflows while public verification keeps private details out of view.",
  },
];

const steps = [
  { number: "01", title: "Submit a request", copy: "Choose the document you need and send the details securely." },
  { number: "02", title: "Registrar review", copy: "The registrar checks the request and updates its progress." },
  { number: "03", title: "Get the next step", copy: "Follow pickup instructions or verify an issued certificate." },
];

export default function Home() {
  return (
    <main className="overflow-hidden bg-[#fbf9f7] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-[#fffdfa]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          <AppLogo />
          <nav aria-label="Main navigation" className="flex items-center gap-1.5 sm:gap-2">
            <PendingLink
              href="/about"
              label="About"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 md:inline-flex"
            />
            <PendingLink
              href="/verify"
              label="Verify"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-brand transition hover:bg-rose-50"
            />
            <ButtonLink href="/sign-in" tone="secondary" size="sm" className="border-transparent bg-transparent px-3 hover:border-border hover:bg-white">
              Sign in
            </ButtonLink>
            <ButtonLink href="/sign-up" size="sm" className="hidden shadow-md shadow-brand/15 sm:inline-flex">
              Register
            </ButtonLink>
          </nav>
        </div>
      </header>

      <section className="relative isolate overflow-hidden bg-[#4d1119] text-white">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_78%_15%,rgba(238,175,140,0.25),transparent_31%),radial-gradient(ellipse_at_0%_100%,rgba(135,32,48,0.75),transparent_42%)]" />
        <div aria-hidden className="absolute -right-48 top-28 -z-10 h-[34rem] w-[34rem] rounded-full border border-white/10 sm:right-[-5rem] sm:top-8" />
        <div aria-hidden className="absolute -right-24 top-52 -z-10 h-[25rem] w-[25rem] rounded-full border border-white/[0.07] sm:right-8 sm:top-28" />

        <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.04fr_0.96fr] lg:gap-10 lg:px-8 lg:py-24">
          <MotionReveal>
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3.5 py-2 text-xs font-semibold text-rose-50 shadow-sm backdrop-blur">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-50 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
                </span>
                Digital services for the school community
              </div>
              <p className="mt-7 text-xs font-bold uppercase tracking-[0.2em] text-rose-200 sm:text-sm">{SCHOOL_NAME}</p>
              <h1 className="mt-4 max-w-2xl text-[2.7rem] font-semibold leading-[1.04] tracking-[-0.045em] sm:text-6xl lg:text-[4.25rem]">
                School documents,
                <span className="mt-1 block text-rose-200">made simpler.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-rose-50/80 sm:text-lg sm:leading-8">
                Request school documents online, follow their progress, and verify issued certificates in one clear place.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <ButtonLink href="/sign-in" tone="secondary" size="lg" className="border-white bg-white text-[#54131b] shadow-xl shadow-black/10 hover:bg-rose-50">
                  Open the student portal
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </ButtonLink>
                <ButtonLink href="/verify" tone="secondary" size="lg" className="border-white/25 bg-white/[0.08] text-white backdrop-blur hover:border-white/40 hover:bg-white/[0.14]">
                  <QrCode className="h-4 w-4" aria-hidden />
                  Verify a certificate
                </ButtonLink>
              </div>
              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-rose-100/75 sm:text-sm">
                <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-emerald-300" aria-hidden />Track requests</span>
                <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-emerald-300" aria-hidden />Secure certificate checks</span>
              </div>
            </div>
          </MotionReveal>

          <MotionReveal delay={0.12} className="relative mx-auto w-full max-w-[570px]">
            <div aria-hidden className="absolute -inset-6 rounded-[2.5rem] bg-rose-200/10 blur-2xl" />
            <div className="absolute -right-3 -top-5 z-20 hidden items-center gap-2.5 rounded-2xl border border-white/80 bg-white px-4 py-3 text-slate-900 shadow-xl shadow-black/15 sm:flex">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                <BadgeCheck className="h-5 w-5" aria-hidden />
              </span>
              <span>
                <span className="block text-xs font-bold">QR verification</span>
                <span className="mt-0.5 block text-[11px] text-slate-500">Public and easy to check</span>
              </span>
            </div>

            <div className="relative rounded-[1.8rem] border border-white/70 bg-white p-3 shadow-[0_28px_90px_-32px_rgba(0,0,0,0.5)] sm:rounded-[2rem] sm:p-4">
              <div className="flex items-center justify-between gap-3 px-2 pb-4 pt-1 sm:px-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50">
                    <Image src="/lanhs-logo.png" alt="" width={29} height={29} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">LANHS DRMS</p>
                    <p className="text-xs text-slate-500">A clearer request journey</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-800 sm:text-[11px]">3 simple steps</span>
              </div>

              <div className="rounded-[1.35rem] bg-[#f7f4f2] p-4 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand">Student services</p>
                    <h2 className="mt-1.5 text-lg font-bold tracking-tight text-slate-950 sm:text-xl">From request to document</h2>
                  </div>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-brand shadow-sm ring-1 ring-slate-200/70">
                    <FileCheck2 className="h-5 w-5" aria-hidden />
                  </span>
                </div>

                <ol className="mt-5 space-y-3">
                  {steps.map((step, index) => (
                    <li key={step.number} className="relative flex gap-3.5 rounded-2xl border border-slate-200/75 bg-white p-3.5 shadow-sm sm:gap-4 sm:p-4">
                      {index < steps.length - 1 ? <span aria-hidden className="absolute -bottom-3.5 left-[2.05rem] z-10 h-3.5 w-px bg-slate-300" /> : null}
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-bold ${index === 0 ? "bg-brand text-white" : "bg-slate-100 text-slate-500"}`}>
                        {step.number}
                      </span>
                      <span className="min-w-0 pt-0.5">
                        <span className="block text-sm font-bold text-slate-900">{step.title}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500 sm:text-[13px]">{step.copy}</span>
                      </span>
                      {index === 0 ? <Check className="ml-auto mt-1 h-4 w-4 shrink-0 text-emerald-600" aria-hidden /> : null}
                    </li>
                  ))}
                </ol>

                <div className="mt-4 flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/80 px-4 py-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-brand shadow-sm">
                    <ShieldCheck className="h-5 w-5" aria-hidden />
                  </span>
                  <p className="text-xs leading-5 text-slate-700 sm:text-[13px]">
                    <span className="font-bold text-slate-900">Clear updates, secure records.</span> Your request stays connected to its tracking number.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 px-2 pb-1 pt-4 sm:px-3">
                <span className="text-[11px] font-medium text-slate-500">Designed for students and registrar teams</span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-brand"><LockKeyhole className="h-3.5 w-3.5" aria-hidden />Private by design</span>
              </div>
            </div>
          </MotionReveal>
        </div>

        <div className="border-t border-white/10 bg-black/10">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-xs text-rose-100/70 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <p className="font-semibold uppercase tracking-[0.16em]">A school service built around your time</p>
            <p>Request online <span className="px-2 text-rose-300">/</span> Follow progress <span className="px-2 text-rose-300">/</span> Verify documents</p>
          </div>
        </div>
      </section>

      <section className="relative bg-[#fbf9f7] px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div aria-hidden className="absolute right-0 top-0 h-72 w-72 rounded-full bg-rose-100/70 blur-3xl" />
        <div className="relative mx-auto max-w-7xl">
          <MotionReveal>
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <p className="text-xs font-bold uppercase tracking-[0.19em] text-brand">A straightforward process</p>
                <h2 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-slate-950 sm:text-4xl">Less guesswork. Clear next steps.</h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
                Handle the request online, then use your tracking number to stay oriented as it moves through review.
              </p>
            </div>
          </MotionReveal>

          <div className="mt-9 grid gap-3 md:grid-cols-3 md:gap-4">
            {steps.map((step, index) => (
              <MotionReveal key={step.number} delay={index * 0.06}>
                <article className="group relative h-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200/60 sm:p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold tracking-[0.16em] text-brand">STEP {step.number}</span>
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-50 text-slate-500 transition group-hover:bg-rose-50 group-hover:text-brand">
                      {index === 0 ? <FilePlus2 className="h-5 w-5" aria-hidden /> : index === 1 ? <UsersRound className="h-5 w-5" aria-hidden /> : <ArrowRight className="h-5 w-5" aria-hidden />}
                    </span>
                  </div>
                  <h3 className="mt-6 text-lg font-bold tracking-tight text-slate-950">{step.title}</h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">{step.copy}</p>
                  {index < steps.length - 1 ? <div aria-hidden className="absolute bottom-0 left-0 h-1 w-0 bg-brand transition-all duration-300 group-hover:w-full" /> : null}
                </article>
              </MotionReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <MotionReveal>
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.19em] text-brand">One connected service</p>
              <h2 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-slate-950 sm:text-4xl">Everything important, in one place.</h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
                A more organized way to request documents, manage school records, and confirm certificate details.
              </p>
            </div>
          </MotionReveal>

          <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              const content = (
                <>
                  <div className="flex items-center justify-between">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-brand transition group-hover:bg-brand group-hover:text-white">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="font-mono text-xs font-semibold text-slate-300">{feature.number}</span>
                  </div>
                  <h3 className="mt-6 text-base font-bold text-slate-950">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{feature.copy}</p>
                  {feature.href ? <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-brand">Verify a document <ArrowUpRight className="h-4 w-4" aria-hidden /></span> : null}
                </>
              );

              return (
                <MotionReveal key={feature.title} delay={index * 0.05}>
                  {feature.href ? (
                    <Link href={feature.href} prefetch={false} className="group block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">
                      <article className="h-full rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-rose-200 hover:shadow-xl hover:shadow-rose-950/[0.06] sm:p-6">{content}</article>
                    </Link>
                  ) : (
                    <article className="group h-full rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-rose-200 hover:shadow-xl hover:shadow-rose-950/[0.06] sm:p-6">{content}</article>
                  )}
                </MotionReveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8 lg:pb-24">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-[#4d1119] px-6 py-10 text-white shadow-xl shadow-rose-950/10 sm:px-10 sm:py-12 lg:px-14 lg:py-14">
          <div aria-hidden className="absolute -right-10 -top-32 h-80 w-80 rounded-full border border-white/10" />
          <div aria-hidden className="absolute -right-1 -top-24 h-64 w-64 rounded-full border border-white/[0.08]" />
          <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.19em] text-rose-200">Get started</p>
              <h2 className="mt-3 text-2xl font-bold tracking-[-0.03em] sm:text-3xl">Your next document request starts here.</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-rose-50/75 sm:text-base sm:leading-7">
                Sign in to submit and track requests, or create an account to access student services.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <ButtonLink href="/sign-in" tone="secondary" size="lg" className="border-white bg-white text-[#54131b] hover:bg-rose-50">
                Sign in to the portal <ArrowRight className="h-4 w-4" aria-hidden />
              </ButtonLink>
              <ButtonLink href="/sign-up" tone="secondary" size="lg" className="border-white/25 bg-white/[0.08] text-white hover:bg-white/[0.14]">
                Create an account
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-[#fffdfa]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <AppLogo />
          <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-slate-600">
            <PendingLink href="/about" label="About" className="transition hover:text-brand" />
            <PendingLink href="/verify" label="Verify a document" className="transition hover:text-brand" />
            <PendingLink href="/sign-in" label="Sign in" className="transition hover:text-brand" />
          </nav>
        </div>
      </footer>
    </main>
  );
}
