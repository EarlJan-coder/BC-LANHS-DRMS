import { DocumentTemplateEditor } from "@/components/document-template-editor";
import { SectionHeading } from "@/components/section-heading";
import { getDocumentSignatoryTemplate } from "@/lib/services/document-signatory-template";
import { getDocumentTemplateWording } from "@/lib/services/document-template-wording";

export default async function DocumentTemplatePage() {
  const [wording, names] = await Promise.all([getDocumentTemplateWording(), getDocumentSignatoryTemplate()]);
  return (
    <div className="space-y-5">
      <SectionHeading title="Document template" description="Edit the wording printed on each certificate, with a live preview." />
      <DocumentTemplateEditor names={names} wording={wording} />
    </div>
  );
}
