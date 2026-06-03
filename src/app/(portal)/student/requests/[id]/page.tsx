import { notFound } from "next/navigation";
import { SectionHeading } from "@/components/section-heading";
import { StatusBadge } from "@/components/status-badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDocumentRequestView } from "@/lib/services/live-data";

export default async function StudentRequestDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const request = await getDocumentRequestView(id, true);

  if (!request) {
    notFound();
  }

  return (
    <div>
      <SectionHeading
        title="Request details"
        description={request.trackingNumber}
        actions={<ButtonLink href="/student/requests" tone="secondary">Back to requests</ButtonLink>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>{request.documentType}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail label="Status" value={<StatusBadge status={request.status} />} />
              <Detail label="Requested date" value={request.requestedAt} />
              <Detail label="Last update" value={request.updatedAt} />
              <Detail label="Blockchain status" value={request.blockchainStatus} />
            </div>
            <Detail label="Purpose" value={request.purpose} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workflow</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {["Submitted", "Registrar review", "Document generation", "Ready for pickup", "Claimed"].map((step) => (
              <div key={step} className="rounded-md border border-border px-3 py-2 text-sm text-slate-600">
                {step}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <div className="mt-1 text-sm text-slate-900">{value}</div>
    </div>
  );
}
