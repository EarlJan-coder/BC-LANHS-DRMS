import { NextResponse } from "next/server";
import { getCurrentRole } from "@/lib/auth";
import { generateCertificatePdf } from "@/lib/services/certificates";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // The proxy only proves "some account is signed in"; certificate PDFs
    // carry student PII (name, LRN, grade/section), so restrict to staff.
    const role = await getCurrentRole();
    if (role !== "registrar" && role !== "admin") {
      return NextResponse.json({ error: "Registrar access is required." }, { status: 403 });
    }

    const { id } = await params;
    const pdf = await generateCertificatePdf(id);

    // ?inline=1 renders in the preview iframe; default forces a download.
    const inline = new URL(request.url).searchParams.get("inline") === "1";

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="certificate-${id}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Unable to generate certificate PDF." }, { status: 500 });
  }
}
