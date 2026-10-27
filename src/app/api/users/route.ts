import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentDbUser } from "@/lib/auth";
import { checkAuthRateLimit } from "@/lib/auth-rate-limit";
import { recordAuditedAction } from "@/lib/services/audit-log";
import { createStaffAccount, assertAdmin } from "@/lib/services/account-admin";
import { userCreateSchema } from "@/lib/validators";
import { AppError } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    }

    assertAdmin(user);

    const values = userCreateSchema.parse(await request.json());

    const rateLimit = await checkAuthRateLimit(request, values.email, "admin-account");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Wait a few minutes and try again." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      );
    }

    const created = await createStaffAccount(values);

    await recordAuditedAction({
      action: "user.create",
      actorRole: "admin",
      entityType: "user",
      entityId: created.id,
      actorUserId: user.id,
      referenceId: created.id,
      metadata: { email: created.email, role: created.role },
    });

    return NextResponse.json({ ok: true, user: created }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid user details." }, { status: 400 });
    }

    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    return NextResponse.json({ error: "Unable to create the account right now." }, { status: 500 });
  }
}
