import { createRequire } from "node:module";
import { and, eq, ne, sql } from "drizzle-orm";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env");

loadEnvConfig(process.cwd());

async function main() {
  const { getDb } = await import("../src/db");
  const { users } = await import("../src/db/schema");
  const db = getDb();

  try {
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(49123017)`);
      const target = await tx.query.users.findFirst({ where: eq(users.email, "earljhonmalatag2@gmail.com") });
      if (!target) throw new Error("The account to promote was not found.");
      const existingAdmin = await tx.query.users.findFirst({
        where: and(eq(users.role, "admin"), ne(users.id, target.id)),
      });
      if (existingAdmin) throw new Error("An administrator already exists. Only one administrator is allowed.");
      return tx.update(users)
        .set({ role: "admin", updatedAt: new Date() })
        .where(eq(users.id, target.id))
        .returning({ id: users.id, email: users.email, role: users.role });
    });

    console.log("Updated:", result);
  } finally {
    const { closeDb } = await import("../src/db");
    await closeDb();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
