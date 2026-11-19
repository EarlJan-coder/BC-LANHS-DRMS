import { NextResponse } from "next/server";
import { retryPendingBlockchainLogs } from "@/lib/services/audit-log";
import { getSystemSettings } from "@/lib/services/system-settings";

/**
 * Injectable effects for tests (same seam pattern as `apiGuardEffects`).
 * Production behavior is unchanged — the seam defaults to the real calls.
 */
export const cronEffects = {
  getSettings: getSystemSettings,
  retryProofs: () => retryPendingBlockchainLogs(),
};

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Never leave the endpoint open when the secret is not configured.
    return NextResponse.json({ error: "Scheduled retry is not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const settings = await cronEffects.getSettings();
  if (!settings.autoFixProofs) {
    return NextResponse.json({ skipped: true, reason: "Automatic proof fixing is turned off." });
  }

  const retry = await cronEffects.retryProofs();
  return NextResponse.json({ skipped: false, retry });
}
