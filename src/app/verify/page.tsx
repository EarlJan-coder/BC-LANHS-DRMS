import { ArrowLeft, CheckCircle2, Clock3, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VerifyForm } from "@/components/verify-form";
import { verifyPublicReference, type PublicVerificationResult } from "@/lib/services/verification-lookup";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const statuses = {
  valid: { label: "Valid", Icon: ShieldCheck, classes: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  proof_pending: { label: "Proof pending", Icon: Clock3, classes: "bg-amber-50 text-amber-800 ring-amber-200" },
  invalid: { label: "Not valid", Icon: ShieldAlert, classes: "bg-red-50 text-red-800 ring-red-200" },
  not_found: { label: "Not valid", Icon: ShieldAlert, classes: "bg-red-50 text-red-800 ring-red-200" },
} as const;

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export default async function VerifyPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = {
    certificateNumber: first(params.certificateNumber),
    trackingNumber: first(params.trackingNumber),
    code: first(params.code),
  };
  const hasQuery = Object.values(query).some(Boolean);
  const result = hasQuery ? await verifyPublicReference(query) : null;

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#fff1f2_0%,_#f8fafc_46%,_#f8fafc_100%)] px-4 py-6 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          className="mb-7 inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/80 bg-white/80 px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:border-rose-200 hover:bg-white hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:mb-10 sm:px-4"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to home
        </Link>
        <div className="mb-7 flex items-center gap-4 text-left sm:mb-10 sm:block sm:text-center">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-lg shadow-brand/20 sm:mx-auto sm:h-14 sm:w-14">
            <ShieldCheck className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand sm:mt-5 sm:text-xs sm:tracking-[0.2em]">Public document service</p>
            <h1 className="mt-1 text-2xl font-bold leading-tight tracking-tight text-slate-950 sm:mt-2 sm:text-4xl">Verify a school document</h1>
            <p className="mt-1.5 max-w-xl text-sm leading-5 text-slate-600 sm:mx-auto sm:mt-3 sm:text-base sm:leading-6">
            Check a certificate using its number or scan the QR code printed on the document.
            </p>
          </div>
        </div>

        <div className="grid items-start gap-4 sm:gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="overflow-hidden rounded-2xl border-white/80 shadow-xl shadow-slate-200/60">
            <CardHeader>
              <CardTitle>Look up a document</CardTitle>
              <p className="text-sm leading-6 text-slate-500">Enter either number. Your lookup is checked against the school record and its public proof.</p>
            </CardHeader>
            <CardContent className="p-4 sm:p-5"><VerifyForm certificateNumber={query.certificateNumber} trackingNumber={query.trackingNumber} /></CardContent>
          </Card>

          {result ? <VerificationCard result={result} /> : (
            <div className="hidden min-h-64 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center lg:grid">
              <div>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
                  <CheckCircle2 className="h-6 w-6" aria-hidden />
                </div>
                <p className="mt-4 font-semibold text-slate-800">Your result will appear here</p>
                <p className="mt-1 text-sm text-slate-500">Only basic document details are shown.</p>
              </div>
            </div>
          )}
        </div>
        <p className="mx-auto mt-5 max-w-2xl text-center text-xs leading-5 text-slate-500 sm:mt-8 sm:text-sm sm:leading-6">Public verification shows limited document details and never includes student contact information.</p>
      </div>
    </main>
  );
}

function VerificationCard({ result }: { result: PublicVerificationResult }) {
  const status = statuses[result.status];
  const Icon = status.Icon;
  const fields = [
    { label: "Certificate no.", value: result.certificateNumber ?? "Not set" },
    { label: result.nameRole === "requestor" ? "Requestor name" : "Student name", value: result.studentName ?? "Not set" },
    { label: "Type of document", value: result.documentType ?? "Not set" },
    { label: "Date issued", value: result.dateIssued ?? "Not issued" },
    { label: "Issuing school", value: result.issuingSchool },
  ];

  return (
    <Card className="overflow-hidden border-white/80 shadow-xl shadow-slate-200/60" aria-live="polite">
      <div className={`flex items-center gap-3 border-b px-6 py-5 ${result.status === "valid" ? "border-emerald-100 bg-emerald-50/70" : result.status === "proof_pending" ? "border-amber-100 bg-amber-50/70" : "border-red-100 bg-red-50/70"}`}>
        <span className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-bold ring-1 ring-inset ${status.classes}`}>
          <Icon className="h-4 w-4" aria-hidden />{status.label}
        </span>
      </div>
      <CardContent className="p-4 sm:p-5">
        <dl className="divide-y divide-slate-100">
          {fields.map((field) => (
            <div key={field.label} className="grid gap-1 py-3.5 sm:grid-cols-[minmax(9rem,0.42fr)_1fr] sm:gap-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{field.label}</dt>
              <dd className="break-words text-sm font-semibold leading-6 text-slate-950">{field.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
