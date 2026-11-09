import { SectionHeading } from "@/components/section-heading";
import { DocumentTypesManager } from "@/components/document-types-manager";
import { listDocumentTypeViews } from "@/lib/services/live-data";

export default async function DocumentTypeManagementPage() {
  const rows = await listDocumentTypeViews();

  return (
    <div className="space-y-5">
      <SectionHeading title="Document type management" description="Add, edit, and deactivate supported document request types." />
      <DocumentTypesManager initialTypes={rows} />
    </div>
  );
}
