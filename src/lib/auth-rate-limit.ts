import { createHmac, randomInt } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { assertSessionSecretConfigured } from "@/lib/session-token";

const WINDOW_MINUTES = 15;
const DEFAULT_IP_ATTEMPT_LIMIT = 20;
const DEFAULT_LOGIN_ATTEMPT_LIMIT = 5;

// Per-instance fallback budget for auth attempts when no client address is
// available. A token bucket per endpoint (login, signup) bounds the bcrypt
// work a single instance can be made to perform; it lives in process memory
// and a restart simply refills it.
export const FALLBACK_BURST_TOKENS = 30;
const FALLBACK_REFILL_TOKENS = 30; // sustained tokens per 15-minute window
const FALLBACK_WINDOW_MS = WINDOW_MINUTES * 60_000;

export type AuthRateLimitAction = "login" | "signup";

type RateLimitRow = {
  attempts: number;
  resetAt: Date | string;
};

// Limits are configurable per deployment (a school behind one egress IP needs
// a higher per-address ceiling than the historical defaults). Malformed
// values never throw on the request path: they fall back to the historical
// defaults.
function envAttemptLimit(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (raw === undefined || !/^[0-9]+$/.test(raw)) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

// Per-address ceiling (all attempts from one trusted client address).
export function getIpAttemptLimit(): number {
  return envAttemptLimit("IP_ATTEMPT_LIMIT", DEFAULT_IP_ATTEMPT_LIMIT);
}

// Per-credential ceiling (one email/LRN on login, one LRN on signup).
export function getLoginAttemptLimit(): number {
  return envAttemptLimit("LOGIN_ATTEMPT_LIMIT", DEFAULT_LOGIN_ATTEMPT_LIMIT);
}

export type FallbackBudgetState = { tokens: number; updatedAtMs: number };

export type FallbackBudget = {
  consume(nowMs: number): { allowed: boolean; retryAfterSeconds: number };
  reset(): void;
};

// Pure token bucket with the clock injected per call so tests can drive time
// directly. A denied consume never burns tokens.
export function createFallbackBudget(capacity: number, refillPerWindow: number, windowMs: number): FallbackBudget {
  let state: FallbackBudgetState | null = null;

  return {
    consume(nowMs: number) {
      const refillPerMs = refillPerWindow / windowMs;
      const tokens =
        state === null
          ? capacity
          : Math.min(capacity, state.tokens + Math.max(0, nowMs - state.updatedAtMs) * refillPerMs);

      if (tokens >= 1) {
        state = { tokens: tokens - 1, updatedAtMs: nowMs };
        return { allowed: true, retryAfterSeconds: 0 };
      }

      state = { tokens, updatedAtMs: nowMs };
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((1 - tokens) / refillPerMs / 1000)),
      };
    },
    reset() {
      state = null;
    },
  };
}

const fallbackBudgets = new Map<AuthRateLimitAction, FallbackBudget>();

function fallbackBudgetFor(action: AuthRateLimitAction): FallbackBudget {
  let budget = fallbackBudgets.get(action);
  if (!budget) {
    budget = createFallbackBudget(FALLBACK_BURST_TOKENS, FALLBACK_REFILL_TOKENS, FALLBACK_WINDOW_MS);
    fallbackBudgets.set(action, budget);
  }
  return budget;
}

// A successful login may restore the shared fallback budget, but at most once
// per interval. Restoring on every success would let any caller holding ONE
// valid credential drain the budget with rotating-identifier failures and
// refill it with a single success, over and over — unbounding the very bcrypt
// work the budget exists to cap. One restore per minute keeps the legitimate
// burst case (a class logging in at the start of a period) working while
// capping the amplification. (Refunding one token per success was rejected:
// a success consumes one token and refunds one, so a loop of successful
// logins would never drain the budget at all — still unbounded.)
export const FALLBACK_RESET_MIN_INTERVAL_MS = 60_000;

const lastFallbackResetAtMs = new Map<AuthRateLimitAction, number>();

