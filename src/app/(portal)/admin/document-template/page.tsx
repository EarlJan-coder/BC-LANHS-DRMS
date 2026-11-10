import { SectionHeading } from "@/components/section-heading";
import { DocumentSignatoryTemplateForm } from "@/components/document-signatory-template-form";
import { getDocumentSignatoryTemplate } from "@/lib/services/document-signatory-template";

export default async function DocumentTemplatePage() {
  const template = await getDocumentSignatoryTemplate();
  return (
    <div className="space-y-5">
      <SectionHeading title="Document template" description="Set the default principal and registrar names that appear on certificates." />
      <DocumentSignatoryTemplateForm initialValues={template} />
    </div>
  );
}
