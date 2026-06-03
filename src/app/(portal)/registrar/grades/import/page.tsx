import { GradeImportUploader } from "@/components/grade-import-uploader";
import { SectionHeading } from "@/components/section-heading";

export default function BulkGradeImportPage() {
  return (
    <div>
      <SectionHeading
        title="Bulk grade import"
        description="Download the template, upload an Excel or CSV file, validate rows, review errors, and save valid records."
      />
      <GradeImportUploader />
    </div>
  );
}

