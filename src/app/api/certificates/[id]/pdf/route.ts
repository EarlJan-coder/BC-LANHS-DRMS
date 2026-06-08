import { NextResponse } from "next/server";
import { generateCertificatePdf } from "@/lib/services/certificates";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const pdf = await generateCertificatePdf(id);

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="certificate-${id}.pdf"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate certificate PDF." },
      { status: 500 },
    );
  }
}
