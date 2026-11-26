import { CheckCircle2, Clock3, ShieldAlert, ShieldCheck } from "lucide-react";
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
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#fff1f2_0%,_#f8fafc_46%,_#f8fafc_100%)] px-4 py-10 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-lg shadow-brand/20">
            <ShieldCheck className="h-7 w-7" aria-hidden />
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-brand">Public document service</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Verify a school document</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
            Check a certificate using its number or scan the QR code printed on the document.
          </p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-white/80 shadow-xl shadow-slate-200/60">
            <CardHeader>
              <CardTitle>Look up a document</CardTitle>
              <p className="text-sm leading-6 text-slate-500">Enter either number. Your lookup is checked against the school record and its public proof.</p>
            </CardHeader>
            <CardContent><VerifyForm certificateNumber={query.certificateNumber} trackingNumber={query.trackingNumber} /></CardContent>
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
        <p className="mt-8 text-center text-xs text-slate-500">Public verification shows limited document details and never includes student contact information.</p>
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
      <CardContent>
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
