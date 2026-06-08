import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { clerkConfigured, getCurrentRole } from "@/lib/auth";
import { userRoleUpdateSchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const role = await getCurrentRole();
    if (clerkConfigured() && role !== "admin") {
      return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    }

    const { id } = await params;
    const values = userRoleUpdateSchema.parse(await request.json());
    const db = getDb();

    await db
      .update(users)
      .set({
        role: values.role,
        status: values.status,
        isActive: values.status ? values.status === "active" : undefined,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid user update." }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update user." },
      { status: 500 },
    );
  }
}
