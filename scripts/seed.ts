import { createRequire } from "node:module";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { documentRequests, documentTypes, requestStatusHistory, students, users } from "../src/db/schema";
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
  const seedPassword = process.env.SEED_PASSWORD;

  if (!seedPassword || seedPassword.length < 8 || new TextEncoder().encode(seedPassword).byteLength > 72) {
    throw new Error("Set SEED_PASSWORD to a password between 8 and 72 bytes before seeding sample accounts.");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Sample seed data must not be created in production.");
  }

  const passwordHash = await bcrypt.hash(seedPassword, 12);

  try {
    await db
      .insert(documentTypes)
      .values(
        DOCUMENT_TYPES.map((name) => ({
          name,
          code: name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/_$/, ""),
          processingDays: name === "Form 137" ? 5 : 3,
          fee: "0",
          isActive: true,
        })),
      )
      .onConflictDoNothing();

    await db
      .insert(users)
      .values([
        {
          lrn: "111111111111",
          email: "admin@lanhs.edu.ph",
          passwordHash,
          firstName: "System",
          lastName: "Administrator",
          role: "admin",
          status: "active",
          registrationStatus: "approved",
        },
        {
          lrn: "222222222222",
          email: "registrar@lanhs.edu.ph",
          passwordHash,
          firstName: "LANHS",
          lastName: "Registrar",
          role: "registrar",
          status: "active",
          registrationStatus: "approved",
        },
        {
          lrn: "123456789012",
          email: "student@lanhs.edu.ph",
          passwordHash,
          firstName: "Maria",
          lastName: "Santos",
          role: "student",
          status: "active",
          registrationStatus: "approved",
        },
      ])
      .onConflictDoNothing();

    const registrar = await db.query.users.findFirst({ where: eq(users.email, "registrar@lanhs.edu.ph") });
    const studentUser = await db.query.users.findFirst({ where: eq(users.email, "student@lanhs.edu.ph") });
    const certificateType = await db.query.documentTypes.findFirst({
      where: eq(documentTypes.name, "Good Moral Certificate"),
    });

    if (studentUser) {
      await db
        .insert(students)
        .values({
          userId: studentUser.id,
          lrn: "123456789012",
          firstName: "Maria",
          middleName: "Reyes",
          lastName: "Santos",
          gender: "Female",
          email: "student@lanhs.edu.ph",
          contactNumber: "09170000001",
          address: "Luis Aguado community",
          lastSchoolYearAttended: "2025-2026",
          studentType: "current",
          status: "enrolled",
          enrollmentStatus: "enrolled",
        })
        .onConflictDoNothing();
    }

    const sampleStudent = await db.query.students.findFirst({ where: eq(students.lrn, "123456789012") });

    if (sampleStudent && studentUser && certificateType) {
      await db
        .insert(documentRequests)
        .values({
          trackingNumber: "LANHS-20260603-A8K2Q",
          studentId: sampleStudent.id,
          requestedByUserId: studentUser.id,
          documentTypeId: certificateType.id,
          purpose: "College scholarship application",
          schoolYearNeeded: "2026-2027",
          gradeLevelNeeded: "Grade 12",
          remarks: "Please include supporting school records.",
          status: "under_review",
          registrarRemarks: "Validated student profile.",
        })
        .onConflictDoNothing();

      const sampleRequest = await db.query.documentRequests.findFirst({
        where: eq(documentRequests.trackingNumber, "LANHS-20260603-A8K2Q"),
      });
      const hasHistory =
        sampleRequest &&
        (await db.query.requestStatusHistory.findFirst({
          where: eq(requestStatusHistory.requestId, sampleRequest.id),
        }));

      if (sampleRequest && !hasHistory) {
        await db.insert(requestStatusHistory).values([
          {
            requestId: sampleRequest.id,
            toStatus: "pending",
            actorUserId: studentUser.id,
            remarks: "Request submitted online.",
          },
          {
            requestId: sampleRequest.id,
            fromStatus: "pending",
            toStatus: "under_review",
            actorUserId: registrar?.id,
            remarks: "Registrar started validation.",
          },
        ]);
      }
    }

    console.log("Seed data inserted.");
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
