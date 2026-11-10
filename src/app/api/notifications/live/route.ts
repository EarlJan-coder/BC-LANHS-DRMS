import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth";
import { countUnread, listUserNotifications } from "@/lib/services/notifications";

export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });

  try {
    const [notifications, unreadCount] = await Promise.all([
      listUserNotifications(user.id, 20),
      countUnread(user.id),
    ]);
    return NextResponse.json(
      { notifications, unreadCount },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    return NextResponse.json({ error: "Unable to load notifications." }, { status: 500 });
  }
}
