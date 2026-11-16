import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireAdmin } from "@/lib/api-guards";
import type { CertTemplateKey } from "@/lib/services/certificate-layouts";
import { assertBodyFits, TooLongBodyError } from "@/lib/services/certificate-body-layout";
import { renderSampleCertificate } from "@/lib/services/certificate-renderer";
import { DEFAULT_WORDING } from "@/lib/services/certificate-wording-defaults";

const TEMPLATE_KEYS = Object.keys(DEFAULT_WORDING) as [CertTemplateKey, ...CertTemplateKey[]];

// Draft wording for preview: same trimmed-string limits as the save schema, but
// no placeholder check — drafts are rendered as typed while the admin edits.
const previewSchema = z.object({
  template: z.enum(TEMPLATE_KEYS),
  title: z.string().trim().max(200, "Title must be 200 characters or fewer."),
  body: z
    .string()
    .trim()
    .min(1, "Body text is required.")
    .max(4000, "Body text must be 4000 characters or fewer."),
  principalTitle: z.string().trim().max(120, "Principal title must be 120 characters or fewer."),
  registrarTitle: z.string().trim().max(120, "Registrar title must be 120 characters or fewer."),
  principalName: z.string().trim().max(200, "Principal name must be 200 characters or fewer.").optional(),
  registrarName: z.string().trim().max(200, "Registrar name must be 200 characters or fewer.").optional(),
});

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { template, title, body, principalTitle, registrarTitle, principalName, registrarName } = previewSchema.parse(
      await request.json(),
    );
    // Strict draft validation: the render layer falls back to the default
    // wording when the body overflows the block, so an over-long draft would
    // silently preview as the default certificate. Enforce the same
    // worst-case-values check the save service uses instead.
    await assertBodyFits(template, body);
    const pdf = await renderSampleCertificate(
      template,
      { title, body, principalTitle, registrarTitle },
      { principalName, registrarName },
    );
    // Inline preview, not a download — mirrors the ?inline=1 certificate PDF shape.
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="document-template-preview.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request body." }, { status: 400 });
    if (error instanceof TooLongBodyError) return NextResponse.json({ error: "Body text is too long for this document." }, { status: 400 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    return NextResponse.json({ error: "Unable to generate the document preview." }, { status: 500 });
  }
}
