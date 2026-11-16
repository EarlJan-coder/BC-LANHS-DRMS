import { NextResponse } from "next/server";
import { ensureCurrentDbUser } from "@/lib/auth";

/**
 * Injectable effects for tests (same seam pattern as `resolveUser` in
 * `document-requests.ts`): cookie-bound auth is unreachable from route tests
 * because `cookies()` requires a Next.js request scope. Production behavior is
 * unchanged — the seam defaults to the real resolver.
 */
export const apiGuardEffects = {
  resolveUser: ensureCurrentDbUser,
};

export async function requireAdmin() {
  const user = await apiGuardEffects.resolveUser();
  if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "You do not have access to this resource." }, { status: 403 });
  return null;
}
