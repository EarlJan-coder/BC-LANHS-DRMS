import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ensureCurrentDbUser } from "@/lib/auth";
import { isPostgresError } from "@/lib/services/student-records";
import { updateStudentProfile } from "@/lib/services/student-profiles";
import { profileUpdateSchema } from "@/lib/validators";
import { AppError } from "@/lib/utils";

export async function PATCH(request: Request) {
  try {
    const values = profileUpdateSchema.parse(await request.json());

    const user = await ensureCurrentDbUser();

    if (!user) {
      return NextResponse.json({ error: "User profile is not available." }, { status: 401 });
    }

    await updateStudentProfile(user.id, values);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid profile data." }, { status: 400 });
    }

    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
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
