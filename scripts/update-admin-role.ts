import { createRequire } from "node:module";
import { eq } from "drizzle-orm";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env");

loadEnvConfig(process.cwd());

async function main() {
  const { getDb } = await import("../src/db");
  const { users } = await import("../src/db/schema");
  const db = getDb();

  try {
    const result = await db.update(users)
      .set({ role: "admin", updatedAt: new Date() })
      .where(eq(users.email, "earljhonmalatag2@gmail.com"))
      .returning();

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