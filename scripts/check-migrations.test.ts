import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateMigrationSafety } from "./check-migrations";
import type { JournalMigration, MigrationSafetyState, PendingDataDelete } from "./check-migrations";

// A miniature journal standing in for drizzle/meta/_journal.json. Hashes are what drizzle
// records in "drizzle"."__drizzle_migrations" (sha256 of the migration file's contents).
const journal: JournalMigration[] = [
  { tag: "0000_daffy_jamie_braddock", when: 1000, hash: "hash-0000", hashNormalized: "hash-0000" },
  { tag: "0001_wandering_maelstrom", when: 2000, hash: "hash-0001", hashNormalized: "hash-0001" },
  { tag: "0006_peaceful_mindworm", when: 3000, hash: "hash-0006", hashNormalized: "hash-0006" },
  { tag: "0008_flawless_bushwacker", when: 4000, hash: "hash-0008", hashNormalized: "hash-0008" },
  { tag: "0010_dry_silver_surfer", when: 5000, hash: "hash-0010", hashNormalized: "hash-0010" },
];

/** Rows of __drizzle_migrations for a database that applied journal entries 0..throughIndex. */
function appliedThrough(throughIndex: number): MigrationSafetyState["appliedMigrations"] {
  return journal.slice(0, throughIndex + 1).map((entry) => ({ hash: entry.hash, createdAt: entry.when }));
}

function baseState(overrides: Partial<MigrationSafetyState> = {}): MigrationSafetyState {
  return {
    hasSchema: true,
    hasMigrationsTable: true,
    appliedMigrations: appliedThrough(journal.length - 1),
    journalMigrations: journal,
    pendingDataDeletes: [],
    allowDestructive: false,
    ...overrides,
  };
}

const usersWipe: PendingDataDelete = {
  migration: "0006_peaceful_mindworm.sql",
  statement: 'DELETE FROM "users"',
  affectedRows: 12,
};

const cogWipe: PendingDataDelete = {
  migration: "0008_flawless_bushwacker.sql",
  statement:
    'DELETE FROM "certificates", "document_requests", "document_types", "notifications" ' +
    '(Certificate of Grades data; "cog" matched as a whole word, notifications matched by ' +
    "certificate or tracking number)",
  affectedRows: 4,
};

const gradeWipe: PendingDataDelete = {
  migration: "0008_flawless_bushwacker.sql",
  statement:
    'DELETE FROM "student_grades", "subjects", "grade_import_batches", "grade_import_errors" (grade data)',
  affectedRows: 1200,
};

