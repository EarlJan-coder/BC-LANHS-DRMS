import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth";
import { markAll } from "@/lib/services/notifications";

/** Mark every unread notification read for the signed-in user. */
export async function POST() {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    }

    const updated = await markAll(user.id);

    return NextResponse.json({ success: true, updated });
  } catch {
    return NextResponse.json({ error: "Unable to update notifications." }, { status: 500 });
  }
}
