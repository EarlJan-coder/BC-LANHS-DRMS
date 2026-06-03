import { NextResponse } from "next/server";
import { readAuditCount } from "@/lib/blockchain/client";

export async function POST() {
  try {
    const auditCount = await readAuditCount();
    return NextResponse.json({
      message: "Retry worker scaffold is ready. Query pending blockchain_audit_logs and resubmit in a scheduled job.",
      auditCount,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to reach blockchain contract." },
      { status: 500 },
    );
  }
}

