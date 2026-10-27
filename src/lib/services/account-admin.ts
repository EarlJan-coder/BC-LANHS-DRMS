import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { users, type UserRole } from "@/db/schema";
import { comparePassword } from "@/lib/password";
import { AppError } from "@/lib/utils";

function postgresCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const cause = "cause" in error ? (error as { cause?: unknown }).cause : error;

  if (cause && typeof cause === "object" && "code" in cause) {
    return (cause as { code?: string }).code;
  }

  return "code" in error ? (error as { code?: string }).code : undefined;
}

function assertPasswordFitsBcrypt(password: string): void {
  if (new TextEncoder().encode(password).byteLength > 72) {
    throw new AppError("Password must be 72 bytes or fewer.", 400);
  }
}

export async function createStaffAccount(input: {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  password: string;
}): Promise<{ id: string; email: string; role: UserRole }> {
  if (input.role === "student") {
    throw new AppError("Student accounts cannot be created here.", 400);
  }

  assertPasswordFitsBcrypt(input.password);

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

export async function resetUserPassword(userId: string, password: string): Promise<{ id: string }> {
  assertPasswordFitsBcrypt(password);

  const db = getDb();
  const target = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!target) {
    throw new AppError("Account not found.", 404);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db
    .update(users)
    .set({
      passwordHash,
      mustChangePassword: true,
      tokenVersion: sql`${users.tokenVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return { id: userId };
}

export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ tokenVersion: number }> {
  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new AppError("Account not found.", 404);
  }

  if (!(await comparePassword(currentPassword, user.passwordHash))) {
    throw new AppError("Your current password is incorrect.", 401);
  }

  if (await comparePassword(newPassword, user.passwordHash)) {
    throw new AppError("New password must be different from your current password.", 400);
  }

  assertPasswordFitsBcrypt(newPassword);

  const passwordHash = await bcrypt.hash(newPassword, 12);

  const [updated] = await db
    .update(users)
    .set({
      passwordHash,
      mustChangePassword: false,
      tokenVersion: sql`${users.tokenVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({
      tokenVersion: users.tokenVersion,
    });

  return { tokenVersion: updated.tokenVersion };
}
