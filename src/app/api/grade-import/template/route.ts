import { gradeImportTemplateXlsx } from "@/lib/services/grade-import";

export async function GET() {
  const bytes = gradeImportTemplateXlsx();
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="lanhs-grade-import-template.xlsx"',
    },
  });
}
