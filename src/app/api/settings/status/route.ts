import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-guards";
import { getSystemHealth } from "@/lib/services/system-health";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json({ data: await getSystemHealth() });
}
