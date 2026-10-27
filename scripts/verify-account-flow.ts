/**
 * End-to-end verification for admin account creation + forced password change.
 * Walks the exact journey the task reviewers flagged as unverified:
 *   placeholder sign-in -> forced redirect -> wrong current password -> success -> role dashboard
 *
 * Run: node --import tsx .superpowers/sdd/2026-10-27-admin-account-creation-and-password-change/e2e-verify.ts
 * Requires DATABASE_URL + SESSION_SECRET and a running server on BASE_URL.
 */
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";

// tsx does not auto-load .env.local the way the Next.js server does.
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = t.indexOf("=");
  const key = t.slice(0, i).trim();
  if (!process.env[key]) {
    let value = t.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const BASE = process.env.BASE_URL ?? "http://localhost:3122";
const EMAIL = `e2e-${Date.now()}@example.com`;
const PLACEHOLDER = "placeholder123";
const NEW_PASSWORD = "brandnew12345";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  -- ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  const { db } = await import("@/db");
  const { users } = await import("@/db/schema");
  const { createStaffAccount } = await import("@/lib/services/account-admin");

  // --- setup: create a staff account exactly as the admin UI does -------------
  const created = await createStaffAccount({
    email: EMAIL,
    firstName: "E2E",
    lastName: "Test",
    role: "registrar",
    password: PLACEHOLDER,
  });
  check("create staff account (registrar)", Boolean(created.id), `id=${created.id}`);

  try {
    // --- 1. sign in with the placeholder --------------------------------------
    const login = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: EMAIL, password: PLACEHOLDER }),
    });
    const cookie = (login.headers.getSetCookie?.() ?? [])
      .map((c) => c.split(";")[0])
      .filter((c) => c.startsWith("lanhs_session="))
      .join("; ");
    check("login with placeholder returns 200", login.status === 200, `status=${login.status}`);
    check("login sets a session cookie", Boolean(cookie), cookie ? "lanhs_session present" : "NO COOKIE");

    const authed = { Cookie: cookie, "Content-Type": "application/json" };

    // --- 2. forced redirect away from a protected page ------------------------
    const bounce = await fetch(`${BASE}/registrar/dashboard`, {
      headers: authed,
      redirect: "manual",
    });
    const loc = bounce.headers.get("location") ?? "";
    check(
      "flagged user is redirected off the protected page",
      bounce.status >= 300 && bounce.status < 400 && loc.endsWith("/change-password"),
      `status=${bounce.status} location=${loc}`,
    );

    // --- 3. the change-password screen actually renders -----------------------
    const screen = await fetch(`${BASE}/change-password`, { headers: authed, redirect: "manual" });
    const html = await screen.text();
    check("change-password returns 200 (not 404)", screen.status === 200, `status=${screen.status}`);
    check(
      "change-password renders the heading",
      html.includes("Set a new password"),
      html.includes("Set a new password") ? "found" : "MISSING",
    );
    check(
      "change-password shows the forced-change banner",
      html.includes("Choose a new password to continue."),
      "banner text",
    );

    // --- 4. wrong current password is rejected and does not change anything --
    const wrong = await fetch(`${BASE}/api/profile/password`, {
      method: "PATCH",
      headers: authed,
      body: JSON.stringify({ currentPassword: "definitely-not-it", newPassword: NEW_PASSWORD }),
    });
    const wrongBody = await wrong.json();
    check("wrong current password returns 401", wrong.status === 401, `status=${wrong.status}`);
    check(
      "401 carries the message the form shows",
      wrongBody.error === "Your current password is incorrect.",
      `error=${JSON.stringify(wrongBody.error)}`,
    );

    // still locked out after the failure
    const stillBounced = await fetch(`${BASE}/registrar/dashboard`, {
      headers: authed,
      redirect: "manual",
    });
    check(
      "still forced to change-password after a failed attempt",
      stillBounced.status >= 300 && stillBounced.status < 400,
      `status=${stillBounced.status}`,
    );

    // --- 5. correct current password succeeds --------------------------------
    const good = await fetch(`${BASE}/api/profile/password`, {
      method: "PATCH",
      headers: authed,
      body: JSON.stringify({ currentPassword: PLACEHOLDER, newPassword: NEW_PASSWORD }),
    });
    check("password change returns 200", good.status === 200, `status=${good.status}`);
    const newCookie = (good.headers.getSetCookie?.() ?? [])
      .map((c) => c.split(";")[0])
      .filter((c) => c.startsWith("lanhs_session="))
      .join("; ");
    check("change re-issues a session cookie (caller stays signed in)", Boolean(newCookie), "new cookie");
    check("re-issued cookie differs from the old one", Boolean(newCookie) && newCookie !== cookie);

    const after = { Cookie: newCookie || cookie, "Content-Type": "application/json" };

    // --- 6. the flag is cleared and the role dashboard is reachable ----------
    const dash = await fetch(`${BASE}/registrar/dashboard`, { headers: after, redirect: "manual" });
    check(
      "role dashboard reachable after the change",
      dash.status === 200,
      `status=${dash.status}`,
    );

    const screenAfter = await fetch(`${BASE}/change-password`, { headers: after, redirect: "manual" });
    check(
      "change-password no longer shows the forced banner",
      screenAfter.status === 200 && !(await screenAfter.text()).includes("Choose a new password to continue."),
      `status=${screenAfter.status}`,
    );

    // --- 7. the placeholder password no longer works -------------------------
    const relogin = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: EMAIL, password: PLACEHOLDER }),
    });
    check("the old placeholder password is rejected", relogin.status === 401, `status=${relogin.status}`);

    const relogin2 = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: EMAIL, password: NEW_PASSWORD }),
    });
    check("the new password signs in", relogin2.status === 200, `status=${relogin2.status}`);
  } finally {
    await db.delete(users).where(eq(users.email, EMAIL));
    console.log(`\ncleaned up test account ${EMAIL}`);
  }

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("verification crashed:", error);
  process.exit(1);
});
