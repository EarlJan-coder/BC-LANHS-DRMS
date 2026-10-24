import { notFound } from "next/navigation";
import { CertificatePreviewEditor } from "@/components/certificate-preview-editor";
import { SectionHeading } from "@/components/section-heading";
import { getCertificateEditView } from "@/lib/services/certificates";

export default async function CertificateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const certificate = await getCertificateEditView(id);

  if (!certificate) {
    notFound();
  }

  return (
    <div>
      <SectionHeading
        title="Preview & edit PDF"
        description={`${certificate.certificateNumber} — edit the content printed on the certificate PDF. The record and its verification hash are not changed.`}
      />
      <CertificatePreviewEditor
        certificateId={certificate.id}
        initial={{
          studentName: certificate.studentName,
          gradeLevel: certificate.gradeLevel,
          section: certificate.section,
          purpose: certificate.purpose,
          dateGenerated: certificate.dateGenerated.slice(0, 10),
        }}
        hasOverride={certificate.hasOverride}
      />
    </div>
  );
}
