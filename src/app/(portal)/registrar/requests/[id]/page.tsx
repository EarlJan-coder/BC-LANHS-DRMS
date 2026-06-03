import { notFound } from "next/navigation";
import { RequestStatusActions } from "@/components/request-status-actions";
import { SectionHeading } from "@/components/section-heading";
import { StatusBadge } from "@/components/status-badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDocumentRequestView } from "@/lib/services/live-data";

export default async function RegistrarRequestDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const request = await getDocumentRequestView(id);

  if (!request) {
    notFound();
  }

  return (
    <div>
      <SectionHeading
        title="Request details"
        description={request.trackingNumber}
        actions={<ButtonLink href="/registrar/requests" tone="secondary">Back to queue</ButtonLink>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>{request.documentType}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail label="Student" value={request.studentName} />
              <Detail label="Status" value={<StatusBadge status={request.status} />} />
              <Detail label="Requested" value={request.requestedAt} />
              <Detail label="Updated" value={request.updatedAt} />
            </div>
            <Detail label="Purpose" value={request.purpose} />
            <RequestStatusActions requestId={request.id} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit proof</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-slate-600">
            <Detail label="Blockchain status" value={request.blockchainStatus} />
            <Detail label="On-chain data" value="referenceId, action, actorRole, recordHash, timestamp" />
            <p className="rounded-md bg-rose-50 p-3 text-brand">
              Student details, grades, LRN, email, and documents are never stored on-chain.
            </p>
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
