import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { AppLogo } from "@/components/layout/app-logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BlockchainVerificationBadge } from "@/components/BlockchainVerificationBadge";
import { verifyCertificate } from "@/lib/services/certificates";
import { verifyCertificateOnChain } from "@/lib/services/blockchain-verification";
import { getDb } from "@/db";
import { certificates } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { CertificateVerificationView } from "@/lib/types";
import type { LifecycleEvent } from "@/lib/services/blockchain-verification";

const EVENT_LABELS: Record<string, string> = {
  CERTIFICATE_ISSUED: "Issued",
  CERTIFICATE_REISSUED: "Reissued",
  CERTIFICATE_VOIDED: "Voided",
  CERTIFICATE_VERIFIED: "Verified",
};

const EVENT_COLORS: Record<string, string> = {
  CERTIFICATE_ISSUED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CERTIFICATE_REISSUED: "bg-blue-100 text-blue-800 border-blue-200",
  CERTIFICATE_VOIDED: "bg-red-100 text-red-800 border-red-200",
  CERTIFICATE_VERIFIED: "bg-amber-100 text-amber-800 border-amber-200",
};

export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ verificationCode: string }>;
}) {
  const { verificationCode } = await params;
  const result: CertificateVerificationView = await verifyCertificate(verificationCode).catch(() => ({ valid: false }));

  let blockchainResult;
  if (result.valid && result.certificateNumber) {
    const db = getDb();
    if (db) {
      const cert = await db.query.certificates.findFirst({
        where: eq(certificates.certificateNumber, result.certificateNumber),
      });
      if (cert) {
        blockchainResult = await verifyCertificateOnChain(cert.id);
      }
    }
  }

  const eventTimeline = blockchainResult?.eventTimeline;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex justify-center">
          <AppLogo />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.valid ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" aria-hidden />
              )}
              Certificate verification
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div
              className={
                result.valid
                  ? "rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-800"
                  : "rounded-md border border-red-200 bg-red-50 p-4 text-red-800"
              }
            >
              <p className="text-sm font-semibold">{result.valid ? "Valid certificate" : "Invalid certificate"}</p>
              <p className="mt-1 text-sm">
                {result.valid
                  ? "This certificate code exists in LANHS DRMS."
                  : "No certificate exists for this verification code."}
              </p>
            </div>

            {result.valid ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label="Certificate no." value={result.certificateNumber ?? "Not set"} />
                <Detail label="Student" value={result.studentDisplayName ?? "Private"} />
                <Detail label="Type" value={result.certificateType ?? "Certificate"} />
                <Detail label="Date generated" value={result.issuedAt ?? "Not set"} />
                <Detail label="Issuing school" value={result.issuingSchool ?? "LANHS"} />
                <Detail label="Blockchain tx" value={result.blockchainTxHash ?? "Pending"} />
              </div>
            ) : null}

            {blockchainResult && <BlockchainVerificationBadge result={blockchainResult} />}

            {eventTimeline && eventTimeline.length > 0 && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <p className="mb-3 text-sm font-semibold text-slate-900">Blockchain Event Timeline</p>
                <div className="space-y-3">
                  {eventTimeline.map((event: LifecycleEvent, index: number) => (
                    <EventTimelineItem key={index} event={event} isLast={index === eventTimeline.length - 1} />
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 rounded-md bg-rose-50 p-4 text-sm text-brand">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>Public verification does not expose full grades or private student information.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function EventTimelineItem({ event, isLast }: { event: LifecycleEvent; isLast: boolean }) {
  const label = EVENT_LABELS[event.eventType] ?? event.eventType;
  const colorClass = EVENT_COLORS[event.eventType] ?? "bg-slate-100 text-slate-800 border-slate-200";

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`h-3 w-3 rounded-full border-2 ${colorClass.split(" ")[0]} shrink-0`} />
        {!isLast && <div className="mt-1 w-px flex-1 bg-slate-300" />}
      </div>
      <div className="flex-1 pb-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colorClass}`}>
            {label}
          </span>
          <span className="text-xs text-slate-500">
            {new Date(event.recordedAt).toLocaleString()}
          </span>
        </div>
        <p className="mt-1 break-all text-xs text-slate-600">
          Hash: <code className="rounded bg-slate-100 px-1">{event.recordHash.slice(0, 18)}...</code>
        </p>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-4">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}
