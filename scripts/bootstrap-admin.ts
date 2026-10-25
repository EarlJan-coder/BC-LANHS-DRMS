import { emitKeypressEvents } from "node:readline";
import { createInterface } from "node:readline/promises";
import { createRequire } from "node:module";
import { stdin, stdout } from "node:process";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { users } from "../src/db/schema";
import { assertSessionSecretConfigured } from "../src/lib/session-token";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env");

loadEnvConfig(process.cwd());

function ask(question: string) {
  const terminal = createInterface({ input: stdin, output: stdout });
  return terminal.question(question).finally(() => terminal.close());
}

function askHidden(question: string) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    throw new Error("Run this command from an interactive terminal so the password can be entered without echoing it.");
  }

  emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();
  stdout.write(question);

  return new Promise<string>((resolve, reject) => {
    let value = "";
    const finish = (error?: Error) => {
      stdin.off("keypress", onKeypress);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };

    const onKeypress = (text: string | undefined, key: { name?: string; ctrl?: boolean; meta?: boolean }) => {
      if (key.ctrl && key.name === "c") {
        finish(new Error("Cancelled."));
        return;
      }

      if (key.name === "return" || key.name === "enter") {
        finish();
        return;
      }

      if (key.name === "backspace") {
        value = value.slice(0, -1);
        return;
      }

      if (text && !key.ctrl && !key.meta) {
        value += text;
      }
    };

    stdin.on("keypress", onKeypress);
  });
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }
  assertSessionSecretConfigured();

  const databaseHost = new URL(databaseUrl).hostname;
  console.log(`Target database host: ${databaseHost}`);
  console.log("Only run this command after verifying the administrator’s identity through the school’s trusted process.");

  if ((await ask('Type "CREATE FIRST ADMIN" to continue: ')).trim() !== "CREATE FIRST ADMIN") {
    throw new Error("First-admin bootstrap cancelled.");
  }

  const emailResult = z.string().trim().toLowerCase().email().max(191).safeParse(await ask("Administrator email: "));
  if (!emailResult.success) {
    throw new Error("Enter a valid email address (maximum 191 characters).");
  }

  const firstName = (await ask("First name: ")).trim();
  const lastName = (await ask("Last name: ")).trim();
  if (!firstName || firstName.length > 100 || !lastName || lastName.length > 100) {
    throw new Error("First and last names are required and must be no longer than 100 characters.");
  }

  const password = await askHidden("Password (8–72 bytes): ");
  const passwordConfirmation = await askHidden("Confirm password: ");
  const passwordBytes = new TextEncoder().encode(password).byteLength;
  if (password !== passwordConfirmation || passwordBytes < 8 || passwordBytes > 72) {
    throw new Error("Passwords must match and be between 8 and 72 bytes.");
  }

  const { closeDb, getDb } = await import("../src/db");
  const db = getDb();

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const created = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(49123017)`);

      const existingAdmin = await tx.query.users.findFirst({ where: eq(users.role, "admin") });
      if (existingAdmin) {
        throw new Error("An administrator already exists. Bootstrap is first-admin-only.");
      }

      const existingEmail = await tx.query.users.findFirst({ where: eq(users.email, emailResult.data) });
      if (existingEmail) {
        throw new Error("That email already has an account. Have an authorized administrator update its role.");
      }

      const [admin] = await tx
        .insert(users)
        .values({
          email: emailResult.data,
          firstName,
          lastName,
          passwordHash,
          role: "admin",
          status: "active",
          isActive: true,
        })
        .returning({ id: users.id, email: users.email });

      return admin;
    });

    console.log(`First administrator created for ${created.email}. Sign in with that email and the password entered above.`);
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "First-admin bootstrap failed.");
  process.exitCode = 1;
});
