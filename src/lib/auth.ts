import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { UserRole } from "@/db/schema";

function clerkConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

export async function getCurrentRole(): Promise<UserRole> {
  if (!clerkConfigured()) {
    return "student";
  }

  const { sessionClaims } = await auth();
  const claims = sessionClaims as { metadata?: { role?: UserRole } } | null;
  const role = claims?.metadata?.role;

  if (role === "admin" || role === "registrar" || role === "student") {
    return role;
  }

  return "student";
}

export async function getCurrentProfile() {
  if (!clerkConfigured()) {
    return {
      clerkId: "demo-user",
      email: "demo@lanhs.edu.ph",
      firstName: "Demo",
      lastName: "User",
      role: "student" as UserRole,
    };
  }

  const user = await currentUser();
  const role = await getCurrentRole();

  return {
    clerkId: user?.id ?? "demo-user",
    email: user?.primaryEmailAddress?.emailAddress ?? "demo@lanhs.edu.ph",
    firstName: user?.firstName ?? "Demo",
    lastName: user?.lastName ?? "User",
    role,
  };
}

export async function ensureCurrentDbUser() {
  if (!db) {
    return null;
  }

  const profile = await getCurrentProfile();
  const byClerkId = await db.query.users.findFirst({
    where: eq(users.clerkId, profile.clerkId),
  });

  if (byClerkId) {
    const [updated] = await db
      .update(users)
      .set({
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        role: profile.role,
        updatedAt: new Date(),
      })
      .where(eq(users.id, byClerkId.id))
      .returning();

    return updated;
  }

  const byEmail = await db.query.users.findFirst({
    where: eq(users.email, profile.email),
  });

  if (byEmail) {
    const [updated] = await db
      .update(users)
      .set({
        clerkId: profile.clerkId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        role: profile.role,
        updatedAt: new Date(),
      })
      .where(eq(users.id, byEmail.id))
      .returning();

    return updated;
  }

  const [created] = await db
    .insert(users)
    .values({
      clerkId: profile.clerkId,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      role: profile.role,
    })
    .returning();

  return created;
}

export function assertRole(role: UserRole, allowed: UserRole[]) {
  if (!allowed.includes(role)) {
    throw new Error("You do not have permission to perform this action.");
  }
}
