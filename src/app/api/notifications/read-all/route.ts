import { NextResponse } from "next/server";
import { markAllNotificationsRead } from "@/lib/services/notifications";

/** Mark all of the current user's notifications as read. */
export async function POST() {
  try {
    const updated = await markAllNotificationsRead();
    return NextResponse.json({ ok: true, updated });
  } catch {
    return NextResponse.json({ error: "Unable to update notifications." }, { status: 500 });
  }
}
