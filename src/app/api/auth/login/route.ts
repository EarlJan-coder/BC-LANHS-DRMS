import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getDb } from "@/db";
import { checkAuthRateLimit, clearLoginAttempts } from "@/lib/auth-rate-limit";
import { users } from "@/db/schema";
import { comparePassword } from "@/lib/password";
import { startSession } from "@/lib/session";
import { requiresStudentRegistrationApproval } from "@/lib/registration-access";

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or LRN.").max(191),
  password: z.string().min(1, "Enter your password.").max(72),
});

export async function POST(request: Request) {
  try {
    const values = loginSchema.parse(await request.json());
    if (new TextEncoder().encode(values.password).byteLength > 72) {
      return NextResponse.json({ error: "Password must be 72 bytes or fewer." }, { status: 400 });
    }

    const isEmail = values.identifier.includes("@");
    const identifier = isEmail ? values.identifier.toLowerCase() : values.identifier;
    const rateLimit = await checkAuthRateLimit(request, identifier, "login");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Wait a few minutes and try again." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      );
    }

    const db = getDb();
    let user: typeof users.$inferSelect | undefined;
    if (isEmail) {
      user = await db.query.users.findFirst({ where: eq(users.email, identifier) });
    } else {
      const lrnMatches = await db.select().from(users).where(eq(users.lrn, identifier)).limit(2);
      if (lrnMatches.length > 1) {
        await comparePassword(values.password, null);
        return NextResponse.json(
          { error: "Email/LRN or password is incorrect." },
          { status: 401 },
        );
      }
      user = lrnMatches[0];
    }

    // Always run one bcrypt compare — against a dummy cost-12 hash when no
    // user exists — so response time does not reveal valid emails/LRNs.
    const passwordOk = await comparePassword(values.password, user?.passwordHash ?? null);

    if (!user || !user.isActive || user.status !== "active" || !passwordOk) {
      return NextResponse.json({ error: "Email/LRN or password is incorrect." }, { status: 401 });
    }

    if (requiresStudentRegistrationApproval(user.role)) {
      if (user.registrationStatus === "pending") {
        return NextResponse.json(
          {
            error:
              "Your account is on hold while the registrar confirms your identity. We'll email you when it's approved.",
          },
          { status: 403 },
        );
      }

      if (user.registrationStatus === "declined") {
        return NextResponse.json({ error: "Your registration was declined. Contact the registrar." }, { status: 403 });
      }
    }

    await clearLoginAttempts(request, identifier);
    await startSession(user.id, user.tokenVersion);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Enter your login details." }, { status: 400 });
    }

    return NextResponse.json({ error: "Unable to sign in right now." }, { status: 500 });
  }
}
