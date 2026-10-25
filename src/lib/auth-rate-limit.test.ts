import { describe, it, afterEach, after } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret-32b";

const {
  checkAuthRateLimit,
  getClientAddress,
  clearLoginAttempts,
  createFallbackBudget,
  resetFallbackBudget,
  getIpAttemptLimit,
  getLoginAttemptLimit,
  FALLBACK_BURST_TOKENS,
} = await import("@/lib/auth-rate-limit");
const { getDb, closeDb } = await import("@/db");
const { sql } = await import("drizzle-orm");

// The integration tests open postgres sockets; close the pool so the test
// process can exit.
after(async () => {
  await closeDb();
});

const originalTrustProxy = process.env.TRUST_PROXY;
const originalIpAttemptLimit = process.env.IP_ATTEMPT_LIMIT;
const originalLoginAttemptLimit = process.env.LOGIN_ATTEMPT_LIMIT;

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

afterEach(() => {
  restoreEnv("TRUST_PROXY", originalTrustProxy);
  restoreEnv("IP_ATTEMPT_LIMIT", originalIpAttemptLimit);
  restoreEnv("LOGIN_ATTEMPT_LIMIT", originalLoginAttemptLimit);
});

function hmacKey(value: string) {
  return createHmac("sha256", process.env.SESSION_SECRET!).update(value).digest("hex");
}

// Every identifier/address used as a bucket key is tagged with a per-run id,
// so rows left behind by an aborted run can never change the counts or limits
// observed here. Assertions build key shapes from the same tagged values.
const RUN_TAG = Date.now().toString(36).slice(-5);
function runKey(value: string) {
  return `${RUN_TAG}-${value}`;
}

describe("getClientAddress", () => {
  it("ignores spoofed forwarding headers when TRUST_PROXY is unset", () => {
    delete process.env.TRUST_PROXY;
    const request = new Request("http://localhost/api/auth/login", {
      headers: { "x-forwarded-for": "203.0.113.7", "x-real-ip": "203.0.113.7" },
    });
    assert.equal(getClientAddress(request), null);
  });

  it("reads X-Real-IP when TRUST_PROXY=true", () => {
    process.env.TRUST_PROXY = "true";
    const request = new Request("http://localhost/api/auth/login", {
      headers: { "x-real-ip": "192.0.2.10" },
    });
    assert.equal(getClientAddress(request), "192.0.2.10");
  });

  it("reads the first X-Forwarded-For hop when TRUST_PROXY=true", () => {
    process.env.TRUST_PROXY = "true";
    const request = new Request("http://localhost/api/auth/login", {
      headers: { "x-forwarded-for": "198.51.100.9, 7.7.7.7" },
    });
    assert.equal(getClientAddress(request), "198.51.100.9");
  });

  it("returns null when trusted but no header is present (never a shared bucket)", () => {
    process.env.TRUST_PROXY = "1";
    const request = new Request("http://localhost/api/auth/login");
    assert.equal(getClientAddress(request), null);
  });

  it("ignores headers when TRUST_PROXY is explicitly false", () => {
    process.env.TRUST_PROXY = "false";
    const request = new Request("http://localhost/api/auth/login", {
      headers: { "x-forwarded-for": "203.0.113.7" },
    });
    assert.equal(getClientAddress(request), null);
  });
});

describe("attempt limit configuration", () => {
  it("falls back to 20 per address and 5 per credential when unset", () => {
    delete process.env.IP_ATTEMPT_LIMIT;
    delete process.env.LOGIN_ATTEMPT_LIMIT;
    assert.equal(getIpAttemptLimit(), 20);
    assert.equal(getLoginAttemptLimit(), 5);
  });

  it("reads overrides from IP_ATTEMPT_LIMIT and LOGIN_ATTEMPT_LIMIT", () => {
    process.env.IP_ATTEMPT_LIMIT = "7";
    process.env.LOGIN_ATTEMPT_LIMIT = "3";
    assert.equal(getIpAttemptLimit(), 7);
    assert.equal(getLoginAttemptLimit(), 3);
  });

  it("ignores malformed values and keeps the historical defaults", () => {
    for (const bad of ["abc", "0", "-4", "4.5", "", "   ", "1e3", "5abc", "99999999999999999999"]) {
      process.env.IP_ATTEMPT_LIMIT = bad;
      process.env.LOGIN_ATTEMPT_LIMIT = bad;
      assert.equal(getIpAttemptLimit(), 20, `IP_ATTEMPT_LIMIT=${JSON.stringify(bad)}`);
      assert.equal(getLoginAttemptLimit(), 5, `LOGIN_ATTEMPT_LIMIT=${JSON.stringify(bad)}`);
    }
  });
});

