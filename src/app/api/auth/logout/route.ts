import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentDbUser } from "@/lib/auth";
import { endSession } from "@/lib/session";

export async function POST() {
  // Bump token_version first so every other session cookie for this account
  // (including a stolen copy) becomes invalid immediately, not just this one.
  const user = await getCurrentDbUser();
  if (user && db) {
    await db
      .update(users)
      .set({ tokenVersion: user.tokenVersion + 1, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  }

  await endSession();
  return NextResponse.json({ ok: true });
}
