import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { eq } from "drizzle-orm";
import { getCurrentDbUser } from "@/lib/auth";
import { checkAuthRateLimit } from "@/lib/auth-rate-limit";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { recordAuditedAction } from "@/lib/services/audit-log";
import { resetUserPassword, assertAdmin } from "@/lib/services/account-admin";
import { userPasswordResetSchema } from "@/lib/validators";
import { AppError } from "@/lib/utils";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    }

    assertAdmin(user);

    const values = userPasswordResetSchema.parse(await request.json());

    const { id } = await params;

    const rateLimit = await checkAuthRateLimit(request, id, "admin-account");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Wait a few minutes and try again." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      );
    }

    const target = await getDb().query.users.findFirst({ where: eq(users.id, id) });
    if (!target) {
      throw new AppError("Account not found.", 404);
    }

    await resetUserPassword(id, values.password);

    await recordAuditedAction({
      action: "user.password_reset",
      actorRole: "admin",
      entityType: "user",
      entityId: id,
      actorUserId: user.id,
      referenceId: id,
      metadata: { email: target.email },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid password details." }, { status: 400 });
    }

    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    return NextResponse.json({ error: "Unable to reset the password right now." }, { status: 500 });
  }
}
