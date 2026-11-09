import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getDb } from "@/db";
import { students, users } from "@/db/schema";
import { ensureCurrentDbUser } from "@/lib/auth";
import { isPostgresError } from "@/lib/services/student-records";

const profileUpdateSchema = z.object({
  contactNumber: z.string().trim().max(30).optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(191).optional(),
});

export async function PATCH(request: Request) {
  try {
    const values = profileUpdateSchema.parse(await request.json());
    const db = getDb();
    const user = await ensureCurrentDbUser();

    if (!user) {
      return NextResponse.json({ error: "User profile is not available." }, { status: 401 });
    }

    const existingProfile = await db.query.students.findFirst({
      where: eq(students.userId, user.id),
    });

    const updatesStudentRecord = values.contactNumber !== undefined;
    if (updatesStudentRecord && !existingProfile) {
      return NextResponse.json(
        {
          error: "Your student record is not linked yet. Contact the registrar to update your contact number.",
        },
        { status: 409 },
      );
    }

    const now = new Date();

    // One transaction: the email writes to both students and users, and the
    // users.email unique violation must not leave a half-applied update.
    await db.transaction(async (tx) => {
      if (existingProfile) {
        await tx
          .update(students)
          .set({
            ...(values.contactNumber !== undefined ? { contactNumber: values.contactNumber || null } : {}),
            ...(values.email !== undefined ? { email: values.email } : {}),
            updatedAt: now,
          })
          .where(eq(students.id, existingProfile.id));
      }

      if (values.email !== undefined) {
        await tx
          .update(users)
          .set({ email: values.email, updatedAt: now })
          .where(eq(users.id, user.id));
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid profile data." }, { status: 400 });
    }

    if (isPostgresError(error, "23505", "users_email_idx")) {
      return NextResponse.json({ error: "This email is already used by another account." }, { status: 409 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update profile." },
      { status: 500 },
    );
  }
}
