import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

const queryClient = connectionString
  ? postgres(connectionString, { prepare: false, max: 5 })
  : null;

export const db = queryClient ? drizzle(queryClient, { schema }) : null;

export function getDb() {
  if (!db) {
    throw new Error("DATABASE_URL is not configured. Copy .env.example to .env.local and set DATABASE_URL.");
  }

  return db;
}

export async function closeDb() {
  await queryClient?.end({ timeout: 5 });
}
