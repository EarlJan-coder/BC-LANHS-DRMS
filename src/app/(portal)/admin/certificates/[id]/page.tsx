import Image from "next/image";
import { Download, ExternalLink, QrCode } from "lucide-react";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { SectionHeading } from "@/components/section-heading";
import { ButtonLink } from "@/components/ui/button";
import { DownloadButton } from "@/components/ui/download-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCertificateView } from "@/lib/services/certificates";
import { humanizeStatus } from "@/lib/utils";

export default async function CertificateDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const certificate = await getCertificateView(id);

  if (!certificate) {
    notFound();
  }

  const verificationQrDataUrl = await QRCode.toDataURL(certificate.verificationUrl, { margin: 1, width: 288 });

  return (
    <div>
      <SectionHeading
        title="Certificate details"
        description={certificate.certificateNumber}
        actions={
          <>
            <ButtonLink href="/admin/certificates" tone="secondary">
              Back
            </ButtonLink>
            {certificate.requestId ? <ButtonLink href={`/admin/requests/${certificate.requestId}`} tone="secondary">View originating request</ButtonLink> : null}
            <DownloadButton href={`/api/certificates/${certificate.id}/pdf`} tone="info" loadingLabel="Preparing PDF…">
              <Download className="h-4 w-4" aria-hidden />
              Download PDF
            </DownloadButton>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,360px)]">
        <Card>
          <CardHeader>
            <CardTitle>{certificate.certificateType}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Detail label="Student" value={certificate.studentName} />
            <Detail label="School year" value={certificate.schoolYear} />
            <Detail label="Generated" value={certificate.generatedAt} />
            <Detail label="Blockchain status" value={humanizeStatus(certificate.blockchainStatus)} />
            <Detail label="Transaction hash" value={certificate.blockchainTxHash} wide />
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-brand" aria-hidden />
              Verification
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-sm text-slate-600">
              Anyone can confirm this certificate is genuine on the public verification page.
            </p>
            <div className="flex min-w-0 flex-col items-center gap-2 rounded-lg border border-border bg-rose-50/50 p-4">
              <Image
                src={verificationQrDataUrl}
                alt={`QR code linking to the verification page for ${certificate.certificateNumber}`}
                width={144}
                height={144}
                unoptimized
                className="h-36 w-36 max-w-full rounded-md bg-white p-2 ring-1 ring-border"
              />
              <p className="text-center text-xs text-slate-500">Scan to open the verification page</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Verification code</p>
              <p className="mt-1.5 overflow-hidden break-all rounded-md border border-border bg-white px-3 py-2 text-center font-mono text-sm font-semibold tracking-[0.06em] text-slate-950">
                {certificate.verificationCode}
              </p>
            </div>
            <ButtonLink href={certificate.verificationUrl} tone="info" className="w-full">
              <ExternalLink className="h-4 w-4" aria-hidden />
              Open verification
            </ButtonLink>
            <p className="break-all text-xs text-slate-500">{certificate.verificationUrl}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardHeader>
          <CardTitle>Certificate preview</CardTitle>
          <p className="text-sm text-slate-500">Use Download PDF to view or save the file.</p>
        </CardHeader>
        <CardContent className="pt-0">
          <iframe
            src={`/api/certificates/${certificate.id}/pdf?inline=1`}
            title={`PDF preview of certificate ${certificate.certificateNumber}`}
            className="h-[min(1100px,75vh)] min-h-[540px] w-full rounded-lg border border-border bg-slate-100"
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}
