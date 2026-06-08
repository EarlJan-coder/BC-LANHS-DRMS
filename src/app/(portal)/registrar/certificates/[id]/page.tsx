import { Download, ExternalLink, QrCode } from "lucide-react";
import { notFound } from "next/navigation";
import { SectionHeading } from "@/components/section-heading";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCertificateView } from "@/lib/services/certificates";

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

  return (
    <div>
      <SectionHeading
        title="Certificate details"
        description={certificate.certificateNumber}
        actions={
          <>
            <ButtonLink href="/registrar/certificates" tone="secondary">
              Back
            </ButtonLink>
            <ButtonLink href={`/api/certificates/${certificate.id}/pdf`}>
              <Download className="h-4 w-4" aria-hidden />
              Download PDF
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>{certificate.certificateType}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Detail label="Student" value={certificate.studentName} />
            <Detail label="School year" value={certificate.schoolYear} />
            <Detail label="Generated" value={certificate.generatedAt} />
            <Detail label="Blockchain status" value={certificate.blockchainStatus} />
            <Detail label="Transaction hash" value={certificate.blockchainTxHash} wide />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-brand" aria-hidden />
              Verification
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Detail label="Verification code" value={certificate.verificationCode} />
            <Detail label="Verification URL" value={certificate.verificationUrl} />
            <ButtonLink href={certificate.verificationUrl} tone="secondary">
              <ExternalLink className="h-4 w-4" aria-hidden />
              Open verification
            </ButtonLink>
          </CardContent>
        </Card>
      </div>
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
