import { NextResponse } from "next/server";
import { readAuditCount } from "@/lib/blockchain/client";
import { retryPendingBlockchainLogs } from "@/lib/services/audit-log";

export async function POST() {
  try {
    const retry = await retryPendingBlockchainLogs();
    const auditCount = await readAuditCount();
    return NextResponse.json({
      message: "Pending blockchain proofs processed.",
      retry,
      auditCount,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to reach blockchain contract." },
      { status: 500 },
    );
  }
}
