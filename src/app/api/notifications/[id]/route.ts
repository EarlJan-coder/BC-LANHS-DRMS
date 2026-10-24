import { NextResponse } from "next/server";
import { markNotificationRead } from "@/lib/services/notifications";

/** Mark one of the current user's notifications as read. */
export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const updated = await markNotificationRead(id);

    if (!updated) {
      // Not found OR owned by another user — same answer either way.
      return NextResponse.json({ error: "Notification not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to update notification." }, { status: 500 });
  }
}
