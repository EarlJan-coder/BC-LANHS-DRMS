import { StudentImportUploader } from "@/components/student-import-uploader";
import { SectionHeading } from "@/components/section-heading";
import { ButtonLink } from "@/components/ui/button";

export default function BulkStudentImportPage() {
  return (
    <div>
      <SectionHeading
        title="Bulk student import"
        description="Upload the student roster, check every row, and add the records together after validation."
        actions={<ButtonLink href="/registrar/students" tone="secondary">Back to student records</ButtonLink>}
      />
      <StudentImportUploader />
    </div>
  );
}