// Throttled restore for the success path. Returns true when it restored.
function maybeResetFallbackBudget(action: AuthRateLimitAction, nowMs: number): boolean {
  const lastResetAtMs = lastFallbackResetAtMs.get(action);
  if (lastResetAtMs !== undefined && nowMs - lastResetAtMs < FALLBACK_RESET_MIN_INTERVAL_MS) {
    return false;
  }

  fallbackBudgetFor(action).reset();
  lastFallbackResetAtMs.set(action, nowMs);
  return true;
}

// Unconditional restore: the test/ops primitive. Also clears the reset
// throttle so the next successful login is eligible to restore again. Not
// reachable from any request path.
export function resetFallbackBudget(action?: AuthRateLimitAction): void {
  if (action === undefined) {
    fallbackBudgets.clear();
    lastFallbackResetAtMs.clear();
    return;
  }

  fallbackBudgets.get(action)?.reset();
  lastFallbackResetAtMs.delete(action);
}

function trustProxyHeaders() {
  const flag = process.env.TRUST_PROXY?.trim().toLowerCase();
  return flag === "true" || flag === "1";
}

// Returns the client address ONLY when explicitly trusted via TRUST_PROXY.
// Next.js exposes no socket address in route handlers, so these headers are
// attacker-supplied unless a reverse proxy overwrites them; trusting them
// unconditionally would let an attacker rotate X-Forwarded-For to bypass the
// IP buckets. When null, callers must skip address-keyed buckets entirely
// (never bucket every client together under one shared address) and fall
// back to the per-instance budget instead.
export function getClientAddress(request: Request): string | null {
  if (!trustProxyHeaders()) {
    return null;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  const forwardedIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = realIp || forwardedIp;
  return address ? address.slice(0, 128) : null;
}

function rateLimitKey(value: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not configured.");
  }

  return createHmac("sha256", secret).update(value).digest("hex");
}

function credentialBucketKey(action: AuthRateLimitAction, address: string | null, identifier: string) {
  // Two shapes: address-scoped when the client address is trusted, plain
  // per-identifier otherwise. Flipping TRUST_PROXY or a proxy misconfiguration
  // orphans at most one 15-minute window of rows.
  return rateLimitKey(
    address === null ? `${action}-credential:${identifier}` : `${action}-ip-credential:${address}:${identifier}`,
  );
}

async function incrementBucket(bucketKey: string): Promise<RateLimitRow> {
  const db = getDb();
  const [row] = await db.execute<RateLimitRow>(sql`
    INSERT INTO auth_rate_limits (bucket_key, window_started_at, attempts, updated_at)
    VALUES (${bucketKey}, now(), 1, now())
    ON CONFLICT (bucket_key) DO UPDATE SET
      attempts = CASE
        WHEN auth_rate_limits.window_started_at <= now() - interval '${sql.raw(String(WINDOW_MINUTES))} minutes' THEN 1
        ELSE auth_rate_limits.attempts + 1
      END,
      window_started_at = CASE
        WHEN auth_rate_limits.window_started_at <= now() - interval '${sql.raw(String(WINDOW_MINUTES))} minutes' THEN now()
        ELSE auth_rate_limits.window_started_at
      END,
      updated_at = now()
    RETURNING attempts, window_started_at + interval '${sql.raw(String(WINDOW_MINUTES))} minutes' AS "resetAt"
  `);

  if (!row) {
    throw new Error("Unable to check the login attempt limit.");
  }

  return row;
}

// Compensating rollback for an increment that must not stick: the attempt
// was rejected before any password check ran, so it is not an attempt against
// the per-credential bucket. Never decrements below zero, so a concurrent
// failure cannot be un-counted by someone else's rollback. Best-effort only:
// the caller swallows failures, so a transient DB error here cannot turn a
// correct 429 into a 500.
async function decrementBucket(bucketKey: string): Promise<void> {
  const db = getDb();
  await db.execute(sql`
    UPDATE auth_rate_limits
    SET attempts = GREATEST(attempts - 1, 0), updated_at = now()
    WHERE bucket_key = ${bucketKey}
  `);
}

