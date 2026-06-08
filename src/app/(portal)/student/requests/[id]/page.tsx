import { notFound } from "next/navigation";
import { SectionHeading } from "@/components/section-heading";
import { StatusBadge } from "@/components/status-badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDocumentRequestView, listRequestStatusHistoryViews } from "@/lib/services/live-data";

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

  const timeline = await listRequestStatusHistoryViews(request.id);

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
              <Detail label="School year needed" value={request.schoolYearNeeded} />
              <Detail label="Grade level needed" value={request.gradeLevelNeeded} />
              <Detail label="Requested date" value={request.requestedAt} />
              <Detail label="Last update" value={request.updatedAt} />
              <Detail label="Blockchain status" value={request.blockchainStatus} />
            </div>
            <Detail label="Purpose" value={request.purpose} />
            <Detail label="Remarks" value={request.remarks} />
            <Detail label="Registrar remarks" value={request.registrarRemarks} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status timeline</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {timeline.length === 0 ? (
              <p className="text-sm text-slate-500">No status changes recorded yet.</p>
            ) : (
              timeline.map((item) => (
                <div key={item.id} className="rounded-md border border-border px-3 py-2 text-sm text-slate-600">
                  <p className="font-medium text-slate-900">
                    {String(item.oldStatus).replaceAll("_", " ")} {"->"} {String(item.newStatus).replaceAll("_", " ")}
                  </p>
                  <p className="mt-1">{item.remarks}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.createdAt}</p>
                </div>
              ))
            )}
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
