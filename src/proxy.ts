import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/student(.*)",
  "/registrar(.*)",
  "/admin(.*)",
  "/api/document-requests(.*)",
  "/api/users(.*)",
  "/api/profile(.*)",
  "/api/students(.*)",
  "/api/certificates(.*)",
  "/api/grade-import(.*)",
  "/api/audit(.*)",
  "/api/blockchain(.*)",
  "/api/reports(.*)",
]);

const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

const proxy = clerkConfigured
  ? clerkMiddleware(async (auth, req) => {
      if (isProtectedRoute(req)) {
        await auth.protect();
      }
    })
  : function demoProxy() {
      return NextResponse.next();
    };

export default proxy;

export const config = {
  matcher: [
    "/dashboard(.*)",
    "/student(.*)",
    "/registrar(.*)",
    "/admin(.*)",
    "/api/document-requests(.*)",
    "/api/users(.*)",
    "/api/profile(.*)",
    "/api/students(.*)",
    "/api/certificates(.*)",
    "/api/grade-import(.*)",
    "/api/audit(.*)",
    "/api/blockchain(.*)",
    "/api/reports(.*)",
    "/__clerk/(.*)",
  ],
};
