import { createRequire } from "node:module";
import { documentTypes } from "../src/db/schema";
import { DOCUMENT_TYPES } from "../src/lib/constants";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env");

loadEnvConfig(process.cwd());

async function main() {
  const { closeDb, getDb } = await import("../src/db");
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required before seeding sample data.");
  }

  const databaseHost = new URL(databaseUrl).hostname;
  const isLocalDatabase = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(databaseHost);

  if (!isLocalDatabase && process.env.ALLOW_REMOTE_SEED !== "true") {
    throw new Error("Refusing to seed a remote database. Use a local development database or explicitly set ALLOW_REMOTE_SEED=true.");
  }

  const db = getDb();

  if (process.env.NODE_ENV === "production") {
    throw new Error("Development seed data must not be created in production.");
  }

  try {
    await db
      .insert(documentTypes)
      .values(
        DOCUMENT_TYPES.map((name) => ({
          name,
          processingDays: name === "Form 137" ? 5 : 3,
          fee: "0",
          isActive: true,
        })),
      )
      .onConflictDoNothing();

    console.log("Development document types seeded. Sample portal accounts are not created.");
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
