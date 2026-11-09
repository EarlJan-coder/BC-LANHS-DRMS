import { Download, Eye } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { SectionHeading } from "@/components/section-heading";
import { ButtonLink } from "@/components/ui/button";
import { DownloadButton } from "@/components/ui/download-button";
import { PendingLink } from "@/components/ui/pending-link";
import { listCertificateViews } from "@/lib/services/certificates";
import { Pagination } from "@/components/ui/pagination";
import { parsePage } from "@/lib/pagination";

export default async function CertificatesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = parsePage((await searchParams).page);
  const certificates = await listCertificateViews({ page });

  return (
    <div>
      <SectionHeading
        title="Certificates"
        description="Generated school document PDFs, QR verification links, and blockchain proof status."
      />
      <DataTable
        rows={certificates.rows}
        emptyMessage="No certificates have been generated yet."
        columns={[
          {
            key: "number",
            label: "Certificate no.",
            render: (row) => (
              <PendingLink
                href={`/registrar/certificates/${row.id}`}
                label={row.certificateNumber}
                className="font-medium text-brand"
              />
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
                <DownloadButton href={`/api/certificates/${row.id}/pdf`} tone="secondary" size="icon" aria-label="Download PDF">
                  <Download className="h-4 w-4" />
                </DownloadButton>
              </div>
            ),
          },
        ]}
      />
      <Pagination page={certificates.page} totalPages={Math.ceil(certificates.total / certificates.pageSize)} basePath="/registrar/certificates" total={certificates.total} pageSize={certificates.pageSize} />
    </div>
  );
}