describe("createFallbackBudget (per-instance token bucket)", () => {
  it("allows a burst up to capacity, then denies with a retry hint", () => {
    const budget = createFallbackBudget(3, 3, 60_000);
    const now = 1_000_000;
    for (let i = 0; i < 3; i += 1) {
      assert.equal(budget.consume(now).allowed, true, `attempt ${i + 1} should be allowed`);
    }
    const denied = budget.consume(now);
    assert.equal(denied.allowed, false);
    assert.ok(denied.retryAfterSeconds >= 1);
  });

  it("refills gradually on an injected clock and never exceeds capacity", () => {
    // 4 tokens per 60s window = one token per 15s.
    const budget = createFallbackBudget(4, 4, 60_000);
    const now = 2_000_000;
    for (let i = 0; i < 4; i += 1) {
      assert.equal(budget.consume(now).allowed, true, `attempt ${i + 1} should be allowed`);
    }
    assert.equal(budget.consume(now).allowed, false);

    // A quarter window later exactly one token is back.
    assert.equal(budget.consume(now + 15_000).allowed, true);
    assert.equal(budget.consume(now + 15_000).allowed, false);

    // A long idle period refills at most to capacity.
    for (let i = 0; i < 4; i += 1) {
      assert.equal(budget.consume(now + 600_000).allowed, true, `idle attempt ${i + 1} should be allowed`);
    }
    assert.equal(budget.consume(now + 600_000).allowed, false);
  });

  it("reset() restores the full burst", () => {
    const budget = createFallbackBudget(2, 2, 60_000);
    const now = 3_000_000;
    budget.consume(now);
    budget.consume(now);
    assert.equal(budget.consume(now).allowed, false);
    budget.reset();
    assert.equal(budget.consume(now).allowed, true);
    assert.equal(budget.consume(now).allowed, true);
    assert.equal(budget.consume(now).allowed, false);
  });
});

const hasDb = Boolean(process.env.DATABASE_URL);
const trackedKeys = new Set<string>();

function trackKey(shape: string) {
  const key = hmacKey(shape);
  trackedKeys.add(key);
  return key;
}

async function bucketAttempts(shape: string): Promise<number> {
  const key = trackKey(shape);
  const db = getDb();
  const rows = await db.execute<{ attempts: number }>(
    sql`SELECT attempts FROM auth_rate_limits WHERE bucket_key = ${key}`,
  );
  return rows[0]?.attempts ?? 0;
}

describe("checkAuthRateLimit (integration, local DB)", {
  skip: hasDb ? false : "DATABASE_URL not configured",
}, () => {
  it("skips IP buckets entirely when TRUST_PROXY is unset (spoofed headers never bucketed)", async () => {
    delete process.env.TRUST_PROXY;
    const identifier = runKey("999999999999");
    const spoofed = runKey("203.0.113.77");
    const request = new Request("http://localhost/api/auth/login", {
      headers: { "x-forwarded-for": spoofed },
    });

    let last: { allowed: boolean; retryAfterSeconds: number } | undefined;
    for (let i = 0; i < 6; i += 1) {
      last = await checkAuthRateLimit(request, identifier, "login");
    }

    assert.ok(last);
    // Credential bucket (addressless key shape) still enforces 5/15min.
    assert.equal(await bucketAttempts(`login-credential:${identifier}`), 6);
    assert.equal(last.allowed, false);
    // The spoofed address never produced IP or IP-credential buckets.
    assert.equal(await bucketAttempts(`login-ip:${spoofed}`), 0);
    assert.equal(await bucketAttempts(`login-ip-credential:${spoofed}:${identifier}`), 0);
  });

  it("buckets by trusted address when TRUST_PROXY=true", async () => {
    process.env.TRUST_PROXY = "true";
    const identifier = runKey("888888888888");
    const address = runKey("198.51.100.42");
    const request = new Request("http://localhost/api/auth/login", {
      headers: { "x-forwarded-for": address },
    });

    const result = await checkAuthRateLimit(request, identifier, "login");
    assert.equal(result.allowed, true);
    assert.equal(await bucketAttempts(`login-ip:${address}`), 1);
    assert.equal(await bucketAttempts(`login-ip-credential:${address}:${identifier}`), 1);
  });

  it("keeps signup buckets in their own namespace from login", async () => {
    delete process.env.TRUST_PROXY;
    const identifier = runKey("777777777777");
    const request = new Request("http://localhost/api/auth/signup");

    const result = await checkAuthRateLimit(request, identifier, "signup");
    assert.equal(result.allowed, true);
    assert.equal(await bucketAttempts(`signup-credential:${identifier}`), 1);
    assert.equal(await bucketAttempts(`login-credential:${identifier}`), 0);
  });
});

