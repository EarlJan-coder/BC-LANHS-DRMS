import { Download, Eye } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { SectionHeading } from "@/components/section-heading";
import { ButtonLink } from "@/components/ui/button";
import { listCertificateViews } from "@/lib/services/certificates";

export default async function CertificatesPage() {
  const certificates = await listCertificateViews();

  return (
    <div>
      <SectionHeading
        title="Certificates"
        description="Generated Certificate of Grades PDFs, QR verification links, and blockchain proof status."
      />
      <DataTable
        rows={certificates}
        emptyMessage="No certificates have been generated yet."
        columns={[
          {
            key: "number",
            label: "Certificate no.",
            render: (row) => (
              <Link href={`/registrar/certificates/${row.id}`} className="font-medium text-brand" prefetch={false}>
                {row.certificateNumber}
              </Link>
            ),
          },
          { key: "student", label: "Student", render: (row) => row.studentName },
          { key: "schoolYear", label: "School year", render: (row) => row.schoolYear },
          { key: "chain", label: "Chain", render: (row) => row.blockchainStatus },
          { key: "generated", label: "Generated", render: (row) => row.generatedAt },
          {
            key: "actions",
            label: "Actions",
            render: (row) => (
              <div className="flex gap-2">
                <ButtonLink href={`/registrar/certificates/${row.id}`} tone="secondary" size="icon" aria-label="View certificate">
                  <Eye className="h-4 w-4" />
                </ButtonLink>
                <ButtonLink href={`/api/certificates/${row.id}/pdf`} tone="secondary" size="icon" aria-label="Download PDF">
                  <Download className="h-4 w-4" />
                </ButtonLink>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
