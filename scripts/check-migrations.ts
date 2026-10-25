import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

// Guard for `npm run db:migrate`. It refuses to run when:
//
//   (a) pending migrations contain irreversible data deletes (0006's `DELETE FROM "users"`,
//       0008's Certificate of Grades / grade data deletes) that would destroy existing rows
//       and ALLOW_DESTRUCTIVE_MIGRATIONS is not set;
//   (b) the database has application tables but no "drizzle"."__drizzle_migrations" table —
//       the schema was applied out of band (`drizzle-kit push` / manual SQL), and replaying
//       migrations 0000-0010 against it would fail or corrupt data;
//   (c) the rows recorded in "drizzle"."__drizzle_migrations" do not line up (in order and
//       content) with drizzle/meta/_journal.json — migrations were applied out of order or
//       files were edited after they ran, and `drizzle-kit migrate` would silently skip or
//       replay migrations.
//
// The decision function is pure: everything it decides on is injected by the DB probe below.

export interface AppliedMigrationRow {
  /** sha256 of the migration file as drizzle recorded it on apply. */
  hash: string;
  /** drizzle's created_at: the migration's journal `when`. */
  createdAt: number;
}

export interface JournalMigration {
  /** Journal tag, e.g. "0008_flawless_bushwacker". */
  tag: string;
  /** The journal entry's `when`; drizzle stores this as created_at. */
  when: number;
  /** sha256 of the current migration file contents (raw bytes). */
  hash: string;
  /** sha256 of the file contents with CRLF normalized to LF (line-ending drift is not an edit). */
  hashNormalized: string;
}

export interface PendingDataDelete {
  /** Migration file that contains the deletes, e.g. "0006_peaceful_mindworm.sql". */
  migration: string;
  /** The destructive statement(s), named for the operator. */
  statement: string;
  /** Rows the deletes would irreversibly destroy right now. */
  affectedRows: number;
}

export interface MigrationSafetyState {
  /** Any application table exists in the target database. */
  hasSchema: boolean;
  /** "drizzle"."__drizzle_migrations" exists in the target database. */
  hasMigrationsTable: boolean;
  /** Rows of __drizzle_migrations in recorded order (ORDER BY id). */
  appliedMigrations: AppliedMigrationRow[];
  /** Migrations from drizzle/meta/_journal.json in journal order, with current file hashes. */
  journalMigrations: JournalMigration[];
  /** Irreversible data deletes the pending migrations would run, with current row counts. */
  pendingDataDeletes: PendingDataDelete[];
  allowDestructive: boolean;
}

