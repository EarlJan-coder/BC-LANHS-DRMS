import { notFound } from "next/navigation";
import { RegistrarRequestDetailsView } from "@/components/registrar-request-details-view";
import { SectionHeading } from "@/components/section-heading";
import { ButtonLink } from "@/components/ui/button";
import { getDocumentRequestView, listRequestStatusHistoryViews } from "@/lib/services/live-data";

export const dynamic = "force-dynamic";

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

  const timeline = await listRequestStatusHistoryViews(request.id);

  return (
    <div>
      <SectionHeading
        title="Request details"
        description={request.trackingNumber}
        actions={<ButtonLink href="/registrar/requests" tone="secondary">Back to queue</ButtonLink>}
      />

      <RegistrarRequestDetailsView request={request} initialTimeline={timeline} />
    </div>
  );
}
