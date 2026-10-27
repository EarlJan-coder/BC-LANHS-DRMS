import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentDbUser } from "@/lib/auth";
import { checkAuthRateLimit } from "@/lib/auth-rate-limit";
import { startSession } from "@/lib/session";
import { recordAuditedAction } from "@/lib/services/audit-log";
import { changeOwnPassword } from "@/lib/services/account-admin";
import { passwordChangeSchema } from "@/lib/validators";
import { AppError } from "@/lib/utils";

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    }

    const values = passwordChangeSchema.parse(await request.json());

    const rateLimit = await checkAuthRateLimit(request, user.email, "admin-account");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Wait a few minutes and try again." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      );
    }

    const { tokenVersion } = await changeOwnPassword(user.id, values.currentPassword, values.newPassword);

    await startSession(user.id, tokenVersion);

    await recordAuditedAction({
      action: "user.password_change",
      actorRole: user.role,
      entityType: "user",
      entityId: user.id,
      actorUserId: user.id,
      referenceId: user.id,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid password details." },
        { status: 400 },
      );
    }

    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    return NextResponse.json({ error: "Unable to change the password right now." }, { status: 500 });
  }
}