export function evaluateMigrationSafety(state: MigrationSafetyState): {
  allowed: boolean;
  reason?: string;
} {
  // (b) Schema without a migrations table: migrations were applied out of band
  // (e.g. `drizzle-kit push` or manual SQL). Replaying 0000-0010 against a current
  // schema would fail or corrupt data.
  if (state.hasSchema && !state.hasMigrationsTable) {
    return {
      allowed: false,
      reason:
        'Refusing to migrate: this database has application tables but no "drizzle"."__drizzle_migrations" table ' +
        "(missing table: __drizzle_migrations), so its schema was applied out of band — for example with " +
        "`drizzle-kit push` or manual SQL. Running `drizzle-kit migrate` here would replay migrations 0000-0010 " +
        "against the already-current schema and fail or corrupt data.\n" +
        "Recover with one of:\n" +
        "  - `drizzle-kit push` to reconcile the schema with the migration files and keep using push for schema " +
        "changes (push never replays the migration files), or\n" +
        '  - manual baselining: create "drizzle"."__drizzle_migrations" (id serial, hash text, created_at bigint) ' +
        "and insert one row per migration already reflected in the schema (hash = sha256 of the .sql file, " +
        "created_at = its `when` from drizzle/meta/_journal.json), then re-run `npm run db:migrate`.",
    };
  }

  // (c) Recorded migrations must be a prefix of the journal, in order and unchanged.
  const applied = state.appliedMigrations;
  const journal = state.journalMigrations;

  if (applied.length > journal.length) {
    return {
      allowed: false,
      reason:
        'Refusing to migrate: "drizzle"."__drizzle_migrations" records ' +
        `${applied.length} applied migration(s) but drizzle/meta/_journal.json lists only ${journal.length}. ` +
        "Migrations were recorded that the journal no longer knows about; `drizzle-kit migrate` selects pending " +
        "migrations by timestamp and would silently skip or replay migrations and fail or corrupt data.\n" +
        "Recover with one of:\n" +
        "  - restore the migration files and drizzle/meta/_journal.json to the state that was actually applied, or\n" +
        '  - delete the extra rows from "drizzle"."__drizzle_migrations" after verifying the database matches the ' +
        "current drizzle/ files, then re-run `npm run db:migrate`.",
    };
  }

  for (let i = 0; i < applied.length; i++) {
    const record = applied[i];
    const entry = journal[i];

    if (Number(record.createdAt) !== entry.when) {
      return {
        allowed: false,
        reason:
          'Refusing to migrate: the rows in "drizzle"."__drizzle_migrations" do not line up with ' +
          `drizzle/meta/_journal.json — applied entry #${i + 1} records created_at ${record.createdAt}, but ` +
          `journal entry #${i + 1} is '${entry.tag}' (when ${entry.when}). Migrations were applied out of order ` +
          "or the journal changed after they ran; `drizzle-kit migrate` selects pending migrations by timestamp " +
          "and would silently skip or replay them and fail or corrupt data.\n" +
          "Recover with one of:\n" +
          "  - restore drizzle/ and drizzle/meta/_journal.json to the state that was actually applied, or\n" +
          '  - reconcile "drizzle"."__drizzle_migrations" with the journal (created_at = the journal `when`, ' +
          "hash = sha256 of the .sql file) so its rows form a prefix of drizzle/meta/_journal.json in order, " +
          "then re-run `npm run db:migrate`.",
      };
    }

    if (record.hash !== entry.hash && record.hash !== entry.hashNormalized) {
      return {
        allowed: false,
        reason:
          'Refusing to migrate: migration ' +
          `'${entry.tag}' is recorded in "drizzle"."__drizzle_migrations" as applied with hash ${record.hash}, ` +
          `but drizzle/${entry.tag}.sql currently hashes to ${entry.hash} — the file's contents changed after ` +
          "it ran (line endings are ignored). `drizzle-kit migrate` would skip it and leave the database behind " +
          "the current migration set.\n" +
          "Recover with one of:\n" +
          `  - restore drizzle/${entry.tag}.sql to the content that was applied (recorded hash ${record.hash}), or\n` +
          "  - if the database already reflects the current file, update the recorded hash in " +
          `"drizzle"."__drizzle_migrations" to ${entry.hash}, then re-run \`npm run db:migrate\`.`,
      };
    }
  }

  // (a) Irreversible data deletes in pending migrations need explicit acknowledgement.
  const destructive = state.pendingDataDeletes.filter((d) => d.affectedRows > 0);

  if (destructive.length > 0) {
    const lines = destructive
      .map((d) => `  - ${d.migration}: ${d.statement} — ${d.affectedRows} row(s)`)
      .join("\n");

    if (!state.allowDestructive) {
      return {
        allowed: false,
        reason:
          "Refusing to migrate: pending migration(s) contain irreversible data deletes that would destroy " +
          `existing rows:\n${lines}\n` +
          "Back up the database first (pg_dump), then either:\n" +
          "  - re-run with ALLOW_DESTRUCTIVE_MIGRATIONS=true if this data loss is intended, or\n" +
          "  - migrate a database that is already past these migrations (fresh installs are unaffected).",
      };
    }

    return {
      allowed: true,
      reason:
        "Proceeding because ALLOW_DESTRUCTIVE_MIGRATIONS=true. Irreversible data deletes will run:\n" +
        lines,
    };
  }

  return { allowed: true };
}

function loadJournalMigrations(repoRoot: string): JournalMigration[] {
  // Read the journal and hash each migration file exactly the way drizzle does
  // (sha256 of the raw file contents), so hashes are comparable to the ones
  // recorded in __drizzle_migrations. A second hash with CRLF normalized to LF is
  // kept so line-ending drift between checkouts is not mistaken for an edit.
  const journalPath = path.join(repoRoot, "drizzle", "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
    entries: { tag: string; when: number }[];
  };

  return journal.entries.map((entry) => {
    const sqlText = readFileSync(path.join(repoRoot, "drizzle", `${entry.tag}.sql`), "utf8");
    return {
      tag: entry.tag,
      when: Number(entry.when),
      hash: createHash("sha256").update(sqlText).digest("hex"),
      hashNormalized: createHash("sha256").update(sqlText.replace(/\r\n/g, "\n")).digest("hex"),
    };
  });
}

