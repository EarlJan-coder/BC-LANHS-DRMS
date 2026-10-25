import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth";
import { markRead } from "@/lib/services/notifications";
import { AppError } from "@/lib/utils";

/** Mark one notification read. Owner-scoped: a row that is not the caller's
 * maps to 404 (never 403) so notification ids are not confirmed. */
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    }

    const { id } = await params;
    await markRead(user.id, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to update notification." }, { status: 500 });
  }
}
