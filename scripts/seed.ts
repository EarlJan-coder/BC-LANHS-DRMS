import { createRequire } from "node:module";
import { eq } from "drizzle-orm";
import {
  documentTypes,
  gradeLevels,
  schoolYears,
  sections,
  subjects,
  users,
} from "../src/db/schema";
import { DOCUMENT_TYPES } from "../src/lib/constants";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env");

loadEnvConfig(process.cwd());

async function main() {
  const { closeDb, getDb } = await import("../src/db");
  const db = getDb();

  try {
    await db.insert(schoolYears).values({ name: "2026-2027", isActive: true }).onConflictDoNothing();

    const levelValues = [
      { name: "Grade 7", order: 7 },
      { name: "Grade 8", order: 8 },
      { name: "Grade 9", order: 9 },
      { name: "Grade 10", order: 10 },
      { name: "Grade 11", order: 11 },
      { name: "Grade 12", order: 12 },
    ];

    await db.insert(gradeLevels).values(levelValues).onConflictDoNothing();

    const grade12 = await db.query.gradeLevels.findFirst({
      where: eq(gradeLevels.name, "Grade 12"),
    });

    if (grade12) {
      await db
        .insert(sections)
        .values([
          { name: "STEM - Aguado", gradeLevelId: grade12.id, adviserName: "Ms. Elena Garcia" },
          { name: "HUMSS - Rizal", gradeLevelId: grade12.id, adviserName: "Mr. Noel Ramos" },
        ])
        .onConflictDoNothing();

      await db
        .insert(subjects)
        .values([
          { code: "ENG-12", name: "English for Academic and Professional Purposes", gradeLevelId: grade12.id },
          { code: "GENMATH-12", name: "General Mathematics", gradeLevelId: grade12.id },
          { code: "FIL-12", name: "Filipino sa Piling Larang", gradeLevelId: grade12.id },
        ])
        .onConflictDoNothing();
    }

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
          clerkId: "seed_admin",
          email: "admin@lanhs.edu.ph",
          firstName: "System",
          lastName: "Administrator",
          role: "admin",
        },
        {
          clerkId: "seed_registrar",
          email: "registrar@lanhs.edu.ph",
          firstName: "LANHS",
          lastName: "Registrar",
          role: "registrar",
        },
      ])
      .onConflictDoNothing();

    console.log("Seed data inserted.");
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
