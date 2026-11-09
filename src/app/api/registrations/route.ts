import { NextResponse } from "next/server";
import { ensureCurrentDbUser } from "@/lib/auth";
import { listPendingRegistrations } from "@/lib/services/registrations";

function canReview(role: string) {
  return role === "registrar" || role === "admin";
}

export async function GET() {
  const user = await ensureCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  if (!canReview(user.role)) return NextResponse.json({ error: "You do not have access to this resource." }, { status: 403 });

  return NextResponse.json({ data: await listPendingRegistrations() });
}
