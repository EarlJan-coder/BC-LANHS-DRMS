import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth";
import { generateRequestSlipPdf } from "@/lib/services/document-requests";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const viewer = await getCurrentDbUser();
    if (!viewer) {
      return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    }

    const { id } = await params;
    const pdf = await generateRequestSlipPdf(id, viewer);

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="request-slip-${id}.pdf"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate request slip.";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
