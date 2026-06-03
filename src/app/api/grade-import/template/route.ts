import { gradeImportTemplateCsv } from "@/lib/services/grade-import";

export async function GET() {
  return new Response(gradeImportTemplateCsv(), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="lanhs-grade-import-template.csv"',
    },
  });
}

