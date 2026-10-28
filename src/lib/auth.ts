import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users, type UserRole } from "@/db/schema";
import { SESSION_COOKIE, isSessionValidForUser, verifySessionToken } from "@/lib/session-token";
import { AppError } from "@/lib/utils";

export async function getCurrentDbUser() {
  if (!db) {
    return null;
  }

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  try {
    const session = await verifySessionToken(token);
    const user = await db.query.users.findFirst({ where: eq(users.id, session.sub) });

    if (!user || !user.isActive || user.status !== "active" || !isSessionValidForUser(session, user)) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

export async function ensureCurrentDbUser() {
  return getCurrentDbUser();
}

export async function getCurrentRole(): Promise<UserRole> {
  return (await getCurrentDbUser())?.role ?? "student";
}

export async function getCurrentProfile() {
  const user = await getCurrentDbUser();

  if (!user) {
    throw new AppError("Please sign in to continue.", 401);
  }

  return {
    userId: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
  };
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
    return role === "student" || role === "admin";
  }

  return true;
}
