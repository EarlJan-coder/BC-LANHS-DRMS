import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { SESSION_COOKIE, isSessionValidForUser, verifySessionToken } from "@/lib/session-token";
import { canAccessWithRegistrationStatus } from "@/lib/registration-access";
import { roleCanAccessPath } from "@/lib/auth";

const protectedPrefixes = [
  "/dashboard",
  "/student",
  "/registrar",
  "/admin",
  "/change-password",
  "/api/document-requests",
  "/api/users",
  "/api/profile",
  "/api/students",
  "/api/certificates",
  "/api/audit",
  "/api/blockchain",
  "/api/reports",
  "/api/registrations",
  "/api/notifications",
  "/api/document-types",
  "/api/settings",
];

const passwordChangeAllowlist = ["/change-password", "/api/profile/password", "/api/auth/logout"];
const publicApiPaths = new Set(["/api/auth/login", "/api/auth/signup"]);

function continuePageRequest(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const isProd = process.env.NODE_ENV === "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "script-src-attr 'none'",
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`,
    // Framer Motion and a few interactive controls set style attributes at
    // runtime. Keep those working while keeping executable scripts nonce-only.
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

function isStateChangingMethod(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function hasSameOriginSource(request: NextRequest) {
  const source = request.headers.get("origin") ?? request.headers.get("referer");
  if (!source || source === "null") return false;

  try {
    return new URL(source).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

function isProtectedPath(pathname: string) {
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return !publicApiPaths.has(pathname);
  }

  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export { isProtectedPath };

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // SameSite cookies are the first CSRF defense. Requiring an exact Origin or
  // Referer match on API writes adds a server-side check for browsers that
  // attach the session cookie to a forged request.
  if (pathname.startsWith("/api/") && isStateChangingMethod(request.method) && !hasSameOriginSource(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
  }

  if (!isProtectedPath(request.nextUrl.pathname)) {
    return pathname.startsWith("/api/") ? NextResponse.next() : continuePageRequest(request);
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

        if (
          user &&
          user.isActive &&
          user.status === "active" &&
          canAccessWithRegistrationStatus(user.role, user.registrationStatus) &&
          isSessionValidForUser(session, user)
        ) {
          if (!pathname.startsWith("/api/") && !roleCanAccessPath(user.role, pathname)) {
            return NextResponse.redirect(new URL("/dashboard", request.url));
          }

          if (user.mustChangePassword && !passwordChangeAllowlist.includes(request.nextUrl.pathname)) {
            return request.nextUrl.pathname.startsWith("/api/")
              ? NextResponse.json({ error: "Change your password before continuing." }, { status: 403 })
              : NextResponse.redirect(new URL("/change-password", request.url));
          }

          return pathname.startsWith("/api/") ? NextResponse.next() : continuePageRequest(request);
        }
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
    "/api/:path*",
    // Scope nonce CSP to HTML routes that render dynamically. Static assets
    // and the framework's static 404 response do not need a request nonce.
    "/",
    "/about",
    "/dashboard/:path*",
    "/student/:path*",
    "/registrar/:path*",
    "/admin/:path*",
    "/change-password",
    "/sign-in/:path*",
    "/sign-up/:path*",
    "/verify",
    "/verify-certificate/:path*",
  ],
};
