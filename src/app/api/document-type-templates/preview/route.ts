import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireAdmin } from "@/lib/api-guards";
import { assertBodyFits, TooLongBodyError } from "@/lib/services/certificate-body-layout";
import type { CertTemplateKey } from "@/lib/services/certificate-layouts";
import { renderSampleCertificate } from "@/lib/services/certificate-renderer";
import { DEFAULT_WORDING } from "@/lib/services/certificate-wording-defaults";

const layoutKeys = Object.keys(DEFAULT_WORDING) as [CertTemplateKey, ...CertTemplateKey[]];
const previewSchema = z.object({
  layoutKey: z.enum(layoutKeys),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(4000),
  principalTitle: z.string().trim().max(120),
  registrarTitle: z.string().trim().max(120),
  principalName: z.string().trim().max(200).optional(),
  registrarName: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { layoutKey, title, body, principalTitle, registrarTitle, principalName, registrarName } = previewSchema.parse(await request.json());
    await assertBodyFits(layoutKey, body);
    const pdf = await renderSampleCertificate(
      layoutKey,
      { title, body, principalTitle, registrarTitle },
      { principalName, registrarName },
      {
        name: "Maria Clara Santos Dela Cruz",
        grade: "9 - Diamond",
        schoolYear: "2026-2027",
        lrn: "123456789012",
        purpose: "school record validation",
        day: "12",
        month: "November 2026",
      },
    );
    return new Response(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="custom-document-preview.pdf"', "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid preview." }, { status: 400 });
    if (error instanceof TooLongBodyError) return NextResponse.json({ error: "Body text is too long for this layout." }, { status: 400 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    return NextResponse.json({ error: "Unable to generate the document preview." }, { status: 500 });
  }
}