function secondsUntilReset(row: RateLimitRow) {
  const remaining = new Date(row.resetAt).getTime() - Date.now();
  return Math.max(1, Math.ceil(remaining / 1000));
}

export async function checkAuthRateLimit(request: Request, identifier: string, action: AuthRateLimitAction) {
  assertSessionSecretConfigured();

  const address = getClientAddress(request);
  const normalizedIdentifier = identifier.includes("@") ? identifier.trim().toLowerCase() : identifier.trim();
  const credentialKey = credentialBucketKey(action, address, normalizedIdentifier);
  const [ipBucket, credentialBucket] = await Promise.all([
    address === null
      ? Promise.resolve(null)
      : incrementBucket(rateLimitKey(`${action}-ip:${address}`)),
    incrementBucket(credentialKey),
  ]);

  if (randomInt(0, 100) === 0) {
    const db = getDb();
    await db.execute(sql`
      WITH expired AS (
        SELECT bucket_key
        FROM auth_rate_limits
        WHERE updated_at < now() - interval '1 day'
        ORDER BY updated_at
        LIMIT 500
      )
      DELETE FROM auth_rate_limits
      WHERE bucket_key IN (SELECT bucket_key FROM expired)
    `).catch(() => undefined);
  }

  const withinIpLimit = ipBucket === null || ipBucket.attempts <= getIpAttemptLimit();
  const withinCredentialLimit = credentialBucket.attempts <= getLoginAttemptLimit();

  if (!withinIpLimit || !withinCredentialLimit) {
    return {
      allowed: false,
      retryAfterSeconds:
        ipBucket === null
          ? secondsUntilReset(credentialBucket)
          : Math.max(secondsUntilReset(ipBucket), secondsUntilReset(credentialBucket)),
    };
  }

  // No client address: there is no key to bucket by, so bound the instance
  // with a per-endpoint budget instead. It is only spent on attempts that
  // would otherwise reach bcrypt — attempts already rejected above must not
  // drain the shared budget and lock other users out. A fallback denial never
  // reached the password check, so roll its increment back: otherwise a flood
  // that exhausts the shared budget would inflate legitimate users' credential
  // rows into a personal lockout that outlives the budget.
  if (address === null) {
    const result = fallbackBudgetFor(action).consume(Date.now());
    if (!result.allowed) {
      await decrementBucket(credentialKey).catch(() => undefined);
      return { allowed: false, retryAfterSeconds: result.retryAfterSeconds };
    }
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

// Called after a successful login. Successful attempts must not erode the
// attempt budgets — otherwise the per-address bucket or the shared fallback
// budget counts successes and eventually locks out legitimate users (a school
// behind one egress IP logging in at the start of a class). Clears the
// per-credential row and, on the addressless path, restores the per-instance
// fallback budget — at most once per FALLBACK_RESET_MIN_INTERVAL_MS, so a
// caller holding one valid credential cannot drain the budget with
// rotating-identifier failures and buy the whole burst back with one success
// per drain. `nowMs` is injectable so tests can drive the throttle clock.
export async function clearLoginAttempts(
  request: Request,
  identifier: string,
  nowMs: number = Date.now(),
) {
  assertSessionSecretConfigured();

  const address = getClientAddress(request);
  const normalizedIdentifier = identifier.includes("@") ? identifier.trim().toLowerCase() : identifier.trim();
  const credentialKey = credentialBucketKey("login", address, normalizedIdentifier);
  const db = getDb();

  if (address === null) {
    maybeResetFallbackBudget("login", nowMs);
    await db.execute(sql`DELETE FROM auth_rate_limits WHERE bucket_key = ${credentialKey}`);
    return;
  }

  const ipKey = rateLimitKey(`login-ip:${address}`);
  await db.execute(sql`DELETE FROM auth_rate_limits WHERE bucket_key IN (${credentialKey}, ${ipKey})`);
}
