import { NextResponse } from "next/server";
import { getCurrentRole } from "@/lib/auth";
import { readAuditCount } from "@/lib/blockchain/client";
import { retryPendingBlockchainLogs } from "@/lib/services/audit-log";

export async function POST() {
  try {
    // Submitting on-chain transactions spends gas and overrides the retry
    // backoff schedule; keep it admin-only.
    const role = await getCurrentRole();
    if (role !== "admin") {
      return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
    }

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
