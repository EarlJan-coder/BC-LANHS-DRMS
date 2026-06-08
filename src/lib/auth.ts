import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { UserRole } from "@/db/schema";

export function clerkConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

async function getClaimRole(): Promise<UserRole> {
  const { sessionClaims } = await auth();
  const claims = sessionClaims as { metadata?: { role?: UserRole } } | null;
  const role = claims?.metadata?.role;

  if (role === "admin" || role === "registrar" || role === "student" || role === "alumni") {
    return role;
  }

  return "student";
}

export async function getCurrentRole(): Promise<UserRole> {
  if (!clerkConfigured()) {
    return "student";
  }

  const { userId } = await auth();

  if (userId && db) {
    const localUser = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
    });

    if (localUser?.role) {
      return localUser.role;
    }
  }

  return getClaimRole();
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
  const role = await getClaimRole();

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

export function dashboardPathForRole(role: UserRole) {
  if (role === "admin") {
    return "/admin/dashboard";
  }

  if (role === "registrar") {
    return "/registrar/dashboard";
  }

  return "/student/dashboard";
}

export function roleCanAccessPath(role: UserRole, pathname: string) {
  if (pathname.startsWith("/admin")) {
    return role === "admin";
  }

  if (pathname.startsWith("/registrar")) {
    return role === "registrar" || role === "admin";
  }

  if (pathname.startsWith("/student")) {
    return role === "student" || role === "alumni" || role === "admin";
  }

  return true;
}
