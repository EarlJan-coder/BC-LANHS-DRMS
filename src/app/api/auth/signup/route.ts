import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getDb } from "@/db";
import { students, users } from "@/db/schema";
import { checkAuthRateLimit } from "@/lib/auth-rate-limit";
import { composeAddress } from "@/lib/ph-address";
import { fanOutNewRegistrationNotification } from "@/lib/services/notifications";

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(191),
  lrn: z.string().trim().regex(/^\d{12}$/, "Enter your 12-digit LRN."),
  firstName: z.string().trim().min(1, "First name is required.").max(100),
  middleName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().min(1, "Last name is required.").max(100),
  suffix: z.enum(["None", "Jr.", "Sr.", "II", "III", "IV"]).default("None"),
  phone: z.string().trim().max(30).optional(),
  addressCity: z.string().trim().min(1, "City is required.").max(100),
  addressBarangay: z.string().trim().min(1, "Barangay is required.").max(100),
  addressStreetLine: z.string().trim().min(1, "Street line is required.").max(500),
  lastSchoolYearAttended: z
    .string()
    .trim()
    .min(1, "Last school year attended is required.")
    .max(40, "Last school year attended must be 40 characters or fewer."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72),
  acceptedTerms: z.literal(true, "You must accept the Terms and Conditions to register."),
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

export async function POST(request: Request) {
  try {
    const values = signupSchema.parse(await request.json());

    if (new TextEncoder().encode(values.password).byteLength > 72) {
      return NextResponse.json({ error: "Password must be 72 bytes or fewer." }, { status: 400 });
    }

    // Email is the account's unique identifier. LRNs may be shared across
    // registrations, so they must not block signup or share its rate bucket.
    const rateLimit = await checkAuthRateLimit(request, values.email, "signup");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Wait a few minutes and try again." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      );
    }

    // Hash before opening the transaction: bcrypt is CPU-bound (~hundreds of
    // ms at cost 12) and would otherwise hold one of the 5 pool connections
    // hostage for the whole computation.
    const passwordHash = await bcrypt.hash(values.password, 12);

    const db = getDb();
    const user = await db.transaction(async (tx) => {
      const duplicate = await tx.query.users.findFirst({
        where: eq(users.email, values.email),
      });

      if (duplicate) {
        throw new Error("EMAIL_EXISTS");
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

      await tx.insert(students).values({
        userId: createdUser.id,
        lrn: values.lrn,
        firstName: values.firstName,
        middleName: values.middleName?.trim() || null,
        lastName: values.lastName,
        suffix: values.suffix === "None" ? null : values.suffix,
        email: values.email,
        contactNumber: values.phone?.trim() || null,
        address: composeAddress({
          streetLine: values.addressStreetLine,
          barangay: values.addressBarangay,
          city: values.addressCity,
        }),
        lastSchoolYearAttended: values.lastSchoolYearAttended,
      });

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
      {
        ok: true,
        message:
          "Your account is on hold while the registrar confirms your identity. We'll email you when it's approved, with a link to sign in.",
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Check the signup details." }, { status: 400 });
    }

    if (error instanceof Error && error.message === "EMAIL_EXISTS") {
      return NextResponse.json({ error: "An account already uses that email." }, { status: 409 });
    }

    if (postgresCode(error) === "23505") {
      return NextResponse.json({ error: "An account already uses that email." }, { status: 409 });
    }

    return NextResponse.json({ error: "Unable to create the account right now." }, { status: 500 });
  }
}
