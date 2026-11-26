import { DocumentTemplateEditor } from "@/components/document-template-editor";
import { DocumentTypeTemplateEditor } from "@/components/document-type-template-editor";
import { SectionHeading } from "@/components/section-heading";
import { getDocumentSignatoryTemplate } from "@/lib/services/document-signatory-template";
import { listDocumentTypeTemplates } from "@/lib/services/document-type-templates";
import { getDocumentTemplateWording } from "@/lib/services/document-template-wording";
import { pickCertificateTemplate } from "@/lib/services/certificate-renderer";

export default async function DocumentTemplatePage() {
  const [wording, names, customTemplates] = await Promise.all([
    getDocumentTemplateWording(),
    getDocumentSignatoryTemplate(),
    listDocumentTypeTemplates(),
  ]);
  const customTypes = customTemplates.filter(({ documentTypeName }) => pickCertificateTemplate(documentTypeName, "9") === null);
  return (
    <div className="space-y-5">
      <SectionHeading title="Document template" description="Edit the wording printed on each certificate, with a live preview." />
      <DocumentTemplateEditor names={names} wording={wording} />
      <section className="space-y-4 border-t border-border pt-7">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Templates for custom document types</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Choose a document type, select an official page layout, and customize its wording. New document types start with a ready-to-edit default.
          </p>
        </div>
        <DocumentTypeTemplateEditor templates={customTypes} names={names} />
      </section>
    </div>
  );
}
