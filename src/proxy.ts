import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { SESSION_COOKIE, isSessionValidForUser, verifySessionToken } from "@/lib/session-token";

const protectedPrefixes = [
  "/dashboard",
  "/student",
  "/registrar",
  "/admin",
  "/api/document-requests",
  "/api/users",
  "/api/profile",
  "/api/students",
  "/api/academic-setup",
  "/api/certificates",
  "/api/audit",
  "/api/blockchain",
  "/api/reports",
];

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest) {
  if (!isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const session = await verifySessionToken(token);

      // Proxy runs on the Node.js runtime (Next 16 default), so revocation
      // can be enforced here for every protected route — including ones with
      // no in-route user check. A bumped users.token_version (logout) or a
      // deleted/disabled account invalidates the cookie immediately.
      if (db) {
        const user = await db.query.users.findFirst({ where: eq(users.id, session.sub) });

        if (user && user.isActive && user.status === "active" && isSessionValidForUser(session, user)) {
          return NextResponse.next();
        }
      } else {
        // No database configured: fall back to signature-only verification.
        return NextResponse.next();
      }
    } catch {
      // Treat an invalid or expired cookie as signed out.
    }
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  }

  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  return NextResponse.redirect(new URL(`/sign-in?next=${encodeURIComponent(next)}`, request.url));
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/student/:path*",
    "/registrar/:path*",
    "/admin/:path*",
    "/api/document-requests/:path*",
    "/api/users/:path*",
    "/api/profile/:path*",
    "/api/students/:path*",
    "/api/academic-setup/:path*",
    "/api/certificates/:path*",
    "/api/audit/:path*",
    "/api/blockchain/:path*",
    "/api/reports/:path*",
  ],
};