describe("fallback budget engagement (integration, local DB)", {
  skip: hasDb ? false : "DATABASE_URL not configured",
}, () => {
  it("bounds rotating-identifier login attempts when no client address is available", async () => {
    resetFallbackBudget("login");
    delete process.env.TRUST_PROXY;
    // Raise the address/credential limits out of the way: only the fallback
    // budget can bound this sequence.
    process.env.IP_ATTEMPT_LIMIT = "100000";
    process.env.LOGIN_ATTEMPT_LIMIT = "100000";

    let allowedCount = 0;
    let last: { allowed: boolean; retryAfterSeconds: number } | undefined;
    const spoofed = runKey("203.0.113.99");
    for (let i = 0; i <= FALLBACK_BURST_TOKENS; i += 1) {
      const identifier = runKey(`4444${String(i).padStart(8, "0")}`);
      trackKey(`login-credential:${identifier}`);
      // A spoofed header must not create buckets nor bypass the fallback.
      last = await checkAuthRateLimit(
        new Request("http://localhost/api/auth/login", { headers: { "x-forwarded-for": spoofed } }),
        identifier,
        "login",
      );
      if (last.allowed) {
        allowedCount += 1;
      }
    }

    assert.equal(allowedCount, FALLBACK_BURST_TOKENS);
    assert.equal(last?.allowed, false);
    assert.ok((last?.retryAfterSeconds ?? 0) >= 1);
    assert.equal(await bucketAttempts(`login-ip:${spoofed}`), 0);
    assert.equal(await bucketAttempts(`login-ip-credential:${spoofed}:${runKey("444400000000")}`), 0);
  });

  it("restores the fallback budget after a successful login and clears the credential row", async () => {
    resetFallbackBudget("login");
    delete process.env.TRUST_PROXY;
    process.env.IP_ATTEMPT_LIMIT = "100000";
    process.env.LOGIN_ATTEMPT_LIMIT = "100000";

    // Exhaust the budget with rotating identifiers.
    for (let i = 0; i <= FALLBACK_BURST_TOKENS; i += 1) {
      const identifier = runKey(`4445${String(i).padStart(8, "0")}`);
      trackKey(`login-credential:${identifier}`);
      await checkAuthRateLimit(new Request("http://localhost/api/auth/login"), identifier, "login");
    }

    const identifier = runKey("444599999999");
    const request = new Request("http://localhost/api/auth/login");
    trackKey(`login-credential:${identifier}`);
    assert.equal((await checkAuthRateLimit(request, identifier, "login")).allowed, false, "budget should be exhausted");

    await clearLoginAttempts(request, identifier);

    // A successful login restores the anonymous budget and drops the
    // credential row, so the next attempt starts clean.
    assert.equal(await bucketAttempts(`login-credential:${identifier}`), 0);
    assert.equal((await checkAuthRateLimit(request, identifier, "login")).allowed, true);
  });

  it("does not fully refill the fallback budget on every successful login (success reset throttled)", async () => {
    resetFallbackBudget("login");
    delete process.env.TRUST_PROXY;
    process.env.IP_ATTEMPT_LIMIT = "100000";
    process.env.LOGIN_ATTEMPT_LIMIT = "100000";
    const request = new Request("http://localhost/api/auth/login");
    const startMs = Date.now();

    // Drain the shared budget with rotating-identifier failures, then spend
    // one "successful login" (clearLoginAttempts) — the move an attacker
    // holding a single valid credential makes.
    const drainThenLogIn = async (prefix: string, nowMs: number) => {
      for (let i = 0; i <= FALLBACK_BURST_TOKENS; i += 1) {
        const identifier = runKey(`${prefix}${String(i).padStart(8, "0")}`);
        trackKey(`login-credential:${identifier}`);
        await checkAuthRateLimit(request, identifier, "login");
      }
      const winner = runKey(`${prefix}99999999`);
      trackKey(`login-credential:${winner}`);
      assert.equal(
        (await checkAuthRateLimit(request, winner, "login")).allowed,
        false,
        "rotating-identifier failures should exhaust the fallback budget",
      );
      await clearLoginAttempts(request, winner, nowMs);
    };

    // The first success does restore the budget — the start-of-class case.
    await drainThenLogIn("6666", startMs);
    const probe = runKey("666688888888");
    trackKey(`login-credential:${probe}`);
    assert.equal((await checkAuthRateLimit(request, probe, "login")).allowed, true, "first success restores the budget");

    // Drain again and "log in" again well within one reset interval.
    await drainThenLogIn("6667", startMs + 30_000);

    // The second success must not hand back another full burst.
    let refilled = 0;
    for (let i = 0; i < FALLBACK_BURST_TOKENS; i += 1) {
      const identifier = runKey(`6668${String(i).padStart(8, "0")}`);
      trackKey(`login-credential:${identifier}`);
      if ((await checkAuthRateLimit(request, identifier, "login")).allowed) {
        refilled += 1;
      }
    }
    assert.ok(
      refilled <= 2,
      `a second success within the reset interval must not refill the budget (saw ${refilled} of ${FALLBACK_BURST_TOKENS} tokens)`,
    );
  });

  it("does not engage the fallback budget when a trusted client address is available", async () => {
    resetFallbackBudget("login");
    process.env.TRUST_PROXY = "true";
    process.env.IP_ATTEMPT_LIMIT = "100000";
    process.env.LOGIN_ATTEMPT_LIMIT = "100000";
    const address = runKey("198.51.100.77");

    // More attempts than the fallback burst would allow: with an address each
    // client keeps its own buckets and no shared budget is drawn on.
    for (let i = 0; i <= FALLBACK_BURST_TOKENS; i += 1) {
      const identifier = runKey(`4446${String(i).padStart(8, "0")}`);
      trackKey(`login-ip:${address}`);
      trackKey(`login-ip-credential:${address}:${identifier}`);
      const result = await checkAuthRateLimit(
        new Request("http://localhost/api/auth/login", { headers: { "x-forwarded-for": address } }),
        identifier,
        "login",
      );
      assert.equal(result.allowed, true, `attempt ${i + 1} must stay allowed (no shared fallback)`);
    }
  });

  it("bounds rotating-LRN signup probes through the signup fallback budget", async () => {
    resetFallbackBudget("signup");
    delete process.env.TRUST_PROXY;
    process.env.IP_ATTEMPT_LIMIT = "100000";
    process.env.LOGIN_ATTEMPT_LIMIT = "100000";

    let allowedCount = 0;
    let last: { allowed: boolean; retryAfterSeconds: number } | undefined;
    for (let i = 0; i <= FALLBACK_BURST_TOKENS; i += 1) {
      const lrn = runKey(String(900000000000 + i));
      trackKey(`signup-credential:${lrn}`);
      last = await checkAuthRateLimit(new Request("http://localhost/api/auth/signup"), lrn, "signup");
      if (last.allowed) {
        allowedCount += 1;
      }
    }

    assert.equal(allowedCount, FALLBACK_BURST_TOKENS);
    assert.equal(last?.allowed, false);
  });

  it("does not count fallback-denied attempts against the credential bucket", async () => {
    resetFallbackBudget("login");
    delete process.env.TRUST_PROXY;
    // Reproduce the default deployment with the historical limits: five
    // retries during exhaustion must not eat into LOGIN_ATTEMPT_LIMIT=5.
    delete process.env.IP_ATTEMPT_LIMIT;
    delete process.env.LOGIN_ATTEMPT_LIMIT;

    // Exhaust the shared budget with rotating identifiers.
    for (let i = 0; i <= FALLBACK_BURST_TOKENS; i += 1) {
      const identifier = runKey(`4447${String(i).padStart(8, "0")}`);
      trackKey(`login-credential:${identifier}`);
      await checkAuthRateLimit(new Request("http://localhost/api/auth/login"), identifier, "login");
    }

    // A legitimate user retries five times while the budget is exhausted.
    const identifier = runKey("444799999999");
    trackKey(`login-credential:${identifier}`);
    const request = new Request("http://localhost/api/auth/login");
    for (let i = 0; i < 5; i += 1) {
      assert.equal((await checkAuthRateLimit(request, identifier, "login")).allowed, false, `retry ${i + 1} is 429`);
    }

    // Those were 429s that never reached bcrypt: they must not inflate the
    // per-credential row.
    assert.equal(await bucketAttempts(`login-credential:${identifier}`), 0);

    // When the budget recovers (~30s of refill), the same attempt is allowed
    // again instead of being denied by LOGIN_ATTEMPT_LIMIT until the window
    // rolls.
    resetFallbackBudget("login");
    assert.equal((await checkAuthRateLimit(request, identifier, "login")).allowed, true);
  });

  it("honors env-configurable limits inside checkAuthRateLimit", async () => {
    process.env.TRUST_PROXY = "true";
    process.env.IP_ATTEMPT_LIMIT = "3";
    process.env.LOGIN_ATTEMPT_LIMIT = "2";
    const address = runKey("198.51.100.60");
    const first = runKey("555500000001");
    const second = runKey("555500000002");

    trackKey(`login-ip:${address}`);
    trackKey(`login-ip-credential:${address}:${first}`);
    trackKey(`login-ip-credential:${address}:${second}`);

    const attempt = (identifier: string) =>
      checkAuthRateLimit(
        new Request("http://localhost/api/auth/login", { headers: { "x-forwarded-for": address } }),
        identifier,
        "login",
      );

    assert.equal((await attempt(first)).allowed, true);
    assert.equal((await attempt(first)).allowed, true);
    // Third attempt on the same identifier hits LOGIN_ATTEMPT_LIMIT=2.
    assert.equal((await attempt(first)).allowed, false);
    // A fresh identifier is still blocked once IP_ATTEMPT_LIMIT=3 is reached.
    assert.equal((await attempt(second)).allowed, false);
  });

  it("clears the per-address bucket after a successful login", async () => {
    process.env.TRUST_PROXY = "true";
    const identifier = runKey("555500000003");
    const address = runKey("203.0.113.55");
    const request = new Request("http://localhost/api/auth/login", { headers: { "x-forwarded-for": address } });

    await checkAuthRateLimit(request, identifier, "login");
    await checkAuthRateLimit(request, identifier, "login");
    assert.equal(await bucketAttempts(`login-ip:${address}`), 2);
    assert.equal(await bucketAttempts(`login-ip-credential:${address}:${identifier}`), 2);

    await clearLoginAttempts(request, identifier);

    assert.equal(await bucketAttempts(`login-ip:${address}`), 0);
    assert.equal(await bucketAttempts(`login-ip-credential:${address}:${identifier}`), 0);
  });
});

describe("cleanup (integration, local DB)", {
  skip: hasDb ? false : "DATABASE_URL not configured",
}, () => {
  // Remove rows this file created so reruns start from zero.
  it("removes every rate-limit row this file created", async () => {
    const db = getDb();
    const keys = [...trackedKeys];
    for (let i = 0; i < keys.length; i += 100) {
      const chunk = keys.slice(i, i + 100);
      await db.execute(sql`DELETE FROM auth_rate_limits WHERE bucket_key IN (${sql.join(chunk, sql`, `)})`);
    }
    assert.ok(trackedKeys.size >= 3);
  });
});