describe("evaluateMigrationSafety", () => {
  it("allows a database that is already past migration 0006 (applied matches the journal, nothing destructive pending)", () => {
    const result = evaluateMigrationSafety(baseState());
    assert.equal(result.allowed, true);
  });

  it("allows a fresh database with no schema and no __drizzle_migrations table", () => {
    const result = evaluateMigrationSafety(
      baseState({ hasSchema: false, hasMigrationsTable: false, appliedMigrations: [] }),
    );
    assert.equal(result.allowed, true);
  });

  it("allows a pending destructive delete that would remove no rows", () => {
    const result = evaluateMigrationSafety(
      baseState({
        appliedMigrations: appliedThrough(1),
        pendingDataDeletes: [{ ...usersWipe, affectedRows: 0 }],
      }),
    );
    assert.equal(result.allowed, true);
  });

  it("blocks a pre-0006 database whose users would be destroyed", () => {
    const result = evaluateMigrationSafety(
      baseState({
        appliedMigrations: appliedThrough(1),
        pendingDataDeletes: [usersWipe],
      }),
    );
    assert.equal(result.allowed, false);
    assert.ok(result.reason?.includes('DELETE FROM "users"'), "reason names the destructive statement");
    assert.ok(result.reason?.includes("ALLOW_DESTRUCTIVE_MIGRATIONS"), "reason says what to set");
    assert.ok(result.reason?.includes("Back up"), "reason tells the operator to back up first");
  });

  it("blocks pending 0008 Certificate of Grades deletes that would destroy data", () => {
    const result = evaluateMigrationSafety(
      baseState({
        appliedMigrations: appliedThrough(2),
        pendingDataDeletes: [cogWipe, gradeWipe],
      }),
    );
    assert.equal(result.allowed, false);
    assert.ok(
      result.reason?.includes("0008_flawless_bushwacker.sql"),
      "reason names the migration holding the deletes",
    );
    assert.ok(result.reason?.includes('DELETE FROM "certificates"'), "reason names the destructive statement");
    assert.ok(
      result.reason?.includes('DELETE FROM "student_grades"'),
      "reason lists every mirrored delete statement (grade data too)",
    );
    assert.ok(result.reason?.includes("ALLOW_DESTRUCTIVE_MIGRATIONS"), "reason says what to set");
  });

  it("allows pending 0008 deletes when they match no rows (nothing to delete)", () => {
    const result = evaluateMigrationSafety(
      baseState({
        appliedMigrations: appliedThrough(2),
        pendingDataDeletes: [
          { ...cogWipe, affectedRows: 0 },
          { ...gradeWipe, affectedRows: 0 },
        ],
      }),
    );
    assert.equal(result.allowed, true);
  });

  it("allows destructive deletes when ALLOW_DESTRUCTIVE_MIGRATIONS=true acknowledges the risk", () => {
    const result = evaluateMigrationSafety(
      baseState({
        appliedMigrations: appliedThrough(1),
        pendingDataDeletes: [usersWipe],
        allowDestructive: true,
      }),
    );
    assert.equal(result.allowed, true);
    assert.ok(result.reason?.includes("ALLOW_DESTRUCTIVE_MIGRATIONS"), "reason records the override");
    assert.ok(result.reason?.includes('DELETE FROM "users"'), "reason still names the destructive statement");
  });

  it("warns about 0008's deletes when the override is acknowledged", () => {
    const result = evaluateMigrationSafety(
      baseState({
        appliedMigrations: appliedThrough(2),
        pendingDataDeletes: [cogWipe, gradeWipe],
        allowDestructive: true,
      }),
    );
    assert.equal(result.allowed, true);
    assert.ok(result.reason?.includes("0008_flawless_bushwacker.sql"), "reason names the migration");
  });

  it("blocks a schema built out of band when __drizzle_migrations is missing", () => {
    const result = evaluateMigrationSafety(
      baseState({ hasMigrationsTable: false, appliedMigrations: [] }),
    );
    assert.equal(result.allowed, false);
    assert.ok(result.reason?.includes("__drizzle_migrations"), "reason names the table it missed");
    assert.ok(result.reason?.includes("drizzle-kit push"), "reason names a recovery path");
    assert.ok(result.reason?.includes("baselin"), "reason mentions manual baselining");
    assert.ok(result.reason?.includes("replay"), "reason explains why replaying is dangerous");
  });

  it("refuses on the missing-migrations-table state before considering destructive deletes", () => {
    const result = evaluateMigrationSafety(
      baseState({
        hasMigrationsTable: false,
        appliedMigrations: [],
        pendingDataDeletes: [usersWipe],
      }),
    );
    assert.equal(result.allowed, false);
    assert.ok(result.reason?.includes("__drizzle_migrations"), "reason is about the missing table");
    assert.ok(!result.reason?.includes('DELETE FROM "users"'), "reason is not about data deletes");
  });

  it("blocks when applied migrations are out of order vs the journal", () => {
    const result = evaluateMigrationSafety(
      baseState({
        appliedMigrations: [
          { hash: "hash-0010", createdAt: 5000 },
          { hash: "hash-0008", createdAt: 4000 },
        ],
      }),
    );
    assert.equal(result.allowed, false);
    assert.ok(result.reason?.includes("0000_daffy_jamie_braddock"), "reason names the expected journal entry");
    assert.ok(result.reason?.includes("__drizzle_migrations"), "reason names the recorded table");
    assert.ok(result.reason?.includes("drizzle/meta/_journal.json"), "reason names the journal");
    assert.ok(result.reason?.includes("Recover"), "reason tells the operator what to do");
  });

  it("blocks when an applied migration's file content no longer matches", () => {
    const applied = appliedThrough(journal.length - 1).map((row, index) =>
      index === 3 ? { ...row, hash: "stale-hash" } : row,
    );
    const result = evaluateMigrationSafety(baseState({ appliedMigrations: applied }));
    assert.equal(result.allowed, false);
    assert.ok(result.reason?.includes("0008_flawless_bushwacker"), "reason names the edited migration");
    assert.ok(result.reason?.includes("drizzle/0008_flawless_bushwacker.sql"), "reason names the file");
    assert.ok(result.reason?.includes("stale-hash"), "reason shows the recorded hash");
    assert.ok(result.reason?.includes("Recover"), "reason tells the operator what to do");
  });

  it("ignores line-ending drift between the applied file and the working tree", () => {
    // The recorded hash was taken from the file with LF endings; the checkout now has
    // CRLF (or vice versa). Content is unchanged, so this must not block migrating.
    const drifted: JournalMigration[] = journal.map((entry, index) =>
      index === 3 ? { ...entry, hash: "hash-0008-crlf", hashNormalized: "hash-0008" } : entry,
    );
    const applied = drifted.map((entry) => ({ hash: entry.hashNormalized, createdAt: entry.when }));
    const result = evaluateMigrationSafety(
      baseState({ journalMigrations: drifted, appliedMigrations: applied }),
    );
    assert.equal(result.allowed, true);
  });

  it("blocks when more migrations are recorded than the journal has", () => {
    const result = evaluateMigrationSafety(
      baseState({
        appliedMigrations: [
          ...appliedThrough(journal.length - 1),
          { hash: "hash-0011", createdAt: 6000 },
        ],
      }),
    );
    assert.equal(result.allowed, false);
    assert.ok(result.reason?.includes("drizzle/meta/_journal.json"), "reason names the journal");
    assert.ok(result.reason?.includes("__drizzle_migrations"), "reason names the recorded table");
    assert.ok(result.reason?.includes("Recover"), "reason tells the operator what to do");
  });

  it("blocks out-of-order state before considering destructive deletes", () => {
    const result = evaluateMigrationSafety(
      baseState({
        appliedMigrations: [{ hash: "hash-0010", createdAt: 5000 }],
        pendingDataDeletes: [usersWipe],
      }),
    );
    assert.equal(result.allowed, false);
    assert.ok(result.reason?.includes("0000_daffy_jamie_braddock"), "reason is about journal order");
    assert.ok(!result.reason?.includes('DELETE FROM "users"'), "reason is not about data deletes");
  });
});
