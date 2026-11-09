import { NextResponse } from "next/server";
import { ensureCurrentDbUser } from "@/lib/auth";
import { getNotificationDetail } from "@/lib/services/notifications";
import { AppError } from "@/lib/utils";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await ensureCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });

  try {
    const { id } = await params;
    return NextResponse.json({ data: await getNotificationDetail(user.id, id) });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Unable to load notification details." }, { status: 500 });
  }
}
