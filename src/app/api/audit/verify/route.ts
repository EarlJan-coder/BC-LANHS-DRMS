import { NextResponse } from "next/server";
import { verifyRecordHash } from "@/lib/audit/hash";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const verified = verifyRecordHash(body.payload, body.expectedHash);
    return NextResponse.json({ verified });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to verify hash." },
      { status: 400 },
    );
  }
}

