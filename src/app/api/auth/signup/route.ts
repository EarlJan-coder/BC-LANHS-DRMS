import bcrypt from "bcryptjs";
import { and, eq, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getDb } from "@/db";
import { students, users } from "@/db/schema";
import { checkAuthRateLimit } from "@/lib/auth-rate-limit";
import { fanOutNewRegistrationNotification } from "@/lib/services/notifications";

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(191),
  lrn: z.string().trim().regex(/^\d{12}$/, "Enter your 12-digit LRN."),
  firstName: z.string().trim().min(1, "First name is required.").max(100),
  middleName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().min(1, "Last name is required.").max(100),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(2000).optional(),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72),
});

function postgresCode(error: unknown) {
  let current = error;
  const seen = new Set<object>();

  while (typeof current === "object" && current !== null && !seen.has(current)) {
    seen.add(current);
    const code = "code" in current ? (current as { code?: unknown }).code : undefined;
    if (typeof code === "string") return code;
    current = "cause" in current ? (current as { cause?: unknown }).cause : undefined;
  }

  return undefined;
}

function normalizedName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function POST(request: Request) {
  try {
    const values = signupSchema.parse(await request.json());

    if (new TextEncoder().encode(values.password).byteLength > 72) {
      return NextResponse.json({ error: "Password must be 72 bytes or fewer." }, { status: 400 });
    }

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

      // Student records may already exist from a registrar import. Reuse an
      // unlinked record for the same LRN instead of inserting a second row,
      // since students.lrn is unique. If a roster record exists, require its
      // first and last names to match before linking it to the new account.
      const existingStudent = await tx.query.students.findFirst({
        where: eq(students.lrn, values.lrn),
      });

      if (
        existingStudent &&
        (existingStudent.userId !== null ||
          normalizedName(existingStudent.firstName) !== normalizedName(values.firstName) ||
          normalizedName(existingStudent.lastName) !== normalizedName(values.lastName))
      ) {
        throw new Error("STUDENT_MATCH_FAILED");
      }

      const [createdUser] = await tx
        .insert(users)
        .values({
          email: values.email,
          lrn: values.lrn,
          passwordHash,
          firstName: values.firstName,
          lastName: values.lastName,
          role: "student",
          registrationStatus: "pending",
        })
        .returning();

      if (existingStudent) {
        const [linkedStudent] = await tx
          .update(students)
          .set({
            userId: createdUser.id,
            email: values.email,
            ...(values.phone?.trim() ? { contactNumber: values.phone.trim() } : {}),
            ...(values.address?.trim() ? { address: values.address.trim() } : {}),
            updatedAt: new Date(),
          })
          .where(and(eq(students.id, existingStudent.id), isNull(students.userId)))
          .returning({ id: students.id });

        if (!linkedStudent) {
          throw new Error("STUDENT_MATCH_FAILED");
        }
      } else {
        await tx.insert(students).values({
          userId: createdUser.id,
          lrn: values.lrn,
          firstName: values.firstName,
          middleName: values.middleName?.trim() || null,
          lastName: values.lastName,
          email: values.email,
          contactNumber: values.phone?.trim() || null,
          address: values.address?.trim() || null,
        });
      }

      return createdUser;
    });

    try {
      await fanOutNewRegistrationNotification(
        [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" "),
        user.email,
      );
    } catch (error) {
      console.warn("[signup] Registration notification fan-out failed:", error instanceof Error ? error.message : "unknown error");
    }

    return NextResponse.json(
      { ok: true, message: "Registration submitted. Check your email for updates after the registrar reviews it." },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Check the signup details." }, { status: 400 });
    }

    if (error instanceof Error && error.message === "EMAIL_OR_LRN_EXISTS") {
      return NextResponse.json({ error: "An account already uses that email or LRN." }, { status: 409 });
    }

    if (error instanceof Error && error.message === "STUDENT_MATCH_FAILED") {
      return NextResponse.json(
        {
          error:
            "We couldn't match those details to an unlinked student record. Contact the registrar to confirm your record.",
        },
        { status: 400 },
      );
    }

    if (postgresCode(error) === "23505") {
      return NextResponse.json({ error: "An account already uses that email or LRN." }, { status: 409 });
    }

    return NextResponse.json({ error: "Unable to create the account right now." }, { status: 500 });
  }
}