async function main() {
  const require = createRequire(import.meta.url);
  require("@next/env").loadEnvConfig(process.cwd());

  const { default: postgres } = await import("postgres");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not configured; cannot verify migration safety.");
    process.exit(1);
  }

  const journalMigrations = loadJournalMigrations(process.cwd());

  const sql = postgres(databaseUrl, { max: 1, onnotice: () => undefined });

  try {
    // The migrations table may not exist yet (fresh database) — probe with
    // to_regclass so a missing table or schema is a plain NULL, not an error.
    // Anything unexpected (permissions, connectivity) must fail loudly rather
    // than be treated as safe.
    const migrationsTableRows = await sql`
      SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present
    `;
    const hasMigrationsTable = migrationsTableRows[0].present === true;

    const tableRows = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    const existingTables = new Set(tableRows.map((row) => String(row.table_name)));

    const appliedRows = hasMigrationsTable
      ? await sql`SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id`
      : [];
    const appliedMigrations: AppliedMigrationRow[] = appliedRows.map((row) => ({
      hash: String(row.hash),
      createdAt: Number(row.created_at),
    }));

    // Which migrations would actually run (drizzle applies by journal `when` > the
    // last recorded created_at). Mismatched recordings are refused below; the
    // pending set here only drives the row counts for the destructive-delete gate.
    const recordedWhens = new Set(appliedMigrations.map((row) => row.createdAt));
    const pendingTags = new Set(
      journalMigrations.filter((entry) => !recordedWhens.has(entry.when)).map((entry) => entry.tag),
    );

    const pendingDataDeletes: PendingDataDelete[] = [];

    if (pendingTags.has("0006_peaceful_mindworm") && existingTables.has("users")) {
      const rows = await sql`SELECT count(*)::int AS count FROM users`;
      pendingDataDeletes.push({
        migration: "0006_peaceful_mindworm.sql",
        statement: 'DELETE FROM "users"',
        affectedRows: rows[0].count,
      });
    }

    if (pendingTags.has("0008_flawless_bushwacker")) {
      const hasCogTables =
        existingTables.has("certificates") &&
        existingTables.has("document_requests") &&
        existingTables.has("document_types");
      const hasRequestTables = existingTables.has("document_requests") && existingTables.has("document_types");

      // Counts mirror 0008's delete predicates exactly.
      let cogRows = 0;
      if (hasCogTables) {
        const rows = await sql`
          SELECT count(*)::int AS count FROM "certificates"
          WHERE lower(coalesce("certificate_type",'')) LIKE '%certificate of grades%'
             OR lower(coalesce("certificate_type",'')) ~ '(^|[^a-z])cog([^a-z]|$)'
             OR "request_id" IN (
               SELECT dr."id" FROM "document_requests" dr
               JOIN "document_types" dt ON dr."document_type_id" = dt."id"
               WHERE lower(coalesce(dt."name",'')) LIKE '%certificate of grades%'
                  OR lower(coalesce(dt."name",'')) ~ '(^|[^a-z])cog([^a-z]|$)'
             )
        `;
        cogRows += rows[0].count;
      }
      if (hasRequestTables) {
        const rows = await sql`
          SELECT count(*)::int AS count FROM "document_requests" dr
          JOIN "document_types" dt ON dr."document_type_id" = dt."id"
          WHERE lower(coalesce(dt."name",'')) LIKE '%certificate of grades%'
             OR lower(coalesce(dt."name",'')) ~ '(^|[^a-z])cog([^a-z]|$)'
        `;
        cogRows += rows[0].count;
      }
      if (existingTables.has("document_types")) {
        const rows = await sql`
          SELECT count(*)::int AS count FROM "document_types"
          WHERE lower(coalesce("name",'')) LIKE '%certificate of grades%'
             OR lower(coalesce("name",'')) ~ '(^|[^a-z])cog([^a-z]|$)'
        `;
        cogRows += rows[0].count;
      }
      if (existingTables.has("notifications") && hasRequestTables && hasCogTables) {
        // Mirrors steps 5 and 7: notifications matching the certificate numbers of the
        // certificates being deleted, or the tracking numbers of the requests being deleted.
        const rows = await sql`
          SELECT count(*)::int AS count FROM "notifications" AS "n"
          WHERE EXISTS (
            SELECT 1 FROM "certificates" c
            WHERE c."certificate_number" <> ''
              AND strpos("n"."message", c."certificate_number") > 0
              AND (lower(coalesce(c."certificate_type",'')) LIKE '%certificate of grades%'
                OR lower(coalesce(c."certificate_type",'')) ~ '(^|[^a-z])cog([^a-z]|$)'
                OR c."request_id" IN (
                  SELECT dr."id" FROM "document_requests" dr
                  JOIN "document_types" dt ON dr."document_type_id" = dt."id"
                  WHERE lower(coalesce(dt."name",'')) LIKE '%certificate of grades%'
                     OR lower(coalesce(dt."name",'')) ~ '(^|[^a-z])cog([^a-z]|$)'
                ))
          )
          OR EXISTS (
            SELECT 1 FROM "document_requests" dr
            JOIN "document_types" dt ON dr."document_type_id" = dt."id"
            WHERE (lower(coalesce(dt."name",'')) LIKE '%certificate of grades%'
                OR lower(coalesce(dt."name",'')) ~ '(^|[^a-z])cog([^a-z]|$)')
              AND dr."tracking_number" <> ''
              AND strpos("n"."message", dr."tracking_number") > 0
          )
        `;
        cogRows += rows[0].count;
      } else if (existingTables.has("notifications") && hasRequestTables) {
        const rows = await sql`
          SELECT count(*)::int AS count FROM "notifications" AS "n"
          WHERE EXISTS (
            SELECT 1 FROM "document_requests" dr
            JOIN "document_types" dt ON dr."document_type_id" = dt."id"
            WHERE (lower(coalesce(dt."name",'')) LIKE '%certificate of grades%'
                OR lower(coalesce(dt."name",'')) ~ '(^|[^a-z])cog([^a-z]|$)')
              AND dr."tracking_number" <> ''
              AND strpos("n"."message", dr."tracking_number") > 0
          )
        `;
        cogRows += rows[0].count;
      }

      let gradeRows = 0;
      for (const table of ["student_grades", "subjects", "grade_import_batches", "grade_import_errors"]) {
        if (existingTables.has(table)) {
          const rows = await sql.unsafe(`SELECT count(*)::int AS count FROM "${table}"`);
          gradeRows += rows[0].count;
        }
      }
      if (existingTables.has("notifications")) {
        const rows = await sql`SELECT count(*)::int AS count FROM "notifications" WHERE "type" = 'grade'`;
        gradeRows += rows[0].count;
      }

      pendingDataDeletes.push({
        migration: "0008_flawless_bushwacker.sql",
        statement:
          'DELETE FROM "certificates", "document_requests", "document_types", "notifications" ' +
          "(Certificate of Grades data)",
        affectedRows: cogRows,
      });
      pendingDataDeletes.push({
        migration: "0008_flawless_bushwacker.sql",
        statement:
          'DELETE FROM "student_grades", "subjects", "grade_import_batches", "grade_import_errors", ' +
          '"notifications" (grade data)',
        affectedRows: gradeRows,
      });
    }

    const decision = evaluateMigrationSafety({
      hasSchema: existingTables.size > 0,
      hasMigrationsTable,
      appliedMigrations,
      journalMigrations,
      pendingDataDeletes,
      allowDestructive: process.env.ALLOW_DESTRUCTIVE_MIGRATIONS === "true",
    });

    if (!decision.allowed) {
      console.error(decision.reason);
      process.exit(1);
    }

    if (decision.reason) {
      console.warn(`[check-migrations] WARNING: ${decision.reason}`);
    }
  } finally {
    await sql.end();
  }
}

// Only run the DB probe when executed directly (tests import the pure helper).
const invokedDirectly = process.argv[1]?.endsWith("check-migrations.ts");
if (invokedDirectly) {
  main().catch((error) => {
    console.error("Migration safety check failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
