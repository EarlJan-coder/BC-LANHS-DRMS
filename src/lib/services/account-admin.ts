import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users, type UserRole } from "@/db/schema";
import { AppError } from "@/lib/utils";

function postgresCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? (error as { code?: string }).code
    : undefined;
}

export async function createStaffAccount(input: {
  email: string;
  firstName: string;
  lastName: string;
  role: "alumni" | "registrar" | "admin";
  password: string;
}): Promise<{ id: string; email: string; role: UserRole }> {
  if (new TextEncoder().encode(input.password).byteLength > 72) {
    throw new AppError("Password must be 72 bytes or fewer.", 400);
  }

  const db = getDb();
  const existing = await db.query.users.findFirst({
    where: eq(users.email, input.email),
  });

  if (existing) {
    throw new AppError("An account already uses that email.", 409);
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  try {
    const [created] = await db
      .insert(users)
      .values({
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role,
        passwordHash,
        mustChangePassword: true,
        tokenVersion: 0,
        status: "active",
        isActive: true,
      })
      .returning({
        id: users.id,
        email: users.email,
        role: users.role,
      });

    return created;
  } catch (error) {
    if (postgresCode(error) === "23505") {
      throw new AppError("An account already uses that email.", 409);
    }
    throw error;
  }
}

export function assertAdmin(actor: { role: UserRole }): void {
  if (actor.role !== "admin") {
    throw new AppError("Only administrators can manage accounts.", 403);
  }
}
