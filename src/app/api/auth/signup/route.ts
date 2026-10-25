import bcrypt from "bcryptjs";
import { and, eq, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getDb } from "@/db";
import { students, users } from "@/db/schema";
import { checkAuthRateLimit } from "@/lib/auth-rate-limit";
import { startSession } from "@/lib/session";
import { assertSessionSecretConfigured } from "@/lib/session-token";

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(191),
  lrn: z.string().trim().regex(/^\d{12}$/, "Enter your 12-digit LRN."),
  firstName: z.string().trim().min(1, "First name is required.").max(100),
  lastName: z.string().trim().min(1, "Last name is required.").max(100),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72),
});

function normalizedName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function postgresCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? (error as { code?: string }).code
    : undefined;
}

export async function POST(request: Request) {
  try {
    const values = signupSchema.parse(await request.json());

    if (new TextEncoder().encode(values.password).byteLength > 72) {
      return NextResponse.json({ error: "Password must be 72 bytes or fewer." }, { status: 400 });
    }

    assertSessionSecretConfigured();

    // Signup previously had no limit and could be scripted to probe LRNs.
    // The LRN is the enumerated value, so it keys the credential bucket.
    const rateLimit = await checkAuthRateLimit(request, values.lrn, "signup");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Wait a few minutes and try again." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      );
    }

    // Hash before opening the transaction: bcrypt is CPU-bound (~hundreds of
    // ms at cost 12) and would otherwise hold one of the 5 pool connections
    // hostage for the whole computation. Duplicate/match checks still reject
    // before any insert; the only cost is hashing attempts that end in a 409.
    const passwordHash = await bcrypt.hash(values.password, 12);

    const db = getDb();
    const user = await db.transaction(async (tx) => {
      const duplicate = await tx.query.users.findFirst({
        where: or(eq(users.email, values.email), eq(users.lrn, values.lrn)),
      });

      if (duplicate) {
        throw new Error("EMAIL_OR_LRN_EXISTS");
      }

      const existingStudent = await tx.query.students.findFirst({
        where: and(eq(students.lrn, values.lrn), isNull(students.userId)),
      });

      if (!existingStudent) {
        throw new Error("STUDENT_MATCH_FAILED");
      }

      if (
        normalizedName(existingStudent.firstName) !== normalizedName(values.firstName) ||
        normalizedName(existingStudent.lastName) !== normalizedName(values.lastName)
      ) {
        throw new Error("STUDENT_MATCH_FAILED");
      }

      const now = new Date();
      const [createdUser] = await tx
        .insert(users)
        .values({
          email: values.email,
          lrn: values.lrn,
          passwordHash,
          firstName: values.firstName,
          lastName: values.lastName,
          role: "student",
        })
        .returning();

      const [linkedStudent] = await tx
        .update(students)
        .set({ userId: createdUser.id, email: values.email, updatedAt: now })
        .where(and(eq(students.id, existingStudent.id), isNull(students.userId)))
        .returning({ id: students.id });

      if (!linkedStudent) {
        throw new Error("STUDENT_MATCH_FAILED");
      }

      return createdUser;
    });

    await startSession(user.id, user.tokenVersion);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Check the signup details." }, { status: 400 });
    }

    if (error instanceof Error && error.message === "EMAIL_OR_LRN_EXISTS") {
      return NextResponse.json({ error: "An account already uses that email or LRN." }, { status: 409 });
    }

    if (error instanceof Error && error.message === "STUDENT_MATCH_FAILED") {
      // One response for every match failure (unknown LRN, name mismatch,
      // lost link race) so signup responses cannot be used to probe which
      // LRNs exist or to confirm a student's registered name.
      return NextResponse.json(
        { error: "We couldn't match those details to an unlinked student record. Contact the registrar to confirm your record." },
        { status: 400 },
      );
    }

    if (postgresCode(error) === "23505") {
      return NextResponse.json({ error: "An account already uses that email or LRN." }, { status: 409 });
    }

    return NextResponse.json({ error: "Unable to create the account right now." }, { status: 500 });
  }
}
