import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { clerkConfigured, getCurrentRole } from "@/lib/auth";
import { generateCertificate, listCertificateViews } from "@/lib/services/certificates";

export async function GET() {
  return NextResponse.json({ data: await listCertificateViews() });
}

export async function POST(request: Request) {
  try {
    const role = await getCurrentRole();
    if (clerkConfigured() && role !== "registrar" && role !== "admin") {
      return NextResponse.json({ error: "Registrar access is required." }, { status: 403 });
    }

    const body = await request.json();
    const result = await generateCertificate(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid certificate request." }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate certificate." },
      { status: 500 },
    );
  }
}
