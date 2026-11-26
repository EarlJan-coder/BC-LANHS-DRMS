import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getCurrentRole } from "@/lib/auth";
import { getCurrentDbUser } from "@/lib/auth";
import { deletePortalAccount } from "@/lib/services/account-admin";
import { AppError } from "@/lib/utils";
import { userStatusUpdateSchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const role = await getCurrentRole();
    if (role !== "admin") {
      return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    }

    const { id } = await params;
    const values = userStatusUpdateSchema.parse(await request.json());
    const db = getDb();

    const target = await db.query.users.findFirst({ where: eq(users.id, id) });
    if (!target) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    if (target.role === "admin") {
      return NextResponse.json(
        { error: "The administrator account cannot be modified here." },
        { status: 403 },
      );
    }

    await db
      .update(users)
      .set({
        status: values.status,
        isActive: values.status === "active",
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

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const role = await getCurrentRole();
    if (role !== "admin") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    const actor = await getCurrentDbUser();
    if (!actor) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    const { id } = await params;
    await deletePortalAccount(id, { id: actor.id, role: actor.role });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Unable to delete the account." }, { status: 500 });
  }
}
