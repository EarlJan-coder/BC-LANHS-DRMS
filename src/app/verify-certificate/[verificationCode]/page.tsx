import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { AppLogo } from "@/components/layout/app-logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { verifyCertificate } from "@/lib/services/certificates";
import type { CertificateVerificationView } from "@/lib/types";

export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ verificationCode: string }>;
}) {
  const { verificationCode } = await params;
  const result: CertificateVerificationView = await verifyCertificate(verificationCode).catch(() => ({ valid: false }));

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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-4">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}
