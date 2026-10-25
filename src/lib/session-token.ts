import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "lanhs_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function sessionKey() {
  const secret = process.env.SESSION_SECRET;

  if (!secret || new TextEncoder().encode(secret).byteLength < 32) {
    throw new Error("SESSION_SECRET must be set to a secret of at least 32 bytes.");
  }

  return new TextEncoder().encode(secret);
}

export function assertSessionSecretConfigured() {
  sessionKey();
}

export async function createSessionToken(userId: string, tokenVersion: number) {
  return new SignJWT({ tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(sessionKey());
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, sessionKey(), { algorithms: ["HS256"] });

  if (!payload.sub || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.sub)) {
    throw new Error("Invalid session subject.");
  }

  // Tokens minted before the claim existed report null so they can never
  // match a stored token_version (forces a one-time re-login after deploy).
  const tokenVersion = typeof payload.tokenVersion === "number" ? payload.tokenVersion : null;

  return { sub: payload.sub, tokenVersion };
}

// Revocation check: every request compares the JWT claim against the user's
// current token_version. A bumped version (logout) or a legacy token without
// the claim (null) invalidates the session immediately.
export function isSessionValidForUser(
  session: { tokenVersion: number | null },
  user: { tokenVersion: number },
) {
  return session.tokenVersion !== null && session.tokenVersion === user.tokenVersion;
}
