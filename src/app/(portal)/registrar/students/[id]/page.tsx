import { Download } from "lucide-react";
import { notFound } from "next/navigation";
import { DataTable } from "@/components/data-table";
import { SectionHeading } from "@/components/section-heading";
import { StatusBadge } from "@/components/status-badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStudentDetailView } from "@/lib/services/live-data";

export default async function RegistrarStudentDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getStudentDetailView(id);

  if (!data) {
    notFound();
  }

  return (
    <div>
      <SectionHeading
        title="Student record"
        description={data.profile.name}
        actions={<ButtonLink href="/registrar/students" tone="secondary">Back to students</ButtonLink>}
      />

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="LRN" value={data.profile.lrn} />
          <Detail label="Status" value={data.profile.status} />
          <Detail label="Grade level" value={data.profile.gradeLevel} />
          <Detail label="Section" value={data.profile.section} />
          <Detail label="School year" value={data.profile.schoolYear} />
          <Detail label="Email" value={data.profile.email} />
          <Detail label="Contact" value={data.profile.contactNumber} />
          <Detail label="Address" value={data.profile.address} />
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6">
        <DataTable
          rows={data.grades}
          emptyMessage="No grade records found for this student."
          columns={[
            { key: "subject", label: "Subject", render: (row) => row.subject },
            { key: "schoolYear", label: "School year", render: (row) => row.schoolYear },
            { key: "q1", label: "Q1", render: (row) => row.quarter1 ?? "" },
            { key: "q2", label: "Q2", render: (row) => row.quarter2 ?? "" },
            { key: "q3", label: "Q3", render: (row) => row.quarter3 ?? "" },
            { key: "q4", label: "Q4", render: (row) => row.quarter4 ?? "" },
            { key: "final", label: "Final", render: (row) => row.finalGrade },
          ]}
        />

        <DataTable
          rows={data.requests}
          emptyMessage="No document requests found for this student."
          columns={[
            { key: "tracking", label: "Tracking no.", render: (row) => row.trackingNumber },
            { key: "document", label: "Document", render: (row) => row.documentType },
            { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
            { key: "updated", label: "Updated", render: (row) => row.updatedAt },
          ]}
        />

        <DataTable
          rows={data.certificates}
          emptyMessage="No generated certificates found for this student."
          columns={[
            { key: "number", label: "Certificate no.", render: (row) => row.certificateNumber },
            { key: "type", label: "Type", render: (row) => row.certificateType },
            { key: "generated", label: "Generated", render: (row) => row.generatedAt },
            {
              key: "download",
              label: "PDF",
              render: (row) => (
                <ButtonLink href={`/api/certificates/${row.id}/pdf`} tone="secondary" size="icon" aria-label="Download PDF">
                  <Download className="h-4 w-4" />
                </ButtonLink>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}
