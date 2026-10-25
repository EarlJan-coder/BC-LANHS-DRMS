import { studentImportTemplateXlsx } from "@/lib/services/student-import";

export async function GET() {
  const bytes = studentImportTemplateXlsx();
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="lanhs-student-import-template.xlsx"',
    },
  });
}
